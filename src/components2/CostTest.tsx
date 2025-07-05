// src/pages/CostTestPage.tsx
import { useEffect, useState } from "react";
import { Modal, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../components/Landing.css";

// Types
interface CharacterInfo {
  code: string;
  name: string;
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

  const [showEidolonModal, setShowEidolonModal] = useState(false);
  const [eidolonSlotIndex, setEidolonSlotIndex] = useState<number | null>(null);
  const [selectedEidolon, setSelectedEidolon] = useState<number>(0);

  const [showSuperModal, setShowSuperModal] = useState(false);
  const [superSlotIndex, setSuperSlotIndex] = useState<number | null>(null);
  const [selectedSuper, setSelectedSuper] = useState<number>(1);

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.VITE_API_BASE}/api/characters`, {
        credentials: "include",
      }),
      fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/balance`, {
        credentials: "include",
      }),
      fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/cone-balance`, {
        credentials: "include",
      }),
    ])
      .then(async ([charRes, costRes, coneRes]) => {
        const charData = await charRes.json();
        const costData = await costRes.json();
        const coneData = await coneRes.json();

        if (!charRes.ok) throw new Error("Failed to fetch characters");
        if (!costRes.ok) throw new Error("Failed to fetch character costs");
        if (!coneRes.ok) throw new Error("Failed to fetch cones");

        setCharInfos(charData.data);
        setCharCosts(costData.characters);
        setCones(coneData.cones);
        setTeam(
          Array(4).fill({
            characterId: "",
            eidolon: 0,
            lightConeId: "",
            superimpose: 1,
          })
        );
        setLoad(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load data");
        setLoad(false);
      });
  }, []);

  useEffect(() => {
    const extractImageId = (url: string) => {
      const match = url.match(/\/(\d+)\.png$/);
      return match ? match[1] : "";
    };

    const cost = team.reduce((total, member) => {
      const charCost = member.characterInfo
        ? charCosts.find(
            (c) => c.id === extractImageId(member.characterInfo!.image_url)
          )?.costs[member.eidolon] ?? 0
        : 0;

      const coneCost = member.lightConeId
        ? cones.find((c) => c.id === member.lightConeId)?.costs[
            member.superimpose - 1
          ] ?? 0
        : 0;

      return total + charCost + coneCost;
    }, 0);

    setTotalCost(cost);
  }, [team, charCosts, cones]);
  

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
  };

  const removeSlot = (index: number) => {
    const newTeam = [...team];
    newTeam[index] = {
      characterId: "",
      eidolon: 0,
      lightConeId: "",
      superimpose: 1,
    };
    setTeam(newTeam);
  };

  const openConeModal = (index: number) => {
    setActiveSlotIndex(index);
    setSelectedConeId(team[index].lightConeId || "");
    setShowModal(true);
  };

  const confirmConeSelection = () => {
    if (activeSlotIndex === null) return;
    const selectedCone = cones.find((c) => c.id === selectedConeId);
    const newTeam = [...team];
    newTeam[activeSlotIndex] = {
      ...newTeam[activeSlotIndex],
      lightConeId: selectedConeId,
      lightConeData: selectedCone,
    };
    setTeam(newTeam);
    setShowModal(false);
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
      {/* overlay */}
      <div
        style={{
          backgroundColor: "rgba(0,0,0,.6)",
          position: "absolute",
          inset: 0,
          zIndex: 1,
        }}
      />

      {/* content wrapper */}
      <div
        className="position-relative z-2 text-white d-flex flex-column px-4"
        style={{ minHeight: "100vh" }}
      >
        <Navbar />

        <div className="d-flex justify-content-end mb-3 pe-4">
          <Link to="/hsr2" className="btn back-button-glass">
            ← Back
          </Link>
        </div>

        <div
          className="d-flex align-items-start justify-content-center gap-5"
          style={{ maxWidth: "1400px", margin: "0 auto" }}
        >
          {/* Left panel */}
          <div style={{ minWidth: 260, maxWidth: 320 }}>
            <div
              className="p-3 rounded"
              style={{
                background: "rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(6px)",
              }}
            >
              <h5 className="mb-3">Team Cost</h5>

              <label className="form-label small mb-1">Cycles Taken</label>
              <input
                type="number"
                className="form-control form-control-sm bg-dark text-white mb-3"
                value={clearSpeed}
                min={0}
                onChange={(e) => setClearSpeed(parseFloat(e.target.value))}
              />

              <div className="small">
                <strong>Total Cost:</strong> {totalCost.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Center panel */}
          <div className="d-flex gap-3 justify-content-center flex-grow-1">
            {team.map((member, index) => {
              const char = member.characterInfo;
              const cone = member.lightConeData;

              // Helper to extract numeric ID from image_url
              const extractImageId = (url: string) => {
                const match = url.match(/\/(\d+)\.png$/);
                return match ? match[1] : "";
              };

              const charCost = char
                ? charCosts.find((c) => c.id === extractImageId(char.image_url))
                    ?.costs[member.eidolon] ?? 0
                : 0;

              const coneCost = cone
                ? cone.costs[member.superimpose - 1] ?? 0
                : 0;

              return (
                <div
                  key={index}
                  onClick={() => char && openConeModal(index)}
                  style={{
                    width: "120px",
                    borderRadius: "12px",
                    background: "rgba(0,0,0,0.7)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: char ? "pointer" : "default",
                    overflow: "hidden",
                    padding: 0,
                    margin: 0,
                    display: "inline-block",
                  }}
                >
                  {char && (
                    <div style={{ position: "relative" }}>
                      <img
                        src={char.image_url}
                        alt={char.name}
                        style={{
                          width: "100%",
                          height: "140px",
                          objectFit: "cover",
                        }}
                      />
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setEidolonSlotIndex(index);
                          setSelectedEidolon(member.eidolon);
                          setShowEidolonModal(true);
                        }}
                        style={{
                          position: "absolute",
                          top: 4,
                          left: 4,
                          background: "#000",
                          color: "#fff",
                          fontSize: "0.75rem",
                          padding: "2px 6px",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        E{member.eidolon} | {charCost}
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
                  )}

                  {cone && (
                    <div style={{ position: "relative" }}>
                      <img
                        src={cone.imageUrl}
                        alt={cone.name}
                        style={{
                          width: "100%",
                          height: "80px",
                          objectFit: "cover",
                        }}
                      />
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSuperSlotIndex(index);
                          setSelectedSuper(member.superimpose);
                          setShowSuperModal(true);
                        }}
                        style={{
                          position: "absolute",
                          bottom: 4,
                          left: 4,
                          background: "#000",
                          color: "#fff",
                          fontSize: "0.75rem",
                          padding: "2px 6px",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        S{member.superimpose} | {coneCost}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right panel */}
          <div style={{ minWidth: 300, maxWidth: 420 }}>
            <input
              type="text"
              className="form-control form-control-sm mb-2 bg-dark text-white"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))",
                gap: "8px",
                maxHeight: "70vh",
                overflowY: "auto",
                padding: "4px",
              }}
            >
              {charInfos
                .filter((c) =>
                  c.name.toLowerCase().includes(search.toLowerCase())
                )
                .map((char) => (
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
                    }}
                  />
                ))}
            </div>
          </div>
        </div>

        {/* Modal */}
        <Modal
          show={showSuperModal}
          onHide={() => setShowSuperModal(false)}
          centered
          contentClassName="custom-black-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>Select Superimpose Level</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <select
              className="form-select"
              value={selectedSuper}
              onChange={(e) => setSelectedSuper(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>
                  S{level}
                </option>
              ))}
            </select>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setShowSuperModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (superSlotIndex === null) return;
                const updated = [...team];
                updated[superSlotIndex].superimpose = selectedSuper;
                setTeam(updated);
                setShowSuperModal(false);
              }}
            >
              Confirm
            </Button>
          </Modal.Footer>
        </Modal>

        <Modal
          show={showEidolonModal}
          onHide={() => setShowEidolonModal(false)}
          centered
          contentClassName="custom-black-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>Select Eidolon Level</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <select
              className="form-select"
              value={selectedEidolon}
              onChange={(e) => setSelectedEidolon(Number(e.target.value))}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((level) => (
                <option key={level} value={level}>
                  E{level}
                </option>
              ))}
            </select>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setShowEidolonModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (eidolonSlotIndex === null) return;
                const updated = [...team];
                updated[eidolonSlotIndex].eidolon = selectedEidolon;
                setTeam(updated);
                setShowEidolonModal(false);
              }}
            >
              Confirm
            </Button>
          </Modal.Footer>
        </Modal>

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
                {cones
                  .filter((cone) => {
                    const name = cone.name?.toLowerCase() || "";
                    const subname = cone.subname?.toLowerCase() || "";
                    const search = coneSearch.toLowerCase();
                    return name.includes(search) || subname.includes(search);
                  })
                  .map((cone) => (
                    <li
                      key={cone.id}
                      className={`list-group-item list-group-item-action ${
                        selectedConeId === cone.id ? "active" : ""
                      }`}
                      onClick={() => setSelectedConeId(cone.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <strong>{cone.name}</strong>{" "}
                      {cone.subname ? `– ${cone.subname}` : ""} ({cone.rarity}★)
                    </li>
                  ))}
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
