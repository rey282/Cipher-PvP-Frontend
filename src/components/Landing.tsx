import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Landing.css";
import Navbar from "../components/Navbar";
import { Modal, Button, Form, Dropdown, Collapse } from "react-bootstrap";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";

/* ───────────────── Rules ───────────────── */
const ZzzRules = () => (
  <div className="rules-card">
    <strong>Rules:</strong>
    <p>
      For ZZZ PvP you can fight in either of 2 modes, 2v2 or 3v3 in Deadly
      Assault boss stages where you compete for the highest total score.
    </p>
    <strong>Match Procedure:</strong>
    <ul>
      <li>
        2v2: Make teams, draft, then select 2 out of the 3 bosses your team will
        fight.
      </li>
      <li>3v3: Draft, then fight all 3 bosses.</li>
      <li>The bosses picked in 2v2 must be unique for a team.</li>
    </ul>
    <strong>Draft:</strong>
    <p>Three pick types: Bans, Ace(s), Normal Pick.</p>
    <p>
      During draft, select agents and wengines up to 6/9 cost for 2v2/3v3
      respectively. Over cost limit results in score penalty.
    </p>
    <p>Drafting phase will proceed as the number shown in the box.</p>
    <strong>Picks:</strong>
    <ul>
      <li>
        <strong>Normal pick (blank boxes):</strong> pick unpicked/unbanned
        agents.
      </li>
      <li>
        <strong>Ban (red boxes):</strong> elect an agent to ban (cannot ban
        first 4 picks).
      </li>
      <li>
        <strong>Ace pick (orange/yellow boxes):</strong> select any unbanned
        agent, including opponent's picks; only one copy per team allowed.
      </li>
    </ul>
    <strong>Cost:</strong>
    <ul>
      <li>
        Limited S Rank agent: starts at 1 cost, increases by 0.5 per unique
        mindscape (except M3 &amp; M5).
      </li>
      <li>Standard S Rank agent: starts at 1, 1.5 cost at M6.</li>
      <li>All A Rank agents: 0.5 cost all mindscapes.</li>
      <li>
        Limited S Rank wengines: 0.25 starting cost, 0.5 at W3+ refinements.
      </li>
      <li>
        Standard S Rank wengines: 0 starting cost, 0.25 at W3+ refinements.
      </li>
      <li>A &amp; B Rank wengines: 0 cost at all refinements.</li>
      <li>Bangboos do not cost points.</li>
    </ul>
    <strong>Penalty and Resets:</strong>
    <ul>
      <li>
        Every 0.25 points above limit (6 for 2v2, 9 for 3v3) reduces team score
        by 2500.
      </li>
      <li>Each team has 2 resets per match.</li>
      <li>Resets must be used before ending stream.</li>
      <li>Battle starts when boss appears; resets after consume one reset.</li>
      <li>Previous runs voided; only latest run counts.</li>
    </ul>
    <strong>Play:</strong>
    <p>
      After draft, players select bosses and test teams. Runs must be live
      streamed for fairness. If you are unable to stream the run, ask your
      opponents&apos; consent for screenshot submission.
    </p>
    <strong>Discord Server:</strong>{" "}
    <a
      href="https://discord.gg/MHzc5GRDQW"
      target="_blank"
      rel="noreferrer"
      className="rules-link"
    >
      Join Discord Server
    </a>
  </div>
);

/* ───────────────── Game data ───────────────── */
const games = [
  {
    id: "zzz",
    name: "Vivian PvP",
    bg: "/zzz-bg.webp",
    icon: "/zzz-icon.jpeg",
    live: true,
    link: "/zzz",
  },
  {
    id: "hsr",
    name: "Cipher PvP",
    bg: "/HsrBackground.webp",
    icon: "/cipher-icon.webp",
    live: true,
    link: "/cipher",
  },
  {
    id: "hsr2",
    name: "Cerydra PvP",
    bg: "/cerydra-bg.webp",
    icon: "/cerydra-icon.jpg",
    live: true,
    link: "/cerydra",
  },
];

const fmtRarity = (r: number) => (
  <span aria-label={`${r}-star`} style={{ letterSpacing: 2 }}>
    {Array.from({ length: r }).map((_, i) => (
      <span
        key={i}
        style={{
          color: "#FFD54F", 
          textShadow: "0 0 6px rgba(255,213,79,.35)",
          marginRight: 2,
        }}
      >
        ★
      </span>
    ))}
  </span>
);

/* ───────────────── Cost Presets ───────────────── */
type CostProfile = {
  id: string;                // preset id from server
  name: string;              // user-visible label
  charMs: Record<string, number[]>;   // code -> [M0..M6]
  wePhase: Record<string, number[]>;  // id   -> [P1..P5]
  createdAt?: string;
};

// Utility: clamp to 2 decimals & non-negative
const clean2 = (n: number) => Math.max(0, Math.round(n * 100) / 100);


// Team member IDs + roles
const hsrTeamIds: { id: string; role: string }[] = [
  { id: "663145925807702029", role: "Server Owner / Balancer" },
  { id: "249042315736252417", role: "Developer" },
  { id: "371513247641370625", role: "Developer" },
  { id: "693052597812330536", role: "Balancer" },
  { id: "478408402700206081", role: "Balancer" },
  { id: "381948397591986220", role: "Balancer" },
];

const genshinTeamIds: { id: string; role: string }[] = [
  { id: "663145925807702029", role: "Server Owner / Balancer" },
  { id: "249042315736252417", role: "Developer" },
  { id: "371513247641370625", role: "Developer" },
  { id: "486164092931932179", role: "Balancer" },
  { id: "841509164673269792", role: "Balancer" },
  { id: "115890480813703175", role: "Balancer" },
  { id: "265624516762271745", role: "Balancer" },
  { id: "693052597812330536", role: "Balancer" },
];

const zzzTeamIds: { id: string; role: string }[] = [
  { id: "663145925807702029", role: "Server Owner" },
  { id: "371513247641370625", role: "Developer" },
  { id: "313955497604677633", role: "Staff" },
  { id: "478408402700206081", role: "Staff" },
];

// ─── In-memory cache ───
const teamCache: {
  hsr: any[] | null;
  genshin: any[] | null;
  zzz: any[] | null;
} = {
  hsr: null,
  genshin: null,
  zzz: null,
};

const DEFAULT_COST_LABEL = "Default (Vivian PvP)";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ───────────── Helpers ───────────── */
const ensureLen = (arr: (string | undefined)[], len: number) => {
  const next = [...arr];
  next.length = len;
  for (let i = 0; i < len; i++) {
    if (typeof next[i] !== "string") next[i] = "";
  }
  return next as string[];
};

export default function Landing() {
  const [selected, setSelected] = useState(1);
  const [currentBg, setCurrentBg] = useState(games[1].bg);
  const [fadeBg, setFadeBg] = useState("");
  const [bgFading, setBgFading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showTeam, setShowTeam] = useState(false);

  // 🛑 Desktop-only guard for ZZZ draft
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer:coarse), (max-width: 820px)");
    const update = () => setIsMobile(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);

  // Start Draft modal
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [mode, setMode] = useState<"2v2" | "3v3">("2v2");
  const modeRef = useRef<"2v2" | "3v3">("2v2");
  const is3v3 = mode === "3v3";
  const nPlayers = is3v3 ? 3 : 2;

  // defaults depend on mode
  const [costLimit, setCostLimit] = useState<number>(mode === "3v3" ? 9 : 6);
  const [penaltyPerPoint, setPenaltyPerPoint] = useState<number>(2500);

  // hide/show the cost inputs
  const [showCostInputs, setShowCostInputs] = useState(false);

  // defaults depend on mode
  const defaultCostLimit = mode === "3v3" ? 9 : 6;

  // show small summary pills when values differ from defaults
  const showLimitPill = Number(costLimit) !== defaultCostLimit;
  const showPenaltyPill = Number(penaltyPerPoint) !== 2500;

  const fmtQuarter = (n: number) =>
    (Math.round(Number(n) * 4) / 4)
      .toFixed(2)
      .replace(/\.00$/, "")
      .replace(/0$/, "");

  // if the user hasn’t touched costLimit, keep following mode
  const userTouchedCost = useRef(false);
  useEffect(() => {
    if (!userTouchedCost.current) setCostLimit(mode === "3v3" ? 9 : 6);
  }, [mode]);

  type FeaturedCfg = {
    kind: "character" | "wengine";
    // character keys
    code?: string;
    // wengine keys
    id?: string;

    name: string;
    image_url: string;
    rule: "none" | "globalBan" | "globalPick";
    customCost?: number | null; // override (0..100), base at M0/W1
  };

  // local picker pools
  type ZzzChar = {
    code: string;
    name: string;
    subname?: string;
    image_url: string;
  };
  type ZzzWeng = {
    id: string;
    name: string;
    subname?: string;
    rarity: number;
    limited: boolean;
    image_url: string;
  };

  const [showFeaturedModal, setShowFeaturedModal] = useState(false);
  const [featuredList, setFeaturedList] = useState<FeaturedCfg[]>([]);

  const [charPool, setCharPool] = useState<ZzzChar[]>([]);
  const [wengPool, setWengPool] = useState<ZzzWeng[]>([]);

  const [subnameToCharName, setSubnameToCharName] = useState<
    Map<string, string>
  >(new Map());

  // Picker tab + search (inside component)
  const [pickerTab, setPickerTab] = useState<"char" | "weng">("char");
  const [pickerQuery, setPickerQuery] = useState("");

  const [charMeta, setCharMeta] = useState<
    Record<
      string,
      { name: string; image_url: string; subname?: string; rarity?: number }
    >
  >({});

  const [wengMeta, setWengMeta] = useState<
    Record<
      string,
      { name: string; image_url: string; subname?: string; rarity?: number }
    >
  >({});

  // Local search in the editor tables
  const [charSearch, setCharSearch] = useState("");
  const [wengSearch, setWengSearch] = useState("");

  // Load meta and RETURN a fresh snapshot you can use immediately.
  async function ensurePresetMetaLoaded(): Promise<{
    cMap: Record<string, any>;
    wMap: Record<string, any>;
  }> {
    // If already in state, just return it
    if (Object.keys(charMeta).length && Object.keys(wengMeta).length) {
      return { cMap: charMeta, wMap: wengMeta };
    }
    try {
      const [cRes, wRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/characters`, {
          credentials: "include",
        }),
        fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/wengines`, {
          credentials: "include",
        }),
      ]);
      const [cJ, wJ] = await Promise.all([cRes.json(), wRes.json()]);

      const cMap: Record<string, any> = {};
      (cJ?.data ?? []).forEach((c: any) => {
        cMap[c.code] = {
          name: c.name,
          image_url: c.image_url,
          subname: c.subname,
          rarity: c.rarity,
        };
      });

      const wMap: Record<string, any> = {};
      (wJ?.data ?? []).forEach((w: any) => {
        wMap[String(w.id)] = {
          name: w.name,
          image_url: w.image_url,
          subname: w.subname,
          rarity: Number(w.rarity) || 0,
        };
      });

      // Update state for UI; also return the fresh maps for immediate use
      setCharMeta(cMap);
      setWengMeta(wMap);
      return { cMap, wMap };
    } catch {
      // Fall back to whatever is in state (may be empty)
      return { cMap: charMeta, wMap: wengMeta };
    }
  }

  // characters: sort by rarity (desc) then name (A→Z)
  const sortCharsByRarityThenName = (aCode: string, bCode: string) => {
    const a = charMeta[aCode] ?? {};
    const b = charMeta[bCode] ?? {};
    const ra = Number(a.rarity) || 0;
    const rb = Number(b.rarity) || 0;
    if (ra !== rb) return rb - ra; // 5 before 4 before others
    const an = (a.name ?? a.subname ?? aCode).toLowerCase();
    const bn = (b.name ?? b.subname ?? bCode).toLowerCase();
    return an.localeCompare(bn);
  };

  // w-engines: sort by rarity (desc) then name (A→Z)
  const sortWengByRarityThenName = (aId: string, bId: string) => {
    const a = wengMeta[aId] ?? {};
    const b = wengMeta[bId] ?? {};
    const ra = Number(a.rarity) || 0;
    const rb = Number(b.rarity) || 0;
    if (ra !== rb) return rb - ra;
    const an = (a.name ?? a.subname ?? aId).toLowerCase();
    const bn = (b.name ?? b.subname ?? bId).toLowerCase();
    return an.localeCompare(bn);
  };

  useEffect(() => {
    if (!showFeaturedModal) return;

    (async () => {
      try {
        const [cRes, wRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/characters`, {
            credentials: "include",
          }),
          fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/wengines`, {
            credentials: "include",
          }),
        ]);
        const [cJson, wJson] = await Promise.all([cRes.json(), wRes.json()]);

        // explicitly type as ZzzChar[]
        const chars: ZzzChar[] = (cJson?.data ?? []).map((c: any) => ({
          code: c.code,
          name: c.name,
          subname: c.subname,
          image_url: c.image_url,
        }));

        // explicitly type as ZzzWeng[]
        const wengs: ZzzWeng[] = (wJson?.data ?? []).map((w: any) => ({
          id: String(w.id),
          name: w.name,
          subname: w.subname,
          rarity: Number(w.rarity) || 0,
          limited: Boolean(w.limited),
          image_url: w.image_url,
        }));

        setCharPool(chars);
        setWengPool(wengs);

        const map = new Map<string, string>();
        chars.forEach((c: ZzzChar) => {
          const sub = (c.subname || "").toLowerCase();
          if (sub && sub !== "null") map.set(sub, c.name);
        });
        setSubnameToCharName(map);
      } catch {
        setCharPool([]);
        setWengPool([]);
      }
    })();
  }, [showFeaturedModal]);

  const { user } = useAuth();

  // Cost Presets UI state
  const [showCostModal, setShowCostModal] = useState(false);

  // The two presets max (from server)
  const [costPresets, setCostPresets] = useState<CostProfile[]>([]);
  // Which profile will this draft use (null => Default rules)
  const [selectedCostProfileId, setSelectedCostProfileId] = useState<
    string | null
  >(null);

  // after showPenaltyPill etc.
  const presetLabel = selectedCostProfileId
    ? costPresets.find((p) => p.id === selectedCostProfileId)?.name ?? "Preset"
    : DEFAULT_COST_LABEL;

  // Editing buffer inside the modal
  const [costEditing, setCostEditing] = useState<CostProfile | null>(null);
  const [costLoading, setCostLoading] = useState(false);

  // -------- Preset import/export (CSV) --------
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

  // Robust CSV parser: auto-detects delimiter (;, tab, or ,) and handles quotes/BOM
  const parseCsv = (text: string): string[][] => {
    const data = text.replace(/\r/g, "");
    const lines = data.split("\n");

    // Detect delimiter from first non-empty line (Excel EU often uses ';')
    const first = lines.find((l) => l.trim().length > 0) || "";
    let delim = ",";
    if (first.includes(";") && !first.includes(",")) delim = ";";
    else if (first.includes("\t")) delim = "\t";

    const out: string[][] = [];
    for (const raw of lines) {
      // keep blank lines to preserve section split
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
          row.push(cell.trim().replace(/^\uFEFF/, "")); // strip BOM if present
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

  // Parse numbers in 0.25 steps; accepts "0,5" etc.
  // Parse numbers in 0.25 steps; accepts "0,5", "1.25", "1.234,5", "1,234.5"
  const parseQuarter = (v: any): number => {
    if (v == null) return 0;
    let s = String(v).trim();
    if (!s || s === "-" || s === "—") return 0;

    // remove spaces (incl. NBSP/thin spaces) often used as thousands separators
    s = s.replace(/[\s\u00A0\u2000-\u200B\u202F]/g, "");

    // If both '.' and ',' exist, assume the rightmost is the decimal separator
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastComma > -1 && lastDot > -1) {
      if (lastComma > lastDot) {
        // 1.234,56 -> remove dots (thousands), turn comma to dot
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        // 1,234.56 -> remove commas (thousands)
        s = s.replace(/,/g, "");
      }
    } else if (lastComma > -1 && lastDot === -1) {
      // only comma -> decimal comma
      s = s.replace(",", ".");
    } // only dot -> already decimal dot

    const num = Number(s);
    if (!isFinite(num) || num < 0) return 0;
    return Math.round(num * 4) / 4;
  };

  // zero-fill helpers — accept meta so we can use fresh snapshots
  const buildZeroCharMs = (meta: Record<string, any> = charMeta) => {
    const out: Record<string, number[]> = {};
    Object.keys(meta).forEach((code) => {
      out[code] = [0, 0, 0, 0, 0, 0, 0];
    });
    return out;
  };
  const buildZeroWePhase = (meta: Record<string, any> = wengMeta) => {
    const out: Record<string, number[]> = {};
    Object.keys(meta).forEach((id) => {
      out[id] = [0, 0, 0, 0, 0];
    });
    return out;
  };

  /* ================= TEMPLATE (single CSV with two sections) ================= */
  const downloadPresetTemplateCsv = async () => {
    if (!Object.keys(charMeta).length || !Object.keys(wengMeta).length) {
      await ensurePresetMetaLoaded();
    }

    const rows: (string | number)[][] = [
      ["NAME", "My Preset"],
      ["VERSION", 2],
      [],
    ];

    // Characters
    rows.push(["Characters"]);
    rows.push(["code", "name", "M0", "M1", "M2", "M3", "M4", "M5", "M6"]);

    Object.keys(charMeta)
      .sort((a, b) =>
        (charMeta[a]?.name || a).localeCompare(charMeta[b]?.name || b)
      )
      .forEach((code) => {
        rows.push([code, charMeta[code]?.name || code, 0, 0, 0, 0, 0, 0, 0]);
      });

    // W-Engines
    rows.push([]);
    rows.push(["W-Engines"]);
    rows.push(["id", "name", "subname", "P1", "P2", "P3", "P4", "P5"]);

    Object.keys(wengMeta)
      .sort((a, b) =>
        (wengMeta[a]?.name || a).localeCompare(wengMeta[b]?.name || b)
      )
      .forEach((id) => {
        const m = wengMeta[id] || {};
        rows.push([id, m.name || id, m.subname || "", 0, 0, 0, 0, 0]);
      });

    downloadCsv("preset-template.csv", rows);
    toast.success("Template CSV downloaded.");
  };

  /* ================= IMPORT (single combined CSV; also tolerates old files) ================= */
  const handleChooseImportCsv = async () => {
    if (!Object.keys(charMeta).length || !Object.keys(wengMeta).length) {
      await ensurePresetMetaLoaded();
    }
    importCsvInputRef.current?.click();
  };

  // Build robust lookups

  // Normalizes strings for fuzzy matching (diacritics/spacing/punct)
  const normalizeKey = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip diacritics
      .replace(/[\s\u00A0\u2000-\u200B\u202F]/g, "") // strip spaces (incl. NBSP)
      .replace(/[^a-z0-9]/g, ""); // strip punctuation

  const buildLookups = (
    cMeta: Record<string, any> = charMeta,
    wMeta: Record<string, any> = wengMeta
  ) => {
    // Characters
    const charNameToCode = new Map<string, string>(); // exact lower name -> code
    const charNameKeyToCode = new Map<string, string>(); // normalized key -> code
    const charCodeToCode = new Map<string, string>(); // lower code -> code

    Object.keys(cMeta).forEach((code) => {
      const nm = (cMeta[code]?.name || "").trim();
      if (nm) {
        charNameToCode.set(nm.toLowerCase(), code);
        charNameKeyToCode.set(normalizeKey(nm), code);
      }
      charCodeToCode.set(code.toLowerCase(), code);
    });

    // W-Engines
    const wengPairToId = new Map<string, string>(); // "name|subname" (lower) -> id
    const wengPairKeyToId = new Map<string, string>(); // normalized pair -> id
    const wengUniqueNameToId: Record<string, string> = {}; // unique exact name -> id
    const wengNameCounts: Record<string, number> = {};
    const wengNameOnlyToIds: Record<string, string[]> = {};
    const wengIdToId = new Map<string, string>(); // lower id -> id

    Object.keys(wMeta).forEach((id) => {
      const wm = wMeta[id] || {};
      const n = (wm.name || "").trim();
      const s = (wm.subname || "").trim();
      const keyExact = `${n.toLowerCase()}|${s.toLowerCase()}`;
      const keyNorm = `${normalizeKey(n)}|${normalizeKey(s)}`;
      wengPairToId.set(keyExact, id);
      wengPairKeyToId.set(keyNorm, id);

      if (n) {
        const ln = n.toLowerCase();
        wengNameCounts[ln] = (wengNameCounts[ln] || 0) + 1;
        (wengNameOnlyToIds[ln] ||= []).push(id);
      }
      wengIdToId.set(String(id).toLowerCase(), id);
    });

    Object.keys(wengNameCounts).forEach((ln) => {
      if (wengNameCounts[ln] === 1)
        wengUniqueNameToId[ln] = wengNameOnlyToIds[ln][0];
    });

    return {
      charNameToCode,
      charNameKeyToCode,
      charCodeToCode,
      wengPairToId,
      wengPairKeyToId,
      wengUniqueNameToId,
      wengIdToId,
    };
  };

  const handleImportCombinedCsv = async (
    ev: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;

    try {
      // ⚠️ Get a fresh snapshot of meta and use it immediately
      const { cMap, wMap } = await ensurePresetMetaLoaded();

      // Read raw text – DO NOT pre-rewrite delimiters here
      const text = await file.text();

      const rows = parseCsv(text);
      if (!rows.length) {
        toast.error("Empty CSV.");
        return;
      }

      // Build lookups from the fresh snapshot, not from (possibly stale) state
      const {
        charNameToCode,
        charNameKeyToCode,
        charCodeToCode,
        wengPairToId,
        wengPairKeyToId,
        wengUniqueNameToId,
        wengIdToId,
      } = buildLookups(cMap, wMap);

      let presetName: string | null = null;
      let mode: "none" | "chars" | "weng" = "none";

      // header index maps (filled when we encounter a header)
      let cIdx: { name?: number; code?: number; m: number[] } | null = null;
      let wIdx: {
        name?: number;
        subname?: number;
        id?: number;
        p: number[];
      } | null = null;

      let lastCharHeader: { name?: number; code?: number; m: number[] } | null =
        null;
      let lastWengHeader: {
        name?: number;
        subname?: number;
        id?: number;
        p: number[];
      } | null = null;

      const nextCharMs: Record<string, number[]> = {};
      const nextWe: Record<string, number[]> = {};
      const unknownChars: string[] = [];
      const unknownWengs: string[] = [];

      const findIndexCI = (arr: string[], label: string) =>
        arr.findIndex(
          (h) => (h || "").trim().toLowerCase() === label.toLowerCase()
        );

      const isCharsHeader = (r: string[]) => {
        const hasName = findIndexCI(r, "name") !== -1;
        const hasCode = findIndexCI(r, "code") !== -1; // backwards compat
        const ms = ["m0", "m1", "m2", "m3", "m4", "m5", "m6"].map((k) =>
          findIndexCI(r, k)
        );
        return ms.every((i) => i !== -1) && (hasName || hasCode);
      };

      const isWengHeader = (r: string[]) => {
        const hasName = findIndexCI(r, "name") !== -1;
        const hasId = findIndexCI(r, "id") !== -1; // backwards compat
        const ps = ["p1", "p2", "p3", "p4", "p5"].map((k) => findIndexCI(r, k));
        return ps.every((i) => i !== -1) && (hasName || hasId);
      };

      const norm = (s: any) =>
        String(s ?? "")
          .trim()
          .replace(/^\uFEFF/, "");
      const normSub = (s: any) => {
        const t = norm(s).toLowerCase();
        return t === "" || t === "null" || t === "-" || t === "—" ? "" : t;
      };

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length === 0) continue;

        if (/^name$/i.test(norm(r[0]))) {
          presetName = (norm(r[1]) || "Imported Preset").slice(0, 40);
          continue;
        }
        if (/^version$/i.test(norm(r[0]))) {
          continue; // reserved
        }

        // Section banners (optional)
        if (/^characters$/i.test(norm(r[0]))) {
          mode = "chars";
          cIdx = lastCharHeader || cIdx;
          continue;
        }
        if (/^w-?engines$/i.test(norm(r[0]))) {
          mode = "weng";
          wIdx = lastWengHeader || wIdx;
          continue;
        }

        // Header detection
        if (isCharsHeader(r.map(norm))) {
          mode = "chars";
          cIdx = {
            name: findIndexCI(r.map(norm), "name"),
            code: findIndexCI(r.map(norm), "code"),
            m: ["m0", "m1", "m2", "m3", "m4", "m5", "m6"].map((k) =>
              findIndexCI(r.map(norm), k)
            ),
          };
          lastCharHeader = cIdx; // 🔹 NEW
          continue;
        }

        if (isWengHeader(r.map(norm))) {
          mode = "weng";
          wIdx = {
            name: findIndexCI(r.map(norm), "name"),
            subname: findIndexCI(r.map(norm), "subname"),
            id: findIndexCI(r.map(norm), "id"),
            p: ["p1", "p2", "p3", "p4", "p5"].map((k) =>
              findIndexCI(r.map(norm), k)
            ),
          };
          lastWengHeader = wIdx; // 🔹 NEW
          continue;
        }

        // Data rows
        if (mode === "chars" && cIdx) {
          let code = "";

          if (cIdx.code != null && cIdx.code >= 0) {
            const rawCode = norm(r[cIdx.code]).toLowerCase();
            code = charCodeToCode.get(rawCode) || "";
          }

          if (!code && cIdx.name != null && cIdx.name >= 0) {
            const rawName = norm(r[cIdx.name]);
            const ln = rawName.toLowerCase();
            code =
              charNameToCode.get(ln) ||
              charNameKeyToCode.get(normalizeKey(rawName)) ||
              charCodeToCode.get(ln) ||
              "";
          }

          // NEW
          if (!code) {
            const suspected =
              norm(r[cIdx.name ?? 0]) || norm(r[cIdx.code ?? 0]) || "";
            if (suspected) unknownChars.push(`${suspected} @row ${i + 1}`);
            continue;
          }

          const arr = cIdx.m.map((ix) => parseQuarter(ix >= 0 ? r[ix] : 0));
          nextCharMs[code] = arr;
          continue;
        }

        if (mode === "weng" && wIdx) {
          let id = "";
          const nm =
            wIdx.name != null && wIdx.name >= 0 ? norm(r[wIdx.name]) : "";
          const sb =
            wIdx.subname != null && wIdx.subname >= 0
              ? normSub(r[wIdx.subname])
              : "";
          const nlow = nm.toLowerCase();

          if (nm) {
            id =
              wengPairToId.get(`${nlow}|${sb}`) ||
              wengPairKeyToId.get(`${normalizeKey(nm)}|${normalizeKey(sb)}`) ||
              "";
            if (!id && wIdx.id != null && wIdx.id >= 0) {
              const rawId = norm(r[wIdx.id]).toLowerCase();
              id = wengIdToId.get(rawId) || "";
            }
            if (!id) {
              const uniq = wengUniqueNameToId[nlow];
              if (uniq) id = uniq;
            }
          } else if (wIdx.id != null && wIdx.id >= 0) {
            const rawId = norm(r[wIdx.id]).toLowerCase();
            id = wengIdToId.get(rawId) || "";
          }

          if (!id) {
            const pretty = sb ? `${nm} (${sb})` : nm || norm(r[wIdx.id ?? 0]);
            if (pretty) unknownWengs.push(`${pretty} @row ${i + 1}`);
            continue;
          }

          const arr = wIdx.p.map((ix) => parseQuarter(ix >= 0 ? r[ix] : 0));
          nextWe[id] = arr;
          continue;
        }
      }

      // Decide overwrite target: current editor -> selected preset -> new
      const base: CostProfile | null =
        costEditing ??
        (selectedCostProfileId
          ? costPresets.find((p) => p.id === selectedCostProfileId) ?? null
          : null);

      const baseId = base?.id ?? "NEW";
      const baseName = presetName || base?.name || "Imported Preset";

      // Always include ALL current meta (covers newly added items)
      const charZeros = buildZeroCharMs(cMap);
      const weZeros = buildZeroWePhase(wMap);

      // OVERWRITE semantics: reset to zeros, then apply imported values
      const mergedChars: Record<string, number[]> = {
        ...charZeros,
        ...nextCharMs,
      };
      const mergedWe: Record<string, number[]> = { ...weZeros, ...nextWe };

      const imported: CostProfile = {
        id: baseId,
        name: baseName,
        charMs: mergedChars,
        wePhase: mergedWe,
      };

      setCostEditing(imported);
      setShowCostModal(true);

      const notes: string[] = [];
      const cU = Object.keys(nextCharMs).length;
      const wU = Object.keys(nextWe).length;
      if (cU || wU) notes.push(`Updated ${cU} characters, ${wU} W-Engines`);
      if (unknownChars.length) {
        const preview = unknownChars.slice(0, 5).join(", ");
        notes.push(
          `${unknownChars.length} character name(s) not recognized` +
            (unknownChars.length <= 5 ? `: ${preview}` : "")
        );
      }

      if (unknownWengs.length)
        notes.push(`${unknownWengs.length} W-Engine name(s) not recognized`);

      toast[unknownChars.length || unknownWengs.length ? "warn" : "success"](
        notes.join(" • ") || "Imported."
      );
    } catch {
      toast.error("Could not read CSV file.");
    }
  };

  // keep compatibility if your <input onChange={handleImportCsvFile}> is already wired
  const handleImportCsvFile = handleImportCombinedCsv;

  /* ================= EXPORT (combined CSV) ================= */
  const exportEditingCombinedCsv = async () => {
    if (!costEditing) {
      toast.info("Open a preset in the editor first.");
      return;
    }
    if (!Object.keys(charMeta).length || !Object.keys(wengMeta).length) {
      await ensurePresetMetaLoaded();
    }

    const rows: (string | number)[][] = [
      ["NAME", costEditing.name || "My Preset"],
      ["VERSION", 2],
      [],
      ["Characters"],
      // ✅ include code column
      ["code", "name", "M0", "M1", "M2", "M3", "M4", "M5", "M6"],
    ];

    Object.keys(buildZeroCharMs())
      .sort((a, b) =>
        (charMeta[a]?.name || a).localeCompare(charMeta[b]?.name || b)
      )
      .forEach((code) => {
        const nm = charMeta[code]?.name || code;
        const v = costEditing.charMs[code] ?? [0, 0, 0, 0, 0, 0, 0];
        rows.push([code, nm, ...v]); // ← include code in each row
      });

    rows.push([]);
    rows.push(["W-Engines"]);
    // ✅ include id column
    rows.push(["id", "name", "subname", "P1", "P2", "P3", "P4", "P5"]);

    Object.keys(buildZeroWePhase())
      .sort((a, b) =>
        (wengMeta[a]?.name || a).localeCompare(wengMeta[b]?.name || b)
      )
      .forEach((id) => {
        const wm = wengMeta[id] || {};
        const v = costEditing.wePhase[id] ?? [0, 0, 0, 0, 0];
        rows.push([id, wm.name || id, wm.subname || "", ...v]); // ← include id
      });

    const fn = `${(costEditing.name || "preset").replace(/\s+/g, "_")}.csv`;
    downloadCsv(fn, rows);
    toast.success("Exported CSV.");
  };

  const exportPresetCombinedCsv = async (p: CostProfile) => {
    if (!Object.keys(charMeta).length || !Object.keys(wengMeta).length) {
      await ensurePresetMetaLoaded();
    }

    const rows: (string | number)[][] = [
      ["NAME", p.name || "My Preset"],
      ["VERSION", 2],
      [],
      ["Characters"],
      // ✅ include code column
      ["code", "name", "M0", "M1", "M2", "M3", "M4", "M5", "M6"],
    ];

    Object.keys(buildZeroCharMs())
      .sort((a, b) =>
        (charMeta[a]?.name || a).localeCompare(charMeta[b]?.name || b)
      )
      .forEach((code) => {
        const nm = charMeta[code]?.name || code;
        const v = p.charMs[code] ?? [0, 0, 0, 0, 0, 0, 0];
        rows.push([code, nm, ...v]);
      });

    rows.push([]);
    rows.push(["W-Engines"]);
    // ✅ include id column
    rows.push(["id", "name", "subname", "P1", "P2", "P3", "P4", "P5"]);

    Object.keys(buildZeroWePhase())
      .sort((a, b) =>
        (wengMeta[a]?.name || a).localeCompare(wengMeta[b]?.name || b)
      )
      .forEach((id) => {
        const wm = wengMeta[id] || {};
        const v = p.wePhase[id] ?? [0, 0, 0, 0, 0];
        rows.push([id, wm.name || id, wm.subname || "", ...v]);
      });

    const nm = (p.name || "preset").replace(/\s+/g, "_");
    downloadCsv(`${nm}.csv`, rows);
    toast.success("Preset exported.");
  };

  // Gate visibility by login
  const isLoggedIn = !!user;

  async function loadCostPresets() {
    if (!isLoggedIn) {
      setCostPresets([]);
      return;
    }
    try {
      setCostLoading(true);
      const r = await fetch(
        `${import.meta.env.VITE_API_BASE}/api/zzz/cost-presets/my`,
        { credentials: "include" }
      );
      const j = r.ok ? await r.json() : { data: [] };
      setCostPresets(Array.isArray(j.data) ? j.data.slice(0, 2) : []);
    } catch {
      setCostPresets([]);
    } finally {
      setCostLoading(false);
    }
  }
  useEffect(() => {
    loadCostPresets();
  }, [isLoggedIn]);

  // ORIGINAL: per-player inputs
  const [team1Names, setTeam1Names] = useState<string[]>(
    Array(nPlayers).fill("")
  );
  const [team2Names, setTeam2Names] = useState<string[]>(
    Array(nPlayers).fill("")
  );

  // Rules modal
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Team popup data
  const [hsrTeamProfiles, setHsrTeamProfiles] = useState<any[]>([]);
  const [genshinTeamProfiles, setGenshinTeamProfiles] = useState<any[]>([]);
  const [zzzTeamProfiles, setZzzTeamProfiles] = useState<any[]>([]);

  const navigate = useNavigate();
  const location = useLocation();

  const [randomizeLocked, setRandomizeLocked] = useState(false);

  const gamesel = games[selected];
  const team =
    gamesel.id === "hsr"
      ? hsrTeamProfiles
      : gamesel.id === "hsr2"
      ? genshinTeamProfiles
      : gamesel.id === "zzz"
      ? zzzTeamProfiles
      : [];

  // Ko-fi widget
  useEffect(() => {
    if (document.getElementById("kofi-widget-script")) {
      const w = (window as any).kofiWidgetOverlay;
      if (w) {
        w.draw("haya28", {
          type: "floating-chat",
          "floating-chat.donateButton.text": "Support Us",
          "floating-chat.donateButton.background-color": "#8b5cf6",
          "floating-chat.donateButton.text-color": "#ffffff",
        });
      }
      return;
    }
    const script = document.createElement("script");
    script.id = "kofi-widget-script";
    script.src = "https://storage.ko-fi.com/cdn/scripts/overlay-widget.js";
    script.async = true;
    script.onload = () => {
      const w = (window as any).kofiWidgetOverlay;
      if (w) {
        w.draw("haya28", {
          type: "floating-chat",
          "floating-chat.donateButton.text": "Support Us",
          "floating-chat.donateButton.background-color": "#8b5cf6",
          "floating-chat.donateButton.text-color": "#ffffff",
        });
      }
    };
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (showDraftModal) setRandomizeLocked(false);
  }, [showDraftModal]);

  // Background crossfade
  useEffect(() => {
    if (!bgFading) return;
    const t = setTimeout(() => {
      setCurrentBg(fadeBg);
      setBgFading(false);
    }, 600);
    return () => clearTimeout(t);
  }, [bgFading, fadeBg]);

  const changeGame = (i: number) => {
    if (games[i].bg === currentBg) return;
    setFadeBg(games[i].bg);
    setBgFading(true);
    setSelected(i);
  };

  const gotoLivePage = (url: string) => {
    setLeaving(true);
    setTimeout(() => navigate(url), 500);
  };

  // Match History modal state
  const [showMatchesModal, setShowMatchesModal] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [liveDrafts, setLiveDrafts] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);

  // Match History pagination (Completed)
  const RECENT_PAGE_SIZE = 10;
  const [recentPage, setRecentPage] = useState(1);

  const fetchMatches = async () => {
    setLoadingMatches(true);
    try {
      const [liveRes, recentRes] = await Promise.all([
        fetch(
          `${
            import.meta.env.VITE_API_BASE
          }/api/zzz/matches/live?limit=8&minutes=120`,
          { credentials: "include" }
        ),
        fetch(
          `${import.meta.env.VITE_API_BASE}/api/zzz/matches/recent?limit=50`,
          { credentials: "include" }
        ), // was 20
      ]);
      const liveJson = liveRes.ok ? await liveRes.json() : { data: [] };
      const recentJson = recentRes.ok ? await recentRes.json() : { data: [] };
      setLiveDrafts(Array.isArray(liveJson.data) ? liveJson.data : []);
      setRecentMatches(Array.isArray(recentJson.data) ? recentJson.data : []);
      setRecentPage(1); // reset to first page on refresh
    } catch {
      setLiveDrafts([]);
      setRecentMatches([]);
    } finally {
      setLoadingMatches(false);
    }
  };

  const openMatches = () => {
    setShowMatchesModal(true);
    setRecentPage(1); // ensure we open on page 1
    fetchMatches();
  };

  // keep page in range if new fetch shrinks the list
  useEffect(() => {
    if (!showMatchesModal) return;
    const totalPages = Math.max(
      1,
      Math.ceil(recentMatches.length / RECENT_PAGE_SIZE)
    );
    if (recentPage > totalPages) setRecentPage(totalPages);
  }, [recentMatches.length, showMatchesModal]);

  const goSpectator = (key: string) => {
    setLeaving(true);
    setTimeout(() => navigate(`/zzz/s/${key}`), 250);
  };

  const fmtWhen = (ts?: string) => {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return "";
    }
  };

  // Cached fetch of team avatars
  const fetchProfiles = async (
    teamList: { id: string; role: string }[],
    cacheKey: "hsr" | "genshin" | "zzz",
    setter: (profiles: any[]) => void
  ) => {
    if (teamCache[cacheKey]) {
      setter(teamCache[cacheKey]!);
      return;
    }
    const results = await Promise.all(
      teamList.map((member) =>
        fetch(
          `${import.meta.env.VITE_API_BASE}/api/player/${member.id}/summary`,
          {
            credentials: "include",
          }
        )
          .then((res) => (res.ok ? res.json() : null))
          .then((data) =>
            data
              ? {
                  id: member.id,
                  avatar: data.avatar,
                  username: data.username,
                  global_name: data.global_name,
                  role: member.role,
                }
              : null
          )
          .catch(() => null)
      )
    );
    const filtered = results.filter(Boolean) as any[];
    teamCache[cacheKey] = filtered;
    setter(filtered);
  };

  useEffect(() => {
    if (showDraftModal && !user) {
      toast.warning("You are not logged in — this match will NOT be recorded.");
    }
  }, [showDraftModal, user]);

  useEffect(() => {
    const s = location.state as { blocked?: string } | null;
    const blocked = s?.blocked;

    if (!blocked) return;

    const msg =
      blocked === "zzz-draft-mobile"
        ? "Vivian PvP draft is desktop-only for now."
        : blocked === "zzz-draft-no-team"
        ? "Please start a draft from the landing page."
        : blocked === "zzz-spectator-mobile"
        ? "Spectator view is desktop-only for now."
        : "Redirected.";

    toast.info(msg);

    // Clear the state so it won't fire again on internal nav
    navigate(location.pathname + location.search, { replace: true, state: {} });
  }, [location.state, location.pathname, location.search, navigate]);

  useEffect(() => {
    fetchProfiles(hsrTeamIds, "hsr", setHsrTeamProfiles);
    fetchProfiles(genshinTeamIds, "genshin", setGenshinTeamProfiles);
    fetchProfiles(zzzTeamIds, "zzz", setZzzTeamProfiles);
  }, []);

  /* Keep player arrays in sync when mode changes */
  useEffect(() => {
    const len = is3v3 ? 3 : 2;
    setTeam1Names((prev) => ensureLen(prev, len));
    setTeam2Names((prev) => ensureLen(prev, len));
  }, [is3v3]);

  /* Randomize using only what’s typed in the two team boxes */
  const handleRandomizeFromFields = () => {
    if (randomizeLocked) return;
    const m = modeRef.current;
    const len = m === "3v3" ? 3 : 2;

    const pool = [...ensureLen(team1Names, len), ...ensureLen(team2Names, len)]
      .map((s) => (s ?? "").trim())
      .filter(Boolean);

    if (pool.length === 0) {
      toast.info("Enter some names first, then hit Randomize.");
      return;
    }

    const shuf = shuffle(pool);
    const next1 = Array(len)
      .fill("")
      .map((_, i) => shuf[i] ?? "");
    const next2 = Array(len)
      .fill("")
      .map((_, i) => shuf[i + len] ?? "");

    setTeam1Names(next1);
    setTeam2Names(next2);
    setRandomizeLocked(true);
  };

  /* ─────────── owner unfinished session handling ─────────── */
  const [ownerOpen, setOwnerOpen] = useState<null | {
    key: string;
    mode: "2v2" | "3v3";
    team1: string;
    team2: string;
  }>(null);

  // NEW: confirm-delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/api/zzz/sessions/open`,
          {
            credentials: "include",
          }
        );
        if (!res.ok) {
          setOwnerOpen(null);
          return;
        }
        const row = await res.json();
        setOwnerOpen({
          key: row.key,
          mode: row.mode,
          team1: row.team1,
          team2: row.team2,
        });
      } catch {
        setOwnerOpen(null);
      }
    })();
  }, []);

  const clearLocalDraftKeys = () => {
    try {
      sessionStorage.removeItem("zzzSpectatorKey");
      sessionStorage.removeItem("zzzDraftInit");
      sessionStorage.removeItem("zzzDraftId");
    } catch {}
  };

  const resumeUnfinished = () => {
    if (!ownerOpen) return;
    sessionStorage.setItem("zzzSpectatorKey", ownerOpen.key);
    sessionStorage.setItem(
      "zzzDraftInit",
      JSON.stringify({
        team1: ownerOpen.team1,
        team2: ownerOpen.team2,
        mode: ownerOpen.mode,
      })
    );
    if (!sessionStorage.getItem("zzzDraftId")) {
      const draftId =
        (crypto as any).randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem("zzzDraftId", draftId);
    }
    setLeaving(true);
    setTimeout(() => navigate("/zzz/draft"), 250);
  };

  // NEW: delete unfinished draft
  const confirmDeleteUnfinished = async () => {
    if (!ownerOpen) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/api/zzz/sessions/${ownerOpen.key}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (!res.ok) {
        const msg = await res
          .json()
          .catch(() => ({ error: "Failed to delete" }));
        toast.error(msg.error || "Failed to delete draft.");
        return;
      }
      // success
      clearLocalDraftKeys();
      setOwnerOpen(null);
      setShowDeleteModal(false);
      toast.success("Unfinished draft deleted.");

      // Open the Start Draft modal so they can start a new one immediately
      setShowDraftModal(true);
    } catch (e) {
      toast.error("Network error deleting draft.");
    } finally {
      setDeleting(false);
    }
  };
  /* ─────────── END owner unfinished session handling ─────────── */

  const handleStart = () => {
    // If an unfinished draft exists, show resume/delete guidance instead
    if (ownerOpen) {
      toast.warn(
        "You have an unfinished Vivian PvP draft. You can resume it, or delete it to start fresh."
      );
      return;
    }

    // 🛑 Block starting ZZZ draft on mobile
    if (gamesel.id === "zzz" && isMobile) {
      toast.warn(
        "Vivian PvP draft is desktop-only for now. Please use a laptop/desktop."
      );
      return;
    }

    const m = modeRef.current;
    const len = m === "3v3" ? 3 : 2;

    const safe1 = ensureLen(team1Names, len).map((s) => (s ?? "").trim());
    const safe2 = ensureLen(team2Names, len).map((s) => (s ?? "").trim());

    const anyName = [...safe1, ...safe2].some((n) => n !== "");
    if (!anyName) {
      toast.warn("Please enter at least one player name.");
      return;
    }

    const t1 = safe1.filter(Boolean).join("|");
    const t2 = safe2.filter(Boolean).join("|");

    const [team1, team2] = Math.random() < 0.5 ? [t1, t2] : [t2, t1];

    // Featured validation: every item must have a rule or custom cost
    const invalidFeatured = featuredList.some(
      (f) => f.rule === "none" && typeof f.customCost !== "number"
    );
    if (invalidFeatured) {
      setShowFeaturedModal(true);
      toast.error("Fix featured items: add a rule or a custom cost to each.");
      return;
    }

    const payload = {
      team1,
      team2,
      mode: m,
      costProfileId: selectedCostProfileId ?? null,
      featured: featuredList.map((f) => ({
        kind: f.kind, // "character" | "wengine"
        code: f.kind === "character" ? f.code! : undefined,
        id: f.kind === "wengine" ? f.id! : undefined,
        customCost: typeof f.customCost === "number" ? f.customCost : null,
        rule: f.rule,
        name: f.name,
        image_url: f.image_url,
      })),
      costLimit,
      penaltyPerPoint,
    };

    const draftId =
      (crypto as any).randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    sessionStorage.setItem("zzzDraftId", draftId);
    sessionStorage.setItem("zzzDraftInit", JSON.stringify(payload));
    sessionStorage.removeItem("zzzSpectatorKey");

    navigate("/zzz/draft", { state: { ...payload, draftId } });
  };

  // Pre-fill from URL; do NOT auto-open draft on mobile
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("game") === "zzz" && params.get("draft") === "1") {
      if (isMobile) {
        toast.info("Vivian PvP draft is desktop-only for now.");
        return;
      }
      setShowDraftModal(true);

      const m = (params.get("mode") as "2v2" | "3v3") || "2v2";
      setMode(m);
      modeRef.current = m;

      const len = m === "3v3" ? 3 : 2;
      const t1 = (params.get("team1") || "").split("|").filter(Boolean);
      const t2 = (params.get("team2") || "").split("|").filter(Boolean);

      setTeam1Names(ensureLen(t1, len));
      setTeam2Names(ensureLen(t2, len));
    }
  }, [location.search, isMobile]);

  const canSaveFeatured = featuredList.every(
    (f) => f.rule !== "none" || typeof f.customCost === "number"
  );

  const totalRecentPages = Math.max(
    1,
    Math.ceil(recentMatches.length / RECENT_PAGE_SIZE)
  );
  const recentStart = (recentPage - 1) * RECENT_PAGE_SIZE;
  const recentPageItems = recentMatches.slice(
    recentStart,
    recentStart + RECENT_PAGE_SIZE
  );

  return (
    <div className={`landing-wrapper ${leaving ? "fade-out" : ""}`}>
      <div
        className="bg-layer"
        style={{ backgroundImage: `url(${currentBg})` }}
      />
      {bgFading && (
        <div
          className="bg-layer fading-in"
          style={{ backgroundImage: `url(${fadeBg})` }}
        />
      )}
      <div className="overlay" />

      <div
        className="position-relative z-2 text-white d-flex flex-column px-4"
        style={{ minHeight: "100vh" }}
      >
        <Navbar />

        {/* ───────────────── Start Draft Modal ───────────────── */}
        <Modal
          show={showDraftModal}
          onHide={() => setShowDraftModal(false)}
          centered
          contentClassName="custom-dark-modal"
          size="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>Start Draft</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            <div className="text-white-50 mb-3" style={{ fontSize: ".95rem" }}>
              Enter player names in the team boxes below. You can either{" "}
              <strong>Start</strong> with teams exactly as written, or click{" "}
              <strong>Randomize Teams</strong> to shuffle names into teams.
              Sides are randomized on start too.
            </div>

            {/* Mode */}
            <Form.Group className="mb-3">
              <Form.Label>Mode</Form.Label>
              <div className="d-flex gap-3">
                <Form.Check
                  inline
                  label="2v2"
                  name="mode"
                  type="radio"
                  checked={mode === "2v2"}
                  onChange={() => {
                    setMode("2v2");
                    modeRef.current = "2v2";
                  }}
                />
                <Form.Check
                  inline
                  label="3v3"
                  name="mode"
                  type="radio"
                  checked={mode === "3v3"}
                  onChange={() => {
                    setMode("3v3");
                    modeRef.current = "3v3";
                  }}
                />
              </div>
              {/* Toggle to show/hide cost inputs + summary pills */}
              {/* Toggle to show/hide cost inputs + summary pills */}
              <div className="mt-2 d-flex align-items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className={`btn btn-sm btn-glass ${
                    showCostInputs ? "btn-glass-warning" : "btn-glass-outline"
                  }`}
                  onClick={() => setShowCostInputs((s) => !s)}
                  aria-expanded={showCostInputs}
                  aria-controls="draft-cost-collapse"
                  title="Show/hide cost settings"
                >
                  {showCostInputs
                    ? "Hide cost settings ▲"
                    : "Costs & penalties ▼"}
                </button>

                {showLimitPill && (
                  <span className="badge rounded-pill bg-warning text-dark">
                    Limit {fmtQuarter(costLimit)}
                  </span>
                )}
                {showPenaltyPill && (
                  <span className="badge rounded-pill bg-warning text-dark">
                    Penalty {Number(penaltyPerPoint)}/0.25
                  </span>
                )}
              </div>

              <Collapse in={showCostInputs}>
                <div id="draft-cost-collapse" className="mt-2">
                  {/* Cost preset dropdown (same black style as Featured) */}
                  {isLoggedIn && (
                    <div className="mb-3 d-flex align-items-center gap-2 flex-wrap">
                      <Dropdown
                        className="featured-dd cost-preset-dd"
                        drop="down"
                      >
                        <Dropdown.Toggle
                          className="btn-glass text-start"
                          id="cost-preset-dd"
                          style={{ minWidth: 260 }}
                          title="Choose a saved cost preset"
                        >
                          {presetLabel}
                        </Dropdown.Toggle>

                        <Dropdown.Menu
                          variant="dark"
                          className="featured-dd-menu"
                          renderOnMount
                          flip={false}
                          popperConfig={{
                            strategy: "fixed",
                            modifiers: [
                              {
                                name: "preventOverflow",
                                options: { boundary: "viewport" },
                              },
                              { name: "offset", options: { offset: [0, 6] } },
                            ],
                          }}
                        >
                          <Dropdown.Item
                            active={!selectedCostProfileId}
                            onClick={() => setSelectedCostProfileId(null)}
                          >
                            {DEFAULT_COST_LABEL}
                          </Dropdown.Item>

                          {costPresets.map((p) => (
                            <Dropdown.Item
                              key={p.id}
                              active={selectedCostProfileId === p.id}
                              onClick={() => setSelectedCostProfileId(p.id)}
                            >
                              {p.name}
                            </Dropdown.Item>
                          ))}

                          <Dropdown.Divider />
                          <Dropdown.Item
                            onClick={async () => {
                              await ensurePresetMetaLoaded();
                              setShowCostModal(true);
                            }}
                          >
                            Manage presets…
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown>

                      <span className="text-white-50 small">
                        Use your saved preset (up to 2).
                      </span>
                    </div>
                  )}

                  {/* Cost + Penalty inputs */}
                  <div className="row g-2">
                    <div className="col-sm-6">
                      <label className="form-label">Cost limit</label>
                      <input
                        type="number"
                        step="0.25"
                        min={0}
                        className="form-control"
                        value={costLimit}
                        onChange={(e) => {
                          userTouchedCost.current = true;
                          setCostLimit(parseFloat(e.target.value) || 0);
                        }}
                      />
                      <small className="text-white-50">
                        Default: 6 (2v2), 9 (3v3)
                      </small>
                    </div>

                    <div className="col-sm-6">
                      <label className="form-label">
                        Penalty per 0.25 over
                      </label>
                      <input
                        type="number"
                        step="1"
                        min={0}
                        className="form-control"
                        value={penaltyPerPoint}
                        onChange={(e) =>
                          setPenaltyPerPoint(
                            Math.max(0, parseInt(e.target.value || "0", 10))
                          )
                        }
                      />
                      <small className="text-white-50">
                        e.g. 2500 → every 0.25 over costs 2500
                      </small>
                    </div>
                  </div>
                </div>
              </Collapse>

              <small className="text-white-50">
                Tip: for a 1v1, just fill one name and leave the rest empty.
              </small>
              <br />
              <small className="text-white-50">
                Note: You must be logged in for the match to be recorded.
              </small>
            </Form.Group>
            {featuredList.length > 0 && (
              <div
                className="p-2 rounded-3 mb-3"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div className="fw-semibold mb-2">
                  Featured ({featuredList.length})
                </div>

                <div className="d-flex flex-wrap gap-2">
                  {featuredList.map((f) => (
                    <div
                      key={f.kind === "character" ? f.code! : `we-${f.id}`}
                      className="d-flex align-items-center gap-2 px-2 py-1 rounded"
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      <img
                        src={f.image_url}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          objectFit: "cover",
                        }}
                      />
                      <div className="small">
                        <div className="fw-semibold">{f.name}</div>
                        <div className="text-white-50">
                          {f.rule === "globalBan"
                            ? "Universal Ban"
                            : f.rule === "globalPick"
                            ? "Universal Pick"
                            : "None"}
                          {typeof f.customCost === "number"
                            ? ` • Cost ${f.customCost.toFixed(2)}`
                            : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 d-flex gap-2">
                  <Button
                    size="sm"
                    className="btn-glass btn-glass-warning"
                    onClick={() => setShowFeaturedModal(true)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    className="btn-glass btn-glass-outline"
                    onClick={() => setFeaturedList([])}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
            )}

            {/* Player inputs */}
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <div
                  className="p-2 rounded-3"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div className="fw-semibold mb-2">Team 1 Players</div>
                  {Array(nPlayers)
                    .fill(0)
                    .map((_, i) => (
                      <input
                        key={i}
                        type="text"
                        className="form-control mb-2"
                        placeholder={`Player ${i + 1} name`}
                        value={team1Names[i] ?? ""}
                        maxLength={40}
                        onChange={(e) => {
                          const next = ensureLen(team1Names, nPlayers);
                          next[i] = e.target.value ?? "";
                          setTeam1Names(next);
                        }}
                        style={{
                          background: "rgba(0,0,0,0.35)",
                          color: "white",
                          border: "1px solid rgba(255,255,255,0.15)",
                        }}
                      />
                    ))}
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div
                  className="p-2 rounded-3"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div className="fw-semibold mb-2">Team 2 Players</div>
                  {Array(nPlayers)
                    .fill(0)
                    .map((_, i) => (
                      <input
                        key={i}
                        type="text"
                        className="form-control mb-2"
                        placeholder={`Player ${i + 1} name`}
                        value={team2Names[i] ?? ""}
                        maxLength={40}
                        onChange={(e) => {
                          const next = ensureLen(team2Names, nPlayers);
                          next[i] = e.target.value ?? "";
                          setTeam2Names(next);
                        }}
                        style={{
                          background: "rgba(0,0,0,0.35)",
                          color: "white",
                          border: "1px solid rgba(255,255,255,0.15)",
                        }}
                      />
                    ))}
                </div>
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer className="d-flex justify-content-between">
            <div className="d-flex gap-2">
              <Button
                className="btn-glass btn-glass-secondary"
                onClick={() => setShowDraftModal(false)}
              >
                Cancel
              </Button>
            </div>
            <div className="d-flex gap-2">
              {isLoggedIn && (
                <Button
                  className="btn-glass btn-glass-outline"
                  onClick={async () => {
                    await ensurePresetMetaLoaded();
                    setShowCostModal(true);
                  }}
                  title="Create or pick a cost preset (per-Mindscape/Phase)"
                >
                  ⚙️ Cost
                </Button>
              )}
              <Button
                className={`btn-glass ${
                  featuredList.length
                    ? "btn-glass-warning"
                    : "btn-glass-outline"
                }`}
                onClick={() => setShowFeaturedModal(true)}
                title="Configure featured (universal ban/pick and cost overrides)"
              >
                ⭐{" "}
                {featuredList.length
                  ? `Edit Featured (${featuredList.length})`
                  : "Featured"}
              </Button>

              <Button
                className="btn-glass btn-glass-outline"
                onClick={handleRandomizeFromFields}
                disabled={randomizeLocked}
                title={
                  randomizeLocked
                    ? "Locked: close and reopen this dialog to randomize again"
                    : ""
                }
              >
                🎲 {randomizeLocked ? "Randomize (Locked)" : "Randomize Teams"}
              </Button>

              <Button
                className="btn-glass btn-glass-warning"
                onClick={handleStart}
              >
                Start
              </Button>
            </div>
          </Modal.Footer>
        </Modal>

        <Modal
          show={showCostModal}
          onHide={() => {
            setShowCostModal(false);
            setCostEditing(null);
            setCharSearch("");
            setWengSearch("");
          }}
          centered
          contentClassName="custom-dark-modal"
          size="xl"
        >
          <Modal.Header closeButton>
            <Modal.Title>Cost Presets</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            {/* Preset picker row (top) */}
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <div className="d-flex align-items-center gap-2">
                <strong>My Presets</strong>
                {costLoading && (
                  <span className="text-white-50 small">Loading…</span>
                )}
              </div>
              <div className="d-flex align-items-center gap-2">
                <Button
                  className="btn-glass btn-sm"
                  onClick={loadCostPresets}
                  title="Refresh"
                >
                  Refresh
                </Button>

                <Button
                  className="btn-glass btn-sm btn-glass-outline"
                  onClick={downloadPresetTemplateCsv}
                  title="Download one CSV containing all characters & W-Engines"
                >
                  ⬇️ Template CSV
                </Button>

                <Button
                  className="btn-glass btn-sm btn-glass-outline"
                  onClick={handleChooseImportCsv}
                  title="Import a single CSV to load/replace the editor"
                >
                  ⬆️ Import CSV
                </Button>

                <Button
                  className="btn-glass btn-sm btn-glass-outline"
                  onClick={exportEditingCombinedCsv}
                  title="Export the current editor to one CSV"
                >
                  ⭳ Export CSV
                </Button>

                <Button
                  className="btn-glass btn-glass-warning btn-sm"
                  onClick={async () => {
                    setCostLoading(true);
                    try {
                      const [cRes, wRes] = await Promise.all([
                        fetch(
                          `${import.meta.env.VITE_API_BASE}/api/zzz/characters`,
                          { credentials: "include" }
                        ),
                        fetch(
                          `${import.meta.env.VITE_API_BASE}/api/zzz/wengines`,
                          { credentials: "include" }
                        ),
                      ]);
                      const [cJ, wJ] = await Promise.all([
                        cRes.json(),
                        wRes.json(),
                      ]);

                      const cMap: Record<string, any> = {};
                      (cJ?.data ?? []).forEach((c: any) => {
                        cMap[c.code] = {
                          name: c.name,
                          image_url: c.image_url,
                          subname: c.subname,
                          rarity: c.rarity,
                        };
                      });
                      const wMap: Record<string, any> = {};
                      (wJ?.data ?? []).forEach((w: any) => {
                        wMap[String(w.id)] = {
                          name: w.name,
                          image_url: w.image_url,
                          subname: w.subname,
                          rarity: w.rarity,
                        };
                      });

                      setCharMeta((prev) =>
                        Object.keys(prev).length ? prev : cMap
                      );
                      setWengMeta((prev) =>
                        Object.keys(prev).length ? prev : wMap
                      );

                      const charMs: Record<string, number[]> = {};
                      (cJ?.data ?? []).forEach((c: any) => {
                        charMs[c.code] = [0, 0, 0, 0, 0, 0, 0];
                      });

                      const wePhase: Record<string, number[]> = {};
                      (wJ?.data ?? []).forEach((w: any) => {
                        wePhase[String(w.id)] = [0, 0, 0, 0, 0];
                      });

                      setCostEditing({
                        id: "NEW",
                        name: "My Preset",
                        charMs,
                        wePhase,
                      });
                    } finally {
                      setCostLoading(false);
                    }
                  }}
                  disabled={costPresets.length >= 2}
                  title={
                    costPresets.length >= 2
                      ? "You can save up to 2 presets"
                      : "Start a new preset from defaults"
                  }
                >
                  + New Preset
                </Button>

                {/* Hidden file picker for Import CSV */}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  ref={importCsvInputRef}
                  onChange={handleImportCsvFile}
                  style={{ display: "none" }}
                />
              </div>
            </div>

            {/* Existing presets list (compact) */}
            {costPresets.length > 0 && (
              <div className="d-flex flex-wrap gap-2 mb-3">
                {costPresets.map((p) => (
                  <div
                    key={p.id}
                    className="p-2 rounded-3"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <strong>{p.name}</strong>

                      <Button
                        className="btn-glass btn-sm"
                        onClick={() => exportPresetCombinedCsv(p)}
                        title="Download this preset as a single CSV (characters + W-Engines)"
                      >
                        Export CSV
                      </Button>

                      <Button
                        className="btn-glass btn-glass-warning btn-sm"
                        onClick={() =>
                          setCostEditing(JSON.parse(JSON.stringify(p)))
                        }
                      >
                        Edit
                      </Button>

                      <Button
                        className="btn-glass btn-glass-danger btn-sm"
                        onClick={async () => {
                          if (!confirm("Delete this preset?")) return;
                          const r = await fetch(
                            `${
                              import.meta.env.VITE_API_BASE
                            }/api/zzz/cost-presets/${p.id}`,
                            { method: "DELETE", credentials: "include" }
                          );
                          if (r.ok) {
                            toast.success("Deleted.");
                            loadCostPresets();
                            if (selectedCostProfileId === p.id)
                              setSelectedCostProfileId(null);
                          } else {
                            toast.error("Failed to delete.");
                          }
                        }}
                      >
                        Delete
                      </Button>

                      <Button
                        className={`btn-glass btn-sm ${
                          selectedCostProfileId === p.id
                            ? "btn-glass-warning"
                            : "btn-glass-outline"
                        }`}
                        onClick={() => {
                          setSelectedCostProfileId(p.id); // choose preset
                          setShowCostModal(false); // ✅ close modal
                          toast.success(`Using preset: ${p.name}`);
                        }}
                      >
                        {selectedCostProfileId === p.id
                          ? "Selected"
                          : "Use this"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Editor */}
            {costEditing ? (
              <div
                className="p-2 rounded-3"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div className="d-flex align-items-center gap-2 mb-2">
                  <Form.Control
                    style={{ maxWidth: 320 }}
                    value={costEditing.name}
                    onChange={(e) =>
                      setCostEditing({
                        ...costEditing,
                        name: e.target.value.slice(0, 40),
                      })
                    }
                    placeholder="Preset name"
                  />
                  <span className="text-white-50 small">
                    Tip: keep it short
                  </span>
                </div>

                {/* Tables */}
                <div className="mb-3">
                  <div className="fw-semibold mb-2">Characters</div>
                  <input
                    className="form-control form-control-sm"
                    style={{ maxWidth: 280 }}
                    placeholder="Search"
                    value={charSearch}
                    onChange={(e) => setCharSearch(e.target.value)}
                  />
                  <div
                    className="table-responsive"
                    style={{ maxHeight: 280, overflowY: "auto" }}
                  >
                    <table className="table table-dark table-striped table-sm align-middle">
                      <thead
                        style={{
                          position: "sticky",
                          top: 0,
                          background: "rgba(0,0,0,0.5)", // darker overlay
                          backdropFilter: "blur(6px)", // frosted glass effect
                          WebkitBackdropFilter: "blur(6px)", // Safari support
                          fontWeight: "700", // thicker font
                          fontSize: "0.9rem", // slightly bigger
                          zIndex: 2, // ensure stays above
                        }}
                      >
                        <tr>
                          <th style={{ minWidth: 180 }}>Character</th>
                          {Array.from({ length: 7 }, (_, i) => (
                            <th key={i}>M{i}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(costEditing.charMs)
                          .filter((code) => {
                            if (!charSearch.trim()) return true;
                            const meta = charMeta[code];
                            const hay = [
                              code,
                              meta?.name || "",
                              meta?.subname || "",
                            ]
                              .join(" ")
                              .toLowerCase();
                            return hay.includes(charSearch.toLowerCase());
                          })
                          .sort(sortCharsByRarityThenName)
                          .map((code) => {
                            const meta = charMeta[code];
                            return (
                              <tr key={code}>
                                <td style={{ minWidth: 220 }}>
                                  <div className="d-flex align-items-center gap-2">
                                    <img
                                      src={
                                        meta?.image_url ||
                                        "/avatars/default.png"
                                      }
                                      style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 6,
                                        objectFit: "cover",
                                      }}
                                    />
                                    <div>
                                      <div className="fw-semibold">
                                        {meta?.name || "Unknown"}
                                      </div>
                                      <div className="text-white-50 small">
                                        {fmtRarity(meta?.rarity ?? 0)}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {costEditing.charMs[code].map((v, idx) => (
                                  <td key={idx} style={{ minWidth: 84 }}>
                                    <input
                                      type="number"
                                      step="0.25"
                                      min={0}
                                      className="form-control form-control-sm"
                                      value={String(v)}
                                      onChange={(e) => {
                                        const val = clean2(
                                          Number(e.target.value || 0)
                                        );
                                        setCostEditing((prev) => {
                                          if (!prev) return prev;
                                          const next = {
                                            ...prev,
                                            charMs: { ...prev.charMs },
                                          };
                                          const row = [...next.charMs[code]];
                                          row[idx] = val;
                                          next.charMs[code] = row;
                                          return next;
                                        });
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

                <div>
                  <div className="fw-semibold mb-2">W-Engines</div>
                  <input
                    className="form-control form-control-sm"
                    style={{ maxWidth: 280 }}
                    placeholder="Search"
                    value={wengSearch}
                    onChange={(e) => setWengSearch(e.target.value)}
                  />
                  <div
                    className="table-responsive"
                    style={{ maxHeight: 280, overflowY: "auto" }}
                  >
                    <table className="table table-dark table-striped table-sm align-middle">
                      <thead
                        style={{
                          position: "sticky",
                          top: 0,
                          background: "rgba(0,0,0,.4)",
                        }}
                      >
                        <tr>
                          <th style={{ minWidth: 220 }}>W-Engine</th>
                          {Array.from({ length: 5 }, (_, i) => (
                            <th key={i}>P{i + 1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(costEditing.wePhase)
                          .filter((id) => {
                            if (!wengSearch.trim()) return true;
                            const meta = wengMeta[id];
                            const hay = [
                              id,
                              meta?.name || "",
                              meta?.subname || "",
                            ]
                              .join(" ")
                              .toLowerCase();
                            return hay.includes(wengSearch.toLowerCase());
                          })
                          .sort(sortWengByRarityThenName)
                          .map((id) => {
                            const meta = wengMeta[id];
                            return (
                              <tr key={id}>
                                <td style={{ minWidth: 260 }}>
                                  <div className="d-flex align-items-center gap-2">
                                    <img
                                      src={
                                        meta?.image_url ||
                                        "/avatars/default.png"
                                      }
                                      style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 6,
                                        objectFit: "cover",
                                      }}
                                    />
                                    <div>
                                      <div className="fw-semibold">
                                        {meta?.name || "Unknown W-Engine"}
                                      </div>
                                      <div className="text-white-50 small">
                                        {fmtRarity(meta?.rarity ?? 0)}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {costEditing.wePhase[id].map((v, idx) => (
                                  <td key={idx} style={{ minWidth: 84 }}>
                                    <input
                                      type="number"
                                      step="0.25"
                                      min={0}
                                      className="form-control form-control-sm"
                                      value={String(v)}
                                      onChange={(e) => {
                                        const val = clean2(
                                          Number(e.target.value || 0)
                                        );
                                        setCostEditing((prev) => {
                                          if (!prev) return prev;
                                          const next = {
                                            ...prev,
                                            wePhase: { ...prev.wePhase },
                                          };
                                          const row = [...next.wePhase[id]];
                                          row[idx] = val;
                                          next.wePhase[id] = row;
                                          return next;
                                        });
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

                {/* Save row */}
                <div className="d-flex justify-content-end gap-2 mt-3">
                  <Button
                    className="btn-glass btn-glass-secondary"
                    onClick={() => setCostEditing(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="btn-glass btn-glass-warning"
                    onClick={async () => {
                      // Save/Upsert
                      if (!costEditing) return;
                      if (!costEditing.name.trim()) {
                        toast.error("Name is required.");
                        return;
                      }
                      try {
                        const method =
                          costEditing.id === "NEW" ? "POST" : "PUT";
                        const url =
                          costEditing.id === "NEW"
                            ? `${
                                import.meta.env.VITE_API_BASE
                              }/api/zzz/cost-presets`
                            : `${
                                import.meta.env.VITE_API_BASE
                              }/api/zzz/cost-presets/${costEditing.id}`;
                        const r = await fetch(url, {
                          method,
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: costEditing.name.trim(),
                            charMs: costEditing.charMs,
                            wePhase: costEditing.wePhase,
                          }),
                        });
                        if (!r.ok) {
                          const j = await r.json().catch(() => ({}));
                          toast.error(j.error || "Failed to save.");
                          return;
                        }
                        toast.success("Saved.");
                        setCostEditing(null);
                        await loadCostPresets();
                      } catch {
                        toast.error("Network error.");
                      }
                    }}
                    disabled={
                      costPresets.length >= 2 && costEditing.id === "NEW"
                    }
                    title={
                      costPresets.length >= 2 && costEditing.id === "NEW"
                        ? "You already have 2 presets"
                        : "Save preset"
                    }
                  >
                    Save Preset
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-white-50">
                Create a new preset or edit an existing one.
              </div>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button
              className="btn-glass btn-glass-secondary"
              onClick={() => {
                setShowCostModal(false);
                setCostEditing(null);
              }}
            >
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        {/* ───────────────── Rules Modal ───────────────── */}
        <Modal
          show={showRulesModal}
          onHide={() => setShowRulesModal(false)}
          centered
          contentClassName="custom-dark-modal"
          size="xl"
        >
          <Modal.Header closeButton>
            <Modal.Title>Vivian PvP Rules</Modal.Title>
          </Modal.Header>
          <Modal.Body className="rules-modal-body">
            <ZzzRules />
          </Modal.Body>
          <Modal.Footer>
            <Button
              className="btn-glass btn-glass-secondary"
              onClick={() => setShowRulesModal(false)}
            >
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        <Modal
          show={showFeaturedModal}
          onHide={() => setShowFeaturedModal(false)}
          centered
          contentClassName="custom-dark-modal keep-height"
          size="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>Featured</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            {/* Selected list editor */}
            <div
              className="p-2 rounded-3 mb-3"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="fw-semibold mb-2">
                Selected ({featuredList.length}/15)
              </div>

              {featuredList.length === 0 ? (
                <div className="text-white-50"></div>
              ) : (
                <div
                  className="d-flex flex-column gap-2"
                  style={{ maxHeight: 280, overflowY: "auto", paddingRight: 4 }}
                >
                  {featuredList.map((f, idx) => (
                    <div
                      key={`${f.kind}:${f.code || f.id}`}
                      className="d-flex align-items-center gap-2 p-2 rounded-3"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <img
                        src={f.image_url}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 6,
                          objectFit: "cover",
                        }}
                      />
                      <div className="flex-grow-1">
                        <div className="fw-semibold">{f.name}</div>
                        <div className="small text-white-50">
                          {f.rule === "globalBan"
                            ? "Universal Ban"
                            : f.rule === "globalPick"
                            ? "Universal Pick"
                            : "No special rule"}
                          {typeof f.customCost === "number"
                            ? ` • Cost ${f.customCost.toFixed(2)}`
                            : ""}
                        </div>
                      </div>

                      {/* Rule selector */}
                      <div className="d-flex align-items-center gap-2 ms-auto">
                        <Dropdown
                          className="featured-dd"
                          align="end"
                          drop="down"
                        >
                          <Dropdown.Toggle
                            className="btn-glass btn-sm text-start"
                            style={{ width: 180 }}
                            id={`feat-rule-${
                              f.kind === "character" ? f.code : `we-${f.id}`
                            }`}
                          >
                            {f.rule === "globalBan"
                              ? "Universal Ban"
                              : f.rule === "globalPick"
                              ? "Universal Pick"
                              : "No special rule"}
                          </Dropdown.Toggle>

                          <Dropdown.Menu
                            variant="dark"
                            className="featured-dd-menu"
                            renderOnMount
                            flip={false}
                            popperConfig={{
                              strategy: "fixed",
                              modifiers: [
                                {
                                  name: "preventOverflow",
                                  options: { boundary: "viewport" },
                                },
                                { name: "offset", options: { offset: [0, 6] } },
                              ],
                            }}
                          >
                            <Dropdown.Item
                              onClick={() => {
                                setFeaturedList((list) => {
                                  const next = [...list];
                                  next[idx] = { ...f, rule: "none" };
                                  return next;
                                });
                              }}
                            >
                              No special rule
                            </Dropdown.Item>

                            <Dropdown.Item
                              onClick={() => {
                                setFeaturedList((list) => {
                                  const next = [...list];
                                  next[idx] = { ...f, rule: "globalBan" };
                                  return next;
                                });
                              }}
                            >
                              Universal Ban
                            </Dropdown.Item>

                            {/* Only show Uni Pick for characters */}
                            {f.kind === "character" && (
                              <Dropdown.Item
                                onClick={() => {
                                  setFeaturedList((list) => {
                                    const next = [...list];
                                    next[idx] = { ...f, rule: "globalPick" };
                                    return next;
                                  });
                                }}
                              >
                                Universal Pick
                              </Dropdown.Item>
                            )}
                          </Dropdown.Menu>
                        </Dropdown>

                        <input
                          type="number"
                          step="0.25"
                          min={0}
                          max={100}
                          className="form-control"
                          style={{ width: 130 }}
                          placeholder="Custom cost"
                          value={
                            typeof f.customCost === "number"
                              ? String(f.customCost)
                              : ""
                          }
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            setFeaturedList((list) => {
                              const next = [...list];
                              // allow blank to clear; otherwise clamp 0..100 and handle NaN
                              if (raw === "") {
                                next[idx] = { ...f, customCost: null };
                              } else {
                                let val = Number(raw);
                                if (isNaN(val)) val = 0;
                                val = Math.min(100, Math.max(0, val));
                                next[idx] = { ...f, customCost: val };
                              }
                              return next;
                            });
                          }}
                        />

                        <Button
                          size="sm"
                          className="btn-glass btn-glass-outline"
                          onClick={() =>
                            setFeaturedList((list) =>
                              list.filter(
                                (x) =>
                                  !(
                                    x.kind === f.kind &&
                                    (f.kind === "character"
                                      ? x.code === f.code
                                      : x.id === f.id)
                                  )
                              )
                            )
                          }
                          title="Remove"
                        >
                          ✖
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Picker: one pool with tabs + search */}
            <div className="fw-semibold mb-2">Add items</div>

            <div className="d-flex align-items-center gap-2 mb-2">
              <div
                className="btn-group"
                role="group"
                aria-label="Featured picker"
              >
                <button
                  type="button"
                  className={`btn btn-sm btn-glass ${
                    pickerTab === "char"
                      ? "btn-glass-warning"
                      : "btn-glass-outline"
                  }`}
                  onClick={() => setPickerTab("char")}
                  title="Show Characters"
                >
                  Characters
                </button>
                <button
                  type="button"
                  className={`btn btn-sm btn-glass ${
                    pickerTab === "weng"
                      ? "btn-glass-warning"
                      : "btn-glass-outline"
                  }`}
                  onClick={() => setPickerTab("weng")}
                  title="Show W-Engines"
                >
                  W-Engines
                </button>
              </div>

              <input
                className="form-control"
                placeholder={pickerTab === "char" ? "Search" : "Search"}
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                style={{ maxWidth: 420 }}
              />
            </div>

            <div className="picker-grid">
              {pickerTab === "char"
                ? charPool
                    .filter((c) => {
                      const q = pickerQuery.toLowerCase();
                      const n = c.name.toLowerCase();
                      const s = (c.subname || "").toLowerCase();
                      return n.includes(q) || s.includes(q);
                    })
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => {
                      const selected = featuredList.some(
                        (f) => f.kind === "character" && f.code === c.code
                      );
                      const disabled = !selected && featuredList.length >= 15;
                      return (
                        <button
                          key={`char:${c.code}`}
                          type="button"
                          onClick={() => {
                            if (selected) {
                              setFeaturedList((list) =>
                                list.filter(
                                  (f) =>
                                    !(
                                      f.kind === "character" &&
                                      f.code === c.code
                                    )
                                )
                              );
                            } else {
                              if (featuredList.length >= 15) return;
                              setFeaturedList((list) => [
                                ...list,
                                {
                                  kind: "character",
                                  code: c.code,
                                  name: c.name,
                                  image_url: c.image_url,
                                  rule: "none",
                                  customCost: null,
                                },
                              ]);
                            }
                            setPickerQuery("");
                          }}
                          className={`btn btn-glass ${
                            selected ? "btn-glass-warning" : "btn-glass-outline"
                          }`}
                          style={{
                            width: 72,
                            height: 72,
                            padding: 0,
                            borderRadius: 8,
                            backgroundImage: `url(${c.image_url})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            outline: selected ? "2px solid #f6c453" : "none",
                            opacity: disabled ? 0.5 : 1,
                            cursor: disabled ? "not-allowed" : "pointer",
                          }}
                          title={selected ? `${c.name}` : `${c.name}`}
                          disabled={disabled}
                        />
                      );
                    })
                : (() => {
                    const q = pickerQuery.toLowerCase();

                    // search by we name or subname, or by character subname (signature hint)
                    const filtered = wengPool.filter((w) => {
                      const name = (w.name || "").toLowerCase();
                      const sub = (w.subname || "").toLowerCase();
                      if (name.includes(q) || sub.includes(q)) return true;

                      for (const [
                        subname,
                        charName,
                      ] of subnameToCharName.entries()) {
                        if (subname.includes(q)) {
                          const cn = charName.toLowerCase();
                          if (sub === cn || name.includes(cn)) return true;
                        }
                      }
                      return false;
                    });

                    return filtered
                      .sort((a, b) => {
                        const ra = Number.isFinite(Number(a.rarity))
                          ? Number(a.rarity)
                          : 0;
                        const rb = Number.isFinite(Number(b.rarity))
                          ? Number(b.rarity)
                          : 0;

                        if (rb !== ra) return rb - ra; // 5★ first, then 4★, etc.

                        const an = (a.name || "").trim();
                        const bn = (b.name || "").trim();
                        const byName = an.localeCompare(bn, undefined, {
                          sensitivity: "base",
                        });
                        if (byName !== 0) return byName;

                        // final stable tiebreaker avoids weird “stuck” items
                        return String(a.id).localeCompare(String(b.id));
                      })
                      .map((w) => {
                        const selected = featuredList.some(
                          (f) => f.kind === "wengine" && f.id === w.id
                        );
                        const disabled = !selected && featuredList.length >= 15;
                        return (
                          <button
                            key={`weng:${w.id}`}
                            type="button"
                            onClick={() => {
                              if (selected) {
                                setFeaturedList((list) =>
                                  list.filter(
                                    (f) =>
                                      !(f.kind === "wengine" && f.id === w.id)
                                  )
                                );
                              } else {
                                if (featuredList.length >= 15) return;
                                setFeaturedList((list) => [
                                  ...list,
                                  {
                                    kind: "wengine",
                                    id: w.id,
                                    name: w.name,
                                    image_url: w.image_url,
                                    rule: "none",
                                    customCost: null,
                                  },
                                ]);
                              }
                              setPickerQuery("");
                            }}
                            className={`btn btn-glass ${
                              selected
                                ? "btn-glass-warning"
                                : "btn-glass-outline"
                            }`}
                            style={{
                              width: 72,
                              height: 72,
                              padding: 0,
                              borderRadius: 8,
                              backgroundImage: `url(${w.image_url})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              outline: selected ? "2px solid #f6c453" : "none",
                              opacity: disabled ? 0.5 : 1,
                              cursor: disabled ? "not-allowed" : "pointer",
                            }}
                            title={selected ? `${w.name}` : `${w.name}`}
                            disabled={disabled}
                          />
                        );
                      });
                  })()}
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button
              className="btn-glass btn-glass-secondary"
              onClick={() => setShowFeaturedModal(false)}
            >
              Close
            </Button>
            <Button
              className="btn-glass btn-glass-warning"
              disabled={!canSaveFeatured}
              onClick={() => {
                if (!canSaveFeatured) {
                  toast.error(
                    "Each featured character needs either a rule or a custom cost."
                  );
                  return;
                }
                setShowFeaturedModal(false);
              }}
              title={
                canSaveFeatured
                  ? "Save featured"
                  : "Each item must have a rule or a custom cost"
              }
            >
              Save
            </Button>
          </Modal.Footer>
        </Modal>

        {/* ───────────────── Match History Modal ───────────────── */}
        <Modal
          show={showMatchesModal}
          onHide={() => setShowMatchesModal(false)}
          centered
          contentClassName="custom-dark-modal"
          size="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>Match History</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            {loadingMatches ? (
              <div className="text-center py-4 text-white-50">Loading…</div>
            ) : (
              <>
                {/* Live section */}
                {liveDrafts.length > 0 && (
                  <>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="fw-semibold">Live Now</div>
                      <span className="badge bg-danger">LIVE</span>
                    </div>
                    <div className="list-group mb-3">
                      {liveDrafts.map((m) => (
                        <button
                          key={`live-${m.key}`}
                          className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                          onClick={() => goSpectator(m.key)}
                          style={{ cursor: "pointer" }}
                        >
                          <div>
                            <div className="fw-semibold">
                              {m.team1}{" "}
                              <span className="text-white-50">vs</span>{" "}
                              {m.team2}
                            </div>
                            <div className="small text-white-50">
                              Mode: {m.mode?.toUpperCase?.() || m.mode} • Last
                              activity: {fmtWhen(m.lastActivityAt)}
                            </div>
                          </div>
                          <span className="badge bg-danger">LIVE</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Completed section */}
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="fw-semibold">Completed</div>
                </div>
                {recentMatches.length === 0 ? (
                  <div className="text-white-50">No completed matches yet.</div>
                ) : (
                  <div className="list-group">
                    {recentMatches.length === 0 ? (
                      <div className="text-white-50">
                        No completed matches yet.
                      </div>
                    ) : (
                      <>
                        <div className="list-group">
                          {recentPageItems.map((m) => (
                            <button
                              key={`done-${m.key}`}
                              className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                              onClick={() => goSpectator(m.key)}
                              style={{ cursor: "pointer" }}
                            >
                              <div>
                                <div className="fw-semibold">
                                  {m.team1}{" "}
                                  <span className="text-white-50">vs</span>{" "}
                                  {m.team2}
                                </div>
                                <div className="small text-white-50">
                                  Mode: {m.mode?.toUpperCase?.() || m.mode} •
                                  Completed: {fmtWhen(m.completedAt)}
                                </div>
                              </div>
                              <span className="badge bg-success">Done</span>
                            </button>
                          ))}
                        </div>

                        {/* Pagination controls */}
                        {totalRecentPages > 1 && (
                          <div className="d-flex justify-content-between align-items-center mt-3">
                            <button
                              type="button"
                              className="btn btn-sm btn-glass btn-glass-outline"
                              onClick={() =>
                                setRecentPage((p) => Math.max(1, p - 1))
                              }
                              disabled={recentPage === 1}
                            >
                              ‹ Prev
                            </button>

                            <div className="text-white-50 small">
                              Page {recentPage} / {totalRecentPages}
                            </div>

                            <button
                              type="button"
                              className="btn btn-sm btn-glass btn-glass-outline"
                              onClick={() =>
                                setRecentPage((p) =>
                                  Math.min(totalRecentPages, p + 1)
                                )
                              }
                              disabled={recentPage === totalRecentPages}
                            >
                              Next ›
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button
              className="btn-glass btn-glass-secondary"
              onClick={() => setShowMatchesModal(false)}
            >
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        {/* ───────────────── Confirm Delete Unfinished Draft ───────────────── */}
        <Modal
          show={showDeleteModal}
          onHide={() => setShowDeleteModal(false)}
          centered
          contentClassName="custom-dark-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>Delete Unfinished Draft?</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="mb-2">
              This will permanently delete your unfinished draft:
            </p>
            <div
              className="p-2 rounded-3 mb-3"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="fw-semibold">
                {ownerOpen?.team1} <span className="text-white-50">vs</span>{" "}
                {ownerOpen?.team2}
              </div>
              <div className="small text-white-50">
                Mode: {ownerOpen?.mode.toUpperCase()}
              </div>
            </div>
            <p className="text-white-50 mb-0">
              You won’t be able to recover it. Continue?
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button
              className="btn-glass btn-glass-secondary"
              onClick={() => setShowDeleteModal(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              className="btn-glass btn-glass-danger"
              onClick={confirmDeleteUnfinished}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete Draft"}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* ───── Hero Section ───── */}
        <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center text-center">
          <div className="hero animate__animated animate__fadeInDown text-white">
            <h2 className="game-title mb-4">{gamesel.name}</h2>

            {team.length > 0 && (
              <div
                className="team-button-wrapper position-relative"
                onMouseEnter={() => setShowTeam(true)}
                onMouseLeave={() => setShowTeam(false)}
              >
                <button className="btn btn-team">Our Team</button>
                <div className={`team-popup ${showTeam ? "show" : ""}`}>
                  {team.map((m, idx) => (
                    <div key={idx} className="member-row">
                      <img
                        src={
                          m.avatar
                            ? `https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.png?size=64`
                            : "/avatars/default.png"
                        }
                        alt={m.username}
                        className="member-avatar"
                      />
                      <div className="member-info">
                        <div className="member-name">
                          {m.global_name || m.username}
                        </div>
                        <div className="member-role">{m.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div
              className="animate__animated animate__fadeInUp mt-4 px-3"
              style={{ maxWidth: 700, margin: "0 auto" }}
            >
              <p className="lead text-white mb-4">
                {gamesel.id === "zzz" ? (
                  <>
                    Vivian PvP is a custom Zenless Zone Zero PvP mode for 2v2
                    and 3v3 on Deadly Assault...
                  </>
                ) : gamesel.id === "hsr" ? (
                  <>
                    Cipher PvP is a custom Honkai: Star Rail PvP mode featuring
                    strategic drafts and preban mechanics...
                  </>
                ) : (
                  <>
                    Cerydra PvP is a custom Honkai: Star Rail PvP mode with unit
                    and Eidolon costs...
                  </>
                )}
              </p>
            </div>

            <div className="mt-3">
              {gamesel.id === "zzz" ? (
                <div className="d-flex flex-column justify-content-center align-items-center gap-2">
                  <div className="d-flex justify-content-center align-items-center gap-2">
                    <button
                      className={`btn angled-btn ${
                        isMobile || ownerOpen ? "disabled" : ""
                      }`}
                      onClick={() => {
                        if (isMobile) {
                          toast.info(
                            "Vivian PvP draft is desktop-only for now. Please use a laptop/desktop."
                          );
                          return;
                        }
                        if (ownerOpen) {
                          toast.warn(
                            "Complete or delete your unfinished draft before starting a new one."
                          );
                          return;
                        }
                        setShowDraftModal(true);
                      }}
                      disabled={isMobile || !!ownerOpen}
                      title={
                        isMobile
                          ? "Desktop only"
                          : ownerOpen
                          ? "Complete or delete unfinished draft first"
                          : "Start draft"
                      }
                    >
                      Start Now
                    </button>

                    <button
                      className="btn btn-info-circle"
                      title="Match History"
                      onClick={openMatches}
                      style={{ fontSize: "1.2rem", zIndex: 5 }}
                    >
                      📖
                    </button>
                    <button
                      className="btn btn-info-circle"
                      onClick={() => setShowRulesModal(true)}
                      title="View Rules"
                    >
                      !
                    </button>
                  </div>

                  {/* NEW: visible resume/delete when unfinished draft exists */}
                  {ownerOpen && (
                    <div className="mt-2 text-center d-flex flex-column align-items-center gap-2">
                      <div className="d-flex gap-2 flex-wrap justify-content-center">
                        <button
                          className="btn back-button-glass"
                          onClick={resumeUnfinished}
                          title="Return to your unfinished draft"
                        >
                          ↩︎ Resume Unfinished Draft
                        </button>
                        <button
                          className="btn btn-info-circle"
                          onClick={() => setShowDeleteModal(true)}
                          title="Delete unfinished draft"
                          style={{
                            backgroundColor: "#b91c1c",
                            borderColor: "#b91c1c",
                          }}
                        >
                          🗑
                        </button>
                      </div>
                      <div className="text-white-50 small mt-1">
                        {ownerOpen.team1}{" "}
                        <span className="text-white-25">vs</span>{" "}
                        {ownerOpen.team2} • {ownerOpen.mode.toUpperCase()}
                      </div>
                    </div>
                  )}

                  {isMobile && (
                    <div className="text-white-50 small">
                      Drafting is <strong>desktop-only</strong>
                    </div>
                  )}
                </div>
              ) : gamesel.live ? (
                <button
                  className="btn angled-btn"
                  onClick={() => gotoLivePage(gamesel.link!)}
                >
                  Start Now
                </button>
              ) : (
                <button className="btn angled-btn disabled" disabled>
                  Coming Soon
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ───── Game Selector ───── */}
        <div className="game-nav d-flex justify-content-center gap-4 pb-5">
          {games.map((g, i) => (
            <img
              key={g.id}
              src={g.icon}
              height={72}
              onClick={() => changeGame(i)}
              className={`game-thumb ${i === selected ? "active" : ""}`}
              style={{ cursor: "pointer" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
