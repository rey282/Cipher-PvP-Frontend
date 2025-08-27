import { useEffect, useState, useRef } from "react";
import Navbar from "../components/Navbar";
import "../components/Landing.css";
import { useLocation } from "react-router-dom";
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
  rarity: number; // 5 = S, 4/A/B below
  image_url: string;
  limited: boolean;
};

type DraftPick = {
  character: Character;
  eidolon: number; // Mindscape M0..M6
  wengine?: WEngine;
  superimpose: number; // W1..W5 (1..5)
};

const SCORE_MIN = 0;
const SCORE_MAX = 65000;

/* ───────────── Responsive row sizing ───────────── */
// Base card metrics (match your CSS defaults)
const CARD_W = 170; // px
const CARD_H = 240; // px
const CARD_GAP = 12; // px
const CARD_MIN_SCALE = 0.68; // smallest we allow cards to get

function useRowScale<T extends HTMLElement>(
  ref: React.MutableRefObject<T | null>,
  cardCount: number
) {
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    const compute = () => {
      const available = el.clientWidth;
      const needed = cardCount * CARD_W + (cardCount - 1) * CARD_GAP;
      const s = Math.min(1, Math.max(CARD_MIN_SCALE, available / needed));
      setScale(s);
    };

    compute();

    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    window.addEventListener("resize", compute);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [ref, cardCount]);

  return scale;
}

/* ───────────── Cost Rules Helpers ───────────── */
function calcAgentCost(agent: Character, mindscape: number): number {
  const ms = Math.max(0, Math.min(6, mindscape));
  if (agent.rarity === 4) return 0.5; // All A Rank agents: 0.5 flat

  if (agent.rarity === 5) {
    if (agent.limited) {
      // Limited S Rank agent: +0.5 at M1, M2, M4, M6 (M3 & M5 skipped)
      const bumpMilestones = [1, 2, 4, 6];
      const bumps = bumpMilestones.filter((m) => ms >= m).length;
      return 1 + 0.5 * bumps;
    } else {
      // Standard S Rank agent: 1.0 base, 1.5 at M6
      return ms >= 6 ? 1.5 : 1;
    }
  }
  return 0;
}

function calcWEngineCost(we: WEngine | undefined, refine: number): number {
  if (!we) return 0;
  const r = Math.max(0, Math.min(5, refine));
  if (we.rarity <= 4) return 0; // A & B Rank: 0 cost
  if (we.limited) return r >= 3 ? 0.5 : 0.25; // Limited S
  return r >= 3 ? 0.25 : 0; // Standard S
}

/* ───────────── Penalty ───────────── */
const PENALTY_PER_POINT = 2500; // per 0.25 above cap

export default function ZzzDraftPage() {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const mode = query.get("mode") || "2v2";
  const is3v3 = mode === "3v3";
  const COST_LIMIT = is3v3 ? 9 : 6;

  const draftSequence: string[] = is3v3
    ? [
        "B",
        "R",
        "R",
        "B",
        "RR",
        "BB",
        "R",
        "B",
        "B(ACE)",
        "R(ACE)",
        "R",
        "B",
        "B",
        "R",
        "R",
        "B",
        "B(ACE)",
        "R(ACE)",
        "R",
        "B",
      ]
    : [
        "B",
        "R",
        "R",
        "B",
        "RR",
        "BB",
        "R",
        "B",
        "B",
        "R",
        "R(ACE)",
        "B(ACE)",
        "B",
        "R",
      ];

  const [characters, setCharacters] = useState<Character[]>([]);
  const [wengines, setWengines] = useState<WEngine[]>([]);
  const [draftPicks, setDraftPicks] = useState<(DraftPick | null)[]>(
    Array(draftSequence.length).fill(null)
  );
  const [currentTurn, setCurrentTurn] = useState(0);
  const [, setError] = useState<string | null>(null);

  const [eidolonOpenIndex, setEidolonOpenIndex] = useState<number | null>(null);
  const [superOpenIndex, setSuperOpenIndex] = useState<number | null>(null);

  const [showWengineModal, setShowWengineModal] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [selectedWengineId, setSelectedWengineId] = useState<string>("");
  const [wengineSearch, setWengineSearch] = useState("");
  const [keyboardSearch, setKeyboardSearch] = useState("");

  const eidolonRefs = useRef<(HTMLDivElement | null)[]>([]);
  const superimposeRefs = useRef<(HTMLDivElement | null)[]>([]);

  const draftComplete = currentTurn >= draftSequence.length;

  const team1Name = query.get("team1") || "Blue Team";
  const team2Name = query.get("team2") || "Red Team";

  const [blueScores, setBlueScores] = useState<number[]>(
    is3v3 ? [0, 0, 0] : [0, 0]
  );
  const [redScores, setRedScores] = useState<number[]>(
    is3v3 ? [0, 0, 0] : [0, 0]
  );

  const bannedCodes = draftPicks
    .map((pick, i) =>
      draftSequence[i] === "BB" || draftSequence[i] === "RR"
        ? pick?.character.code
        : null
    )
    .filter(Boolean) as string[];

  /* Row refs + scales (hooks must be outside maps) */
  const blueRowRef = useRef<HTMLDivElement>(null);
  const redRowRef = useRef<HTMLDivElement>(null);
  const blueCount = draftSequence.filter((s) => s.startsWith("B")).length;
  const redCount = draftSequence.filter((s) => s.startsWith("R")).length;
  const blueScale = useRowScale(blueRowRef, blueCount);
  const redScale = useRowScale(redRowRef, redCount);

  function getSlotCost(pick: DraftPick | null | undefined) {
    if (!pick) return { agentCost: 0, weCost: 0, total: 0 };
    const agentCost = calcAgentCost(pick.character, pick.eidolon);
    const weCost = calcWEngineCost(pick.wengine, pick.superimpose);
    return {
      agentCost,
      weCost,
      total: Number((agentCost + weCost).toFixed(2)),
    };
  }

  /* ───────────── Data Fetch ───────────── */
  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/characters`, {
        credentials: "include",
      }),
      fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/wengines`, {
        credentials: "include",
      }),
    ])
      .then(async ([charRes, wengRes]) => {
        const charData = await charRes.json();
        const wengData = await wengRes.json();
        if (!charRes.ok || !wengRes.ok) throw new Error("Failed to fetch data");
        setCharacters((charData.data || []) as Character[]);
        setWengines((wengData.data || []) as WEngine[]);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load data");
      });
  }, []);

  /* ───────────── Click-outside sliders ───────────── */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      const bootstrapModal = document.querySelector(".modal-content");
      if (bootstrapModal && bootstrapModal.contains(target)) return;

      if (
        superOpenIndex !== null &&
        superimposeRefs.current[superOpenIndex] &&
        !superimposeRefs.current[superOpenIndex]!.contains(target)
      ) {
        setSuperOpenIndex(null);
      }
      if (
        eidolonOpenIndex !== null &&
        eidolonRefs.current[eidolonOpenIndex] &&
        !eidolonRefs.current[eidolonOpenIndex]!.contains(target)
      ) {
        setEidolonOpenIndex(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [superOpenIndex, eidolonOpenIndex]);

  /* ───────────── Draft actions ───────────── */
  const handleCharacterPick = (char: Character) => {
    if (draftComplete) return;
    const currentStep = draftSequence[currentTurn];
    if (!currentStep) return;

    const mySide = currentStep.startsWith("B") ? "B" : "R";
    if (bannedCodes.includes(char.code)) return;

    const myTeamPicks = draftPicks.filter((_, i) =>
      draftSequence[i].startsWith(mySide)
    );
    const alreadyPickedByMyTeam = myTeamPicks.some(
      (p) => p?.character.code === char.code
    );
    if (alreadyPickedByMyTeam) return;

    const updated = [...draftPicks];
    updated[currentTurn] = { character: char, eidolon: 0, superimpose: 1 };
    setDraftPicks(updated);
    setCurrentTurn((prev) => prev + 1);
    setKeyboardSearch("");
  };

  const handleUndo = () => {
    if (currentTurn === 0) return;
    const updated = [...draftPicks];
    updated[currentTurn - 1] = null;
    setDraftPicks(updated);
    setCurrentTurn((prev) => prev - 1);
  };

  const updateEidolon = (index: number, eidolon: number) => {
    const updated = [...draftPicks];
    if (updated[index]) {
      updated[index] = { ...updated[index]!, eidolon };
      setDraftPicks(updated);
    }
  };

  const isSignatureWengine = (weng: WEngine, char: Character | undefined) => {
    if (!char) return false;
    const wengSub = weng.subname?.toLowerCase() || "";
    const charName = char.name.toLowerCase();
    return wengSub === charName;
  };

  const openWengineModal = (index: number) => {
    // guard: don't allow engines on BAN slots
    if (draftSequence[index] === "BB" || draftSequence[index] === "RR") return;

    const currentConeId = draftPicks[index]?.wengine?.id || "";
    setSelectedWengineId(currentConeId);
    setActiveSlotIndex(index);
    setShowWengineModal(true);
  };

  const confirmWengine = (index: number) => {
    // guard: ignore on BAN slots
    if (draftSequence[index] === "BB" || draftSequence[index] === "RR") {
      setShowWengineModal(false);
      return;
    }

    const selected =
      selectedWengineId === ""
        ? undefined
        : wengines.find((w) => String(w.id) === String(selectedWengineId));

    setDraftPicks((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index]!, wengine: selected ?? undefined };
      }
      return updated;
    });

    setShowWengineModal(false);
    setTimeout(() => setActiveSlotIndex(null), 100);
    setSelectedWengineId("");
    setWengineSearch("");
  };

  const updateSuperimpose = (index: number, superimpose: number) => {
    const updated = [...draftPicks];
    if (updated[index]) {
      updated[index] = { ...updated[index]!, superimpose };
      setDraftPicks(updated);
    }
  };

  /* For signature sort hinting */
  const subnameToCharacterName = new Map<string, string>();
  characters.forEach((char) => {
    if (char.subname) {
      subnameToCharacterName.set(char.subname.toLowerCase(), char.name);
    }
  });

  /* ───────────── Team Cost using new rules ───────────── */
  const getTeamCost = (prefix: string) => {
    let total = 0;
    for (let i = 0; i < draftSequence.length; i++) {
      if (!draftSequence[i].startsWith(prefix)) continue;
      if (draftSequence[i] === "BB" || draftSequence[i] === "RR") continue;
      const pick = draftPicks[i];
      if (!pick) continue;

      const charCost = calcAgentCost(pick.character, pick.eidolon);
      const weCost = calcWEngineCost(pick.wengine, pick.superimpose);
      total += charCost + weCost;
    }

    const penalty = Math.max(0, total - COST_LIMIT);
    const penaltyPoints = Math.floor(penalty / 0.25) * PENALTY_PER_POINT;
    return { total: Number(total.toFixed(2)), penaltyPoints };
  };

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
        {/* Draft Box */}
        <div className="d-flex flex-column align-items-center gap-3 mb-4">
          {(() => {
            const team1Cost = getTeamCost("B");
            const team2Cost = getTeamCost("R");

            return [
              {
                prefix: "B" as const,
                name: team1Name,
                color: "#3388ff",
                cost: team1Cost,
                ref: blueRowRef,
                scale: blueScale,
              },
              {
                prefix: "R" as const,
                name: team2Name,
                color: "#cc3333",
                cost: team2Cost,
                ref: redRowRef,
                scale: redScale,
              },
            ].map(({ prefix, name, color, cost, ref, scale }) => (
              <div className="w-100 text-center" key={prefix}>
                <div className="team-header">
                  <div className="team-title" style={{ color }}>
                    <span
                      className="team-dot"
                      style={{ backgroundColor: color }}
                    />
                    {name}
                  </div>

                  <div className="team-cost">
                    Cost: {cost.total} / {COST_LIMIT}
                    {cost.penaltyPoints > 0 && (
                      <span className="penalty">–{cost.penaltyPoints} pts</span>
                    )}
                  </div>
                </div>

                {/* measured wrapper */}
                <div ref={ref} className="draft-row-wrap">
                  {/* scaled row */}
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
                            i === currentTurn && !draftComplete ? "active" : "",
                          ].join(" ")}
                          style={{ zIndex: 10 }}
                          onClick={(e) => {
                            const isBanSlot = side === "BB" || side === "RR";
                            if (isBanSlot) return;
                            if (
                              eidolonOpenIndex === i ||
                              superOpenIndex === i
                            ) {
                              e.stopPropagation();
                              return;
                            }
                            if (draftPicks[i]?.character) openWengineModal(i);
                          }}
                        >
                          {/* Ribbon (only when empty) */}
                          {(() => {
                            const isBanSlot = side === "BB" || side === "RR";
                            const isAceSlot = side.includes("ACE");
                            const showRibbon =
                              !draftPicks[i] && (isBanSlot || isAceSlot);
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

                          {draftPicks[i] ? (
                            <>
                              {/* Character image */}
                              <img
                                src={draftPicks[i]!.character.image_url}
                                alt={draftPicks[i]!.character.name}
                                className="draft-img"
                                style={{
                                  filter:
                                    side === "BB" || side === "RR"
                                      ? "grayscale(100%) brightness(0.5)"
                                      : "none",
                                }}
                              />

                              {/* Engine badge */}
                              {draftPicks[i]?.wengine && (
                                <img
                                  src={draftPicks[i]!.wengine!.image_url}
                                  alt={draftPicks[i]!.wengine!.name}
                                  title={draftPicks[i]!.wengine!.name}
                                  className="engine-badge"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openWengineModal(i);
                                  }}
                                />
                              )}

                              {/* Mindscape slider */}
                              {eidolonOpenIndex === i && (
                                <div
                                  className="slider-panel"
                                  ref={(el) => {
                                    eidolonRefs.current[i] = el;
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  <div className="slider-label">Mindscape</div>
                                  <input
                                    type="range"
                                    min={0}
                                    max={6}
                                    className="big-slider"
                                    value={draftPicks[i]!.eidolon}
                                    onChange={(e) =>
                                      updateEidolon(
                                        i,
                                        parseInt(
                                          (e.target as HTMLInputElement).value
                                        )
                                      )
                                    }
                                  />
                                  <div className="slider-ticks mt-1">
                                    {[0, 1, 2, 3, 4, 5, 6].map((v) => (
                                      <span
                                        key={v}
                                        className={
                                          draftPicks[i]!.eidolon === v
                                            ? "active"
                                            : ""
                                        }
                                      >
                                        {v}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Superimpose slider */}
                              {superOpenIndex === i && (
                                <div
                                  className="slider-panel"
                                  ref={(el) => {
                                    superimposeRefs.current[i] = el;
                                  }}
                                  style={{ bottom: 70 }}
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  <div className="slider-label">
                                    Superimpose
                                  </div>
                                  <input
                                    type="range"
                                    min={1}
                                    max={5}
                                    className="big-slider"
                                    value={draftPicks[i]!.superimpose}
                                    onChange={(e) =>
                                      updateSuperimpose(
                                        i,
                                        parseInt(
                                          (e.target as HTMLInputElement).value
                                        )
                                      )
                                    }
                                  />
                                  <div className="slider-ticks mt-1">
                                    {[1, 2, 3, 4, 5].map((v) => (
                                      <span
                                        key={v}
                                        className={
                                          draftPicks[i]!.superimpose === v
                                            ? "active"
                                            : ""
                                        }
                                      >
                                        {v}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Bottom info */}
                              {(() => {
                                const c = getSlotCost(draftPicks[i]);
                                const name = draftPicks[i]!.character.name;
                                const bannedSlot =
                                  side === "BB" || side === "RR";
                                return (
                                  <div
                                    className="info-bar"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="char-name" title={name}>
                                      {name}
                                    </div>
                                    <div className="chips">
                                      {!bannedSlot && (
                                        <>
                                          <span
                                            className="chip clickable"
                                            title="Set Mindscape"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSuperOpenIndex(null);
                                              setEidolonOpenIndex(
                                                eidolonOpenIndex === i
                                                  ? null
                                                  : i
                                              );
                                            }}
                                          >
                                            M{draftPicks[i]!.eidolon}
                                          </span>
                                          {draftPicks[i]?.wengine && (
                                            <span
                                              className="chip clickable"
                                              title="Set Superimpose"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEidolonOpenIndex(null);
                                                setSuperOpenIndex(
                                                  superOpenIndex === i
                                                    ? null
                                                    : i
                                                );
                                              }}
                                            >
                                              S{draftPicks[i]!.superimpose}
                                            </span>
                                          )}
                                        </>
                                      )}
                                      {!bannedSlot && (
                                        <span
                                          className="chip cost"
                                          title={`Agent ${c.agentCost} + W-Eng ${c.weCost}`}
                                        >
                                          {c.total}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                            </>
                          ) : (
                            <div className="d-flex w-100 h-100 align-items-center justify-content-center text-white-50">
                              #{i + 1}
                            </div>
                          )}
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>

        {/* Search Bar + Undo */}
        <div className="mb-3 w-100 d-flex justify-content-center align-items-center gap-2 flex-wrap">
          <input
            type="text"
            className="form-control"
            placeholder="Search characters..."
            value={keyboardSearch}
            onChange={(e) => setKeyboardSearch(e.target.value)}
            style={{
              maxWidth: "300px",
              backgroundColor: "rgba(255,255,255,0.08)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          />
          <button
            className="btn back-button-glass"
            onClick={handleUndo}
            disabled={currentTurn === 0}
            style={{ whiteSpace: "nowrap" }}
          >
            ⟲ Undo
          </button>
        </div>

        {/* Character Grid */}
        {!draftComplete && (
          <div
            className="mb-5 px-2"
            style={{ maxWidth: "1000px", margin: "0 auto" }}
          >
            <div className="character-pool-scroll">
              <div className="character-pool-grid upscaled">
                {characters
                  .filter((char) => {
                    const q = keyboardSearch.toLowerCase();
                    const name = char.name.toLowerCase();
                    const sub =
                      char.subname && char.subname.toLowerCase() !== "null"
                        ? char.subname.toLowerCase()
                        : "";
                    return name.includes(q) || sub.includes(q);
                  })
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((char) => {
                    const currentStep = draftSequence[currentTurn];
                    if (!currentStep) return null;

                    const mySide = currentStep.startsWith("B") ? "B" : "R";
                    const opponentSide = mySide === "B" ? "R" : "B";

                    const myPicks = draftPicks.filter((_, i) =>
                      draftSequence[i]?.startsWith(mySide)
                    );
                    const opponentPicks = draftPicks.filter((_, i) =>
                      draftSequence[i]?.startsWith(opponentSide)
                    );

                    const alreadyPickedByMe = myPicks.some(
                      (p) => p?.character.code === char.code
                    );
                    const alreadyPickedByOpponent = opponentPicks.some(
                      (p) => p?.character.code === char.code
                    );

                    const isBanned = bannedCodes.includes(char.code);
                    const isAcePickStep = currentStep.includes("ACE");
                    const isOpponentPicked = alreadyPickedByOpponent;

                    const isDisabled =
                      draftComplete ||
                      isBanned ||
                      (!isAcePickStep &&
                        (alreadyPickedByMe || alreadyPickedByOpponent)) ||
                      (isAcePickStep && alreadyPickedByMe);

                    return (
                      <div
                        key={char.code}
                        title={char.name}
                        onClick={() => !isDisabled && handleCharacterPick(char)}
                        style={{
                          width: "70px",
                          height: "70px",
                          borderRadius: "8px",
                          border:
                            isAcePickStep && isOpponentPicked
                              ? "2px solid gold"
                              : isBanned
                              ? "2px dashed #888"
                              : alreadyPickedByMe || alreadyPickedByOpponent
                              ? "2px solid #aaa"
                              : "2px solid #555",
                          backgroundImage: `url(${char.image_url})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          cursor: isDisabled ? "not-allowed" : "pointer",
                          opacity: isDisabled ? 0.4 : 1,
                          filter: isDisabled
                            ? "grayscale(100%) brightness(0.6)"
                            : "none",
                          transition:
                            "transform 0.15s ease, box-shadow 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!isDisabled)
                            (
                              e.currentTarget as HTMLDivElement
                            ).style.transform = "scale(1.1)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.transform =
                            "scale(1)";
                        }}
                      />
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Post-draft scoring */}
        {draftComplete && (
          <div
            className="d-flex flex-column flex-md-row gap-3 px-2 mt-4"
            style={{ maxWidth: 1000, margin: "0 auto" }}
          >
            {(["B", "R"] as const).map((side) => {
              const isBlue = side === "B";
              const scores = isBlue ? blueScores : redScores;
              const setScores = isBlue ? setBlueScores : setRedScores;
              const label = isBlue ? team1Name : team2Name;
              const { total, penaltyPoints } = getTeamCost(side);
              const adjustedTotal =
                scores.reduce((a, b) => a + b, 0) - penaltyPoints;

              return (
                <div
                  key={side}
                  className={`score-card ${isBlue ? "blue" : "red"} w-100`}
                >
                  <div className="score-header">
                    <div className="score-title">{label}</div>
                    <div className="score-draft">
                      Cost: {total} / {COST_LIMIT}
                      {penaltyPoints > 0 && (
                        <span className="penalty-pill">
                          −{penaltyPoints} pts
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="score-inputs">
                    {(is3v3 ? [0, 1, 2] : [0, 1]).map((i) => (
                      <div className="score-input-group" key={i}>
                        <label>Player {i + 1}</label>
                        <input
                          type="number"
                          className="form-control score-input"
                          placeholder="0"
                          inputMode="numeric"
                          min={SCORE_MIN}
                          max={SCORE_MAX}
                          value={scores[i] === 0 ? "" : String(scores[i])}
                          onChange={(e) => {
                            const v = e.target.value; 
                            const updated = [...scores];
                            if (v === "") {
                              updated[i] = 0; 
                            } else {
                              const n = parseInt(v, 10) || 0;
                              updated[i] = Math.max(
                                SCORE_MIN,
                                Math.min(SCORE_MAX, n)
                              ); 
                            }
                            setScores(updated);
                          }}
                          onBlur={() => {
                            const updated = [...scores];
                            updated[i] = Math.max(
                              SCORE_MIN,
                              Math.min(SCORE_MAX, updated[i] || 0)
                            );
                            setScores(updated);
                          }}
                        />
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

        {draftComplete && (
          <div className="text-center mt-4 text-white">
            {(() => {
              const blueTotal =
                blueScores.reduce((a, b) => a + b, 0) -
                getTeamCost("B").penaltyPoints;
              const redTotal =
                redScores.reduce((a, b) => a + b, 0) -
                getTeamCost("R").penaltyPoints;
              if (blueTotal > redTotal)
                return (
                  <h4 style={{ color: "#3388ff" }}>🏆 {team1Name} Wins!</h4>
                );
              if (redTotal > blueTotal)
                return (
                  <h4 style={{ color: "#cc3333" }}>🏆 {team2Name} Wins!</h4>
                );
              return <h4 className="text-warning">Draw!</h4>;
            })()}
          </div>
        )}

        {/* W-Engine Modal */}
        <Modal
          show={showWengineModal}
          onHide={() => setShowWengineModal(false)}
          centered
          contentClassName="custom-black-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>Select W-Engine</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <input
              type="text"
              className="form-control mb-2"
              placeholder="Search W-Engine..."
              value={wengineSearch}
              onChange={(e) => setWengineSearch(e.target.value)}
            />
            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              <ul className="list-group">
                <li
                  className={`list-group-item list-group-item-action ${
                    selectedWengineId === "" ? "active" : ""
                  }`}
                  onClick={() => setSelectedWengineId("")}
                  style={{ cursor: "pointer" }}
                >
                  None
                </li>
                {(() => {
                  const searchLower = wengineSearch.toLowerCase();
                  const activeChar =
                    activeSlotIndex !== null
                      ? draftPicks[activeSlotIndex]?.character
                      : undefined;
                  const activeCharName = activeChar?.name.toLowerCase();
                  const activeCharSubname = activeChar?.subname?.toLowerCase();

                  const filteredWengines = wengines.filter((w: WEngine) => {
                    const name = w.name?.toLowerCase() || "";
                    const sub = w.subname?.toLowerCase() || "";
                    if (name.includes(searchLower) || sub.includes(searchLower))
                      return true;

                    for (const [
                      subname,
                      charName,
                    ] of subnameToCharacterName.entries()) {
                      if (
                        subname.includes(searchLower) &&
                        (name.includes(charName.toLowerCase()) ||
                          sub.includes(charName.toLowerCase()))
                      ) {
                        return true;
                      }
                    }
                    return false;
                  });

                  // signature first
                  filteredWengines.sort((a: WEngine, b: WEngine) => {
                    if (!activeCharName && !activeCharSubname) return 0;
                    const aSub = a.subname?.toLowerCase() || "";
                    const bSub = b.subname?.toLowerCase() || "";
                    const aMatches =
                      (activeCharName && aSub === activeCharName) ||
                      (activeCharSubname && aSub === activeCharSubname);
                    const bMatches =
                      (activeCharName && bSub === activeCharName) ||
                      (activeCharSubname && bSub === activeCharSubname);
                    if (aMatches && !bMatches) return -1;
                    if (!aMatches && bMatches) return 1;
                    return 0;
                  });

                  return filteredWengines.map((w: WEngine) => {
                    const isSig =
                      !!activeChar && isSignatureWengine(w, activeChar);
                    return (
                      <li
                        key={w.id}
                        className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                          selectedWengineId === String(w.id) ? "active" : ""
                        }`}
                        onClick={() => setSelectedWengineId(String(w.id))}
                        style={{
                          cursor: "pointer",
                          padding: "6px 10px",
                          gap: "10px",
                        }}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <img
                            src={w.image_url}
                            alt={w.name}
                            style={{
                              width: "32px",
                              height: "32px",
                              objectFit: "cover",
                              borderRadius: "4px",
                              border: "1px solid rgba(255,255,255,0.1)",
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 600 }}>{w.name}</div>
                            <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                              {w.subname || "(no subname)"} ({w.rarity}★)
                              {w.limited ? " • Limited" : ""}
                            </div>
                          </div>
                        </div>
                        {isSig && (
                          <span
                            className="badge bg-warning text-dark"
                            style={{
                              fontSize: "0.65rem",
                              fontWeight: 600,
                              borderRadius: "6px",
                              padding: "2px 6px",
                            }}
                          >
                            💠 Signature
                          </span>
                        )}
                      </li>
                    );
                  });
                })()}
              </ul>
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setShowWengineModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (activeSlotIndex !== null) confirmWengine(activeSlotIndex);
              }}
            >
              Confirm
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </div>
  );
}
