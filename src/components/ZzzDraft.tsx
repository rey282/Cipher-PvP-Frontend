import { useEffect, useState, useRef } from "react";
import Navbar from "../components/Navbar";
import "../components/Landing.css";
import { useLocation } from "react-router-dom";
import { Modal, Button, Popover, OverlayTrigger } from "react-bootstrap";

/* ───────────── Types ───────────── */
type Character = {
  code: string;
  name: string;
  subname?: string;
  rarity: number; // 5 = S, 4 = A
  image_url: string;
  limited: boolean; // NEW
};

type WEngine = {
  id: string;
  name: string;
  subname?: string;
  rarity: number; // 5 = S, 4/A/B below
  image_url: string;
  limited: boolean; // NEW
};

type DraftPick = {
  character: Character;
  eidolon: number; // Mindscape M0..M6
  wengine?: WEngine;
  superimpose: number; // Refinement W1..W5 (0 if none)
};

/* ───────────── Cost Rules Helpers ───────────── */
/** Mindscape levels are integers 0..6 (M0..M6) */
function calcAgentCost(agent: Character, mindscape: number): number {
  const ms = Math.max(0, Math.min(6, mindscape));

  // All A Rank agents: 0.5 at all mindscapes.
  if (agent.rarity === 4) return 0.5;

  // S Rank
  if (agent.rarity === 5) {
    if (agent.limited) {
      // Limited S Rank agent: starts at 1, +0.5 per unique mindscape (except M3 & M5).
      // i.e., bumps at M1, M2, M4, M6
      const bumpMilestones = [1, 2, 4, 6];
      const bumps = bumpMilestones.filter((m) => ms >= m).length;
      return 1 + 0.5 * bumps;
    } else {
      // Standard S Rank agent: starts at 1, 1.5 cost at M6.
      return ms >= 6 ? 1.5 : 1;
    }
  }

  // Anything else (just in case): free
  return 0;
}

/** Refinement levels are integers 0..5 (0 if none, W1..W5 => 1..5). */
function calcWEngineCost(we: WEngine | undefined, refine: number): number {
  if (!we) return 0;
  const r = Math.max(0, Math.min(5, refine));

  // A & B Rank wengines: 0 cost at all refinements.
  if (we.rarity <= 4) return 0;

  // S Rank wengines
  if (we.limited) {
    // Limited S Rank wengines: 0.25 starting cost, 0.5 at W3+ refinements.
    return r >= 3 ? 0.5 : 0.25;
  } else {
    // Standard S Rank wengines: 0 starting cost, 0.25 at W3+ refinements.
    return r >= 3 ? 0.25 : 0;
  }
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

  const pvpRulesPopover = (
    <Popover
      id="pvp-rules-popover"
      style={{
        maxWidth: 350,
        backgroundColor: "#1e1e2f",
        color: "#ddd",
        border: "1px solid #444",
      }}
    >
      <Popover.Header
        as="h3"
        style={{
          fontSize: "1.1rem",
          fontWeight: "bold",
          backgroundColor: "#2c2c44",
          color: "#eee",
          borderBottom: "1px solid #444",
        }}
      >
        PvP Rules
      </Popover.Header>
      <Popover.Body
        style={{
          maxHeight: 300,
          overflowY: "auto",
          fontSize: 12,
          textAlign: "left",
          whiteSpace: "normal",
          paddingRight: 10,
          backgroundColor: "#1e1e2f",
          color: "#ddd",
        }}
      >
        <strong>Rules:</strong>
        <p>
          For ZZZ PvP you can fight in either of 2 modes, 2v2 or 3v3 in Deadly
          Assault boss stages where you compete for the highest total score.
        </p>
        <strong>Match Procedure:</strong>
        <ul>
          <li>
            2v2: Make teams, draft, then select 2 out of the 3 bosses your team
            will fight.
          </li>
          <li>3v3: Draft, then fight all 3 bosses.</li>
          <li>The bosses picked in 2v2 must be unique for a team.</li>
        </ul>
        <strong>Draft:</strong>
        <p>Three pick types: Bans, Ace(s), Normal Pick.</p>
        <p>
          During draft, select agents and wengines up to 8/12 cost for 2v2/3v3
          respectively. Over cost limit results in score penalty.
        </p>
        <p>Drafting phase will proceed as the number shown in the box.</p>
        <strong>Picks:</strong>
        <ul>
          <li>
            <strong>Normal pick (blank boxes):</strong> pick unpicked/unbanned
            agents.
          </li>
          <li>
            <strong>Ban (red boxes):</strong> elect an agent to ban (cannot ban
            first 4 picks).
          </li>
          <li>
            <strong>Ace pick (orange/yellow boxes):</strong> select any unbanned
            agent, including opponent's picks; only one copy per team allowed.
          </li>
        </ul>
        <strong>Cost:</strong>
        <ul>
          <li>
            Limited S Rank agent: starts at 1 cost, increases by 0.5 per unique
            mindscape (except M3 & M5).
          </li>
          <li>Standard S Rank agent: starts at 1, 1.5 cost at M6.</li>
          <li>All A Rank agents: 0.5 cost all mindscapes.</li>
          <li>
            Limited S Rank wengines: 0.25 starting cost, 0.5 at W3+ refinements.
          </li>
          <li>
            Standard S Rank wengines: 0 starting cost, 0.25 at W3+ refinements.
          </li>
          <li>A & B Rank wengines: 0 cost at all refinements.</li>
          <li>Bangboos do not cost points.</li>
        </ul>
        <strong>Penalty and Resets:</strong>
        <ul>
          <li>
            Every 0.25 points above limit (6 for 2v2, 9 for 3v3) reduces team
            score by 2500.
          </li>
          <li>Each team has 2 resets per match.</li>
          <li>Resets must be used before battle end screen.</li>
          <li>
            Battle starts when boss appears; resets after consume one reset.
          </li>
          <li>Previous runs voided; only latest run counts.</li>
        </ul>
        <strong>Play:</strong>
        <p>
          After draft, players select bosses and test teams. Runs must be live
          streamed for fairness. If you are unable to stream the run, ask your
          opponents' consent for screenshot submission.
        </p>
        <strong>Discord Server:</strong>{" "}
        <a
          href="https://discord.gg/MHzc5GRDQW"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#57a6ff", textDecoration: "underline" }}
        >
          Join Discord Server
        </a>
      </Popover.Body>
    </Popover>
  );

  const bannedCodes = draftPicks
    .map((pick, i) =>
      draftSequence[i] === "BB" || draftSequence[i] === "RR"
        ? pick?.character.code
        : null
    )
    .filter(Boolean) as string[];

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

        // Expecting `limited` to be returned from API; if not, safely default to true for characters, false for engines?
        // Based on your DB defaults, characters/wengines default to TRUE unless you updated them; keep as-is from API.
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

      const modal = document.querySelector(".modal-content");
      if (modal && modal.contains(target)) return;

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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
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
    updated[currentTurn] = {
      character: char,
      eidolon: 0, // M0
      superimpose: 1, // W1 by default (changeable via slider)
    };
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
    const currentConeId = draftPicks[index]?.wengine?.id || "";
    setSelectedWengineId(currentConeId);
    setActiveSlotIndex(index);
    setShowWengineModal(true);
  };

  const confirmWengine = (index: number) => {
    const selected =
      selectedWengineId === ""
        ? undefined
        : wengines.find((w) => String(w.id) === String(selectedWengineId));

    setDraftPicks((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = {
          ...updated[index]!,
          wengine: selected ? { ...selected } : undefined,
        };
      }
      return updated;
    });

    setShowWengineModal(false);
    setTimeout(() => {
      setActiveSlotIndex(null);
    }, 100);

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
      // const bbCost = calcBangbooCost(); // no bangboo in UI currently

      total += charCost + weCost; // + bbCost
    }

    const penalty = Math.max(0, total - COST_LIMIT);
    const penaltyPoints = Math.floor(penalty / 0.25) * PENALTY_PER_POINT;

    return { total: Number(total.toFixed(2)), penaltyPoints };
  };

  const slotStyle = (index: number, side: string) => {
    const isActive = index === currentTurn;
    const isBlue = side.startsWith("B");
    const isRed = side.startsWith("R");
    const isBan = side === "BB" || side === "RR";
    const isAce = side.includes("ACE");
    const borderColor = isBlue ? "#3388ff" : isRed ? "#cc3333" : "#888";

    let backgroundColor = "#111";
    if (isBan) backgroundColor = "#330000";
    if (isAce) backgroundColor = "#332100"; // gold-ish

    return {
      width: "130px",
      height: "190px",
      borderRadius: "10px",
      backgroundColor,
      border: `2px solid ${borderColor}`,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontSize: "0.9rem",
      color: "#ccc",
      boxShadow:
        isActive && !draftComplete ? `0 0 10px 4px ${borderColor}` : "none",
      overflow: "hidden",
      position: "relative" as const,
      flexDirection: "column" as const,
    };
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

            const teams: {
              prefix: string;
              name: string;
              color: string;
              cost: { total: number; penaltyPoints: number };
            }[] = [
              {
                prefix: "B",
                name: team1Name,
                color: "#3388ff",
                cost: team1Cost,
              },
              {
                prefix: "R",
                name: team2Name,
                color: "#cc3333",
                cost: team2Cost,
              },
            ];

            return teams.map(({ prefix, name, color, cost }) => (
              <div className="w-100 text-center" key={prefix}>
                <h5
                  className="mb-1 d-flex justify-content-center align-items-center gap-3"
                  style={{ color }}
                >
                  {name}
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#000",
                      border: "1px solid #888",
                      color: "#fff",
                      fontSize: "0.75rem",
                      padding: "4px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    Cost: {cost.total} / {COST_LIMIT}
                    {cost.penaltyPoints > 0 && (
                      <> (–{cost.penaltyPoints} pts)</>
                    )}
                  </span>
                </h5>
                <div className="d-flex justify-content-center gap-2 flex-wrap">
                  {draftSequence.map((side, i) =>
                    side.startsWith(prefix as string) ? (
                      <div
                        key={i}
                        style={{
                          ...slotStyle(i, side),
                          position: "relative",
                          zIndex: 10,
                          boxShadow:
                            side.includes("ACE") && draftPicks[i]
                              ? "0 0 8px 4px rgba(255, 215, 0, 0.6)" // gold glow
                              : slotStyle(i, side).boxShadow,
                        }}
                      >
                        {draftPicks[i] ? (
                          <>
                            {(() => {
                              const cost = getSlotCost(draftPicks[i]);

                              return (
                                <>
                                  {/* Character Image */}
                                  <img
                                    src={draftPicks[i]!.character.image_url}
                                    alt={draftPicks[i]!.character.name}
                                    style={{
                                      width: "100%",
                                      height: draftPicks[i]?.wengine
                                        ? "70%"
                                        : "100%",
                                      objectFit: "cover",
                                      cursor: "pointer",
                                      filter:
                                        side === "BB" || side === "RR"
                                          ? "grayscale(100%) brightness(0.4)"
                                          : "none",
                                    }}
                                    onClick={() => openWengineModal(i)}
                                  />

                                  {/* Mindscape pill with cost */}
                                  {!(
                                    side === "BB" ||
                                    side === "RR" ||
                                    bannedCodes.includes(
                                      draftPicks[i]?.character.code || ""
                                    )
                                  ) && (
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEidolonOpenIndex(
                                          eidolonOpenIndex === i ? null : i
                                        );
                                      }}
                                      style={{
                                        position: "absolute",
                                        top: 4,
                                        left: 4,
                                        background: "#000",
                                        padding: "2px 6px",
                                        fontSize: "0.72rem",
                                        borderRadius: "6px",
                                        cursor: "pointer",
                                        lineHeight: 1.15,
                                        border:
                                          "1px solid rgba(255,255,255,0.15)",
                                      }}
                                      title={`Agent ${cost.agentCost} + W-Eng ${cost.weCost} = ${cost.total}`}
                                    >
                                      M{draftPicks[i]!.eidolon} | {cost.total}
                                    </div>
                                  )}

                                  {/* Mindscape slider panel */}
                                  {eidolonOpenIndex === i && (
                                    <div
                                      ref={(el) => {
                                        eidolonRefs.current[i] = el;
                                      }}
                                      style={{
                                        position: "absolute",
                                        top: "60%",
                                        left: 0,
                                        width: "100%",
                                        background: "rgba(0,0,0,0.85)",
                                        padding: "6px",
                                        borderRadius: "6px",
                                        zIndex: 20,
                                      }}
                                    >
                                      <input
                                        type="range"
                                        min={0}
                                        max={6}
                                        value={draftPicks[i]!.eidolon}
                                        onChange={(e) =>
                                          updateEidolon(
                                            i,
                                            parseInt(e.target.value)
                                          )
                                        }
                                        style={{
                                          width: "100%",
                                          accentColor: "#0af",
                                        }}
                                      />
                                      <div className="d-flex justify-content-between text-white small mt-1">
                                        {[
                                          "0",
                                          "1",
                                          "2",
                                          "3",
                                          "4",
                                          "5",
                                          "6",
                                        ].map((label, j) => (
                                          <span
                                            key={j}
                                            style={{
                                              color:
                                                draftPicks[i]!.eidolon === j
                                                  ? "#0af"
                                                  : "#ccc",
                                              fontWeight:
                                                draftPicks[i]!.eidolon === j
                                                  ? "bold"
                                                  : "normal",
                                            }}
                                          >
                                            {label}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* W-Engine section */}
                                  {draftPicks[i]?.wengine && (
                                    <div
                                      style={{
                                        position: "relative",
                                        width: "100%",
                                      }}
                                    >
                                      <img
                                        key={draftPicks[i]!.wengine!.id}
                                        src={draftPicks[i]!.wengine!.image_url}
                                        alt={draftPicks[i]!.wengine!.name}
                                        style={{
                                          width: "100%",
                                          height: "50px",
                                          objectFit: "cover",
                                          borderTop:
                                            "1px solid rgba(255,255,255,0.2)",
                                          cursor: "pointer",
                                        }}
                                        onClick={() => openWengineModal(i)}
                                      />

                                      {/* Superimpose pill */}
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEidolonOpenIndex(null);
                                          setSuperOpenIndex(
                                            superOpenIndex === i ? null : i
                                          );
                                        }}
                                        style={{
                                          position: "absolute",
                                          bottom: 4,
                                          left: 4,
                                          background: "#000",
                                          padding: "2px 6px",
                                          fontSize: "0.75rem",
                                          borderRadius: "6px",
                                          cursor: "pointer",
                                        }}
                                      >
                                        S{draftPicks[i]!.superimpose}
                                      </div>

                                      {/* Superimpose slider */}
                                      {superOpenIndex === i && (
                                        <div
                                          ref={(el) => {
                                            superimposeRefs.current[i] = el;
                                          }}
                                          style={{
                                            position: "absolute",
                                            bottom: "100%",
                                            left: 0,
                                            width: "100%",
                                            background: "rgba(0,0,0,0.85)",
                                            padding: "6px",
                                            borderRadius: "6px",
                                            zIndex: 20,
                                          }}
                                        >
                                          <input
                                            type="range"
                                            min={1}
                                            max={5}
                                            value={draftPicks[i]!.superimpose}
                                            onChange={(e) =>
                                              updateSuperimpose(
                                                i,
                                                parseInt(e.target.value)
                                              )
                                            }
                                            style={{
                                              width: "100%",
                                              accentColor: "#0af",
                                            }}
                                          />
                                          <div className="d-flex justify-content-between text-white small mt-1">
                                            {["1", "2", "3", "4", "5"].map(
                                              (label, j) => (
                                                <span
                                                  key={j}
                                                  style={{
                                                    color:
                                                      draftPicks[i]!
                                                        .superimpose ===
                                                      j + 1
                                                        ? "#0af"
                                                        : "#ccc",
                                                    fontWeight:
                                                      draftPicks[i]!
                                                        .superimpose ===
                                                      j + 1
                                                        ? "bold"
                                                        : "normal",
                                                  }}
                                                >
                                                  {label}
                                                </span>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </>
                        ) : (
                          `#${i + 1}`
                        )}
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            ));
          })()}
        </div>

        {/* Search Bar + Undo + PvP Rules */}
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

          <OverlayTrigger
            trigger="click"
            placement="right"
            overlay={pvpRulesPopover}
            rootClose
          >
            <button
              type="button"
              className="btn back-button-glass"
              style={{ whiteSpace: "nowrap" }}
              aria-label="PvP Rules"
            >
              ℹ️ PvP Rules
            </button>
          </OverlayTrigger>
        </div>

        {/* Character Grid */}
        {!draftComplete && (
          <div
            className="mb-5 px-2"
            style={{ maxWidth: "1000px", margin: "0 auto" }}
          >
            <div className="character-pool-scroll">
              <div className="character-pool-grid">
                {characters
                  .filter((char) => {
                    const lowerSearch = keyboardSearch.toLowerCase();
                    const name = char.name.toLowerCase();
                    const subname =
                      char.subname && char.subname.toLowerCase() !== "null"
                        ? char.subname.toLowerCase()
                        : "";
                    return (
                      name.includes(lowerSearch) ||
                      subname.includes(lowerSearch)
                    );
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
                            e.currentTarget.style.transform = "scale(1.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                      />
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Post-draft scoring panels */}
        {draftComplete && (
          <div
            className="d-flex justify-content-between gap-3 px-2 mt-4"
            style={{ maxWidth: 1000, margin: "0 auto" }}
          >
            {["B", "R"].map((side) => {
              const isBlue = side === "B";
              const scores = isBlue ? blueScores : redScores;
              const setScores = isBlue ? setBlueScores : setRedScores;
              const color = isBlue ? "#3388ff" : "#cc3333";
              const label = isBlue ? team1Name : team2Name;
              const { total, penaltyPoints } = getTeamCost(side);
              const adjustedTotal =
                scores.reduce((a, b) => a + b, 0) - penaltyPoints;

              return (
                <div
                  key={side}
                  className="p-3 rounded w-100"
                  style={{
                    backgroundColor: "rgba(0,0,0,0.6)",
                    border: `2px solid ${color}`,
                    boxShadow: `0 0 10px ${color}`,
                    color: "white",
                  }}
                >
                  <h5 style={{ color }}>{label}</h5>
                  <div className="mb-2 small">
                    Draft Cost: {total} / {COST_LIMIT}{" "}
                    {penaltyPoints > 0 && (
                      <span className="text-warning">
                        (-{penaltyPoints} pts)
                      </span>
                    )}
                  </div>
                  {(is3v3 ? [0, 1, 2] : [0, 1]).map((i) => (
                    <input
                      key={i}
                      type="number"
                      className="form-control form-control-sm mb-2 bg-dark text-white"
                      placeholder={`Player ${i + 1} score`}
                      value={scores[i]}
                      onChange={(e) => {
                        const updated = [...scores];
                        updated[i] = parseInt(e.target.value) || 0;
                        setScores(updated);
                      }}
                    />
                  ))}
                  <div className="mt-2 fw-bold">
                    Total: {scores.reduce((a, b) => a + b, 0)}{" "}
                    {penaltyPoints > 0 && (
                      <>
                        – {penaltyPoints} ={" "}
                        <span style={{ color: "#0af" }}>{adjustedTotal}</span>
                      </>
                    )}
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

                  // Sort to show signature first
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
                if (activeSlotIndex !== null) {
                  confirmWengine(activeSlotIndex);
                }
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
