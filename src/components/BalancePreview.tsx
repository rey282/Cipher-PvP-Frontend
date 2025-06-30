// src/components/BalanceView.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import "./Landing.css";

/* ---------- types ---------- */
type CharacterCost = {
  id: string;
  name: string;
  costs: number[]; // E0-E6
};

export default function BalanceView() {
  const [chars, setChars] = useState<CharacterCost[]>([]);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaving] = useState(false); // for your page-fade css

  /* ───────── fetch balance once ───────── */
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/api/balance`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j: { characters: CharacterCost[] }) => {
        setChars(j.characters);
        setLoad(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load balance sheet.");
        setLoad(false);
      });
  }, []);

  /* ───────── loading / error ───────── */
  if (loading || error) {
    return (
      <div
        className="d-flex justify-content-center align-items-center text-white"
        style={{ minHeight: "100vh", background: "#000" }}
      >
        <p>{error || "Loading balance cost…"}</p>
      </div>
    );
  }

  /* ───────── render ───────── */
  return (
    <div
      className={`page-fade-in ${leaving ? "fade-out" : ""}`}
      style={{
        backgroundImage: "url('/background.webp')",
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

      {/* content */}
      <div
        className="position-relative z-2 text-white d-flex flex-column px-4"
        style={{ minHeight: "100vh" }}
      >
        <Navbar />

        {/* back button */}
        <div className="w-100 d-flex justify-content-end mb-3 pe-4">
          <Link to="/hsr" className="btn back-button-glass">
            ← Back
          </Link>
        </div>

        <div className="container py-4 animate__animated animate__fadeInUp">
          <h2
            className="fw-bold mb-4 text-center"
            style={{ paddingLeft: "10rem", paddingRight: "10rem" }}
          >
            Balance Cost
          </h2>

          {/* ── responsive scrollable wrapper ── */}
          <div
            className="w-100 mb-4"
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
            {/* give the table room to breathe on narrow screens */}
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
                      style={{
                        backgroundColor: "transparent",
                        color: "#fff",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        minWidth: "160px",
                        fontSize: "0.9rem",
                      }}
                    >
                      Character
                    </th>

                    {[...Array(7)].map((_, i) => (
                      <th
                        key={i}
                        style={{
                          backgroundColor: "transparent",
                          color: "#fff",
                          fontSize: "0.85rem",
                          minWidth: "85px", // each E-column fixed width
                        }}
                      >
                        E{i}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chars.map((c) => (
                    <tr key={c.id}>
                      {/* name cell */}
                      <td
                        className="text-start"
                        title={c.name}
                        style={{
                          backgroundColor: "transparent",
                          color: "#fff",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          minWidth: "160px",
                          fontSize: "0.9rem",
                          display: "flex",
                          alignItems: "center",
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

                      {/* cost cells */}
                      {c.costs.map((v, idx) => (
                        <td
                          key={idx}
                          style={{
                            backgroundColor: "transparent",
                            color: "#fff",
                            fontSize: "0.85rem",
                            minWidth: "85px",
                          }}
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
        </div>
      </div>
    </div>
  );
}
