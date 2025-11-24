// src/pages/BalancePage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import "./Landing.css";
import { toast } from "react-toastify";

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

  /* ───────── CSV helpers (Vivian-style) ───────── */
  const importCsvInputRef = useRef<HTMLInputElement | null>(null);

  const csvEscape = (s: string) =>
    s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;

  const downloadCsv = (filename: string, rows: (string | number)[][]) => {
    const text = rows
      .map((r) => r.map((v) => csvEscape(String(v ?? ""))).join(","))
      .join("\n");
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsv = (text: string): string[][] => {
    const data = text.replace(/\r/g, "");
    const lines = data.split("\n");
    const first = lines.find((l) => l.trim().length > 0) || "";
    let delim = ",";
    if (first.includes(";") && !first.includes(",")) delim = ";";
    else if (first.includes("\t")) delim = "\t";

    const out: string[][] = [];
    for (const raw of lines) {
      if (raw.length === 0) {
        out.push([]);
        continue;
      }
      let row: string[] = [];
      let cell = "";
      let i = 0;
      let inQuotes = false;

      while (i < raw.length) {
        const ch = raw[i];
        if (ch === '"') {
          if (inQuotes && raw[i + 1] === '"') {
            cell += '"';
            i += 2;
            continue;
          }
          inQuotes = !inQuotes;
          i++;
          continue;
        }
        if (!inQuotes && ch === delim) {
          row.push(cell.trim().replace(/^\uFEFF/, ""));
          cell = "";
          i++;
          continue;
        }
        cell += ch;
        i++;
      }
      row.push(cell.trim().replace(/^\uFEFF/, ""));
      out.push(row);
    }
    return out;
  };

  const parseQuarter = (v: any): number => {
    if (v == null) return 0;
    let s = String(v).trim();
    if (!s || s === "-" || s === "—") return 0;
    s = s.replace(/[\s\u00A0\u2000-\u200B\u202F]/g, "");
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastComma > -1 && lastDot > -1) {
      if (lastComma > lastDot) {
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        s = s.replace(/,/g, "");
      }
    } else if (lastComma > -1 && lastDot === -1) {
      s = s.replace(",", ".");
    }
    const num = Number(s);
    if (!isFinite(num) || num < 0) return 0;
    return Math.round(num * 4) / 4;
  };

  const applyDelta = (charIdx: number, delta: number) => {
    setChars((prev) =>
      prev.map((c, i) =>
        i === charIdx
          ? {
              ...c,
              costs: c.costs.map((old) => {
                const next = old + delta;
                return Math.max(0, Math.round(next * 4) / 4);
              }),
            }
          : c
      )
    );
  };

  const resetCharacter = (charIdx: number) => {
    const original = originalChars[charIdx];
    setChars((prev) =>
      prev.map((c, i) => (i === charIdx ? { ...original } : c))
    );
  };

  /* ───────── lookups over current sheet ───────── */
  const nameToId = useMemo(() => {
    const m = new Map<string, string>();
    chars.forEach((c) => m.set(c.name.toLowerCase(), c.id));
    return m;
  }, [chars]);

  const idSet = useMemo(() => new Set(chars.map((c) => c.id)), [chars]);

  /* ───────── template / export / import ───────── */
  const downloadTemplateCsv = () => {
    const rows: (string | number)[][] = [
      ["Characters"],
      ["id", "name", "E0", "E1", "E2", "E3", "E4", "E5", "E6"],
    ];
    // include current list for convenience
    chars
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((c) => rows.push([c.id, c.name, 0, 0, 0, 0, 0, 0, 0]));
    downloadCsv("balance-template.csv", rows);
    toast.success("Template CSV downloaded.");
  };

  const exportToCSV = () => {
    const rows: (string | number)[][] = [
      ["id", "name", "E0", "E1", "E2", "E3", "E4", "E5", "E6"],
    ];
    chars
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((c) => rows.push([c.id, c.name, ...c.costs]));
    downloadCsv("balance_costs.csv", rows);
    toast.success("Exported CSV.");
  };

  const handleImportCsv = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) {
        toast.error("Empty CSV.");
        return;
      }

      // detect header
      const norm = (s: any) =>
        String(s ?? "")
          .trim()
          .replace(/^\uFEFF/, "");
      const findIndexCI = (arr: string[], label: string) =>
        arr.findIndex(
          (h) => (h || "").trim().toLowerCase() === label.toLowerCase()
        );

      let hdrRow: string[] | null = null;
      for (const r of rows) {
        if (!r || r.length === 0) continue;
        const lower = r.map((x) => norm(x).toLowerCase());
        const hasName = findIndexCI(lower, "name") !== -1;
        const hasId = findIndexCI(lower, "id") !== -1;
        const es = ["e0", "e1", "e2", "e3", "e4", "e5", "e6"].map((k) =>
          findIndexCI(lower, k)
        );
        if ((hasName || hasId) && es.every((i) => i !== -1)) {
          hdrRow = r;
          break;
        }
      }
      if (!hdrRow) {
        toast.error(
          "No valid header found. Expected columns: id/name + E0..E6."
        );
        return;
      }

      const lowerHdr = hdrRow.map((x) => norm(x).toLowerCase());
      const idxName = findIndexCI(lowerHdr, "name");
      const idxId = findIndexCI(lowerHdr, "id");
      const idxE = ["e0", "e1", "e2", "e3", "e4", "e5", "e6"].map((k) =>
        findIndexCI(lowerHdr, k)
      );

      // start from zeros for overwrite semantics
      const zeroed: CharacterCost[] = chars.map((c) => ({
        ...c,
        costs: [0, 0, 0, 0, 0, 0, 0],
      }));

      const nextById: Record<string, number[]> = {};
      const unknowns: string[] = [];

      let start = rows.indexOf(hdrRow) + 1;
      for (let i = start; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length === 0) continue;
        const idRaw = idxId >= 0 ? norm(r[idxId]) : "";
        const nameRaw = idxName >= 0 ? norm(r[idxName]) : "";
        let idMatch = "";

        if (idRaw && idSet.has(idRaw)) {
          idMatch = idRaw;
        } else if (nameRaw) {
          const guess = nameToId.get(nameRaw.toLowerCase());
          if (guess) idMatch = guess;
        }

        if (!idMatch) {
          const label = nameRaw || idRaw;
          if (label) unknowns.push(`${label} @row ${i + 1}`);
          continue;
        }

        const costs = idxE.map((ix) => parseQuarter(ix >= 0 ? r[ix] : 0));
        nextById[idMatch] = costs;
      }

      const merged = zeroed.map((c) => ({
        ...c,
        costs: nextById[c.id] ?? c.costs,
      }));

      setChars(merged);
      setSumm(compareCosts(originalChars, merged));

      const notes: string[] = [];
      notes.push(
        `Updated ${Object.keys(nextById).length} character(s)${
          unknowns.length ? ` • ${unknowns.length} not recognized` : ""
        }`
      );
      if (unknowns.length && unknowns.length <= 5) {
        notes.push(`Unknown: ${unknowns.join(", ")}`);
      }
      toast[unknowns.length ? "warn" : "success"](notes.join(" • "));
    } catch (e) {
      console.error(e);
      toast.error("Could not read CSV file.");
    }
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
      toast.success("Balance costs updated successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "❌ Save failed");
    } finally {
      setSaving(false);
    }
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

      {/* hidden input for CSV import */}
      <input
        ref={importCsvInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={handleImportCsv}
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
              <h2 className="fw-bold mb-0">Cipher Balance Cost</h2>
              <div className="d-flex gap-2 flex-wrap">
                <button
                  className="back-button-glass btn btn-sm"
                  onClick={downloadTemplateCsv}
                  title="Download a template with all characters"
                >
                  ⬇️ Template CSV
                </button>
                <button
                  className="back-button-glass btn btn-sm"
                  onClick={() => importCsvInputRef.current?.click()}
                  title="Import a CSV to overwrite values (unmatched rows are ignored)"
                >
                  ⬆️ Import CSV
                </button>
                <button
                  className="back-button-glass btn btn-sm"
                  onClick={exportToCSV}
                  title="Export current sheet to CSV"
                >
                  ⭳ Export CSV
                </button>
                <button
                  className="back-button-glass btn"
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving ? "Saving…" : "Save All Changes"}
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
                    <th
                      style={{
                        width: "220px",
                        minWidth: "220px",
                        maxWidth: "220px",
                        backgroundColor: "transparent",
                        color: "#fff",
                        textAlign: "center",
                      }}
                    >
                      Adjust
                    </th>
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
                            step="0.25"
                            min={0}
                            className="form-control form-control-sm bg-dark text-white border-secondary"
                            style={{ width: 80 }}
                            value={String(v)}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (!Number.isNaN(val) && val >= 0) {
                                // snap to .25
                                const snapped = Math.round(val * 4) / 4;
                                updateCost(ci, ei, snapped);
                              }
                            }}
                          />
                        </td>
                      ))}

                      <td
                        style={{
                          width: "220px",
                          minWidth: "220px",
                          maxWidth: "220px",
                          overflow: "hidden",
                          backgroundColor: "transparent",
                          color: "#fff",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            justifyContent: "center",
                          }}
                        >
                          {/* Input */}
                          <input
                            id={`delta-${ci}`}
                            type="number"
                            step="0.25"
                            placeholder="0"
                            className="form-control form-control-sm bg-dark text-white border-secondary"
                            style={{
                              width: 80,
                              padding: "2px 6px",
                              borderRadius: "6px",
                              background: "rgba(0, 0, 0, 0.4)",
                              border: "1px solid rgba(255, 255, 255, 0.2)",
                              textAlign: "center",
                            }}
                          />

                          {/* Apply */}
                          <button
                            className="btn btn-sm"
                            style={{
                              padding: "3px 7px",
                              borderRadius: "50%",
                              background: "rgba(255, 255, 255, 0.12)",
                              border: "1px solid rgba(255, 255, 255, 0.25)",
                              color: "#fff",
                              fontSize: "0.8rem",
                            }}
                            onClick={() => {
                              const el = document.getElementById(
                                `delta-${ci}`
                              ) as HTMLInputElement;
                              const raw = Number(el.value);
                              if (!Number.isNaN(raw)) {
                                applyDelta(ci, Math.round(raw * 4) / 4);
                              }
                              el.value = "";
                            }}
                          >
                            ✔
                          </button>

                          {/* Reset */}
                          <button
                            className="btn btn-sm"
                            style={{
                              padding: "3px 7px",
                              borderRadius: "50%",
                              background: "rgba(255, 255, 255, 0.12)",
                              border: "1px solid rgba(255, 255, 255, 0.25)",
                              color: "#fff",
                              fontSize: "0.8rem",
                            }}
                            onClick={() => resetCharacter(ci)}
                          >
                            ↺
                          </button>
                        </div>
                      </td>
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
