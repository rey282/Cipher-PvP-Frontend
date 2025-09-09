import { useEffect, useMemo, useRef, useState } from "react";
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
  rarity: string; // "4" | "5" etc
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

  /* ───────── guard ───────── */
  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) navigate("/");
  }, [user, loading, navigate]);

  /* ───────── fetch balance ───────── */
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

  /* ───────── editors ───────── */
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

  /* ───────── compare for summary ───────── */
  const buildSummary = (
    newChars: CharacterCost[],
    newCones: LightConeCost[]
  ) => {
    const out: string[] = [];
    for (const oldChar of originalChars) {
      const now = newChars.find((c) => c.id === oldChar.id);
      if (!now) continue;
      for (let e = 0; e < 7; e++) {
        if (oldChar.costs[e] !== now.costs[e]) {
          out.push(
            `${oldChar.name} E${e} ${oldChar.costs[e]} → ${now.costs[e]}`
          );
        }
      }
    }
    for (const oldCone of originalCones) {
      const now = newCones.find((c) => c.id === oldCone.id);
      if (!now) continue;
      for (let s = 0; s < 5; s++) {
        if (oldCone.costs[s] !== now.costs[s]) {
          out.push(
            `${oldCone.name} S${s + 1} ${oldCone.costs[s]} → ${now.costs[s]}`
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

      const summary = buildSummary(chars, cones);
      setSumm(summary);
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
      if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if (lastComma > -1 && lastDot === -1) {
      s = s.replace(",", ".");
    }
    const num = Number(s);
    if (!isFinite(num) || num < 0) return 0;
    return Math.round(num * 4) / 4; // snap to .25
  };

  /* ───────── lookups ───────── */
  const charNameToId = useMemo(() => {
    const m = new Map<string, string>();
    chars.forEach((c) => m.set(c.name.toLowerCase(), c.id));
    return m;
  }, [chars]);
  const charIdSet = useMemo(() => new Set(chars.map((c) => c.id)), [chars]);

  const coneMaps = useMemo(() => {
    const pairToId = new Map<string, string>(); // "name|subname" lowercase
    const uniqueNameToId: Record<string, string> = {}; // if a name is unique
    const nameToIds: Record<string, string[]> = {};
    const idToId = new Map<string, string>();
    cones.forEach((c) => {
      const n = (c.name || "").trim().toLowerCase();
      const s = (c.subname || "").trim().toLowerCase();
      pairToId.set(`${n}|${s}`, c.id);
      (nameToIds[n] ||= []).push(c.id);
      idToId.set(String(c.id).toLowerCase(), c.id);
    });
    Object.keys(nameToIds).forEach((n) => {
      if (nameToIds[n].length === 1) uniqueNameToId[n] = nameToIds[n][0];
    });
    return { pairToId, uniqueNameToId, idToId };
  }, [cones]);

  /* ───────── template / export / import ───────── */
  const downloadTemplateCsv = () => {
    const rows: (string | number)[][] = [];
    // Characters
    rows.push(["Characters"]);
    rows.push(["id", "name", "E0", "E1", "E2", "E3", "E4", "E5", "E6"]);
    chars
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((c) => rows.push([c.id, c.name, 0, 0, 0, 0, 0, 0, 0]));
    rows.push([]);
    // Light Cones
    rows.push(["Light Cones"]);
    rows.push([
      "id",
      "name",
      "subname",
      "rarity",
      "S1",
      "S2",
      "S3",
      "S4",
      "S5",
    ]);
    cones
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((c) =>
        rows.push([
          c.id,
          c.name,
          c.subname || "",
          c.rarity || "",
          0,
          0,
          0,
          0,
          0,
        ])
      );
    downloadCsv("cerydra-template.csv", rows);
    toast.success("Template CSV downloaded.");
  };

  const exportToCSV = () => {
    const rows: (string | number)[][] = [];
    // Characters
    rows.push(["Characters"]);
    rows.push(["id", "name", "E0", "E1", "E2", "E3", "E4", "E5", "E6"]);
    chars
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((c) => rows.push([c.id, c.name, ...c.costs]));
    rows.push([]);
    // Light Cones
    rows.push(["Light Cones"]);
    rows.push([
      "id",
      "name",
      "subname",
      "rarity",
      "S1",
      "S2",
      "S3",
      "S4",
      "S5",
    ]);
    cones
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((c) =>
        rows.push([c.id, c.name, c.subname || "", c.rarity || "", ...c.costs])
      );
    downloadCsv("cerydra_balance_costs.csv", rows);
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

      const norm = (s: any) =>
        String(s ?? "")
          .trim()
          .replace(/^\uFEFF/, "");
      const findIndexCI = (arr: string[], label: string) =>
        arr.findIndex(
          (h) => (h || "").trim().toLowerCase() === label.toLowerCase()
        );

      const isCharsHeader = (r: string[]) => {
        const hasName = findIndexCI(r, "name") !== -1;
        const hasId = findIndexCI(r, "id") !== -1;
        const eIdx = ["e0", "e1", "e2", "e3", "e4", "e5", "e6"].map((k) =>
          findIndexCI(r, k)
        );
        return (hasName || hasId) && eIdx.every((i) => i !== -1);
      };

      const isConesHeader = (r: string[]) => {
        const hasName = findIndexCI(r, "name") !== -1;
        const hasId = findIndexCI(r, "id") !== -1;
        const sIdx = ["s1", "s2", "s3", "s4", "s5"].map((k) =>
          findIndexCI(r, k)
        );
        // subname & rarity are optional for matching, but we include them in template
        return (hasName || hasId) && sIdx.every((i) => i !== -1);
      };

      type Mode = "none" | "chars" | "cones";
      let mode: Mode = "none";

      // build header indexes when we see a header row
      let cIdx: { name: number; id: number; e: number[] } | null = null;
      let wIdx: {
        name: number;
        id: number;
        subname: number;
        rarity: number;
        s: number[];
      } | null = null;

      // overwrite: start from zeros
      const zeroChars: CharacterCost[] = chars.map((c) => ({
        ...c,
        costs: [0, 0, 0, 0, 0, 0, 0],
      }));
      const zeroCones: LightConeCost[] = cones.map((c) => ({
        ...c,
        costs: [0, 0, 0, 0, 0],
      }));

      const nextCharById: Record<string, number[]> = {};
      const nextConeById: Record<string, number[]> = {};
      const unknownChars: string[] = [];
      const unknownCones: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i];
        if (!raw || raw.length === 0) continue;
        const r = raw.map((x) => norm(x));
        const lower = r.map((x) => x.toLowerCase());

        if (/^characters$/i.test(r[0])) {
          mode = "chars";
          continue;
        }
        if (/^light\s*cones?$/i.test(r[0])) {
          mode = "cones";
          continue;
        }

        if (isCharsHeader(lower)) {
          mode = "chars";
          const lh = lower;
          cIdx = {
            name: findIndexCI(lh, "name"),
            id: findIndexCI(lh, "id"),
            e: ["e0", "e1", "e2", "e3", "e4", "e5", "e6"].map((k) =>
              findIndexCI(lh, k)
            ),
          };
          continue;
        }
        if (isConesHeader(lower)) {
          mode = "cones";
          const lh = lower;
          wIdx = {
            name: findIndexCI(lh, "name"),
            id: findIndexCI(lh, "id"),
            subname: findIndexCI(lh, "subname"),
            rarity: findIndexCI(lh, "rarity"),
            s: ["s1", "s2", "s3", "s4", "s5"].map((k) => findIndexCI(lh, k)),
          };
          continue;
        }

        // data rows
        if (mode === "chars" && cIdx) {
          const idRaw = cIdx.id >= 0 ? r[cIdx.id] : "";
          const nameRaw = cIdx.name >= 0 ? r[cIdx.name] : "";
          let matchId = "";
          if (idRaw && charIdSet.has(idRaw)) matchId = idRaw;
          else if (nameRaw) {
            const guess = charNameToId.get(nameRaw.toLowerCase());
            if (guess) matchId = guess;
          }
          if (!matchId) {
            const label = nameRaw || idRaw;
            if (label) unknownChars.push(`${label} @row ${i + 1}`);
            continue;
          }
          const costs = cIdx.e.map((ix) => parseQuarter(ix >= 0 ? r[ix] : 0));
          nextCharById[matchId] = costs;
          continue;
        }

        if (mode === "cones" && wIdx) {
          const idRaw = wIdx.id >= 0 ? r[wIdx.id] : "";
          const nameRaw = wIdx.name >= 0 ? r[wIdx.name] : "";
          const subRaw = wIdx.subname >= 0 ? r[wIdx.subname].toLowerCase() : "";
          let matchId = "";

          // Try name+subname, then unique name, then id
          if (nameRaw) {
            const key = `${nameRaw.toLowerCase()}|${subRaw}`;
            matchId = coneMaps.pairToId.get(key) || "";
            if (!matchId) {
              const uniq = coneMaps.uniqueNameToId[nameRaw.toLowerCase()];
              if (uniq) matchId = uniq;
            }
          }
          if (!matchId && idRaw) {
            const byId = coneMaps.idToId.get(idRaw.toLowerCase());
            if (byId) matchId = byId;
          }

          if (!matchId) {
            const pretty = subRaw
              ? `${nameRaw} (${r[wIdx.subname]})`
              : nameRaw || idRaw;
            if (pretty) unknownCones.push(`${pretty} @row ${i + 1}`);
            continue;
          }

          const costs = wIdx.s.map((ix) => parseQuarter(ix >= 0 ? r[ix] : 0));
          nextConeById[matchId] = costs;
          continue;
        }
      }

      // apply overwrite
      const mergedChars = zeroChars.map((c) => ({
        ...c,
        costs: nextCharById[c.id] ?? c.costs,
      }));
      const mergedCones = zeroCones.map((c) => ({
        ...c,
        costs: nextConeById[c.id] ?? c.costs,
      }));

      setChars(mergedChars);
      setCones(mergedCones);
      setSumm(buildSummary(mergedChars, mergedCones));

      const notes: string[] = [];
      notes.push(
        `Updated ${Object.keys(nextCharById).length} character(s), ${
          Object.keys(nextConeById).length
        } cone(s)`
      );
      if (unknownChars.length)
        notes.push(
          `${unknownChars.length} character(s) not recognized${
            unknownChars.length <= 5 ? `: ${unknownChars.join(", ")}` : ""
          }`
        );
      if (unknownCones.length)
        notes.push(
          `${unknownCones.length} cone(s) not recognized${
            unknownCones.length <= 5 ? `: ${unknownCones.join(", ")}` : ""
          }`
        );

      toast[unknownChars.length || unknownCones.length ? "warn" : "success"](
        notes.join(" • ")
      );
    } catch (e) {
      console.error(e);
      toast.error("Could not read CSV file.");
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
              <h2 className="fw-bold mb-0">Cerydra Balance Cost</h2>
              <div className="d-flex gap-2 flex-wrap">
                <button
                  className="back-button-glass btn btn-sm"
                  onClick={downloadTemplateCsv}
                  title="Download a combined template (characters + light cones)"
                >
                  ⬇️ Template CSV
                </button>
                <button
                  className="back-button-glass btn btn-sm"
                  onClick={() => importCsvInputRef.current?.click()}
                  title="Import a combined CSV (characters + light cones)"
                >
                  ⬆️ Import CSV
                </button>
                <button
                  className="back-button-glass btn btn-sm"
                  onClick={exportToCSV}
                  title="Export current sheet (characters + light cones)"
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
                    <div className="col-md-4">
                      {changesSummary
                        .slice(0, Math.ceil(changesSummary.length / 3))
                        .map((line, idx) => (
                          <div
                            key={idx}
                            className="small"
                            style={{
                              padding: "0.25rem 0.5rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {line}
                          </div>
                        ))}
                    </div>
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
                              padding: "0.25rem 0.5rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {line}
                          </div>
                        ))}
                    </div>
                    <div className="col-md-4">
                      {changesSummary
                        .slice(Math.ceil(changesSummary.length / 3) * 2)
                        .map((line, idx) => (
                          <div
                            key={idx + Math.ceil(changesSummary.length / 3) * 2}
                            className="small"
                            style={{
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
                    <th className="text-start" style={{ minWidth: "160px" }}>
                      Character
                    </th>
                    {[...Array(7)].map((_, i) => (
                      <th key={i} style={{ minWidth: "85px" }}>
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
                          minWidth: "160px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        <img
                          src={`https://storage.googleapis.com/hsr-avatar-images/${c.id}.png`}
                          alt={c.name}
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
                      {c.costs.map((v, ei) => (
                        <td key={ei} style={{ minWidth: "85px" }}>
                          <input
                            type="number"
                            step="0.25"
                            min={0}
                            className="form-control form-control-sm bg-dark text-white border-secondary"
                            style={{ width: 80 }}
                            value={String(v)}
                            onChange={(e) => {
                              const raw = Number(e.target.value);
                              if (!Number.isNaN(raw) && raw >= 0) {
                                updateCharCost(ci, ei, Math.round(raw * 4) / 4);
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
                    <th className="text-start" style={{ minWidth: "220px" }}>
                      Light Cone
                    </th>
                    <th style={{ minWidth: "70px" }}>Rarity</th>
                    {[...Array(5)].map((_, i) => (
                      <th key={i} style={{ minWidth: "85px" }}>
                        S{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...cones]
                    .sort((a, b) => {
                      const rarityDiff = Number(b.rarity) - Number(a.rarity);
                      if (rarityDiff !== 0) return rarityDiff;
                      const aHasSub = !!(a.subname && a.subname.trim());
                      const bHasSub = !!(b.subname && b.subname.trim());
                      return Number(bHasSub) - Number(aHasSub);
                    })
                    .map((c) => {
                      const coneIdx = cones.findIndex((x) => x.id === c.id);
                      return (
                        <tr key={c.id}>
                          <td
                            className="text-start"
                            title={c.name}
                            style={{
                              minWidth: "220px",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "6px",
                              lineHeight: 1.2,
                            }}
                          >
                            <img
                              src={c.imageUrl}
                              alt={c.name}
                              style={{
                                width: 28,
                                height: 28,
                                objectFit: "cover",
                                borderRadius: 4,
                                flexShrink: 0,
                                marginTop: 2,
                              }}
                            />
                            <div style={{ wordBreak: "break-word" }}>
                              {c.name} {c.subname && `(${c.subname})`}
                            </div>
                          </td>
                          <td
                            style={{
                              color: c.rarity === "5" ? "#ffd700" : "#c0c0c0",
                              minWidth: "70px",
                            }}
                          >
                            {c.rarity}★
                          </td>
                          {c.costs.map((v, si) => (
                            <td key={si} style={{ minWidth: "85px" }}>
                              <input
                                type="number"
                                step="0.25"
                                min={0}
                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                style={{ width: 80 }}
                                value={String(v)}
                                onChange={(e) => {
                                  const raw = Number(e.target.value);
                                  if (!Number.isNaN(raw) && raw >= 0) {
                                    updateConeCost(
                                      coneIdx,
                                      si,
                                      Math.round(raw * 4) / 4
                                    );
                                  }
                                }}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
