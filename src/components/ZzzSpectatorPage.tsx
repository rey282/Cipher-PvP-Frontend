import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../components/Landing.css";
import { Modal, Button } from "react-bootstrap";


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

/** Featured now supports characters and W-Engines (union) */
type FeaturedCfg =
  | {
      kind: "character";
      code: string;
      name?: string;
      image_url?: string;
      rule: "none" | "globalBan" | "globalPick";
      customCost?: number | null;
    }
  | {
      kind: "wengine";
      id: string;
      name?: string;
      image_url?: string;
      rule: "none" | "globalBan"; // spectator ignores globalPick for W-Engines
      customCost?: number | null;
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
  blueLocked?: boolean;
  redLocked?: boolean;
};

type SessionRow = {
  mode: "2v2" | "3v3";
  team1: string;
  team2: string;
  state: SpectatorState;
  featured?: FeaturedCfg[];
  is_complete?: boolean;
  last_activity_at?: string;
  completed_at?: string | null;

  costLimit?: number | null;
  penaltyPerPoint?: number | null;

  costProfileId?: string | null;
  costProfile?: {
    name?: string | null;
    charMs?: Record<string, number[]>;
    wePhase?: Record<string, number[]>;
  };
};


const MOBILE_QUERY = "(pointer:coarse), (max-width: 820px)";

/* ───────────── Sizing (match ZzzDraft) ───────────── */
const CARD_W = 170;
const CARD_H = 240;
const CARD_GAP = 12;
const CARD_MIN_SCALE = 0.68;

/* ───────────── Responsive row sizing ───────────── */
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

/* ───────────── Cost rules (match Draft) ───────────── */
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

/** Base WE cost at a given phase using the updated rules:
 *  - 4★ => 0 always
 *  - 5★ Limited: base 0.25 at P1, then +0 (P2), +0.25 (P3), +0.25 (P4), +0.25 (P5) => P5 = 0.75
 *  - 5★ Non-limited: base 0, then +0 (P2), +0.25 (P3), +0.25 (P4), +0.25 (P5) => P5 = 0.75
 */
function calcWEngineCostRaw(we: WEngine | undefined, refine: number): number {
  if (!we) return 0;
  const r = Math.max(1, Math.min(5, refine)); // P1..P5
  if (we.rarity <= 4) return 0;

  if (we.limited) {
    // P1 0.25, P2 +0, P3 +0.25, P4 +0.25, P5 +0.25
    let total = 0.25;
    if (r >= 3) total += 0.25;
    if (r >= 4) total += 0.25;
    if (r >= 5) total += 0.25; // P5 => 0.75
    return Number(total.toFixed(2));
  } else {
    // non-limited: P1 0, P2 +0, P3 +0.25, P4 +0.25, P5 +0.25
    let total = 0;
    if (r >= 3) total += 0.25;
    if (r >= 4) total += 0.25;
    if (r >= 5) total += 0.25; // P5 => 0.75
    return Number(total.toFixed(2));
  }
}

/** Like characters: base-at-P1 + delta(Px - P1); base may be overridden by featured customCost */
function calcWEngineCostWithBase(
  we: WEngine | undefined,
  refine: number,
  featuredBaseOverride: number | undefined
): number {
  if (!we) return 0;
  const normalAtP1 = calcWEngineCostRaw(we, 1);
  const normalAtPx = calcWEngineCostRaw(we, refine);
  const delta = Number((normalAtPx - normalAtP1).toFixed(2));
  const base =
    typeof featuredBaseOverride === "number"
      ? featuredBaseOverride
      : normalAtP1;
  return Number((base + delta).toFixed(2));
}

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
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);

  useEffect(() => {
    if (isMobile) {
      navigate("/", {
        replace: true,
        state: { blocked: "zzz-spectator-mobile" },
      });
    }
  }, [isMobile, navigate]);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [wengines, setWengines] = useState<WEngine[]>([]);

  // Refs + row scales
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

  // Dynamic cost settings coming from backend (fallback to mode defaults)
  const COST_LIMIT =
    typeof session?.costLimit === "number"
      ? session.costLimit
      : is3v3
      ? 24
      : 16;


  const PENALTY_PER_POINT =
    typeof session?.penaltyPerPoint === "number"
      ? session.penaltyPerPoint
      : 2500;

  const blueCount = draftSequence.filter((s) => s.startsWith("B")).length;
  const redCount = draftSequence.filter((s) => s.startsWith("R")).length;
  const blueScale = useRowScale(blueRowRef, blueCount);
  const redScale = useRowScale(redRowRef, redCount);

  // Name labels
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

  /* ───────── Featured helpers (hydrate + overrides) ───────── */
  const normalizeFeatured = (list: any[]): FeaturedCfg[] => {
    return (Array.isArray(list) ? list : []).map((f: any) => {
      if (f?.kind === "wengine" || f?.id) {
        return {
          kind: "wengine" as const,
          id: String(f.id),
          name: f.name ?? undefined,
          image_url: f.image_url ?? undefined,
          // spectator only cares about none/globalBan for WE
          rule: f.rule === "globalBan" ? "globalBan" : "none",
          customCost: typeof f.customCost === "number" ? f.customCost : null,
        };
      }
      // default: character
      return {
        kind: "character" as const,
        code: String(f.code),
        name: f.name ?? undefined,
        image_url: f.image_url ?? undefined,
        rule:
          f.rule === "globalBan" || f.rule === "globalPick" ? f.rule : "none",
        customCost: typeof f.customCost === "number" ? f.customCost : null,
      };
    });
  };

  const featuredList: FeaturedCfg[] = normalizeFeatured(
    session?.featured || []
  );

  const [showSettings, setShowSettings] = useState(false);

  const displayCostProfileName = useMemo(() => {
    const raw = session?.costProfile?.name ?? "";
    return raw.trim() ? raw.trim() : "Vivian (Default)";
  }, [session?.costProfile?.name]);

  const featuredCostOverride = useMemo(
    () =>
      new Map<string, number>(
        featuredList
          .filter(
            (f): f is Extract<FeaturedCfg, { kind: "character" }> =>
              f.kind === "character"
          )
          .filter((f) => typeof f.customCost === "number" && !!f.code)
          .map((f) => [f.code, f.customCost as number])
      ),
    [featuredList]
  );

  const featuredWeCostOverride = useMemo(
    () =>
      new Map<string, number>(
        featuredList
          .filter(
            (f): f is Extract<FeaturedCfg, { kind: "wengine" }> =>
              f.kind === "wengine"
          )
          .filter((f) => typeof f.customCost === "number" && !!f.id)
          .map((f) => [String(f.id), f.customCost as number])
      ),
    [featuredList]
  );

  // LIVE badge (optional, to match draft page vibe)
  const isComplete = !!session?.is_complete || !!session?.completed_at;
  const isLive =
    !isComplete &&
    !!session?.last_activity_at &&
    Date.now() - new Date(session.last_activity_at).getTime() <
      2 * 60 * 60 * 1000;

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

  /* ───────────── Load Backend Default Costs (Minimal Patch) ───────────── */
  const [zzzDefaultCharMs, setZzzDefaultCharMs] = useState<
    Record<string, number[]>
  >({});
  const [zzzDefaultWePhase, setZzzDefaultWePhase] = useState<
    Record<string, number[]>
  >({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [charCostRes, weCostRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/balance`, {
            credentials: "include",
          }),
          fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/wengine-balance`, {
            credentials: "include",
          }),
        ]);

        if (!charCostRes.ok || !weCostRes.ok)
          throw new Error("Failed to load ZZZ cost tables");

        const charCostData = await charCostRes.json();
        const weCostData = await weCostRes.json();
        if (cancelled) return;

        const cm: Record<string, number[]> = {};
        (charCostData.characters || []).forEach((c: any) => {
          const arr = Array.isArray(c.costs) ? c.costs.map(Number) : [];
          cm[c.id] = arr.length === 7 ? arr : Array(7).fill(0);
        });

        const wp: Record<string, number[]> = {};
        (weCostData.wengines || []).forEach((w: any) => {
          const arr = Array.isArray(w.costs) ? w.costs.map(Number) : [];
          wp[String(w.id)] = arr.length === 5 ? arr : Array(5).fill(0);
        });

        setZzzDefaultCharMs(cm);
        setZzzDefaultWePhase(wp);
      } catch (e) {
        console.error("ZZZ backend cost load failed", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

   const costCharMs = session?.costProfile?.charMs ?? zzzDefaultCharMs ?? {};

   const costWePhase = session?.costProfile?.wePhase ?? zzzDefaultWePhase ?? {};

  /* Subscribe to live spectator session via SSE */
  useEffect(() => {
    if (!key || isMobile) return;

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

  function getSlotCost(p: SpectatorState["picks"][number]) {
    if (!p) return { agentCost: 0, weCost: 0, total: 0 };

    const char = charByCode.get(p.characterCode);
    const we = p.wengineId ? weById.get(String(p.wengineId)) : undefined;

    // --- Character cost (featured base + preset delta) ---
    let agentCost = 0;
    if (char) {
      const row = costCharMs[char.code]; // preset row [M0..M6]
      const featuredBase = featuredCostOverride.get(char.code);

      if (Array.isArray(row) && row.length === 7) {
        // base: featured customCost (if any) else preset M0
        const baseAtM0 =
          typeof featuredBase === "number"
            ? featuredBase
            : Number((row[0] || 0).toFixed(2));
        const atMx = Number(
          (row[Math.max(0, Math.min(6, p.eidolon))] || 0).toFixed(2)
        );
        const delta = Number((atMx - (row[0] || 0)).toFixed(2));
        agentCost = Number((baseAtM0 + delta).toFixed(2));
      } else {
        // fallback: featured base over normal rule-based delta
        const normalAtM0 = calcAgentCost(char, 0);
        const normalAtMx = calcAgentCost(char, p.eidolon);
        const delta = Number((normalAtMx - normalAtM0).toFixed(2));
        const base =
          typeof featuredBase === "number" ? featuredBase : normalAtM0;
        agentCost = Number((base + delta).toFixed(2));
      }
    }

    // --- W-Engine cost ---
    let weCost = 0;
    if (we) {
      const row = costWePhase[String(we.id)];
      if (Array.isArray(row) && row.length === 5) {
        weCost = Number(
          (row[Math.max(1, Math.min(5, p.superimpose)) - 1] || 0).toFixed(2)
        );
      } else {
        const baseOverride = featuredWeCostOverride.get(String(we.id));
        weCost = calcWEngineCostWithBase(we, p.superimpose, baseOverride);
      }
    }

    const total = Number((agentCost + weCost).toFixed(2));
    return { agentCost, weCost, total };
  }

  const getTeamCost = (prefix: "B" | "R") => {
    let total = 0;
    const picks = state?.picks ?? [];
    for (let i = 0; i < draftSequence.length; i++) {
      const step = draftSequence[i];
      if (!step.startsWith(prefix)) continue;
      if (step === "BB" || step === "RR") continue;

      const slot = picks[i];
      const { total: t } = getSlotCost(slot);
      total += t;
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

  const draftComplete =
    (state?.currentTurn ?? 0) >= (state?.draftSequence?.length ?? 0);
  const blueLocked = !!state?.blueLocked;
  const redLocked = !!state?.redLocked;

  // Featured metadata hydration for display
  const resolveFeaturedMeta = (f: FeaturedCfg) => {
    if (f.kind === "character") {
      const c = f.code ? charByCode.get(f.code) : undefined;
      return {
        title: c?.name ?? f.name ?? (f.code || "Unknown"),
        image: c?.image_url ?? f.image_url ?? "",
      };
    } else {
      const w = f.id ? weById.get(String(f.id)) : undefined;
      return {
        title: w?.name ?? f.name ?? (f.id ? String(f.id) : "Unknown"),
        image: w?.image_url ?? f.image_url ?? "",
      };
    }
  };

  if (isMobile) return null;

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

        {/* Top-right stack: LIVE (if any) + Settings */}
        <div
          className="position-absolute"
          style={{ top: 70, right: 20, zIndex: 10 }}
        >
          {isLive && !draftComplete && (
            <div>
              <span
                className="badge bg-danger d-block"
                style={{
                  fontWeight: 800,
                  letterSpacing: 1,
                  padding: "8px 12px",
                }}
              >
                LIVE
              </span>
            </div>
          )}

          {/* Read-only settings button (mirrors HSR) */}
          <div className="mb-3 w-100 d-flex justify-content-center">
            <button
              type="button"
              className="btn btn-sm btn-glass"
              title="View settings"
              onClick={() => setShowSettings(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span aria-hidden="true">⚙️</span>
            </button>
          </div>
        </div>
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
            const locked = prefix === "B" ? blueLocked : redLocked;

            return (
              <div className="w-100 text-center" key={prefix}>
                <div className="team-header">
                  <div className="team-title" style={{ color }}>
                    <span
                      className="team-dot"
                      style={{ backgroundColor: color }}
                    />
                    {name}
                    {draftComplete && locked && (
                      <span
                        className="badge bg-secondary ms-2"
                        title="Draft locked"
                      >
                        🔒 Locked
                      </span>
                    )}
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
                          {draftComplete && locked && (
                            <div
                              title="Draft locked"
                              style={{
                                position: "absolute",
                                top: 6,
                                left: 6,
                                fontSize: 16,
                                opacity: 0.9,
                              }}
                            >
                              🔒
                            </div>
                          )}

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

                            const { agentCost, weCost, total } = getSlotCost(p);

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

        {/* ───────────── Featured (characters + W-Engines, hydrated) ───────────── */}
        {featuredList.length > 0 && (
          <div
            className="featured-wrap"
            style={{
              marginTop: 16,
              marginBottom: 12,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div
              className="d-flex align-items-center justify-content-between flex-wrap gap-2"
              style={{ marginBottom: 10 }}
            >
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontWeight: 700 }}>Featured</span>
                <span className="text-white-50 small">
                  ({featuredList.length}
                  {featuredList.length === 1 ? " item" : " items"})
                </span>
              </div>
              <div className="text-white-50 small">
                Cost shown is the M0 (or P1) override if set. Rules still apply.
              </div>
            </div>

            <div
              className="featured-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              {featuredList.map((f) => {
                const ruleColor =
                  f.rule === "globalBan"
                    ? "#ef4444"
                    : f.rule === "globalPick"
                    ? "#f59e0b"
                    : "rgba(255,255,255,0.18)";
                const ruleLabel =
                  f.rule === "globalBan"
                    ? "Uni Ban"
                    : f.rule === "globalPick"
                    ? "Uni Pick"
                    : "No Rule";

                const meta = resolveFeaturedMeta(f);
                const keyStr = f.kind === "character" ? f.code : `we-${f.id}`;

                return (
                  <div
                    key={keyStr}
                    className="featured-card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 10,
                      borderRadius: 10,
                      background:
                        "linear-gradient(0deg, rgba(255,255,255,0.03), rgba(255,255,255,0.03))",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    title={ruleLabel}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 8,
                        overflow: "hidden",
                        flex: "0 0 52px",
                        background: "rgba(0,0,0,0.3)",
                      }}
                    >
                      {meta.image ? (
                        <img
                          src={meta.image}
                          alt={meta.title}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <div
                          className="d-flex align-items-center justify-content-center text-white-50"
                          style={{
                            width: "100%",
                            height: "100%",
                            fontSize: 12,
                          }}
                        >
                          {f.kind === "character"
                            ? (f as any).code
                            : (f as any).id}
                        </div>
                      )}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        className="text-truncate"
                        style={{ fontWeight: 600, lineHeight: 1.2 }}
                        title={meta.title}
                      >
                        {meta.title}
                      </div>

                      <div className="d-flex align-items-center gap-2 mt-1">
                        <span
                          className="badge"
                          style={{
                            backgroundColor: ruleColor,
                            border: "1px solid rgba(0,0,0,0.2)",
                            color:
                              f.rule === "none"
                                ? "rgba(255,255,255,0.85)"
                                : "white",
                          }}
                        >
                          {ruleLabel}
                        </span>
                        {typeof (f as any).customCost === "number" && (
                          <span className="text-white-50 small">
                            Cost:{" "}
                            <strong style={{ color: "white" }}>
                              {(f as any).customCost.toFixed(2)}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

      <Modal
        show={showSettings}
        onHide={() => setShowSettings(false)}
        centered
        contentClassName="custom-dark-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Match Settings</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <div className="fw-semibold">Active Cost Preset</div>
            <span
              className="badge bg-warning text-dark"
              title="Active cost preset"
              style={{ fontWeight: 700, padding: "8px 12px" }}
            >
              {displayCostProfileName}
            </span>
          </div>

          <div className="mb-3">
            <label className="form-label fw-semibold">Cost limit</label>
            <input
              type="number"
              className="form-control"
              value={COST_LIMIT}
              readOnly
              disabled
            />
            <small className="text-white-50">Team draft cost cap.</small>
          </div>

          <div className="mb-2">
            <label className="form-label fw-semibold">
              Penalty per 0.01 over cap
            </label>
            <input
              type="number"
              className="form-control"
              value={PENALTY_PER_POINT}
              readOnly
              disabled
            />
            <small className="text-white-50">
              Points deducted for each 0.01 over the cost limit.
            </small>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSettings(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <ReconnectingBadge show={reconnecting && !loading && !notFound} />
    </div>
  );
}
