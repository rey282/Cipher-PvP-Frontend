import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import "../components/Landing.css";
import { toast } from "react-toastify";

/* ---------- types ---------- */
type CharacterCost = {
  id: string;
  name: string;
  costs: number[]; // E0-E6
};

type LightConeCost = {
  id: string;
  name: string;
  costs: number[]; // S1-S5
  imageUrl: string;
  subname: string;
  rarity: string;
};

export default function BalancePage2() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [leaving] = useState(false);

  const [chars, setChars] = useState<CharacterCost[]>([]);
  const [cones, setCones] = useState<LightConeCost[]>([]);
  const [originalChars, setOrigChars] = useState<CharacterCost[]>([]);
  const [originalCones, setOrigCones] = useState<LightConeCost[]>([]);
  const [changesSummary, setSumm] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) navigate("/");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (loading || fetched) return;

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
        setOrigChars(charData.characters);
        setOrigCones(coneData.cones);
        setFetched(true);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load balance data.");
      });
  }, [loading, fetched]);

  const updateCharCost = (charIdx: number, eidolon: number, value: number) => {
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

  const updateConeCost = (
    coneIdx: number,
    superimpose: number,
    value: number
  ) => {
    setCones((prev) =>
      prev.map((c, i) =>
        i === coneIdx
          ? {
              ...c,
              costs: c.costs.map((v, si) => (si === superimpose ? value : v)),
            }
          : c
      )
    );
  };

  const compareCosts = () => {
    const out: string[] = [];

    // Character changes
    for (const oldChar of originalChars) {
      const newChar = chars.find((c) => c.id === oldChar.id);
      if (!newChar) continue;
      for (let e = 0; e < 7; e++) {
        if (oldChar.costs[e] !== newChar.costs[e]) {
          out.push(
            `${oldChar.name} E${e} ${oldChar.costs[e]} → ${newChar.costs[e]}`
          );
        }
      }
    }

    // Light Cone changes
    for (const oldCone of originalCones) {
      const newCone = cones.find((c) => c.id === oldCone.id);
      if (!newCone) continue;
      for (let s = 0; s < 5; s++) {
        if (oldCone.costs[s] !== newCone.costs[s]) {
          out.push(
            `${oldCone.name} S${s + 1} ${oldCone.costs[s]} → ${
              newCone.costs[s]
            }`
          );
        }
      }
    }
    return out;
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Save characters
      const charRes = await fetch(
        `${import.meta.env.VITE_API_BASE}/api/admin/cerydra-balance`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characters: chars }),
        }
      );
      if (!charRes.ok)
        throw new Error(`Character save failed (${charRes.status})`);

      // Save light cones
      const coneRes = await fetch(
        `${import.meta.env.VITE_API_BASE}/api/admin/cerydra-cone-balance`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cones }),
        }
      );
      if (!coneRes.ok)
        throw new Error(`Light cone save failed (${coneRes.status})`);

      setSumm(compareCosts());
      setOrigChars(chars);
      setOrigCones(cones);
      toast.success("Balance costs updated successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "❌ Save failed");
    } finally {
      setSaving(false);
    }
  };

  const exportToCSV = () => {
    // Character CSV
    const charHeaders = ["Character", "E0", "E1", "E2", "E3", "E4", "E5", "E6"];
    const charRows = chars.map((c) => [c.name, ...c.costs]);
    const charCsv = [charHeaders, ...charRows]
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");

    // Light Cone CSV
    const coneHeaders = ["Light Cone", "Rarity", "S1", "S2", "S3", "S4", "S5"];
    const coneRows = cones.map((c) => [c.name, c.rarity, ...c.costs]);
    const coneCsv = [coneHeaders, ...coneRows]
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");

    // Combine both CSVs
    const combinedCsv = `Characters\n${charCsv}\n\nLight Cones\n${coneCsv}`;

    const blob = new Blob([combinedCsv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cerydra_balance_costs.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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
        backgroundImage: "url('/balance.webp')",
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
              <h2 className="fw-bold mb-0">Cerydra Balance Cost</h2>
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
                  Export to CSV
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
                <div
                  className="collapse text-white text-start p-3 mt-2 rounded"
                  id="changesSummary"
                  style={{
                    background: "rgba(0, 0, 0, 0.5)",
                    backdropFilter: "blur(6px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    boxShadow: "0 0 18px rgba(0,0,0,0.4)",
                    maxWidth: "1000px",
                    margin: "0 auto",
                  }}
                >
                  <div className="row">
                    {/* Column 1 */}
                    <div className="col-md-4">
                      {changesSummary
                        .slice(0, Math.ceil(changesSummary.length / 3))
                        .map((line, idx) => (
                          <div
                            key={idx}
                            className="small"
                            style={{
                              background: "transparent",
                              padding: "0.25rem 0.5rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {line}
                          </div>
                        ))}
                    </div>

                    {/* Column 2 */}
                    <div className="col-md-4">
                      {changesSummary
                        .slice(
                          Math.ceil(changesSummary.length / 3),
                          Math.ceil(changesSummary.length / 3) * 2
                        )
                        .map((line, idx) => (
                          <div
                            key={idx + Math.ceil(changesSummary.length / 3)}
                            className="small"
                            style={{
                              background: "transparent",
                              padding: "0.25rem 0.5rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {line}
                          </div>
                        ))}
                    </div>

                    {/* Column 3 */}
                    <div className="col-md-4">
                      {changesSummary
                        .slice(Math.ceil(changesSummary.length / 3) * 2)
                        .map((line, idx) => (
                          <div
                            key={idx + Math.ceil(changesSummary.length / 3) * 2}
                            className="small"
                            style={{
                              background: "transparent",
                              padding: "0.25rem 0.5rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {line}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          {/* ───────── Character Table ───────── */}
          <div
            className="mx-auto mb-5"
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
                                updateCharCost(ci, ei, val);
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

          {/* ───────── Light Cone Table ───────── */}
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
                        minWidth: "200px",
                      }}
                    >
                      Light Cone
                    </th>
                    <th
                      style={{
                        backgroundColor: "transparent",
                        color: "#fff",
                        minWidth: "70px",
                      }}
                    >
                      Rarity
                    </th>
                    {[...Array(5)].map((_, i) => (
                      <th
                        key={i}
                        style={{
                          backgroundColor: "transparent",
                          color: "#fff",
                          minWidth: "85px",
                        }}
                      >
                        S{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cones.map((c, ci) => (
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
                          minWidth: "200px",
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
                          backgroundColor: "transparent",
                          color: c.rarity === "5" ? "#ffd700" : "#c0c0c0",
                          minWidth: "70px",
                        }}
                      >
                        {c.rarity}★
                      </td>

                      {/* editable cost cells */}
                      {c.costs.map((v, si) => (
                        <td
                          key={si}
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
                                updateConeCost(ci, si, val);
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
