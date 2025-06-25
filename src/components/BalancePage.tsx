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
  costs: number[]; // index 0-6 (E0–E6)
};

export default function BalancePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [leaving] = useState(false);

  const [chars, setChars] = useState<CharacterCost[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);


  // ───────── guard ─────────
  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) navigate("/");
  }, [user, loading, navigate]);

  // ───────── fetch from own backend ─────────
  useEffect(() => {
    if (loading || fetched) return;

    fetch(`${import.meta.env.VITE_API_BASE}/api/balance`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j: { characters: CharacterCost[] }) => {
        setChars(j.characters);
        setFetched(true);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load balance sheet.");
      });
  }, [loading, fetched]);

  // ───────── update cost value ─────────
  const updateCost = (charIdx: number, eidolon: number, value: number) => {
    setChars((prev) =>
      prev.map((c, i) =>
        i === charIdx
          ? { ...c, costs: c.costs.map((v, ei) => (ei === eidolon ? value : v)) }
          : c
      )
    );
  };

  // ───────── submit edits ─────────
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        characters: chars.map((c) => ({
          id: c.id,
          name: c.name,
          costs: c.costs,
        })),
      };

      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/admin/balance`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      alert("Balance costs updated successfully!");
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Character", "E0", "E1", "E2", "E3", "E4", "E5", "E6"];
    const rows = chars.map((char) => [char.name, ...char.costs]);
    const csvContent =
        [headers, ...rows]
        .map((row) => row.map((v) => `"${v}"`).join(","))
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "balance_costs.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    };


  // ───────── render ─────────
  if (loading || !user) {
    return (
      <div className="text-white text-center py-5">
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
            <div
                className="d-flex justify-content-between align-items-center mb-4"
                style={{ paddingLeft: "10rem", paddingRight: "10rem" }}
                >
                <h2 className="fw-bold mb-0">Balance Cost</h2>
                <button
                    className="back-button-glass btn btn-sm"
                    onClick={exportToCSV}
                >
                    Import to CSV
                </button>
                </div>

          {error && (
            <div className="alert alert-danger py-2">{error}</div>
          )}

          {/* table */}
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
                    {chars.map((c, ci) => (
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
                        <td key={ei} style={{ backgroundColor: "transparent" }}>
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

          <div className="text-center mt-3">
            <button
                className="back-button-glass btn"
                disabled={saving}
                onClick={handleSave}
            >
                {saving ? "Saving…" : "Save All Changes"}
            </button>
            </div>
        </div>
      </div>
    </div>
  );
}
