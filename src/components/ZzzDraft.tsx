// components/ZzzDraft.tsx
import { useEffect, useState, useRef } from "react";
import Navbar from "../components/Navbar";
import "../components/Landing.css";
import { useLocation, useNavigate } from "react-router-dom";
import { Modal, Button } from "react-bootstrap";
import { useAuth } from "../context/AuthContext";

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
const CARD_W = 170;
const CARD_H = 240;
const CARD_GAP = 12;
const CARD_MIN_SCALE = 0.68;

const CREATE_LOCK_KEY = "zzzSpectatorCreateLock";

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
  if (agent.rarity === 4) return 0.5;
  if (agent.rarity === 5) {
    if (agent.limited) {
      const bumpMilestones = [1, 2, 4, 6];
      const bumps = bumpMilestones.filter((m) => ms >= m).length;
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

/* ───────────── Penalty ───────────── */
const PENALTY_PER_POINT = 2500;

export default function ZzzDraftPage() {
  const location = useLocation();
  type DraftInit = { team1?: string; team2?: string; mode?: "2v2" | "3v3" };

  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const navState = (location.state as DraftInit) || null;

  const stored: DraftInit | null = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("zzzDraftInit") || "null");
    } catch {
      return null;
    }
  })();

  const seed = navState ?? stored ?? {};

  const mode = seed.mode || (query.get("mode") as "2v2" | "3v3") || "2v2";
  const is3v3 = mode === "3v3";

  // Raw team strings (can be "A|B" or "A|B|C")
  const team1Raw = seed.team1 || query.get("team1") || "Blue Team";
  const team2Raw = seed.team2 || query.get("team2") || "Red Team";

  useEffect(() => {
    if (location.search) {
      navigate(location.pathname, {
        replace: true,
        state: { team1: team1Raw, team2: team2Raw, mode },
      });
    }
  }, [location.pathname, location.search, team1Raw, team2Raw, mode, navigate]);

  const { user } = useAuth(); // truthy if logged in
  const [spectatorKey, setSpectatorKey] = useState<string | null>(null);

  useEffect(() => {
    const k = sessionStorage.getItem("zzzSpectatorKey");
    if (k) setSpectatorKey(k);
  }, []);

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

  const [blueScores, setBlueScores] = useState<number[]>(
    is3v3 ? [0, 0, 0] : [0, 0]
  );
  const [redScores, setRedScores] = useState<number[]>(
    is3v3 ? [0, 0, 0] : [0, 0]
  );

  const draftComplete = currentTurn >= draftSequence.length;

  // Player labels
  const nPlayers = is3v3 ? 3 : 2;
  const rawTeam1List = (team1Raw || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const rawTeam2List = (team2Raw || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const team1Name = team1Raw;
  const team2Name = team2Raw;

  function buildNameLabels(rawList: string[], count: number): string[] {
    const primary = rawList.find(Boolean) || "";
    return Array(count)
      .fill("")
      .map((_, i) => rawList[i] || primary);
  }

  const blueLabels = buildNameLabels(rawTeam1List, nPlayers);
  const redLabels = buildNameLabels(rawTeam2List, nPlayers);

  /* Completion + lock */
  const allScoresFilled = (arr: number[]) => arr.every((v) => v > 0);
  const [uiLocked, setUiLocked] = useState(false); // controls read-only UI
  const canFinalize =
    draftComplete && allScoresFilled(blueScores) && allScoresFilled(redScores);
  const isComplete = draftComplete && uiLocked;

  // Build state payload
  const collectSpectatorState = () => ({
    draftSequence,
    currentTurn,
    picks: draftPicks.map((p) =>
      p
        ? {
            characterCode: p.character.code,
            eidolon: p.eidolon,
            wengineId: p.wengine?.id ?? null,
            superimpose: p.superimpose,
          }
        : null
    ),
    blueScores,
    redScores,
  });

  /* ───────────── Session: auto-create on page load ───────────── */
  const [creating, setCreating] = useState(false);

  const generateSpectatorSession = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const payload = {
        team1: team1Name,
        team2: team2Name,
        mode,
        state: collectSpectatorState(),
      };
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/api/zzz/sessions`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json(); // { key, url }
      setSpectatorKey(data.key);
      sessionStorage.setItem("zzzSpectatorKey", data.key);
      // no auto-copy here; button is for manual copy
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    // if we already have a key in state, done
    if (spectatorKey) return;

    // hydrate from storage if present (first line of defense)
    const storedKey = sessionStorage.getItem("zzzSpectatorKey");
    if (storedKey) {
      setSpectatorKey(storedKey);
      return;
    }

    // StrictMode double-mount / remount guard
    if (sessionStorage.getItem(CREATE_LOCK_KEY)) return;

    sessionStorage.setItem(CREATE_LOCK_KEY, "1");
    (async () => {
      try {
        await generateSpectatorSession(); // POST creates exactly one session
      } finally {
        sessionStorage.removeItem(CREATE_LOCK_KEY);
      }
    })();
  }, [user, spectatorKey]);

  // If user logs out mid-session, clear local key
  useEffect(() => {
    if (!user && spectatorKey) {
      sessionStorage.removeItem("zzzSpectatorKey");
      setSpectatorKey(null);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───────────── Derived helpers ───────────── */
  const bannedCodes = draftPicks
    .map((pick, i) =>
      draftSequence[i] === "BB" || draftSequence[i] === "RR"
        ? pick?.character.code
        : null
    )
    .filter(Boolean) as string[];

  const lastPayloadRef = useRef<string>("");

  /* ───────────── Autosave PUTs ───────────── */
  useEffect(() => {
    if (!user || !spectatorKey) return;

    const payload = JSON.stringify({
      state: collectSpectatorState(),
      isComplete: isComplete || undefined,
    });

    if (payload === lastPayloadRef.current) return; // nothing changed
    lastPayloadRef.current = payload;

    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/api/zzz/sessions/${spectatorKey}`,
          {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: payload,
            signal: ctrl.signal,
          }
        );
        if (res.status === 401 || res.status === 404) {
          sessionStorage.removeItem("zzzSpectatorKey");
          setSpectatorKey(null);
        }
      } catch (e) {
        console.warn("spectator PUT failed", e);
      }
    })();
    return () => ctrl.abort();
  }, [
    user,
    spectatorKey,
    isComplete,
    draftComplete,
    draftPicks,
    blueScores,
    redScores,
    currentTurn,
  ]);

  // keepalive so last_activity_at stays fresh
  useEffect(() => {
    if (!user || !spectatorKey) return;
    const id = setInterval(() => {
      fetch(
        `${import.meta.env.VITE_API_BASE}/api/zzz/sessions/${spectatorKey}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}), // <— IMPORTANT: no `state` key here
        }
      ).catch(() => {});
    }, 25_000);
    return () => clearInterval(id);
  }, [user, spectatorKey]);

  /* Row refs + scales */
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
  const eidolonRefs = useRef<(HTMLDivElement | null)[]>([]);
  const superimposeRefs = useRef<(HTMLDivElement | null)[]>([]);

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
    if (uiLocked) return;
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
    if (uiLocked) return;
    if (currentTurn === 0) return;
    const updated = [...draftPicks];
    updated[currentTurn - 1] = null;
    setDraftPicks(updated);
    setCurrentTurn((prev) => prev - 1);
  };

  const updateEidolon = (index: number, eidolon: number) => {
    if (uiLocked) return;
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
    if (uiLocked) return;
    if (draftSequence[index] === "BB" || draftSequence[index] === "RR") return;
    const currentConeId = draftPicks[index]?.wengine?.id || "";
    setSelectedWengineId(currentConeId);
    setActiveSlotIndex(index);
    setShowWengineModal(true);
  };

  const confirmWengine = (index: number) => {
    if (uiLocked) {
      setShowWengineModal(false);
      return;
    }
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
    if (uiLocked) return;
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

                  <div
                    className={`team-cost ${
                      cost.total > COST_LIMIT ? "over" : ""
                    }`}
                  >
                    Cost: {cost.total} / {COST_LIMIT}
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
                        pointerEvents: uiLocked ? "none" : "auto",
                        opacity: uiLocked ? 0.7 : 1,
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
                            if (uiLocked) return;
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
                                    if (uiLocked) return;
                                    e.stopPropagation();
                                    openWengineModal(i);
                                  }}
                                />
                              )}

                              {/* Mindscape slider */}
                              {eidolonOpenIndex === i && !uiLocked && (
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
                              {superOpenIndex === i && !uiLocked && (
                                <div
                                  className="slider-panel"
                                  ref={(el) => {
                                    superimposeRefs.current[i] = el;
                                  }}
                                  style={{ bottom: 70 }}
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  <div className="slider-label">Phase</div>
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
                                const hasWengine = !!draftPicks[i]?.wengine;

                                return (
                                  <div
                                    className="info-bar"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="char-name" title={name}>
                                      {name}
                                    </div>

                                    {!bannedSlot && (
                                      <div className="chip-row">
                                        <span
                                          className={`chip clickable chip-left ${
                                            uiLocked ? "disabled" : ""
                                          }`}
                                          title={
                                            uiLocked
                                              ? "Locked"
                                              : "Set Mindscape"
                                          }
                                          onClick={(e) => {
                                            if (uiLocked) return;
                                            e.stopPropagation();
                                            setSuperOpenIndex(null);
                                            setEidolonOpenIndex(
                                              eidolonOpenIndex === i ? null : i
                                            );
                                          }}
                                        >
                                          M{draftPicks[i]!.eidolon}
                                        </span>

                                        <span
                                          className="chip cost chip-center"
                                          title={`Agent ${c.agentCost} + W-Eng ${c.weCost}`}
                                        >
                                          {c.total}
                                        </span>

                                        {hasWengine ? (
                                          <span
                                            className={`chip clickable chip-right ${
                                              uiLocked ? "disabled" : ""
                                            }`}
                                            title={
                                              uiLocked ? "Locked" : "Set Phase"
                                            }
                                            onClick={(e) => {
                                              if (uiLocked) return;
                                              e.stopPropagation();
                                              setEidolonOpenIndex(null);
                                              setSuperOpenIndex(
                                                superOpenIndex === i ? null : i
                                              );
                                            }}
                                          >
                                            P{draftPicks[i]!.superimpose}
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

        {/* Search Bar + Undo + Copy Link */}
        <div className="mb-3 w-100 d-flex justify-content-center align-items-center gap-2 flex-wrap">
          <input
            type="text"
            className="form-control"
            placeholder="Search characters..."
            value={keyboardSearch}
            onChange={(e) => setKeyboardSearch(e.target.value)}
            disabled={uiLocked}
            style={{
              maxWidth: "300px",
              backgroundColor: "rgba(255,255,255,0.08)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.25)",
              opacity: uiLocked ? 0.6 : 1,
            }}
          />
          <button
            className="btn back-button-glass"
            onClick={handleUndo}
            disabled={currentTurn === 0 || uiLocked}
            style={{ whiteSpace: "nowrap" }}
            title={uiLocked ? "Locked" : "Undo last pick"}
          >
            ⟲ Undo
          </button>

          {user && (
            <button
              className="btn back-button-glass"
              onClick={() => {
                if (!spectatorKey) return;
                const url = `${window.location.origin}/zzz/s/${spectatorKey}`;
                navigator.clipboard.writeText(url);
              }}
              disabled={!spectatorKey}
              title={
                spectatorKey
                  ? "Copy spectator URL"
                  : "Preparing spectator link…"
              }
            >
              {spectatorKey
                ? "Copy Spectator Link"
                : creating
                ? "Generating..."
                : "Preparing Spectator Link..."}
            </button>
          )}
        </div>

        {/* Character Grid */}
        {!draftComplete && (
          <div
            className="mb-5 px-2"
            style={{ maxWidth: "1000px", margin: "0 auto" }}
          >
            <div
              className="character-pool-scroll"
              style={{
                pointerEvents: uiLocked ? "none" : "auto",
                opacity: uiLocked ? 0.6 : 1,
              }}
            >
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
                      uiLocked ||
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
          <>
            <div
              className="score-row d-flex flex-column flex-md-row gap-3 px-2 mt-4"
              style={{ maxWidth: 1000, margin: "0 auto" }}
            >
              {(["B", "R"] as const).map((side) => {
                const isBlue = side === "B";
                const scores = isBlue ? blueScores : redScores;
                const setScores = isBlue ? setBlueScores : setRedScores;
                const label = isBlue ? (
                  <span style={{ color: "#3388ff", fontWeight: 700 }}>
                    Blue Team
                  </span>
                ) : (
                  <span style={{ color: "#cc3333", fontWeight: 700 }}>
                    Red Team
                  </span>
                );
                const nameLabels = isBlue ? blueLabels : redLabels;

                const { total, penaltyPoints } = getTeamCost(side);
                const adjustedTotal =
                  scores.reduce((a, b) => a + b, 0) - penaltyPoints;

                return (
                  <div
                    key={side}
                    className={`score-card ${isBlue ? "blue" : "red"} w-100`}
                    style={{
                      opacity: uiLocked ? 0.8 : 1,
                    }}
                  >
                    <div className="score-header">
                      <div className="score-title">{label}</div>
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
                          <label>{nameLabels[i] || `Player ${i + 1}`}</label>
                          <input
                            type="number"
                            className="form-control score-input"
                            placeholder="0"
                            inputMode="numeric"
                            min={SCORE_MIN}
                            max={SCORE_MAX}
                            disabled={uiLocked}
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

            {/* Finalize / Complete control */}
            <div className="text-center mt-3">
              <button
                className="btn back-button-glass"
                onClick={() => {
                  if (uiLocked) {
                    setUiLocked(false); // unlock to edit (DB remains completed)
                  } else if (canFinalize) {
                    setUiLocked(true); // lock UI and flag as complete
                  }
                }}
                disabled={!uiLocked && !canFinalize}
                title={
                  uiLocked
                    ? "Unlock to edit scores/draft"
                    : canFinalize
                    ? "Marks this match as complete and locks editing"
                    : "Enter all player scores to complete the match"
                }
              >
                {uiLocked ? "Unlock to Edit" : "Mark Match Complete"}
              </button>
            </div>

            {/* Winner banner */}
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
          </>
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
              disabled={uiLocked}
            />
            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              <ul className="list-group">
                <li
                  className={`list-group-item list-group-item-action ${
                    selectedWengineId === "" ? "active" : ""
                  }`}
                  onClick={() => !uiLocked && setSelectedWengineId("")}
                  style={{ cursor: uiLocked ? "not-allowed" : "pointer" }}
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

                    // Signature search hint support
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
                        onClick={() =>
                          !uiLocked && setSelectedWengineId(String(w.id))
                        }
                        style={{
                          cursor: uiLocked ? "not-allowed" : "pointer",
                          padding: "6px 10px",
                          gap: "10px",
                          opacity: uiLocked ? 0.6 : 1,
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
                          <span className="badge bg-warning text-dark">
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
                if (uiLocked) return;
                if (activeSlotIndex !== null) confirmWengine(activeSlotIndex);
              }}
              disabled={uiLocked}
            >
              Confirm
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </div>
  );
}
