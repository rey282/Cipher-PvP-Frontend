import { useEffect, useState, useRef } from "react";
import Navbar from "../components/Navbar";
import "../components/Landing.css";
import { useLocation } from "react-router-dom";
import { Modal, Button } from "react-bootstrap";


type Character = {
  code: string;
  name: string;
  subname?: string;
  rarity: number;
  image_url: string;
};

type WEngine = {
  id: string;
  name: string;
  subname?: string;
  rarity: number;
  image_url: string;
};

type DraftPick = {
  character: Character;
  eidolon: number;
  wengine?: WEngine;
  superimpose: number;
};

const EIDOLON_COSTS_5STAR = [1, 1.5, 2, 2, 2.5, 2.5, 3];
const EIDOLON_COST_4STAR = 0.5;
const SUPERIMPOSE_COSTS = [0.25, 0.25, 0.5, 0.5, 0.75];
const PENALTY_PER_POINT = 2500;


export default function ZzzDraftPage() {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const mode = query.get("mode") || "2v2";
  const is3v3 = mode === "3v3";
  const COST_LIMIT = is3v3 ? 12 : 8;

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
    : ["B", "R", "R", "B", "RR", "BB", "R", "B", "B", "R", "R", "B", "B", "R"];

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
        setCharacters(charData.data || []);
        setWengines(wengData.data || []);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load data");
      });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      // Ignore clicks inside the W-Engine modal
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
  }, [activeSlotIndex, eidolonOpenIndex]);

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
      eidolon: 0,
      superimpose: 1,
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

  const subnameToCharacterName = new Map<string, string>();
  characters.forEach((char) => {
    if (char.subname) {
      subnameToCharacterName.set(char.subname.toLowerCase(), char.name);
    }
  });


  const getTeamCost = (prefix: string) => {
    let total = 0;
    for (let i = 0; i < draftSequence.length; i++) {
      if (!draftSequence[i].startsWith(prefix)) continue;
      if (draftSequence[i] === "BB" || draftSequence[i] === "RR") continue;
      const pick = draftPicks[i];
      if (!pick) continue;

      const charCost =
        pick.character.rarity === 5
          ? EIDOLON_COSTS_5STAR[Math.min(pick.eidolon, 6)]
          : EIDOLON_COST_4STAR;

      const coneCost =
        pick.wengine && pick.superimpose >= 1 && pick.superimpose <= 5
          ? SUPERIMPOSE_COSTS[pick.superimpose - 1]
          : 0;

      total += charCost + coneCost;
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
        isActive && !draftComplete ? `0 0 10px 2px ${borderColor}` : "none",
      animation: isActive && !draftComplete ? "pulse 1s infinite" : "none",
      overflow: "hidden",
      position: "relative" as const,
      flexDirection: "column" as const,
    };
  };


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
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 5px 2px rgba(255,255,255,0.4); }
          50% { box-shadow: 0 0 10px 4px rgba(255,255,255,0.8); }
          100% { box-shadow: 0 0 5px 2px rgba(255,255,255,0.4); }
        }
      `}</style>

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
                            <img
                              src={draftPicks[i]!.character.image_url}
                              alt={draftPicks[i]!.character.name}
                              style={{
                                width: "100%",
                                height: draftPicks[i]?.wengine ? "70%" : "100%",
                                objectFit: "cover",
                                cursor: "pointer",
                                filter:
                                  side === "BB" || side === "RR"
                                    ? "grayscale(100%) brightness(0.4)"
                                    : "none",
                              }}
                              onClick={() => openWengineModal(i)}
                            />
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
                                  fontSize: "0.75rem",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                }}
                              >
                                M{draftPicks[i]!.eidolon}
                              </div>
                            )}

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
                                    updateEidolon(i, parseInt(e.target.value))
                                  }
                                  style={{
                                    width: "100%",
                                    accentColor: "#0af",
                                  }}
                                />
                                <div className="d-flex justify-content-between text-white small mt-1">
                                  {["0", "1", "2", "3", "4", "5", "6"].map(
                                    (label, j) => (
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
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {draftPicks[i]?.wengine && (
                              <div
                                style={{ position: "relative", width: "100%" }}
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
                                                draftPicks[i]!.superimpose ===
                                                j + 1
                                                  ? "#0af"
                                                  : "#ccc",
                                              fontWeight:
                                                draftPicks[i]!.superimpose ===
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

        {/* Search Bar + Undo (always visible) */}
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

        {/* Character Grid (only if draft not complete) */}
        {!draftComplete && (
          <div
            className="mb-5 px-2"
            style={{ maxWidth: "1000px", margin: "0 auto" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
                gap: "12px",
                justifyContent: "center",
              }}
            >
              {characters
                .filter((char) => {
                  const lowerSearch = keyboardSearch.toLowerCase();
                  const name = char.name.toLowerCase();
                  const subname =
                    char.subname && char.subname.toLowerCase() !== "null"
                      ? char.subname.toLowerCase()
                      : "";
                  return (
                    name.includes(lowerSearch) || subname.includes(lowerSearch)
                  );
                })
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((char) => {
                  const currentStep = draftSequence[currentTurn];
                  if (!currentStep) return null;

                  const isAce = currentStep.includes("ACE");
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

                  const isDisabled =
                    draftComplete ||
                    isBanned ||
                    (!isAce &&
                      (alreadyPickedByMe || alreadyPickedByOpponent)) ||
                    (isAce && alreadyPickedByMe);

                  return (
                    <div
                      key={char.code}
                      title={char.name}
                      onClick={() => !isDisabled && handleCharacterPick(char)}
                      style={{
                        width: "70px",
                        height: "70px",
                        borderRadius: "8px",
                        border: isBanned
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
        )}

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
