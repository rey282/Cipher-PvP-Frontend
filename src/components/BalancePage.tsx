// src/pages/BalancePage.tsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import "./Landing.css";

/* ---------- types ---------- */
type CharacterCost = {
  id: string;
  name: string;
  costs: number[]; // E0-E6
};

export default function BalancePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [leaving] = useState(false);

  const [chars, setChars] = useState<CharacterCost[]>([]);
  const [originalChars, setOrig] = useState<CharacterCost[]>([]);
  const [changesSummary, setSumm] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  /* ───────── guard ───────── */
  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) navigate("/");
  }, [user, loading, navigate]);

  /* ───────── fetch balance ───────── */
  useEffect(() => {
    if (loading || fetched) return;

    fetch(`${import.meta.env.VITE_API_BASE}/api/balance`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j: { characters: CharacterCost[] }) => {
        setChars(j.characters);
        setOrig(j.characters);
        setFetched(true);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load balance sheet.");
      });
  }, [loading, fetched]);

  /* ───────── helpers ───────── */
  const updateCost = (charIdx: number, eidolon: number, value: number) => {
    setChars((prev) =>
      prev.map((c, i) =>
        i === charIdx
          ? {
              ...c,
              costs: c.costs.map((v, ei) => (ei === eidolon ? value : v)),
            }
          : c
      )
    );
  };

  const compareCosts = (before: CharacterCost[], after: CharacterCost[]) => {
    const out: string[] = [];
    for (const oldChar of before) {
      const newChar = after.find((c) => c.id === oldChar.id);
      if (!newChar) continue;
      for (let e = 0; e < 7; e++) {
        if (oldChar.costs[e] !== newChar.costs[e]) {
          out.push(
            `${oldChar.name} E${e} ${oldChar.costs[e]} → ${newChar.costs[e]}`
          );
        }
      }
    }
    return out;
  };

  /* ───────── save ───────── */
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/api/admin/balance`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characters: chars }),
        }
      );
      if (!res.ok) throw new Error(`Save failed (${res.status})`);

      setSumm(compareCosts(originalChars, chars));
      setOrig(chars);
      alert("Balance costs updated successfully!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /* ───────── CSV export ───────── */
  const exportToCSV = () => {
    const headers = ["Character", "E0", "E1", "E2", "E3", "E4", "E5", "E6"];
    const rows = chars.map((c) => [c.name, ...c.costs]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "balance_costs.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /* ───────── render ───────── */
  if (loading || !user) {
    return (
      <div
        className="d-flex justify-content-center align-items-center text-white"
        style={{ minHeight: "100vh", background: "#000" }}
      >
        <p>Checking admin access…</p>
      </div>
    );
  }

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
          <Link to="/admin" className="btn back-button-glass">
            ← Back
          </Link>
        </div>

        <div className="container py-4 animate__animated animate__fadeInUp">
          {/* header / buttons */}
          <div
            className="d-flex flex-column align-items-center gap-2 mb-4"
            style={{ paddingLeft: "10rem", paddingRight: "10rem" }}
          >
            <div className="d-flex flex-column flex-md-row justify-content-between w-100 align-items-start align-items-md-center gap-2">
              <h2 className="fw-bold mb-0">Balance Cost</h2>
              <div className="d-flex gap-2">
                <button
                  className="back-button-glass btn"
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving ? "Saving…" : "Save All Changes"}
                </button>
                <button
                  className="back-button-glass btn btn-sm"
                  onClick={exportToCSV}
                >
                  Import to CSV
                </button>
              </div>
            </div>

            {/* summary toggle */}
            {changesSummary.length > 0 && (
              <div className="text-center mt-2">
                <button
                  className="back-button-glass btn btn-sm"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#changesSummary"
                  aria-expanded="false"
                  aria-controls="changesSummary"
                >
                  Show Summary of Changes
                </button>
                <div className="collapse mt-2" id="changesSummary">
                  <div
                    className="text-white text-start p-3 mt-2 rounded"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.05)",
                      maxWidth: 800,
                      margin: "0 auto",
                    }}
                  >
                    <ul className="mb-0 small">
                      {changesSummary.map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          {/* ───────── scrollable table wrapper ───────── */}
          <div
            className="mx-auto mb-4"
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
                      style={{
                        backgroundColor: "transparent",
                        color: "#fff",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        minWidth: "160px",
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
                          minWidth: "85px",
                        }}
                      >
                        E{i}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chars.map((c, ci) => (
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
                        }}
                      >
                        {c.name}
                      </td>

                      {/* editable cost cells */}
                      {c.costs.map((v, ei) => (
                        <td
                          key={ei}
                          style={{
                            backgroundColor: "transparent",
                            color: "#fff",
                            minWidth: "85px",
                          }}
                        >
                          <input
                            type="number"
                            min={0}
                            className="form-control form-control-sm bg-dark text-white border-secondary"
                            style={{ width: 80 }}
                            value={v}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (!Number.isNaN(val) && val >= 0) {
                                updateCost(ci, ei, val);
                              }
                            }}
                          />
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
