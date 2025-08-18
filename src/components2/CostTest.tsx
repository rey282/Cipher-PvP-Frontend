// src/pages/CostTestPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../components/Landing.css";

// Types
interface CharacterInfo {
  code: string;
  name: string;
  subname: string;
  rarity: number;
  image_url: string;
  path: string;
  element: string;
}

interface CharacterCost {
  id: string;
  name: string;
  costs: number[];
}

interface LightCone {
  id: string;
  name: string;
  costs: number[];
  imageUrl: string;
  subname: string;
  rarity: string;
}

interface TeamMember {
  characterId: string;
  characterInfo?: CharacterInfo;
  eidolon: number;
  lightConeId: string;
  lightConeData?: LightCone;
  superimpose: number;
}

export default function CostTestPage() {
  const [charInfos, setCharInfos] = useState<CharacterInfo[]>([]);
  const [charCosts, setCharCosts] = useState<CharacterCost[]>([]);
  const [cones, setCones] = useState<LightCone[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearSpeed, setClearSpeed] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [selectedConeId, setSelectedConeId] = useState<string>("");
  const [coneSearch, setConeSearch] = useState("");

  const [eidolonOpenIndex, setEidolonOpenIndex] = useState<number | null>(null);
  const [superOpenIndex, setSuperOpenIndex] = useState<number | null>(null);
  const eidolonRef = useRef<HTMLDivElement | null>(null);
  const superRef = useRef<HTMLDivElement | null>(null);
  const slotsRef = useRef<HTMLDivElement | null>(null);

  const isSignatureCone = (cone: LightCone, char: CharacterInfo | undefined) => {
   if (!char) return false;
   const coneSub = (cone.subname || "").toLowerCase();
   const charName = char.name.toLowerCase();
   const charSub  = (char.subname || "").toLowerCase();
   return coneSub === charName || (charSub && coneSub === charSub);
 };

  const emptyMember = () => ({
    characterId: "",
    eidolon: 0,
    lightConeId: "",
    superimpose: 1,
  });

  const makeEmptyTeam = () => Array.from({ length: 4 }, () => emptyMember());

  const extractImageId = (url: string) => {
    try {
      const path = new URL(url, window.location.origin).pathname;
      const file = path.split("/").pop() ?? "";
      return file.split(".")[0]; // handles .png/.webp/.jpg and strips query strings
    } catch {
      return url.match(/\/(\d+)\.(png|webp|jpg|jpeg)(\?.*)?$/i)?.[1] ?? "";
    }
  };

  const subnameToCharacterName = useMemo(() => {
   const m = new Map<string, string>();
   for (const char of charInfos) {
     if (char.subname) m.set(char.subname.toLowerCase(), char.name);
   }
   return m;
 }, [charInfos]);

  const clearTeam = () => setTeam(makeEmptyTeam());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (slotsRef.current?.contains(t)) return; 
      setEidolonOpenIndex(null);
      setSuperOpenIndex(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);


  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        const [charRes, costRes, coneRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_BASE}/api/characters/all`, {
            credentials: "include",
            signal: ac.signal,
          }),
          fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/balance`, {
            credentials: "include",
            signal: ac.signal,
          }),
          fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/cone-balance`, {
            credentials: "include",
            signal: ac.signal,
          }),
        ]);

        if (!charRes.ok) throw new Error("Failed to fetch characters");
        if (!costRes.ok) throw new Error("Failed to fetch character costs");
        if (!coneRes.ok) throw new Error("Failed to fetch cones");

        const [charData, costData, coneData] = await Promise.all([
          charRes.json(),
          costRes.json(),
          coneRes.json(),
        ]);

        setCharInfos(charData.data);
        setCharCosts(costData.characters);
        setCones(coneData.cones);
        setTeam(makeEmptyTeam());
        setLoad(false);
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.error(err);
          setError("Failed to load data");
          setLoad(false);
        }
      }
    })();

    return () => ac.abort();
  }, []);

  const charCostMap = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const c of charCosts) m.set(c.id, c.costs);
    return m;
  }, [charCosts]);

  const coneMap = useMemo(() => {
    const m = new Map<string, LightCone>();
    for (const c of cones) m.set(c.id, c);
    return m;
  }, [cones]);

  useEffect(() => {
   const cost = team.reduce((total, member) => {
     const charCost = member.characterInfo
       ? (charCostMap.get(extractImageId(member.characterInfo.image_url))?.[member.eidolon] ?? 0)
       : 0;
     const coneCost = member.lightConeId
       ? (coneMap.get(member.lightConeId)?.costs[member.superimpose - 1] ?? 0)
       : 0;
     return total + charCost + coneCost;
   }, 0);
   setTotalCost(cost);
 }, [team, charCostMap, coneMap]);

  const assignCharacterToSlot = (char: CharacterInfo) => {
    const firstEmpty = team.findIndex((m) => !m.characterId);
    if (firstEmpty === -1) return;

    setTeam((prev) => {
      const newTeam = [...prev];
      newTeam[firstEmpty] = {
        characterId: char.code,
        eidolon: 0,
        characterInfo: char,
        lightConeId: "",
        lightConeData: undefined,
        superimpose: 1,
      };
      return newTeam;
    });

    setSearch("");
    setConeSearch("");
    setEidolonOpenIndex(null);
    setSuperOpenIndex(null);
  };

  const removeSlot = (index: number) => {
    const filtered = team.filter((_, i) => i !== index);
    const compacted = filtered.filter((m) => m.characterId);
    const emptySlots = Array.from(
   { length: 4 - compacted.length },
   () => emptyMember()
 );
    setTeam([...compacted, ...emptySlots]);
  };

  const openConeModal = (index: number) => {
    setActiveSlotIndex(index);
    setSelectedConeId(team[index].lightConeId || "");
    setShowModal(true);
  };

  const confirmConeSelection = () => {
    if (activeSlotIndex === null) return;
    const selectedCone = coneMap.get(selectedConeId || "");
    const newTeam = [...team];
    newTeam[activeSlotIndex] = {
      ...newTeam[activeSlotIndex],
      lightConeId: selectedConeId,
      lightConeData: selectedCone,
    };
    setTeam(newTeam);
    setShowModal(false);
    setConeSearch("");
  };

  if (loading || error) {
    return (
      <div
        className="d-flex justify-content-center align-items-center text-white"
        style={{ minHeight: "100vh", background: "#000" }}
      >
        <p>{error || "Loading team cost data…"}</p>
      </div>
    );
  }

  return (
    <div
      className="page-fade-in"
      style={{
        backgroundImage: "url('/background2.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        minHeight: "100vh",
        position: "relative",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0,0,0,.6)",
          position: "absolute",
          inset: 0,
          zIndex: 1,
        }}
      />

      <div
        className="position-relative z-2 text-white d-flex flex-column px-2 px-md-4"
        style={{ minHeight: "100vh" }}
      >
        <Navbar />

        <div className="d-flex justify-content-end mb-3 pe-4">
          <Link to="/cerydra" className="btn back-button-glass">
            ← Back
          </Link>
        </div>

        <div
          className="flex-grow-1 px-2"
          style={{ maxWidth: "1600px", margin: "0 auto" }}
        >
          {/* Team slots and cost info */}
          <div
            className="d-flex flex-column flex-md-row gap-4 mb-4 align-items-start"
            style={{ width: "100%" }}
          >
            {/* Team Info Box on the left */}
            <div
              className="p-3 rounded"
              style={{
                background: "rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(6px)",
                minWidth: 260,
                flexShrink: 0,
              }}
            >
              <h5 className="mb-3">Team Info</h5>
              <label className="form-label small mb-1">Cycles</label>
              <input
                type="number"
                className="form-control form-control-sm bg-dark text-white mb-2"
                value={clearSpeed}
                min={0}
                onChange={(e) => setClearSpeed(parseFloat(e.target.value))}
              />
              <div className="small mb-2">
                <strong>Total Cost:</strong> {totalCost.toFixed(1)}
              </div>
              <button
                className="btn btn-outline-light btn-sm w-100"
                onClick={clearTeam}
              >
                Clear
              </button>
            </div>

            {/* Team Character Cards */}
            <div
              ref={slotsRef}
              className="d-flex justify-content-between gap-2"
              style={{
                flexWrap: "nowrap",
                overflowX: "auto",
                overflowY: "hidden",
                width: "100%",
              }}
            >
              {team.map((member, index) => {
                const char = member.characterInfo;
                const cone = member.lightConeData;
                const charCost = char
                  ? charCostMap.get(extractImageId(char.image_url))?.[
                      member.eidolon
                    ] ?? 0
                  : 0;
                const coneCost = cone
                  ? cone.costs[member.superimpose - 1] ?? 0
                  : 0;

                return (
                  <div
                    key={index}
                    onClick={() => char && openConeModal(index)}
                    style={{
                      flex: "0 0 auto",
                      width: "22vw",
                      maxWidth: "120px",
                      minWidth: "80px",
                      height: "220px",
                      borderRadius: "12px",
                      background: "rgba(0,0,0,0.7)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      cursor: char ? "pointer" : "default",
                      overflow: "visible",
                      padding: 0,
                      margin: 0,
                      display: "inline-block",
                      position: "relative",
                    }}
                  >
                    {char ? (
                      <div style={{ position: "relative" }}>
                        <img
                          src={char.image_url}
                          alt={char.name}
                          loading="lazy"
                          onError={(e) => {
                            (
                              e.currentTarget as HTMLImageElement
                            ).style.visibility = "hidden";
                          }}
                          style={{
                            width: "100%",
                            height: cone ? "140px" : "220px",
                            objectFit: "cover",
                            transition: "height 0.3s ease",
                          }}
                        />

                        <div
                          style={{
                            position: "absolute",
                            top: 4,
                            left: 4,
                            zIndex: 10,
                          }}
                        >
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setEidolonOpenIndex(
                                eidolonOpenIndex === index ? null : index
                              );
                            }}
                            style={{
                              position: "relative",
                              display: "inline-block",
                              cursor: "pointer",
                            }}
                          >
                            <div
                              style={{
                                background: "#000",
                                color: "#fff",
                                fontSize: "0.75rem",
                                padding: "2px 6px",
                                borderRadius: "6px",
                              }}
                            >
                              E{member.eidolon} | {charCost}
                            </div>

                            {eidolonOpenIndex === index && (
                              <div
                                ref={eidolonRef}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: "absolute",
                                  top: "calc(100% - 1px)",
                                  left: index === team.length - 1 ? "auto" : 0,
                                  right: index === team.length - 1 ? 0 : "auto",
                                  width: "180px",
                                  background: "rgba(0,0,0,0.85)",
                                  padding: "8px",
                                  borderRadius: "10px",
                                  boxShadow: "0 0 6px rgba(0,0,0,0.6)",
                                  backdropFilter: "blur(4px)",
                                  zIndex: 999,
                                }}
                              >
                                <input
                                  type="range"
                                  min={0}
                                  max={Math.max(
                                    6,
                                    ((char &&
                                      charCostMap.get(
                                        extractImageId(char.image_url)
                                      )?.length) ??
                                      7) - 1
                                  )}
                                  step={1}
                                  value={member.eidolon}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const updated = [...team];
                                    updated[index].eidolon = Number(
                                      e.target.value
                                    );
                                    setTeam(updated);
                                  }}
                                  style={{
                                    width: "100%",
                                    accentColor: "#0af",
                                    cursor: "pointer",
                                  }}
                                />
                                <div
                                  className="d-flex justify-content-between text-white mt-1"
                                  style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 500,
                                    color: "#ccc",
                                  }}
                                >
                                  {[
                                    "E0",
                                    "E1",
                                    "E2",
                                    "E3",
                                    "E4",
                                    "E5",
                                    "E6",
                                  ].map((label, i) => (
                                    <span
                                      key={i}
                                      style={{
                                        color:
                                          member.eidolon === i
                                            ? "#0af"
                                            : "#ccc",
                                        fontWeight:
                                          member.eidolon === i
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
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSlot(index);
                          }}
                          className="btn btn-sm btn-danger position-absolute"
                          style={{
                            top: 4,
                            right: 4,
                            padding: "2px 6px",
                            fontSize: "0.75rem",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "140px",
                          background: "rgba(255,255,255,0.05)",
                        }}
                      />
                    )}

                    {cone ? (
                      <div style={{ position: "relative" }}>
                        <img
                          src={cone.imageUrl}
                          alt={cone.name}
                          loading="lazy"
                          onError={(e) => {
                            (
                              e.currentTarget as HTMLImageElement
                            ).style.visibility = "hidden";
                          }}
                          style={{
                            width: "100%",
                            height: "80px",
                            objectFit: "cover",
                          }}
                        />

                        <div
                          style={{
                            position: "absolute",
                            bottom: 4,
                            left: 4,
                            zIndex: 10,
                          }}
                        >
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSuperOpenIndex(
                                superOpenIndex === index ? null : index
                              );
                            }}
                            style={{
                              position: "relative",
                              display: "inline-block",
                              cursor: "pointer",
                            }}
                          >
                            <div
                              style={{
                                background: "#000",
                                color: "#fff",
                                fontSize: "0.75rem",
                                padding: "2px 6px",
                                borderRadius: "6px",
                              }}
                            >
                              S{member.superimpose} | {coneCost}
                            </div>

                            {superOpenIndex === index && (
                              <div
                                ref={superRef}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: "absolute",
                                  bottom: "calc(100% - 1px)",
                                  left: index === team.length - 1 ? "auto" : 0,
                                  right: index === team.length - 1 ? 0 : "auto",
                                  width: "180px",
                                  background: "rgba(0,0,0,0.85)",
                                  padding: "8px",
                                  borderRadius: "10px",
                                  boxShadow: "0 0 6px rgba(0,0,0,0.6)",
                                  backdropFilter: "blur(4px)",
                                  zIndex: 999,
                                }}
                              >
                                <input
                                  type="range"
                                  min={1}
                                  max={Math.max(5, cone?.costs.length ?? 5)}
                                  step={1}
                                  value={member.superimpose}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const updated = [...team];
                                    updated[index].superimpose = Number(
                                      e.target.value
                                    );
                                    setTeam(updated);
                                  }}
                                  style={{
                                    width: "100%",
                                    accentColor: "#0af",
                                    cursor: "pointer",
                                  }}
                                />
                                <div
                                  className="d-flex justify-content-between text-white mt-1"
                                  style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 500,
                                    color: "#ccc",
                                  }}
                                >
                                  {["S1", "S2", "S3", "S4", "S5"].map(
                                    (label, i) => (
                                      <span
                                        key={i}
                                        style={{
                                          color:
                                            member.superimpose === i + 1
                                              ? "#0af"
                                              : "#ccc",
                                          fontWeight:
                                            member.superimpose === i + 1
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
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "80px",
                          background: "rgba(255,255,255,0.05)",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Character Pool */}
          <div className="mb-5">
            <input
              type="text"
              className="form-control form-control-sm mb-3 bg-dark text-white"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
                gap: "4px",
                justifyContent: "center",
              }}
            >
              {charInfos
                .filter((c) => {
                  const lowerSearch = search.toLowerCase();
                  return (
                    c.name.toLowerCase().includes(lowerSearch) ||
                    c.subname?.toLowerCase().includes(lowerSearch)
                  );
                })
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((char) => {
                  return (
                    <div
                      key={char.code}
                      onClick={() => assignCharacterToSlot(char)}
                      title={char.name}
                      style={{
                        width: "70px",
                        height: "70px",
                        borderRadius: "8px",
                        border: "2px solid #555",
                        backgroundImage: `url(${char.image_url})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        cursor: "pointer",
                        opacity: 1,
                        pointerEvents: "auto",
                        transition:
                          "transform 0.15s ease, box-shadow 0.15s ease",
                        boxShadow: "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.1)";
                        e.currentTarget.style.boxShadow =
                          "0 0 8px rgba(255,255,255,0.4)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                  );
                })}
            </div>
          </div>
        </div>

        {/* Modal */}
        <Modal
          show={showModal}
          onHide={() => setShowModal(false)}
          centered
          contentClassName="custom-black-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>Select Light Cone</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <input
              type="text"
              className="form-control mb-2"
              placeholder="Search by name or subname..."
              value={coneSearch}
              onChange={(e) => setConeSearch(e.target.value)}
            />

            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              <ul className="list-group">
                <li
                  className={`list-group-item list-group-item-action ${
                    selectedConeId === "" ? "active" : ""
                  }`}
                  onClick={() => setSelectedConeId("")}
                  style={{ cursor: "pointer" }}
                >
                  None
                </li>
                {(() => {
                  const searchLower = coneSearch.toLowerCase();

                  const activeChar =
                    activeSlotIndex !== null
                      ? team[activeSlotIndex].characterInfo
                      : undefined;
                  const activeCharName = activeChar?.name.toLowerCase();
                  const activeCharSubname = activeChar?.subname?.toLowerCase();
                  const filteredCones = cones.filter((cone) => {
                    const name = cone.name?.toLowerCase() || "";
                    const sub = cone.subname?.toLowerCase() || "";

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

                  // Sort to show character's signature first
                  filteredCones.sort((a, b) => {
                    if (!activeCharName && !activeCharSubname) return 0;

                    const aSub = a.subname?.toLowerCase() || "";
                    const bSub = b.subname?.toLowerCase() || "";

                    const aMatches =
                      (activeCharName && aSub.includes(activeCharName)) ||
                      (activeCharSubname && aSub.includes(activeCharSubname));
                    const bMatches =
                      (activeCharName && bSub.includes(activeCharName)) ||
                      (activeCharSubname && bSub.includes(activeCharSubname));

                    if (aMatches && !bMatches) return -1;
                    if (!aMatches && bMatches) return 1;
                    return 0;
                  });

                  return filteredCones.map((cone) => {
                    const isSig =
                      !!activeChar && isSignatureCone(cone, activeChar);

                    return (
                      <li
                        key={cone.id}
                        className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                          selectedConeId === cone.id ? "active" : ""
                        }`}
                        onClick={() => setSelectedConeId(cone.id)}
                        style={{
                          cursor: "pointer",
                          padding: "6px 10px",
                          gap: "10px",
                        }}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <img
                            src={cone.imageUrl}
                            alt={cone.name}
                            style={{
                              width: "32px",
                              height: "32px",
                              objectFit: "cover",
                              borderRadius: "4px",
                              border: "1px solid rgba(255,255,255,0.1)",
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 600 }}>{cone.name}</div>
                            <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                              {cone.subname} ({cone.rarity}★)
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
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmConeSelection}>
              Confirm
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </div>
  );
}
