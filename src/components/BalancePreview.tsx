// src/components/BalanceView.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import "./Landing.css";

/* ---------- types ---------- */
type CharacterCost = {
  id: string;
  name: string;
  costs: number[]; // E0–E6
};

export default function BalanceView() {
  const [chars, setChars] = useState<CharacterCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaving] = useState(false); // keep the same fade-logic API

  /* ───────── fetch balance once ───────── */
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/api/balance`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j: { characters: CharacterCost[] }) => {
        setChars(j.characters);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load balance sheet.");
        setLoading(false);
      });
  }, []);

  /* ───────── loading / error states ───────── */
  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center text-white"
        style={{ minHeight: "100vh", background: "#000" }}
      >
        <p>Loading balance cost…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="d-flex justify-content-center align-items-center text-white"
        style={{ minHeight: "100vh", background: "#000" }}
      >
        <p>{error}</p>
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

          {/* table – identical styling to admin page but inputs replaced by plain text */}
          <div
            className="mx-auto mb-4"
            style={{
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(6px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              boxShadow: "0 0 18px rgba(0,0,0,0.4)",
              padding: "1rem",
              maxWidth: 1000,
            }}
          >
            <div className="table-responsive">
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
                        maxWidth: "220px",
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
                      <td
                        className="text-start"
                        title={c.name}
                        style={{
                          backgroundColor: "transparent",
                          color: "#fff",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "220px",
                        }}
                      >
                        {c.name}
                      </td>
                      {c.costs.map((v, ei) => (
                        <td
                          key={ei}
                          style={{
                            backgroundColor: "transparent",
                            color: "#fff",
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
