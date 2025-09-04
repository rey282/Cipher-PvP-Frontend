import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { Modal, Button, Form, Dropdown, Collapse } from "react-bootstrap";

import CerydraRules from "./CerydraRules";

/* ─────────────────────────────────────────────────────────────
   Public API to control the HSR (Cerydra) section from Landing
   ───────────────────────────────────────────────────────────── */
export type CerydraSectionHandle = {
  openDraftModal: () => void;
  openMatchesModal: () => void;
  startDraftNow: () => void;
  openRulesModal: () => void;
};

type Props = {
  /** Whether Landing currently has the Cerydra tab selected */
  active: boolean;
  /** Mobile guard (Landing already computes this) */
  isMobile: boolean;
};

/* ─────────────────────────────────────────────────────────────
   Internal helpers/types
   ───────────────────────────────────────────────────────────── */

const ENABLE_HSR_SESSIONS_CHECK = true;

type CostProfile = {
  id: string;
  name: string;
  charMs: Record<string, number[]>; // E0..E6 (stored as "charMs" for parity)
  lcPhase: Record<string, number[]>; // P1..P5
  createdAt?: string;
};

const DEFAULT_COST_LABEL = "Default (Cerydra PvP)";

const ensureLen = (arr: (string | undefined)[], len: number) => {
  const next = [...arr];
  next.length = len;
  for (let i = 0; i < len; i++) {
    if (typeof next[i] !== "string") next[i] = "";
  }
  return next as string[];
};

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

type CharHeaderIdx = { name?: number; code?: number; m: number[] };
type LcHeaderIdx = {
  name?: number;
  subname?: number;
  id?: number;
  p: number[];
};

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

// Utility: clamp to 2 decimals & non-negative
const clean2 = (n: number) => Math.max(0, Math.round(n * 100) / 100);

/* ─────────────────────────────────────────────────────────────
   CerydraSection (HSR modals + data)
   ───────────────────────────────────────────────────────────── */
const CerydraSection = forwardRef<CerydraSectionHandle, Props>(
  function CerydraSection({ active, isMobile }, ref) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    // ───── Draft modal / mode / players ─────
    const [showDraftModal, setShowDraftModal] = useState(false);
    const [mode, setMode] = useState<"2ban" | "3ban">("2ban");
    const modeRef = useRef<"2ban" | "3ban">("2ban");
    const nPlayers = 2;

    const [team1Names, setTeam1Names] = useState<string[]>(
      Array(nPlayers).fill("")
    );
    const [team2Names, setTeam2Names] = useState<string[]>(
      Array(nPlayers).fill("")
    );
    const [randomizeLocked, setRandomizeLocked] = useState(false);
    const [showResumeModal, setShowResumeModal] = useState(false);

    // cycle breakpoint (Cerydra) — used by draft page as penaltyPerPoint
    const [cycleBreakpoint, setCycleBreakpoint] = useState<number>(4);
    const [showCostInputs, setShowCostInputs] = useState(false);

    const showCyclePill = Number(cycleBreakpoint) !== 4;

    // ───── Featured / Pools / Meta (Cerydra) ─────
    type FeaturedCfg = {
      kind: "character" | "lightcone";
      code?: string;
      id?: string;
      name: string;
      image_url: string;
      rule: "none" | "globalBan" | "globalPick"; // server ignores globalPick for lightcone
      customCost?: number | null;
    };

    type HsrChar = {
      code: string;
      name: string;
      subname?: string;
      image_url: string;
    };
    type HsrLC = {
      id: string;
      name: string;
      subname?: string;
      rarity: number;
      limited: boolean;
      image_url: string;
    };
    // ───── Side Pick state/types ─────
    type StartCore = {
      mode: "2ban" | "3ban";
      costProfileId: string | null;
      featured: Array<{
        kind: "character" | "lightcone";
        code?: string;
        id?: string;
        customCost: number | null;
        rule: "none" | "globalBan" | "globalPick";
        name: string;
        image_url: string;
      }>;
      penaltyPerPoint: number;
      timerEnabled?: boolean;
      reserveSeconds?: number;
    };

    type PendingStart = {
      chooser: "A" | "B";
      teamA: string; // pipe-joined player names for one side
      teamB: string; // pipe-joined player names for the other side
      core: StartCore;
    };

    // if you don't already have them defined:
    const [showSidePickModal, setShowSidePickModal] = useState(false);
    const [pendingStart, setPendingStart] = useState<PendingStart | null>(null);

    // Timer
    const [enableTimer, setEnableTimer] = useState<boolean>(false);

    // keep this as a string so users can backspace/clear while typing
    const [reserveMinutesStr, setReserveMinutesStr] = useState<string>("8");

    // what we display in the pill (falls back to 8 if empty/invalid)
    const reserveMinutesDisplay = (() => {
      const v = parseInt(reserveMinutesStr, 10);
      return Number.isFinite(v) && v >= 1 ? v : 8;
    })();

    const showTimerPill = enableTimer;

    const [showFeaturedModal, setShowFeaturedModal] = useState(false);
    const [featuredList, setFeaturedList] = useState<FeaturedCfg[]>([]);
    const [charPool, setCharPool] = useState<HsrChar[]>([]);
    const [lcPool, setLcPool] = useState<HsrLC[]>([]);
    const [subnameToCharName, setSubnameToCharName] = useState<
      Map<string, string>
    >(new Map());

    const [pickerTab, setPickerTab] = useState<"char" | "lc">("char");
    const [pickerQuery, setPickerQuery] = useState("");

    const [charMeta, setCharMeta] = useState<
      Record<
        string,
        { name: string; image_url: string; subname?: string; rarity?: number }
      >
    >({});
    const [lcMeta, setLcMeta] = useState<
      Record<
        string,
        { name: string; image_url: string; subname?: string; rarity?: number }
      >
    >({});

    const [charSearch, setCharSearch] = useState("");
    const [lcSearch, setLcSearch] = useState("");

    async function ensurePresetMetaLoaded(): Promise<{
      cMap: Record<string, any>;
      lMap: Record<string, any>;
    }> {
      if (Object.keys(charMeta).length && Object.keys(lcMeta).length) {
        return { cMap: charMeta, lMap: lcMeta };
      }
      try {
        const [cRes, lcRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_BASE}/api/characters?cycle=0`, {
            credentials: "include",
          }),
          fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/cone-balance`, {
            credentials: "include",
          }),
        ]);
        const [cJ, lcJ] = await Promise.all([cRes.json(), lcRes.json()]);

        const cMap: Record<string, any> = {};
        (cJ?.data ?? []).forEach((c: any) => {
          cMap[c.code] = {
            name: c.name,
            image_url: c.image_url,
            subname: c.subname, // make use of subname if provided
            rarity: c.rarity,
          };
        });

        const lMap: Record<string, any> = {};
        (lcJ?.cones ?? []).forEach((w: any) => {
          lMap[String(w.id)] = {
            name: w.name,
            image_url: w.imageUrl, // convert camelCase to snake-like for UI consistency
            subname: w.subname,
            rarity: Number(w.rarity) || 0,
          };
        });

        setCharMeta(cMap);
        setLcMeta(lMap);
        return { cMap, lMap };
      } catch {
        return { cMap: charMeta, lMap: lcMeta };
      }
    }

    const resumeUnfinished = () => {
      if (!ownerOpen) return;
      if (isMobile) {
        toast.info("Cerydra PvP draft is desktop-only for now.");
        setShowResumeModal(false);
        return;
      }

      // prime session keys so /hsr/draft loads the session
      sessionStorage.setItem("hsrSpectatorKey", ownerOpen.key);
      sessionStorage.setItem(
        "hsrDraftInit",
        JSON.stringify({
          team1: ownerOpen.team1,
          team2: ownerOpen.team2,
          mode: ownerOpen.mode,
        })
      );
      if (!sessionStorage.getItem("hsrDraftId")) {
        const draftId =
          (crypto as any).randomUUID?.() ??
          `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem("hsrDraftId", draftId);
      }

      setShowResumeModal(false);
      navigate("/hsr/draft");
    };

    const sortCharsByRarityThenName = (aCode: string, bCode: string) => {
      const a = charMeta[aCode] ?? {};
      const b = charMeta[bCode] ?? {};
      const ra = Number(a.rarity) || 0;
      const rb = Number(b.rarity) || 0;
      if (ra !== rb) return rb - ra;
      const an = (a.name ?? a.subname ?? aCode).toLowerCase();
      const bn = (b.name ?? b.subname ?? bCode).toLowerCase();
      return an.localeCompare(bn);
    };

    const sortLcByRarityThenName = (aId: string, bId: string) => {
      const a = lcMeta[aId] ?? {};
      const b = lcMeta[bId] ?? {};
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
          const [cRes, lcRes] = await Promise.all([
            fetch(`${import.meta.env.VITE_API_BASE}/api/characters?cycle=0`, {
              credentials: "include",
            }),
            fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/cone-balance`, {
              credentials: "include",
            }),
          ]);
          const [cJson, lcJson] = await Promise.all([
            cRes.json(),
            lcRes.json(),
          ]);
          const chars: HsrChar[] = (cJson?.data ?? []).map((c: any) => ({
            code: c.code,
            name: c.name,
            subname: c.subname,
            image_url: c.image_url,
          }));
          const lcs: HsrLC[] = (lcJson?.cones ?? []).map((w: any) => ({
            id: String(w.id),
            name: w.name,
            subname: w.subname,
            rarity: Number(w.rarity) || 0,
            limited: Boolean(w.limited),
            image_url: w.imageUrl,
          }));
          setCharPool(chars);
          setLcPool(lcs);

          const map = new Map<string, string>();
          chars.forEach((c) => {
            const sub = (c.subname || "").toLowerCase();
            if (sub && sub !== "null") map.set(sub, c.name);
          });
          setSubnameToCharName(map);
        } catch {
          setCharPool([]);
          setLcPool([]);
        }
      })();
    }, [showFeaturedModal]);

    // ───── Cost Presets (Cerydra) ─────
    const [showCostModal, setShowCostModal] = useState(false);
    const [costPresets, setCostPresets] = useState<CostProfile[]>([]);
    const [selectedCostProfileId, setSelectedCostProfileId] = useState<
      string | null
    >(null);
    const [costEditing, setCostEditing] = useState<CostProfile | null>(null);
    const [costLoading, setCostLoading] = useState(false);

    const presetLabel = selectedCostProfileId
      ? costPresets.find((p) => p.id === selectedCostProfileId)?.name ??
        "Preset"
      : DEFAULT_COST_LABEL;

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

    const buildZeroCharMs = (meta: Record<string, any> = charMeta) => {
      const out: Record<string, number[]> = {};
      Object.keys(meta).forEach((code) => (out[code] = [0, 0, 0, 0, 0, 0, 0]));
      return out;
    };
    const buildZeroLcPhase = (meta: Record<string, any> = lcMeta) => {
      const out: Record<string, number[]> = {};
      Object.keys(meta).forEach((id) => (out[id] = [0, 0, 0, 0, 0]));
      return out;
    };

    // fuzzy key normalizer + lookups
    const normalizeKey = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\s\u00A0\u2000-\u200B\u202F]/g, "")
        .replace(/[^a-z0-9]/g, "");

    const buildLookups = (
      cMeta: Record<string, any>,
      lMeta: Record<string, any>
    ) => {
      // Characters
      const charNameToCode = new Map<string, string>();
      const charNameKeyToCode = new Map<string, string>();
      const charCodeToCode = new Map<string, string>();
      Object.keys(cMeta).forEach((code) => {
        const nm = (cMeta[code]?.name || "").trim();
        if (nm) {
          charNameToCode.set(nm.toLowerCase(), code);
          charNameKeyToCode.set(normalizeKey(nm), code);
        }
        charCodeToCode.set(code.toLowerCase(), code);
      });

      // Light Cones
      const lcPairToId = new Map<string, string>(); // "name|subname" (lower) -> id
      const lcPairKeyToId = new Map<string, string>(); // normalized pair -> id
      const lcUniqueNameToId: Record<string, string> = {}; // unique exact name -> id
      const lcNameCounts: Record<string, number> = {};
      const lcNameOnlyToIds: Record<string, string[]> = {};
      const lcIdToId = new Map<string, string>(); // lower id -> id

      Object.keys(lMeta).forEach((id) => {
        const wm = lMeta[id] || {};
        const n = (wm.name || "").trim();
        const s = (wm.subname || "").trim();
        const keyExact = `${n.toLowerCase()}|${s.toLowerCase()}`;
        const keyNorm = `${normalizeKey(n)}|${normalizeKey(s)}`;
        lcPairToId.set(keyExact, id);
        lcPairKeyToId.set(keyNorm, id);

        if (n) {
          const ln = n.toLowerCase();
          lcNameCounts[ln] = (lcNameCounts[ln] || 0) + 1;
          (lcNameOnlyToIds[ln] ||= []).push(id);
        }
        lcIdToId.set(String(id).toLowerCase(), id);
      });

      Object.keys(lcNameCounts).forEach((ln) => {
        if (lcNameCounts[ln] === 1)
          lcUniqueNameToId[ln] = lcNameOnlyToIds[ln][0];
      });

      return {
        charNameToCode,
        charNameKeyToCode,
        charCodeToCode,
        lcPairToId,
        lcPairKeyToId,
        lcUniqueNameToId,
        lcIdToId,
      };
    };

    const downloadPresetTemplateCsv = async () => {
      if (!Object.keys(charMeta).length || !Object.keys(lcMeta).length) {
        await ensurePresetMetaLoaded();
      }
      const rows: (string | number)[][] = [
        ["NAME", "My Preset"],
        ["VERSION", 2],
        [],
      ];
      rows.push(["Characters"]);
      rows.push(["code", "name", "M0", "M1", "M2", "M3", "M4", "M5", "M6"]);
      Object.keys(charMeta)
        .sort((a, b) =>
          (charMeta[a]?.name || a).localeCompare(charMeta[b]?.name || b)
        )
        .forEach((code) =>
          rows.push([code, charMeta[code]?.name || code, 0, 0, 0, 0, 0, 0, 0])
        );

      rows.push([]);
      rows.push(["Light Cones"]);
      rows.push(["id", "name", "subname", "P1", "P2", "P3", "P4", "P5"]);
      Object.keys(lcMeta)
        .sort((a, b) =>
          (lcMeta[a]?.name || a).localeCompare(lcMeta[b]?.name || b)
        )
        .forEach((id) => {
          const m = lcMeta[id] || {};
          rows.push([id, m.name || id, m.subname || "", 0, 0, 0, 0, 0]);
        });

      downloadCsv("preset-template-hsr.csv", rows);
      toast.success("Template CSV downloaded.");
    };

    const handleImportCombinedCsv = async (
      ev: React.ChangeEvent<HTMLInputElement>
    ) => {
      const file = ev.target.files?.[0];
      ev.target.value = "";
      if (!file) return;

      try {
        // Fresh meta snapshot
        const { cMap, lMap } = await ensurePresetMetaLoaded();

        const text = await file.text();
        const rows = parseCsv(text);
        if (!rows.length) {
          toast.error("Empty CSV.");
          return;
        }

        // Lookups
        const {
          charNameToCode,
          charNameKeyToCode,
          charCodeToCode,
          lcPairToId,
          lcPairKeyToId,
          lcUniqueNameToId,
          lcIdToId,
        } = buildLookups(cMap, lMap);

        let presetName: string | null = null;
        let mode: "none" | "chars" | "lc" = "none";

        let cIdx: CharHeaderIdx | null = null;
        let lIdx: LcHeaderIdx | null = null;

        let lastCharHeader: CharHeaderIdx | null = null;
        let lastLcHeader: LcHeaderIdx | null = null;

        const nextCharMs: Record<string, number[]> = {};
        const nextLc: Record<string, number[]> = {};
        const unknownChars: string[] = [];
        const unknownLcs: string[] = [];

        const findIndexCI = (arr: string[], label: string) =>
          arr.findIndex(
            (h) => (h || "").trim().toLowerCase() === label.toLowerCase()
          );

        const isCharsHeader = (r: string[]) => {
          const hasName = findIndexCI(r, "name") !== -1;
          const hasCode = findIndexCI(r, "code") !== -1;
          const ms = ["m0", "m1", "m2", "m3", "m4", "m5", "m6"].map((k) =>
            findIndexCI(r, k)
          );
          return ms.every((i) => i !== -1) && (hasName || hasCode);
        };

        const isLcHeader = (r: string[]) => {
          const hasName = findIndexCI(r, "name") !== -1;
          const hasId = findIndexCI(r, "id") !== -1;
          const ps = ["p1", "p2", "p3", "p4", "p5"].map((k) =>
            findIndexCI(r, k)
          );
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

          // Header key-value (optional)
          if (/^name$/i.test(norm(r[0]))) {
            presetName = (norm(r[1]) || "Imported Preset").slice(0, 40);
            continue;
          }
          if (/^version$/i.test(norm(r[0]))) {
            continue;
          }

          // Section banners (optional)
          if (/^characters$/i.test(norm(r[0]))) {
            mode = "chars";
            cIdx = lastCharHeader || cIdx;
            continue;
          }
          if (/^(light\s?cones?)$/i.test(norm(r[0]))) {
            mode = "lc";
            lIdx = lastLcHeader || lIdx;
            continue;
          }

          // Header detection
          if (isCharsHeader(r.map(norm))) {
            mode = "chars";
            const hdr: CharHeaderIdx = {
              name: findIndexCI(r.map(norm), "name"),
              code: findIndexCI(r.map(norm), "code"),
              m: ["m0", "m1", "m2", "m3", "m4", "m5", "m6"].map((k) =>
                findIndexCI(r.map(norm), k)
              ),
            };
            cIdx = hdr;
            lastCharHeader = hdr;
            continue;
          }

          if (isLcHeader(r.map(norm))) {
            mode = "lc";
            const hdr: LcHeaderIdx = {
              name: findIndexCI(r.map(norm), "name"),
              subname: findIndexCI(r.map(norm), "subname"),
              id: findIndexCI(r.map(norm), "id"),
              p: ["p1", "p2", "p3", "p4", "p5"].map((k) =>
                findIndexCI(r.map(norm), k)
              ),
            };
            lIdx = hdr;
            lastLcHeader = hdr;
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

          if (mode === "lc" && lIdx) {
            let id = "";
            const nm =
              lIdx.name != null && lIdx.name >= 0 ? norm(r[lIdx.name]) : "";
            const sb =
              lIdx.subname != null && lIdx.subname >= 0
                ? normSub(r[lIdx.subname])
                : "";
            const nlow = nm.toLowerCase();

            if (nm) {
              id =
                lcPairToId.get(`${nlow}|${sb}`) ||
                lcPairKeyToId.get(`${normalizeKey(nm)}|${normalizeKey(sb)}`) ||
                "";
              if (!id && lIdx.id != null && lIdx.id >= 0) {
                const rawId = norm(r[lIdx.id]).toLowerCase();
                id = lcIdToId.get(rawId) || "";
              }
              if (!id) {
                const uniq = lcUniqueNameToId[nlow];
                if (uniq) id = uniq;
              }
            } else if (lIdx.id != null && lIdx.id >= 0) {
              const rawId = norm(r[lIdx.id]).toLowerCase();
              id = lcIdToId.get(rawId) || "";
            }

            if (!id) {
              const pretty = sb ? `${nm} (${sb})` : nm || norm(r[lIdx.id ?? 0]);
              if (pretty) unknownLcs.push(`${pretty} @row ${i + 1}`);
              continue;
            }

            const arr = lIdx.p.map((ix) => parseQuarter(ix >= 0 ? r[ix] : 0));
            nextLc[id] = arr;
            continue;
          }
        }

        // Decide overwrite target
        const base: CostProfile | null =
          costEditing ??
          (selectedCostProfileId
            ? costPresets.find((p) => p.id === selectedCostProfileId) ?? null
            : null);

        const baseId = base?.id ?? "NEW";
        const baseName = presetName || base?.name || "Imported Preset";

        // Always include ALL current meta (covers newly added items)
        const charZeros = buildZeroCharMs(cMap);
        const lcZeros = buildZeroLcPhase(lMap);

        // OVERWRITE semantics
        const mergedChars: Record<string, number[]> = {
          ...charZeros,
          ...nextCharMs,
        };
        const mergedLc: Record<string, number[]> = { ...lcZeros, ...nextLc };

        const imported: CostProfile = {
          id: baseId,
          name: baseName,
          charMs: mergedChars,
          lcPhase: mergedLc,
        };

        setCostEditing(imported);
        setShowCostModal(true);

        // Notes
        const notes: string[] = [];
        const cU = Object.keys(nextCharMs).length;
        const lU = Object.keys(nextLc).length;
        if (cU || lU) notes.push(`Updated ${cU} characters, ${lU} light cones`);
        if (unknownChars.length) {
          const preview = unknownChars.slice(0, 5).join(", ");
          notes.push(
            `${unknownChars.length} character name(s) not recognized` +
              (unknownChars.length <= 5 ? `: ${preview}` : "")
          );
        }
        if (unknownLcs.length)
          notes.push(`${unknownLcs.length} light cone name(s) not recognized`);

        toast[unknownChars.length || unknownLcs.length ? "warn" : "success"](
          notes.join(" • ") || "Imported."
        );
      } catch {
        toast.error("Could not read CSV file.");
      }
    };

    const exportEditingCombinedCsv = async () => {
      if (!costEditing) {
        toast.info("Open a preset in the editor first.");
        return;
      }
      if (!Object.keys(charMeta).length || !Object.keys(lcMeta).length) {
        await ensurePresetMetaLoaded();
      }
      const rows: (string | number)[][] = [
        ["NAME", costEditing.name || "My Preset"],
        ["VERSION", 2],
        [],
        ["Characters"],
        ["code", "name", "M0", "M1", "M2", "M3", "M4", "M5", "M6"],
      ];
      Object.keys(buildZeroCharMs())
        .sort((a, b) =>
          (charMeta[a]?.name || a).localeCompare(charMeta[b]?.name || b)
        )
        .forEach((code) => {
          const nm = charMeta[code]?.name || code;
          const v = costEditing.charMs[code] ?? [0, 0, 0, 0, 0, 0, 0];
          rows.push([code, nm, ...v]);
        });

      rows.push([]);
      rows.push(["Light Cones"]);
      rows.push(["id", "name", "subname", "P1", "P2", "P3", "P4", "P5"]);

      Object.keys(buildZeroLcPhase())
        .sort((a, b) =>
          (lcMeta[a]?.name || a).localeCompare(lcMeta[b]?.name || b)
        )
        .forEach((id) => {
          const wm = lcMeta[id] || {};
          const v = costEditing.lcPhase[id] ?? [0, 0, 0, 0, 0];
          rows.push([id, wm.name || id, wm.subname || "", ...v]);
        });

      const fn = `${(costEditing.name || "preset").replace(/\s+/g, "_")}.csv`;
      downloadCsv(fn, rows);
      toast.success("Exported CSV.");
    };

    const exportPresetCombinedCsv = async (p: CostProfile) => {
      if (!Object.keys(charMeta).length || !Object.keys(lcMeta).length) {
        await ensurePresetMetaLoaded();
      }
      const rows: (string | number)[][] = [
        ["NAME", p.name || "My Preset"],
        ["VERSION", 2],
        [],
        ["Characters"],
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
      rows.push(["Light Cones"]);
      rows.push(["id", "name", "subname", "P1", "P2", "P3", "P4", "P5"]);

      Object.keys(buildZeroLcPhase())
        .sort((a, b) =>
          (lcMeta[a]?.name || a).localeCompare(lcMeta[b]?.name || b)
        )
        .forEach((id) => {
          const wm = lcMeta[id] || {};
          const v = p.lcPhase[id] ?? [0, 0, 0, 0, 0];
          rows.push([id, wm.name || id, wm.subname || "", ...v]);
        });

      const nm = (p.name || "preset").replace(/\s+/g, "_");
      downloadCsv(`${nm}.csv`, rows);
      toast.success("Preset exported.");
    };

    const isLoggedIn = !!user;
    useEffect(() => {
      (async () => {
        if (!isLoggedIn) {
          setCostPresets([]);
          return;
        }
        try {
          setCostLoading(true);
          const r = await fetch(
            `${import.meta.env.VITE_API_BASE}/api/hsr/cost-presets/my`,
            {
              credentials: "include",
            }
          );
          const j = r.ok ? await r.json() : { data: [] };
          setCostPresets(Array.isArray(j.data) ? j.data.slice(0, 2) : []);
        } catch {
          setCostPresets([]);
        } finally {
          setCostLoading(false);
        }
      })();
    }, [isLoggedIn]);

    // Rules modal (Cerydra-specific)
    const [showRulesModal, setShowRulesModal] = useState(false);

    // Matches (live/recent)
    const [showMatchesModal, setShowMatchesModal] = useState(false);
    const [loadingMatches, setLoadingMatches] = useState(false);

    type LiveDraft = {
      key: string;
      team1: string;
      team2: string;
      mode: string;
      lastActivityAt?: string;
    };
    type CompletedMatch = {
      key: string;
      team1: string;
      team2: string;
      mode: string;
      completedAt?: string;
    };

    const [liveDrafts, setLiveDrafts] = useState<LiveDraft[]>([]);
    const [recentMatches, setRecentMatches] = useState<CompletedMatch[]>([]);

    const RECENT_PAGE_SIZE = 10;
    const [recentPage, setRecentPage] = useState(1);

    const recentStart = (recentPage - 1) * RECENT_PAGE_SIZE;
    const recentPageItems = recentMatches.slice(
      recentStart,
      recentStart + RECENT_PAGE_SIZE
    );

    const fetchMatches = async () => {
      setLoadingMatches(true);
      try {
        const [liveRes, recentRes] = await Promise.all([
          fetch(
            `${
              import.meta.env.VITE_API_BASE
            }/api/hsr/matches/live?limit=8&minutes=120`,
            {
              credentials: "include",
            }
          ),
          fetch(
            `${import.meta.env.VITE_API_BASE}/api/hsr/matches/recent?limit=50`,
            {
              credentials: "include",
            }
          ),
        ]);
        const liveJson = liveRes.ok ? await liveRes.json() : { data: [] };
        const recentJson = recentRes.ok ? await recentRes.json() : { data: [] };
        setLiveDrafts(Array.isArray(liveJson.data) ? liveJson.data : []);
        setRecentMatches(Array.isArray(recentJson.data) ? recentJson.data : []);
        setRecentPage(1);
      } catch {
        setLiveDrafts([]);
        setRecentMatches([]);
      } finally {
        setLoadingMatches(false);
      }
    };

    const fmtWhen = (ts?: string) => {
      if (!ts) return "";
      try {
        return new Date(ts).toLocaleString();
      } catch {
        return "";
      }
    };

    useEffect(() => {
      if (!showMatchesModal) return;
      const totalPages = Math.max(
        1,
        Math.ceil(recentMatches.length / RECENT_PAGE_SIZE)
      );
      if (recentPage > totalPages) setRecentPage(totalPages);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recentMatches.length, showMatchesModal]);

    const goSpectator = (key: string) => {
      setTimeout(() => navigate(`/hsr/s/${key}`), 250);
    };

    // Owner unfinished session handling
    const [ownerOpen, setOwnerOpen] = useState<null | {
      key: string;
      mode: "2ban" | "3ban";
      team1: string;
      team2: string;
    }>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
      if (!ENABLE_HSR_SESSIONS_CHECK || !active || !user) {
        setOwnerOpen(null);
        return;
      }
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_API_BASE}/api/hsr/sessions/open`,
            {
              credentials: "include",
            }
          );
          if (!res.ok) {
            if (!cancelled) setOwnerOpen(null);
            return;
          }
          const row = await res.json();
          if (!row.exists) {
            if (!cancelled) setOwnerOpen(null);
            return;
          }
          if (!cancelled) {
            setOwnerOpen({
              key: row.key,
              mode: row.mode,
              team1: row.team1,
              team2: row.team2,
            });
          }
        } catch {
          if (!cancelled) setOwnerOpen(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [active, user]);

    useEffect(() => {
      if (showDraftModal) setRandomizeLocked(false);
    }, [showDraftModal]);

    useEffect(() => {
      const params = new URLSearchParams(location.search);
      if (params.get("game") === "hsr" && params.get("draft") === "1") {
        if (isMobile) {
          toast.info("Cerydra PvP draft is desktop-only for now.");
          return;
        }
        setShowDraftModal(true);
        const m = (params.get("mode") as "2ban" | "3ban") || "2ban";
        setMode(m);
        modeRef.current = m;
        const len = nPlayers;
        const t1 = (params.get("team1") || "").split("|").filter(Boolean);
        const t2 = (params.get("team2") || "").split("|").filter(Boolean);
        setTeam1Names(ensureLen(t1, len));
        setTeam2Names(ensureLen(t2, len));
      }
    }, [location.search, isMobile]);

    const clearLocalDraftKeys = () => {
      try {
        sessionStorage.removeItem("hsrSpectatorKey");
        sessionStorage.removeItem("hsrDraftInit");
        sessionStorage.removeItem("hsrDraftId");
      } catch {}
    };

    const confirmDeleteUnfinished = async () => {
      if (!ownerOpen) return;
      setDeleting(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/api/hsr/sessions/${ownerOpen.key}`,
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
        clearLocalDraftKeys();
        setOwnerOpen(null);
        setShowDeleteModal(false);
        toast.success("Unfinished draft deleted.");
        setShowDraftModal(true);
      } catch {
        toast.error("Network error deleting draft.");
      } finally {
        setDeleting(false);
      }
    };

    const handleRandomizeFromFields = () => {
      if (randomizeLocked) return;
      const len = nPlayers;
      const pool = [
        ...ensureLen(team1Names, len),
        ...ensureLen(team2Names, len),
      ]
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

    const canSaveFeatured = featuredList.every(
      (f) => f.rule !== "none" || typeof f.customCost === "number"
    );

    const reserveMinsForStart = enableTimer
      ? Math.max(1, parseInt(reserveMinutesStr || "8", 10) || 8)
      : 0;

    const handleStart = () => {
      if (ownerOpen) {
        toast.warn(
          "You have an unfinished Cerydra PvP draft. You can resume it, or delete it to start fresh."
        );
        setShowResumeModal(true);
        return;
      }
      if (isMobile) {
        toast.warn(
          "Cerydra PvP draft is desktop-only for now. Please use a laptop/desktop."
        );
        return;
      }
      const m = modeRef.current;
      const len = nPlayers;

      const safe1 = ensureLen(team1Names, len).map((s) => (s ?? "").trim());
      const safe2 = ensureLen(team2Names, len).map((s) => (s ?? "").trim());
      const anyName = [...safe1, ...safe2].some((n) => n !== "");
      if (!anyName) {
        toast.warn("Please enter at least one player name.");
        return;
      }

      const t1 = safe1.filter(Boolean).join("|");
      const t2 = safe2.filter(Boolean).join("|");

      const invalidFeatured = featuredList.some(
        (f) => f.rule === "none" && typeof f.customCost !== "number"
      );
      if (invalidFeatured) {
        setShowFeaturedModal(true);
        toast.error("Fix featured items: add a rule or a custom cost to each.");
        return;
      }

      const core: StartCore = {
        mode: m,
        costProfileId: selectedCostProfileId ?? null,
        featured: featuredList.map((f) => ({
          kind: f.kind,
          code: f.kind === "character" ? f.code! : undefined,
          id: f.kind === "lightcone" ? f.id! : undefined,
          customCost: typeof f.customCost === "number" ? f.customCost : null,
          rule: f.rule,
          name: f.name,
          image_url: f.image_url,
        })),
        penaltyPerPoint: cycleBreakpoint,
        timerEnabled: enableTimer,
        reserveSeconds: enableTimer ? reserveMinsForStart * 60 : 0,
      };

      const chooser: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
      setPendingStart({ chooser, teamA: t1, teamB: t2, core });
      setShowSidePickModal(true);
    };
    // ───────────────────────────────
    // Expose a tiny control surface
    // ───────────────────────────────
    useImperativeHandle(ref, () => ({
      openDraftModal: () => {
        if (ownerOpen) {
          toast.warn("You have an unfinished Cerydra PvP draft.");
          setShowResumeModal(true);
          return;
        }
        setShowDraftModal(true);
      },
      openMatchesModal: () => {
        setShowMatchesModal(true);
        setRecentPage(1);
        fetchMatches();
      },
      startDraftNow: () => handleStart(),
      openRulesModal: () => setShowRulesModal(true),
    }));

    const finalizeSideChoice = (choice: "blue" | "red") => {
      if (!pendingStart) return;

      const { chooser, teamA, teamB, core } = pendingStart;
      const picker = chooser === "A" ? teamA : teamB;
      const other = chooser === "A" ? teamB : teamA;

      const [team1, team2] =
        choice === "blue" ? [picker, other] : [other, picker];

      const draftId =
        (crypto as any).randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const payload = {
        team1,
        team2,
        mode: core.mode,
        costProfileId: core.costProfileId,
        featured: core.featured,
        penaltyPerPoint: core.penaltyPerPoint,
        timerEnabled: core.timerEnabled ?? false,
        reserveSeconds: core.reserveSeconds ?? 0,
      };

      sessionStorage.setItem("hsrDraftId", draftId);
      sessionStorage.setItem("hsrDraftInit", JSON.stringify(payload));
      sessionStorage.removeItem("hsrSpectatorKey");

      setShowSidePickModal(false);
      setPendingStart(null);
      navigate("/hsr/draft", { state: { ...payload, draftId } });
    };

    return (
      <>
        {/* Hidden input for CSV import */}
        <input
          ref={importCsvInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={handleImportCombinedCsv}
        />

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
              <strong>Randomize Teams</strong> to shuffle names into teams. On
              start, one team is randomly chosen to pick a side (Blue/Red).
            </div>

            {/* Mode */}
            <Form.Group className="mb-3">
              <Form.Label>Mode</Form.Label>
              <div className="d-flex gap-3">
                <Form.Check
                  inline
                  label="2 ban"
                  name="mode"
                  type="radio"
                  checked={mode === "2ban"}
                  onChange={() => {
                    setMode("2ban");
                    modeRef.current = "2ban";
                  }}
                />
                <Form.Check
                  inline
                  label="3 ban"
                  name="mode"
                  type="radio"
                  checked={mode === "3ban"}
                  onChange={() => {
                    setMode("3ban");
                    modeRef.current = "3ban";
                  }}
                />
              </div>

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
                  title="Show/hide cycle settings"
                >
                  {showCostInputs
                    ? "Hide cycle settings ▲"
                    : "Cycle settings ▼"}
                </button>

                {showCyclePill && (
                  <span className="badge rounded-pill bg-warning text-dark">
                    Breakpoint {cycleBreakpoint}
                  </span>
                )}
                {showTimerPill && (
                  <span className="badge rounded-pill bg-warning text-dark">
                    Timer {reserveMinutesDisplay}m
                  </span>
                )}
              </div>

              <Collapse in={showCostInputs}>
                <div id="draft-cost-collapse" className="mt-2">
                  {/* Cost preset dropdown */}
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

                  {/* Cycle breakpoint + Timer (combined row) */}
                  <div className="row g-2">
                    {/* Cycle breakpoint */}
                    <div className="col-sm-6">
                      <label className="form-label">Cycle breakpoint</label>
                      <input
                        type="number"
                        step="1"
                        min={1}
                        className="form-control"
                        value={cycleBreakpoint}
                        onChange={(e) =>
                          setCycleBreakpoint(
                            Math.max(1, parseInt(e.target.value || "4", 10))
                          )
                        }
                      />
                      <small className="text-white-50">
                        Default: 4 (each 4.00 cost adds 1.00 cycle penalty)
                      </small>
                    </div>

                    {/* Timer (enable + minutes) */}
                    <div className="col-sm-6">
                      <label className="form-label">Timer</label>
                      <div className="d-flex align-items-center gap-2">
                        {/* The circle switch that enables the input */}
                        <div className="form-check form-switch m-0">
                          <input
                            id="enable-timer"
                            className="form-check-input"
                            type="checkbox"
                            checked={enableTimer}
                            onChange={(e) => setEnableTimer(e.target.checked)}
                            title="Enable/disable timer"
                          />
                        </div>

                        {/* Minutes (text field to allow clearing/backspace) */}
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="\d*"
                          className="form-control"
                          style={{ maxWidth: 140 }}
                          placeholder="8"
                          disabled={!enableTimer}
                          value={reserveMinutesStr}
                          onChange={(e) => {
                            // allow empty while typing; digits only
                            const digitsOnly = e.target.value.replace(
                              /[^\d]/g,
                              ""
                            );
                            setReserveMinutesStr(digitsOnly);
                          }}
                          onBlur={() => {
                            // clamp to >=1 if provided; keep empty allowed (Start uses default 8)
                            if (reserveMinutesStr !== "") {
                              const n = Math.max(
                                1,
                                parseInt(reserveMinutesStr || "8", 10)
                              );
                              setReserveMinutesStr(String(n));
                            }
                          }}
                        />
                        <span className="text-white-50 small">min</span>
                      </div>
                      <small className="text-white-50">
                        Default: 8 minutes per team. Disable timer to play
                        without clocks.
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

            {/* Featured summary */}
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
                      key={f.kind === "character" ? f.code! : `lc-${f.id}`}
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
                  title="Create or pick a cost preset (per-Eidolon/Phase)"
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

        {/* ───────────────── Cost Presets Modal ───────────────── */}
        <Modal
          show={showCostModal}
          onHide={() => {
            setShowCostModal(false);
            setCostEditing(null);
            setCharSearch("");
            setLcSearch("");
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
                  onClick={() => {
                    (async () => {
                      try {
                        await ensurePresetMetaLoaded();
                      } finally {
                        // no-op
                      }
                    })();
                  }}
                  title="Refresh"
                >
                  Refresh
                </Button>

                <Button
                  className="btn-glass btn-sm btn-glass-outline"
                  onClick={downloadPresetTemplateCsv}
                  title="Download one CSV containing all characters & Light Cones"
                >
                  ⬇️ Template CSV
                </Button>

                <Button
                  className="btn-glass btn-sm btn-glass-outline"
                  onClick={async () => {
                    if (
                      !Object.keys(charMeta).length ||
                      !Object.keys(lcMeta).length
                    ) {
                      await ensurePresetMetaLoaded();
                    }
                    importCsvInputRef.current?.click();
                  }}
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
                      const [cRes, lRes] = await Promise.all([
                        fetch(
                          `${
                            import.meta.env.VITE_API_BASE
                          }/api/characters?cycle=0`,
                          { credentials: "include" }
                        ),
                        fetch(
                          `${
                            import.meta.env.VITE_API_BASE
                          }/api/cerydra/cone-balance`,
                          { credentials: "include" }
                        ),
                      ]);
                      const [cJ, lJ] = await Promise.all([
                        cRes.json(),
                        lRes.json(),
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
                      const lMap: Record<string, any> = {};
                      (lJ?.cones ?? []).forEach((w: any) => {
                        lMap[String(w.id)] = {
                          name: w.name,
                          image_url: w.imageUrl,
                          subname: w.subname,
                          rarity: w.rarity,
                        };
                      });

                      setCharMeta((prev) =>
                        Object.keys(prev).length ? prev : cMap
                      );
                      setLcMeta((prev) =>
                        Object.keys(prev).length ? prev : lMap
                      );

                      const charMs: Record<string, number[]> = {};
                      (cJ?.data ?? []).forEach((c: any) => {
                        charMs[c.code] = [0, 0, 0, 0, 0, 0, 0];
                      });

                      const lcPhase: Record<string, number[]> = {};
                      (lJ?.cones ?? []).forEach((w: any) => {
                        lcPhase[String(w.id)] = [0, 0, 0, 0, 0];
                      });

                      setCostEditing({
                        id: "NEW",
                        name: "My Preset",
                        charMs,
                        lcPhase,
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
                        title="Download this preset as a single CSV (characters + Light Cones)"
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
                            }/api/hsr/cost-presets/${p.id}`,
                            {
                              method: "DELETE",
                              credentials: "include",
                            }
                          );
                          if (r.ok) {
                            toast.success("Deleted.");
                            try {
                              const r2 = await fetch(
                                `${
                                  import.meta.env.VITE_API_BASE
                                }/api/hsr/cost-presets/my`,
                                {
                                  credentials: "include",
                                }
                              );
                              const j = r2.ok ? await r2.json() : { data: [] };
                              setCostPresets(
                                Array.isArray(j.data) ? j.data.slice(0, 2) : []
                              );
                            } catch {
                              setCostPresets([]);
                            }
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
                          setSelectedCostProfileId(p.id);
                          setShowCostModal(false);
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

                {/* Characters table */}
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
                          background: "rgba(0,0,0,0.5)",
                          backdropFilter: "blur(6px)",
                          WebkitBackdropFilter: "blur(6px)",
                          fontWeight: 700,
                          fontSize: "0.9rem",
                          zIndex: 2,
                        }}
                      >
                        <tr>
                          <th style={{ minWidth: 180 }}>Character</th>
                          {Array.from({ length: 7 }, (_, i) => (
                            <th key={i}>E{i}</th>
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

                {/* Light Cones table */}
                <div>
                  <div className="fw-semibold mb-2">Light Cones</div>
                  <input
                    className="form-control form-control-sm"
                    style={{ maxWidth: 280 }}
                    placeholder="Search"
                    value={lcSearch}
                    onChange={(e) => setLcSearch(e.target.value)}
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
                          <th style={{ minWidth: 220 }}>Light Cone</th>
                          {Array.from({ length: 5 }, (_, i) => (
                            <th key={i}>P{i + 1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(costEditing.lcPhase)
                          .filter((id) => {
                            if (!lcSearch.trim()) return true;
                            const meta = lcMeta[id];
                            const hay = [
                              id,
                              meta?.name || "",
                              meta?.subname || "",
                            ]
                              .join(" ")
                              .toLowerCase();
                            return hay.includes(lcSearch.toLowerCase());
                          })
                          .sort(sortLcByRarityThenName)
                          .map((id) => {
                            const meta = lcMeta[id];
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
                                        {meta?.name || "Unknown Light Cone"}
                                      </div>
                                      <div className="text-white-50 small">
                                        {fmtRarity(meta?.rarity ?? 0)}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {costEditing.lcPhase[id].map((v, idx) => (
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
                                            lcPhase: { ...prev.lcPhase },
                                          };
                                          const row = [...next.lcPhase[id]];
                                          row[idx] = val;
                                          next.lcPhase[id] = row;
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
                              }/api/hsr/cost-presets`
                            : `${
                                import.meta.env.VITE_API_BASE
                              }/api/hsr/cost-presets/${costEditing.id}`;
                        const r = await fetch(url, {
                          method,
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: costEditing.name.trim(),
                            charMs: costEditing.charMs,
                            lcPhase: costEditing.lcPhase,
                          }),
                        });
                        if (!r.ok) {
                          const j = await r.json().catch(() => ({}));
                          toast.error(j.error || "Failed to save.");
                          return;
                        }
                        toast.success("Saved.");
                        setCostEditing(null);
                        // refresh list
                        try {
                          const r2 = await fetch(
                            `${
                              import.meta.env.VITE_API_BASE
                            }/api/hsr/cost-presets/my`,
                            {
                              credentials: "include",
                            }
                          );
                          const j = r2.ok ? await r2.json() : { data: [] };
                          setCostPresets(
                            Array.isArray(j.data) ? j.data.slice(0, 2) : []
                          );
                        } catch {
                          setCostPresets([]);
                        }
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
            <Modal.Title>Cerydra PvP Rules</Modal.Title>
          </Modal.Header>
          <Modal.Body className="rules-modal-body">
            <CerydraRules />
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
          show={showSidePickModal}
          onHide={() => {
            setShowSidePickModal(false);
            setPendingStart(null);
          }}
          centered
          contentClassName="custom-dark-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>Side Pick</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {pendingStart ? (
              <>
                <div className="mb-2">
                  <strong>
                    {(pendingStart.chooser === "A"
                      ? pendingStart.teamA
                      : pendingStart.teamB) || "Selected team"}
                  </strong>{" "}
                  won the side pick.
                </div>
                <div className="text-white-50">
                  Choose which side to start on:
                </div>
              </>
            ) : (
              <div className="text-white-50">Preparing…</div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              className="btn-glass btn-glass-secondary"
              onClick={() => {
                setShowSidePickModal(false);
                setPendingStart(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="btn-glass"
              onClick={() => finalizeSideChoice("blue")}
            >
              Blue
            </Button>
            <Button
              className="btn-glass btn-glass-warning"
              onClick={() => finalizeSideChoice("red")}
            >
              Red
            </Button>
          </Modal.Footer>
        </Modal>

        {/* ───────────────── Featured Modal ───────────────── */}
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
                              f.kind === "character" ? f.code : `lc-${f.id}`
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

                            {/* Only characters support globalPick on server */}
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

            {/* Picker */}
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
                    pickerTab === "lc"
                      ? "btn-glass-warning"
                      : "btn-glass-outline"
                  }`}
                  onClick={() => setPickerTab("lc")}
                  title="Show Light Cones"
                >
                  Light Cones
                </button>
              </div>

              <input
                className="form-control"
                placeholder="Search"
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
                          title={c.name}
                          disabled={disabled}
                        />
                      );
                    })
                : (() => {
                    const q = pickerQuery.toLowerCase();
                    const filtered = lcPool.filter((w) => {
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
                        if (rb !== ra) return rb - ra;
                        const an = (a.name || "").trim();
                        const bn = (b.name || "").trim();
                        const byName = an.localeCompare(bn, undefined, {
                          sensitivity: "base",
                        });
                        if (byName !== 0) return byName;
                        return String(a.id).localeCompare(String(b.id));
                      })
                      .map((w) => {
                        const selected = featuredList.some(
                          (f) => f.kind === "lightcone" && f.id === w.id
                        );
                        const disabled = !selected && featuredList.length >= 15;
                        return (
                          <button
                            key={`lc:${w.id}`}
                            type="button"
                            onClick={() => {
                              if (selected) {
                                setFeaturedList((list) =>
                                  list.filter(
                                    (f) =>
                                      !(f.kind === "lightcone" && f.id === w.id)
                                  )
                                );
                              } else {
                                if (featuredList.length >= 15) return;
                                setFeaturedList((list) => [
                                  ...list,
                                  {
                                    kind: "lightcone",
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
                            title={w.name}
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
                    "Each featured item needs either a rule or a custom cost."
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

                    {/* Pagination */}
                    {Math.max(1, Math.ceil(recentMatches.length / 10)) > 1 && (
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
                          Page {recentPage} /{" "}
                          {Math.max(1, Math.ceil(recentMatches.length / 10))}
                        </div>

                        <button
                          type="button"
                          className="btn btn-sm btn-glass btn-glass-outline"
                          onClick={() =>
                            setRecentPage((p) =>
                              Math.min(
                                Math.max(
                                  1,
                                  Math.ceil(recentMatches.length / 10)
                                ),
                                p + 1
                              )
                            )
                          }
                          disabled={
                            recentPage ===
                            Math.max(1, Math.ceil(recentMatches.length / 10))
                          }
                        >
                          Next ›
                        </button>
                      </div>
                    )}
                  </>
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

        {/* ───────────────── Resume Modal ───────────────── */}
        <Modal
          show={showResumeModal}
          onHide={() => setShowResumeModal(false)}
          centered
          contentClassName="custom-dark-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>Unfinished Draft Detected</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="mb-2">You have an unfinished Cerydra PvP draft:</p>
            <div
              className="p-2 rounded-3 mb-2"
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
                Mode: {ownerOpen?.mode?.toUpperCase?.()}
              </div>
            </div>
            <div className="text-white-50">
              Resume it, or delete it to start fresh?
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              className="btn-glass btn-glass-secondary"
              onClick={() => setShowResumeModal(false)}
            >
              Close
            </Button>
            <Button className="btn-glass" onClick={resumeUnfinished}>
              ↩︎ Resume
            </Button>
            <Button
              className="btn-glass btn-glass-danger"
              onClick={() => {
                setShowResumeModal(false);
                setShowDeleteModal(true);
              }}
            >
              🗑 Delete
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
      </>
    );
  }
);

export default CerydraSection;

