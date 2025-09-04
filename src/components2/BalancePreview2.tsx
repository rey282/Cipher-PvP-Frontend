import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../components/Landing.css";

/* ---------- types ---------- */
type CharacterCost = {
  id: string;
  name: string;
  costs: number[]; // E0–E6
};

type LightConeCost = {
  id: string;
  name: string;
  costs: number[]; // S1-S5
  imageUrl: string;
  subname: string;
  rarity: string;
};

export default function BalancePreviewCerydra() {
  const [chars, setChars] = useState<CharacterCost[]>([]);
  const [cones, setCones] = useState<LightConeCost[]>([]);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"characters" | "lightcones">("characters");

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/balance`, {
        credentials: "include",
      }),
      fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/cone-balance`, {
        credentials: "include",
      }),
    ])
      .then(async ([charRes, coneRes]) => {
        const charData = await charRes.json();
        const coneData = await coneRes.json();

        if (!charRes.ok)
          throw new Error(charData.error || "Character balance failed");
        if (!coneRes.ok)
          throw new Error(coneData.error || "Light cone balance failed");

        return { charData, coneData };
      })
      .then(({ charData, coneData }) => {
        setChars(charData.characters);
        setCones(coneData.cones);
        setLoad(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load balance data.");
        setLoad(false);
      });
  }, []);

  if (loading || error) {
    return (
      <div
        className="d-flex justify-content-center align-items-center text-white"
        style={{ minHeight: "100vh", background: "#000" }}
      >
        <p>{error || "Loading balance data…"}</p>
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
        className="position-relative z-2 text-white d-flex flex-column px-4"
        style={{ minHeight: "100vh" }}
      >
        <Navbar />

        <div className="w-100 d-flex justify-content-end mb-3 pe-4">
          <Link to="/" className="btn back-button-glass">
            ← Back
          </Link>
        </div>

        <div className="container py-4 animate__animated animate__fadeInUp">
          {/* Title and Toggle Buttons */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="fw-bold mb-0">
              {view === "characters"
                ? "Cerydra Character Balance Cost"
                : "Cerydra Light Cone Balance Cost"}
            </h2>
            <div className="btn-group">
              <button
                onClick={() => setView("characters")}
                className="back-button-glass"
                style={{
                  background:
                    view === "characters"
                      ? "rgba(255, 255, 255, 0.2)"
                      : "rgba(255, 255, 255, 0.1)",
                  fontWeight: view === "characters" ? 600 : 500,
                }}
              >
                Characters
              </button>
              <button
                onClick={() => setView("lightcones")}
                className="back-button-glass"
                style={{
                  background:
                    view === "lightcones"
                      ? "rgba(255, 255, 255, 0.2)"
                      : "rgba(255, 255, 255, 0.1)",
                  fontWeight: view === "lightcones" ? 600 : 500,
                }}
              >
                Light Cones
              </button>
            </div>
          </div>

          {view === "characters" ? (
            <div
              className="w-100 mb-5"
              style={{
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(6px)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                boxShadow: "0 0 18px rgba(0,0,0,0.4)",
                padding: "1rem",
                maxWidth: "100%",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <div style={{ minWidth: "950px" }}>
                <table
                  className="table table-hover mb-0 text-white text-center"
                  style={{
                    backgroundColor: "transparent",
                    color: "white",
                    tableLayout: "fixed",
                    width: "100%",
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        className="text-start"
                        style={{ minWidth: "160px", fontSize: "0.9rem" }}
                      >
                        Character
                      </th>
                      {[...Array(7)].map((_, i) => (
                        <th
                          key={i}
                          style={{ fontSize: "0.85rem", minWidth: "85px" }}
                        >
                          E{i}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chars.map((c) => (
                      <tr key={c.id}>
                        <td
                          className="text-start"
                          title={c.name}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            minWidth: "160px",
                            fontSize: "0.9rem",
                          }}
                        >
                          <img
                            src={`https://storage.googleapis.com/hsr-avatar-images/${c.id}.png`}
                            alt={c.name}
                            title={c.name}
                            style={{
                              width: 28,
                              height: 28,
                              objectFit: "cover",
                              borderRadius: 4,
                              marginRight: 6,
                            }}
                          />
                          {c.name}
                        </td>
                        {c.costs.map((v, idx) => (
                          <td
                            key={idx}
                            style={{ fontSize: "0.85rem", minWidth: "85px" }}
                          >
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div
              className="w-100 mb-5"
              style={{
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(6px)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                boxShadow: "0 0 18px rgba(0,0,0,0.4)",
                padding: "1rem",
                maxWidth: "100%",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <div style={{ minWidth: "950px" }}>
                <table
                  className="table table-hover mb-0 text-white text-center"
                  style={{
                    backgroundColor: "transparent",
                    color: "white",
                    tableLayout: "fixed",
                    width: "100%",
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        className="text-start"
                        style={{ minWidth: "200px", fontSize: "0.9rem" }}
                      >
                        Light Cone
                      </th>
                      <th style={{ fontSize: "0.85rem", minWidth: "70px" }}>
                        Rarity
                      </th>
                      {[...Array(5)].map((_, i) => (
                        <th
                          key={i}
                          style={{ fontSize: "0.85rem", minWidth: "85px" }}
                        >
                          S{i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cones
                      .filter((c) => !c.costs.every((v) => v === 0))
                      .map((c) => (
                        <tr key={c.id}>
                          <td
                            className="text-start"
                            title={c.name}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              minWidth: "200px",
                              fontSize: "0.9rem",
                            }}
                          >
                            <img
                              src={c.imageUrl}
                              alt={c.name}
                              title={c.name}
                              style={{
                                width: 28,
                                height: 28,
                                objectFit: "cover",
                                borderRadius: 4,
                                marginRight: 6,
                              }}
                            />
                            {c.name} {c.subname && `(${c.subname})`}
                          </td>
                          <td
                            style={{
                              color: c.rarity === "5" ? "#ffd700" : "#c0c0c0",
                              fontSize: "0.85rem",
                              minWidth: "70px",
                            }}
                          >
                            {c.rarity}★
                          </td>
                          {c.costs.map((v, idx) => (
                            <td
                              key={idx}
                              style={{ fontSize: "0.85rem", minWidth: "85px" }}
                            >
                              {v}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
