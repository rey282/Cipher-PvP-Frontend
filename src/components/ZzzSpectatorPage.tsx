import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../components/Landing.css";

/* ───────────── Types ───────────── */
type Character = {
  code: string;
  name: string;
  subname?: string;
  rarity: number; // 5 = S, 4 = A
  image_url: string;
  limited: boolean;
};

type WEngine = {
  id: string;
  name: string;
  subname?: string;
  rarity: number;
  image_url: string;
  limited: boolean;
};

type SpectatorState = {
  draftSequence: string[];
  currentTurn: number;
  picks: Array<{
    characterCode: string;
    eidolon: number;
    wengineId: string | null;
    superimpose: number;
  } | null>;
  blueScores: number[];
  redScores: number[];
};

type SessionRow = {
  mode: "2v2" | "3v3";
  team1: string;
  team2: string;
  state: SpectatorState;
  is_complete?: boolean;
  last_activity_at?: string;
  completed_at?: string | null;
};

/* ───────────── Sizing (match ZzzDraft) ───────────── */
const CARD_W = 170; // px
const CARD_H = 240; // px
const CARD_GAP = 12; // px
const CARD_MIN_SCALE = 0.68; // same minimum scale

/* ───────────── Responsive row sizing (robust) ───────────── */
function useRowScale<T extends HTMLElement>(
  ref: React.MutableRefObject<T | null>,
  cardCount: number
) {
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const compute = () => {
      const available = el.clientWidth || 0;
      if (!Number.isFinite(cardCount) || cardCount <= 0) {
        setScale(1);
        return;
      }
      const gaps = Math.max(0, cardCount - 1);
      const needed = cardCount * CARD_W + gaps * CARD_GAP;
      const s = Math.min(
        1,
        Math.max(CARD_MIN_SCALE, needed ? available / needed : 1)
      );
      setScale(s);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [ref, cardCount]);

  return scale;
}

/* ───────────── Cost rules (match ZzzDraft) ───────────── */
function calcAgentCost(agent: Character, mindscape: number): number {
  const ms = Math.max(0, Math.min(6, mindscape));
  if (agent.rarity === 4) return 0.5;
  if (agent.rarity === 5) {
    if (agent.limited) {
      const bumps = [1, 2, 4, 6].filter((m) => ms >= m).length;
      return 1 + 0.5 * bumps;
    } else {
      return ms >= 6 ? 1.5 : 1;
    }
  }
  return 0;
}
function calcWEngineCost(we: WEngine | undefined, refine: number): number {
  if (!we) return 0;
  const r = Math.max(0, Math.min(5, refine));
  if (we.rarity <= 4) return 0;
  if (we.limited) return r >= 3 ? 0.5 : 0.25;
  return r >= 3 ? 0.25 : 0;
}
const PENALTY_PER_POINT = 2500;

/* ───────────── Floating reconnect badge ───────────── */
function ReconnectingBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return <div className="sse-indicator">Reconnecting… trying again</div>;
}

/* ───────────── Component ───────────── */
export default function ZzzSpectatorPage() {
  const { key } = useParams<{ key: string }>();

  // Stable top-level state
  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [wengines, setWengines] = useState<WEngine[]>([]);

  // Refs + row scales (always exist)
  const blueRowRef = useRef<HTMLDivElement>(null);
  const redRowRef = useRef<HTMLDivElement>(null);

  // Derived (safe defaults while loading)
  const mode: "2v2" | "3v3" = session?.mode ?? "2v2";
  const is3v3 = mode === "3v3";
  const state: SpectatorState | null = session?.state ?? null;

  const draftSequence = state?.draftSequence ?? [];
  const currentTurn = state?.currentTurn ?? 0;

  const team1Name = session?.team1 ?? "Blue Team";
  const team2Name = session?.team2 ?? "Red Team";

  const blueScores = state?.blueScores ?? (is3v3 ? [0, 0, 0] : [0, 0]);
  const redScores = state?.redScores ?? (is3v3 ? [0, 0, 0] : [0, 0]);

  const COST_LIMIT = is3v3 ? 9 : 6;

  const blueCount = draftSequence.filter((s) => s.startsWith("B")).length;
  const redCount = draftSequence.filter((s) => s.startsWith("R")).length;
  const blueScale = useRowScale(blueRowRef, blueCount);
  const redScale = useRowScale(redRowRef, redCount);

  // Name labels (generic; you stored only team strings)
  const buildNameLabels = (raw: string, count: number) => {
    const parts = (raw || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    const primary = parts.find(Boolean) || "";
    return Array(count)
      .fill("")
      .map((_, i) => parts[i] || primary || `Player ${i + 1}`);
  };
  const nameLabelsBlue = buildNameLabels(team1Name, is3v3 ? 3 : 2);
  const nameLabelsRed = buildNameLabels(team2Name, is3v3 ? 3 : 2);

  // Indexers
  const charByCode = useMemo(() => {
    const m = new Map<string, Character>();
    for (const c of characters) m.set(c.code, c);
    return m;
  }, [characters]);
  const weById = useMemo(() => {
    const m = new Map<string, WEngine>();
    for (const w of wengines) m.set(String(w.id), w);
    return m;
  }, [wengines]);

  /* Load static data once */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [charRes, weRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/characters`, {
            credentials: "include",
          }),
          fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/wengines`, {
            credentials: "include",
          }),
        ]);
        if (!charRes.ok || !weRes.ok) throw new Error("Static fetch failed");
        const [charData, weData] = await Promise.all([
          charRes.json(),
          weRes.json(),
        ]);
        if (!cancelled) {
          setCharacters(charData.data || []);
          setWengines(weData.data || []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Subscribe to live spectator session via SSE (with reconnect flag) */
  useEffect(() => {
    if (!key) return;

    setLoading(true);
    setNotFound(false);
    setError(null);
    setReconnecting(false);

    const url = `${
      import.meta.env.VITE_API_BASE
    }/api/zzz/sessions/${key}/stream`;
    const es = new EventSource(url);

    es.onopen = () => {
      setReconnecting(false);
      setLoading(false);
    };

    const onSnapshot = (e: MessageEvent) => {
      setSession(JSON.parse(e.data));
      setLoading(false);
      setReconnecting(false);
    };
    const onUpdate = (e: MessageEvent) => {
      setSession(JSON.parse(e.data));
      setReconnecting(false);
    };
    const onNotFound = () => {
      setNotFound(true);
      setLoading(false);
      setReconnecting(false);
      es.close();
    };

    es.onerror = () => {
      if (!notFound) setReconnecting(true);
    };

    es.addEventListener("snapshot", onSnapshot);
    es.addEventListener("update", onUpdate);
    es.addEventListener("not_found", onNotFound);

    return () => {
      es.removeEventListener("snapshot", onSnapshot);
      es.removeEventListener("update", onUpdate);
      es.removeEventListener("not_found", onNotFound);
      es.close();
      setReconnecting(false);
    };
  }, [key]);

  /* Helpers */
  const getTeamCost = (prefix: "B" | "R") => {
    let total = 0;
    const picks = state?.picks ?? [];
    for (let i = 0; i < draftSequence.length; i++) {
      const step = draftSequence[i];
      if (!step.startsWith(prefix)) continue;
      if (step === "BB" || step === "RR") continue;

      const p = picks[i];
      if (!p) continue;

      const char = charByCode.get(p.characterCode);
      if (!char) continue; // not resolved yet
      const we = p.wengineId ? weById.get(String(p.wengineId)) : undefined;

      const agentCost = calcAgentCost(char, p.eidolon);
      const weCost = calcWEngineCost(we, p.superimpose);
      total += agentCost + weCost;
    }
    const penalty = Math.max(0, total - COST_LIMIT);
    const penaltyPoints = Math.floor(penalty / 0.25) * PENALTY_PER_POINT;
    return { total: Number(total.toFixed(2)), penaltyPoints };
  };

  const team1Cost = getTeamCost("B");
  const team2Cost = getTeamCost("R");
  const blueTotal =
    blueScores.reduce((a, b) => a + b, 0) - team1Cost.penaltyPoints;
  const redTotal =
    redScores.reduce((a, b) => a + b, 0) - team2Cost.penaltyPoints;

  /* ───────────── Render ───────────── */
  return (
    <div
      className="page-fade-in"
      style={{
        backgroundImage: "url('/zzzdraft.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      />
      <div className="position-relative z-2 text-white px-4">
        <Navbar />
      </div>

      <div
        className="position-relative z-2 text-white px-2 px-md-4"
        style={{ maxWidth: "1600px", margin: "0 auto" }}
      >
        {/* Status strip */}
        {loading && (
          <div className="text-center my-4 text-white-50">
            Loading live draft…
          </div>
        )}
        {notFound && !loading && (
          <div className="text-center my-4 text-warning">
            Spectator session not found or expired.
          </div>
        )}
        {error && !loading && !notFound && (
          <div className="text-center my-4 text-danger">{error}</div>
        )}

        {/* Draft rows (read-only) */}
        <div className="d-flex flex-column align-items-center gap-3 mb-4">
          {(["B", "R"] as const).map((prefix) => {
            const name = prefix === "B" ? team1Name : team2Name;
            const color = prefix === "B" ? "#3388ff" : "#cc3333";
            const ref = prefix === "B" ? blueRowRef : redRowRef;
            const scale = prefix === "B" ? blueScale : redScale;
            const cost = prefix === "B" ? team1Cost : team2Cost;

            return (
              <div className="w-100 text-center" key={prefix}>
                <div className="team-header">
                  <div className="team-title" style={{ color }}>
                    <span
                      className="team-dot"
                      style={{ backgroundColor: color }}
                    />
                    {name}
                  </div>
                  <div
                    className={`team-cost ${
                      cost.total > COST_LIMIT ? "over" : ""
                    }`}
                  >
                    Cost: {cost.total} / {COST_LIMIT}
                  </div>
                </div>

                <div ref={ref} className="draft-row-wrap">
                  <div
                    className="draft-row"
                    style={
                      {
                        // CSS variables used by the stylesheet:
                        "--card-scale": scale,
                        "--card-w": `${CARD_W}px`,
                        "--card-h": `${CARD_H}px`,
                        "--card-gap": `${CARD_GAP}px`,
                      } as React.CSSProperties
                    }
                  >
                    {draftSequence.map((side, i) =>
                      side.startsWith(prefix) ? (
                        <div
                          key={i}
                          className={[
                            "draft-card",
                            side.includes("ACE") ? "ace" : "",
                            side === "BB" || side === "RR" ? "ban" : "",
                            prefix === "B" ? "blue" : "red",
                            i === currentTurn ? "active" : "",
                          ].join(" ")}
                          style={{ zIndex: 10 }}
                        >
                          {/* Ribbon when empty */}
                          {(() => {
                            const p = state?.picks?.[i] ?? null;
                            const isBanSlot = side === "BB" || side === "RR";
                            const isAceSlot = side.includes("ACE");
                            const showRibbon = !p && (isBanSlot || isAceSlot);
                            if (!showRibbon) return null;
                            return (
                              <div
                                className={`ribbon ${
                                  isAceSlot ? "ace" : "ban"
                                }`}
                              >
                                {isAceSlot ? "ACE" : "BAN"}
                              </div>
                            );
                          })()}

                          {(() => {
                            const p = state?.picks?.[i] ?? null;
                            if (!p) {
                              return (
                                <div className="d-flex w-100 h-100 align-items-center justify-content-center text-white-50">
                                  #{i + 1}
                                </div>
                              );
                            }
                            const char = charByCode.get(p.characterCode);
                            const we = p.wengineId
                              ? weById.get(String(p.wengineId))
                              : undefined;
                            const isBanSlot = side === "BB" || side === "RR";

                            const agentCost = char
                              ? calcAgentCost(char, p.eidolon)
                              : 0;
                            const weCost = we
                              ? calcWEngineCost(we, p.superimpose)
                              : 0;
                            const total = Number(
                              (agentCost + weCost).toFixed(2)
                            );

                            return (
                              <>
                                {/* Character image */}
                                {char ? (
                                  <img
                                    src={char.image_url}
                                    alt={char.name}
                                    className="draft-img"
                                    style={{
                                      filter: isBanSlot
                                        ? "grayscale(100%) brightness(0.5)"
                                        : "none",
                                    }}
                                  />
                                ) : (
                                  <div className="d-flex w-100 h-100 align-items-center justify-content-center text-white-50">
                                    (loading)
                                  </div>
                                )}

                                {/* Engine badge (read-only) */}
                                {we && (
                                  <img
                                    src={we.image_url}
                                    alt={we.name}
                                    title={we.name}
                                    className="engine-badge"
                                  />
                                )}

                                {/* Bottom info (read-only) */}
                                <div className="info-bar">
                                  <div
                                    className="char-name"
                                    title={char?.name || ""}
                                  >
                                    {char?.name || ""}
                                  </div>

                                  {!isBanSlot && (
                                    <div className="chip-row">
                                      <span
                                        className="chip chip-left"
                                        title="Mindscape"
                                      >
                                        M{p.eidolon}
                                      </span>
                                      <span
                                        className="chip cost chip-center"
                                        title={`Agent ${agentCost} + W-Eng ${weCost}`}
                                      >
                                        {total}
                                      </span>
                                      {we ? (
                                        <span
                                          className="chip chip-right"
                                          title="Phase"
                                        >
                                          P{p.superimpose}
                                        </span>
                                      ) : (
                                        <span
                                          className="chip-spacer"
                                          aria-hidden="true"
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Read-only scoring */}
        {state && (
          <div
            className="score-row d-flex flex-column flex-md-row gap-3 px-2 mt-4"
            style={{ maxWidth: 1000, margin: "0 auto" }}
          >
            {(["B", "R"] as const).map((side) => {
              const isBlue = side === "B";
              const scores = isBlue ? blueScores : redScores;
              const labels = isBlue ? nameLabelsBlue : nameLabelsRed;
              const { total, penaltyPoints } =
                side === "B" ? team1Cost : team2Cost;
              const adjustedTotal =
                scores.reduce((a, b) => a + b, 0) - penaltyPoints;

              return (
                <div
                  key={side}
                  className={`score-card ${isBlue ? "blue" : "red"} w-100`}
                >
                  <div className="score-header">
                    <div className="score-title">
                      {isBlue ? (
                        <span style={{ color: "#3388ff", fontWeight: 700 }}>
                          Blue Team
                        </span>
                      ) : (
                        <span style={{ color: "#cc3333", fontWeight: 700 }}>
                          Red Team
                        </span>
                      )}
                    </div>
                    <div
                      className={`score-draft ${
                        total > COST_LIMIT ? "over" : ""
                      }`}
                    >
                      Cost: {total} / {COST_LIMIT}
                    </div>
                  </div>

                  <div className="score-inputs">
                    {(is3v3 ? [0, 1, 2] : [0, 1]).map((i) => (
                      <div className="score-input-group" key={i}>
                        <label>{labels[i]}</label>
                        <div
                          className="form-control score-input"
                          style={{ opacity: 0.9 }}
                        >
                          {scores[i] || 0}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="score-total">
                    <div className="score-total-label">Team Total</div>
                    <div className="score-total-value">
                      {scores.reduce((a, b) => a + b, 0)}
                      {penaltyPoints > 0 && (
                        <span className="score-penalty">
                          −{penaltyPoints} ={" "}
                          <span className="score-adjusted">
                            {adjustedTotal}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Winner strip */}
        {state && (
          <div className="text-center mt-4 text-white">
            {blueTotal > redTotal ? (
              <h4 style={{ color: "#3388ff" }}>🏆 {team1Name} Wins!</h4>
            ) : redTotal > blueTotal ? (
              <h4 style={{ color: "#cc3333" }}>🏆 {team2Name} Wins!</h4>
            ) : (
              <h4 className="text-warning">Draw!</h4>
            )}
          </div>
        )}
      </div>

      {/* floating, layout-safe reconnect badge */}
      <ReconnectingBadge show={reconnecting && !loading && !notFound} />
    </div>
  );
}
