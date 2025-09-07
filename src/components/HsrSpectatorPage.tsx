// components/HsrSpectatorPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../components/Landing.css";
import { Modal, Button } from "react-bootstrap";


/* ───────────── Types (HSR) ───────────── */
type Character = {
  code: string;
  name: string;
  subname?: string;
  rarity: number; // 5★ / 4★
  image_url: string;
  limited: boolean;
};

type LightCone = {
  id: string; // number-ish but treat as string
  name: string;
  subname?: string;
  rarity: number; // 5★ / 4★
  image_url: string;
  limited: boolean;
};

type FeaturedCfg =
  | {
      kind: "character";
      code: string;
      name?: string;
      image_url?: string;
      rule: "none" | "globalBan" | "globalPick";
      customCost?: number | null;
    }
  | {
      kind: "lightcone";
      id: string;
      name?: string;
      image_url?: string;
      rule: "none" | "globalBan"; // spectator ignores globalPick for light cones
      customCost?: number | null;
    };

type SpectatorState = {
  draftSequence: string[];
  currentTurn: number;
  picks: Array<{
    characterCode: string;
    eidolon: number;
    lightconeId: string | null;
    superimpose: number; // 1..5
  } | null>;
  blueScores: number[];
  redScores: number[];
  blueLocked?: boolean;
  redLocked?: boolean;

  timerEnabled?: boolean;
  paused?: { B: boolean; R: boolean };
  reserveSeconds?: number;

  reserveLeft?: { B: number; R: number };
  graceLeft?: number;
  timerUpdatedAt?: number;

  extraCyclePenaltyB?: number;
  extraCyclePenaltyR?: number;

  applyCyclePenaltyB?: boolean;
  applyCyclePenaltyR?: boolean;

  timerPenaltyCountB?: number;
  timerPenaltyCountR?: number;
  applyTimerPenaltyB?: boolean;
  applyTimerPenaltyR?: boolean;
};

type HsrMode = "2ban" | "3ban" | "6ban";

type SessionRow = {
  mode: "2ban" | "3ban" | "6ban";
  team1: string;
  team2: string;
  state: SpectatorState;
  featured?: FeaturedCfg[];
  is_complete?: boolean;
  last_activity_at?: string;
  completed_at?: string | null;

  // NOTE: penaltyPerPoint is used as the CYCLE BREAKPOINT (÷ value)
  penaltyPerPoint?: number | null;

  costProfileId?: string | null;
  costProfile?: {
    name?: string | null;
    charMs?: Record<string, number[]>; // code -> [E0..E6]
    lcPhase?: Record<string, number[]>; // lcId -> [P1..P5]
  };
};

const MOBILE_QUERY = "(pointer:coarse), (max-width: 820px)";

/* ───────────── Sizing (match draft) ───────────── */
const CARD_W = 170;
const CARD_H = 240;
const CARD_GAP = 12;
const CARD_MIN_SCALE = 0.68;

/* ───────────── Responsive row sizing ───────────── */
function useRowScale<T extends HTMLElement>(
  ref: React.MutableRefObject<T | null>,
  cardCount: number
) {
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const compute = () => {
      const available = el.clientWidth || 0;
      const gaps = Math.max(0, cardCount - 1);
      const needed = cardCount * CARD_W + gaps * CARD_GAP;
      const s = Math.min(
        1,
        Math.max(CARD_MIN_SCALE, needed ? available / needed : 1)
      );
      setScale(s);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [ref, cardCount]);

  return scale;
}

/* ───────────── Fallback cost rules (when no preset rows) ───────────── */
function calcCharCost(char: Character, eidolon: number): number {
  const e = Math.max(0, Math.min(6, eidolon));
  if (char.rarity === 4) return 0.5;
  // 5★
  if (char.limited) {
    const bumps = [1, 2, 4, 6].filter((m) => e >= m).length;
    return 1 + 0.5 * bumps; // up to 3.0 at E6
  }
  return e >= 6 ? 1.5 : 1;
}

/** LC base at a given superimpose (phase) */
function calcLcCostRaw(lc: LightCone | undefined, sup: number): number {
  if (!lc) return 0;
  const p = Math.max(1, Math.min(5, sup));
  if (lc.rarity <= 4) return 0;

  let total = lc.limited ? 0.25 : 0;
  if (p >= 3) total += 0.25;
  if (p >= 4) total += 0.25;
  if (p >= 5) total += 0.25;
  return Number(total.toFixed(2));
}

/** base-at-P1 + delta(Px - P1); base may be overridden by featured customCost */
function calcLcCostWithBase(
  lc: LightCone | undefined,
  sup: number,
  featuredBaseOverride: number | undefined
): number {
  if (!lc) return 0;
  const normalAtP1 = calcLcCostRaw(lc, 1);
  const normalAtPx = calcLcCostRaw(lc, sup);
  const delta = Number((normalAtPx - normalAtP1).toFixed(2));
  const base =
    typeof featuredBaseOverride === "number"
      ? featuredBaseOverride
      : normalAtP1;
  return Number((base + delta).toFixed(2));
}

function isFirstBanForSide(idx: number, seq: string[]) {
  const tok = seq[idx];
  if (tok !== "BB" && tok !== "RR") return false;
  for (let i = 0; i < idx; i++) {
    if (seq[i] === tok) return false; // we’ve seen this side’s ban already
  }
  return true;
}


/* util: normalize names like draft page */
function normName(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/* ───────────── Floating reconnect badge ───────────── */
function ReconnectingBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return <div className="sse-indicator">Reconnecting… trying again</div>;
}

/* ───────────── Component ───────────── */
export default function HsrSpectatorPage() {
  const { key } = useParams<{ key: string }>();

  // Stable top-level state
  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const navigate = useNavigate();

  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Active preset (read-only on spectator)
  const [costProfileName, setCostProfileName] = useState<string | null>(null);
  const displayCostProfileName = costProfileName?.trim() || "Cerydra (Default)";
  const [costCharMs, setCostCharMs] = useState<Record<string, number[]>>({});
  const [costLcPhase, setCostLcPhase] = useState<Record<string, number[]>>({});
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);

  useEffect(() => {
    if (isMobile) {
      navigate("/", {
        replace: true,
        state: { blocked: "hsr-spectator-mobile" },
      });
    }
  }, [isMobile, navigate]);

  useEffect(() => {
    const cp = session?.costProfile;
    const id = session?.costProfileId;

    // If the session already includes rows, use them
    if (cp && (cp.charMs || cp.lcPhase || cp.name)) {
      setCostProfileName(cp.name || "Preset");
      setCostCharMs(cp.charMs || {});
      setCostLcPhase(cp.lcPhase || {});
      return;
    }

    // If there’s an id but no embedded rows, fetch the preset
    if (!id) {
      setCostProfileName(null);
      setCostCharMs({});
      setCostLcPhase({});
      return;
    }

    let aborted = false;
    (async () => {
      try {
        const r = await fetch(
          `${import.meta.env.VITE_API_BASE}/api/hsr/cost-presets/${id}`,
          { credentials: "include" }
        );
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (aborted) return;

        const cm: Record<string, number[]> = {};
        Object.entries(j.charMs || {}).forEach(([k, v]: [string, any]) => {
          const arr = Array.isArray(v) ? v.map((n) => Number(n) || 0) : [];
          cm[k] = (arr.length === 7 ? arr : Array(7).fill(0)) as number[];
        });

        const lp: Record<string, number[]> = {};
        Object.entries(j.lcPhase || {}).forEach(([k, v]: [string, any]) => {
          const arr = Array.isArray(v) ? v.map((n) => Number(n) || 0) : [];
          lp[String(k)] = (
            arr.length === 5 ? arr : Array(5).fill(0)
          ) as number[];
        });

        setCostProfileName(j.name || "Preset");
        setCostCharMs(cm);
        setCostLcPhase(lp);
      } catch {
        if (!aborted) {
          setCostProfileName("(failed to load)");
          setCostCharMs({});
          setCostLcPhase({});
        }
      }
    })();

    return () => {
      aborted = true;
    };
  }, [session?.costProfile, session?.costProfileId]);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [lightcones, setLightcones] = useState<LightCone[]>([]);
  const [cerydraLcPhase, setCerydraLcPhase] = useState<
    Record<string, number[]>
  >({});
  const [cerydraCharMs, setCerydraCharMs] = useState<Record<string, number[]>>(
    {}
  );

  // Refs + row scales
  const blueRowRef = useRef<HTMLDivElement>(null);
  const redRowRef = useRef<HTMLDivElement>(null);

  // Derived (safe defaults while loading)
  // AFTER
  const mode: HsrMode = session?.mode ?? "2ban";
  const is3ban = mode === "3ban"; 
  const useSmall = mode === "3ban" || mode === "6ban"; 

  const state: SpectatorState | null = session?.state ?? null;

  const draftSequence = state?.draftSequence ?? [];
  const currentTurn = state?.currentTurn ?? 0;

  const team1Name = session?.team1 ?? "Blue Team";
  const team2Name = session?.team2 ?? "Red Team";

  const blueScores = state?.blueScores ?? (is3ban ? [0, 0, 0] : [0, 0]);
  const redScores = state?.redScores ?? (is3ban ? [0, 0, 0] : [0, 0]);

  // “Cycle breakpoint” (÷ value), default 4 if not present
  const cycleBreakpoint = useMemo(() => {
    const v = session?.penaltyPerPoint;
    return Number.isFinite(v as number) && (v as number) > 0
      ? Math.floor(v as number)
      : 4;
  }, [session?.penaltyPerPoint]);

  // Timers (read-only display for spectator)
  const MOVE_GRACE = 30;
  const [timerEnabled, setTimerEnabled] = useState<boolean>(
    !!state?.timerEnabled
  );
  const [paused, setPaused] = useState<{ B: boolean; R: boolean }>({
    B: !!state?.paused?.B,
    R: !!state?.paused?.R,
  });
  const [reserveLeft, setReserveLeft] = useState<{ B: number; R: number }>({
    B: Math.max(0, Number(state?.reserveSeconds) || 0),
    R: Math.max(0, Number(state?.reserveSeconds) || 0),
  });
  const [graceLeft, setGraceLeft] = useState<number>(MOVE_GRACE);

  // Display-only clock baseline from the last server sync
  const [clockSyncedAt, setClockSyncedAt] = useState<number | null>(null);

  // Lightweight UI tick (doesn't mutate clocks; only re-renders)
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    let id: number | null = null;
    const tick = () => {
      setNowMs(Date.now());
      id = window.setTimeout(tick, 200) as unknown as number; // ~5 fps
    };
    id = window.setTimeout(tick, 200) as unknown as number;
    return () => {
      if (id) window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    const st = session?.state;
    if (!st) return;

    // 1) flags
    setTimerEnabled(!!st.timerEnabled);
    if (
      st.paused &&
      typeof st.paused.B === "boolean" &&
      typeof st.paused.R === "boolean"
    ) {
      setPaused({ B: !!st.paused.B, R: !!st.paused.R });
    }

    // 2) base seed for reserves/grace (prefer precise -> fallback)
    let nextReserve =
      st.reserveLeft &&
      typeof st.reserveLeft.B === "number" &&
      typeof st.reserveLeft.R === "number"
        ? {
            B: Math.max(0, Number(st.reserveLeft.B)),
            R: Math.max(0, Number(st.reserveLeft.R)),
          }
        : Number.isFinite(Number(st.reserveSeconds))
        ? (() => {
            const v = Math.max(0, Number(st.reserveSeconds) || 0);
            return { B: v, R: v };
          })()
        : reserveLeft; // keep what we have if nothing provided

    let nextGrace = Number.isFinite(Number(st.graceLeft))
      ? Math.max(0, Number(st.graceLeft))
      : graceLeft;

    // 3) catch up using server timestamp
    const ts = Number.isFinite(Number(st.timerUpdatedAt))
      ? Number(st.timerUpdatedAt)
      : null;

    if (ts && st.timerEnabled) {
      const elapsed = Math.max(0, (Date.now() - ts) / 1000);

      // determine active side from the server’s point of view
      const srvSeq =
        Array.isArray(st.draftSequence) && st.draftSequence.length
          ? st.draftSequence
          : draftSequence;
      const srvTurn = Number.isFinite(Number(st.currentTurn))
        ? Number(st.currentTurn)
        : currentTurn;

      const tok = srvSeq[srvTurn] || "";
      const active = tok.startsWith("B")
        ? "B"
        : tok.startsWith("R")
        ? "R"
        : null;

      // freeze on EACH team’s first ban (BB or RR) wherever it appears
      const firstBanFreeze = isFirstBanForSide(srvTurn, srvSeq);

      if (active && !st.paused?.[active] && !firstBanFreeze) {
        const burnFromGrace = Math.min(nextGrace, elapsed);
        nextGrace = Math.max(0, nextGrace - burnFromGrace);
        const over = Math.max(0, elapsed - burnFromGrace);
        if (over > 0) {
          nextReserve = {
            ...nextReserve,
            [active]: Math.max(0, nextReserve[active] - over),
          };
        }
      }
    }

    setReserveLeft(nextReserve);
    setGraceLeft(nextGrace);
    setClockSyncedAt(Date.now());
  }, [
    session?.state, // fire on any new snapshot/update
    draftSequence,
    currentTurn, // safe fallbacks if server omitted fields
  ]);

  const blueCount = draftSequence.filter((s) => s.startsWith("B")).length;
  const redCount = draftSequence.filter((s) => s.startsWith("R")).length;
  const blueScale = useRowScale(blueRowRef, blueCount);
  const redScale = useRowScale(redRowRef, redCount);

  // Name labels
  const buildNameLabels = (raw: string, count: number) => {
    const parts = (raw || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    const primary = parts.find(Boolean) || "";
    return Array(count)
      .fill("")
      .map((_, i) => parts[i] || primary || `Player ${i + 1}`);
  };
  const nameLabelsBlue = buildNameLabels(team1Name, is3ban ? 3 : 2);
  const nameLabelsRed = buildNameLabels(team2Name, is3ban ? 3 : 2);

  // Indexers
  const charByCode = useMemo(() => {
    const m = new Map<string, Character>();
    for (const c of characters) m.set(c.code, c);
    return m;
  }, [characters]);
  const lcById = useMemo(() => {
    const m = new Map<string, LightCone>();
    for (const w of lightcones) m.set(String(w.id), w);
    return m;
  }, [lightcones]);

  /* ───────── Featured helpers (hydrate + overrides) ───────── */
  const normalizeFeatured = (list: any[]): FeaturedCfg[] => {
    return (Array.isArray(list) ? list : []).map((f: any) => {
      if (f?.kind === "lightcone" || f?.id) {
        return {
          kind: "lightcone" as const,
          id: String(f.id),
          name: f.name ?? undefined,
          image_url: f.image_url ?? undefined,
          rule: f.rule === "globalBan" ? "globalBan" : "none",
          customCost: typeof f.customCost === "number" ? f.customCost : null,
        };
      }
      return {
        kind: "character" as const,
        code: String(f.code),
        name: f.name ?? undefined,
        image_url: f.image_url ?? undefined,
        rule:
          f.rule === "globalBan" || f.rule === "globalPick" ? f.rule : "none",
        customCost: typeof f.customCost === "number" ? f.customCost : null,
      };
    });
  };

  const featuredList: FeaturedCfg[] = normalizeFeatured(
    session?.featured || []
  );

  const featuredCharBase = useMemo(
    () =>
      new Map<string, number>(
        featuredList
          .filter(
            (f): f is Extract<FeaturedCfg, { kind: "character" }> =>
              f.kind === "character"
          )
          .filter((f) => typeof f.customCost === "number" && !!f.code)
          .map((f) => [f.code, f.customCost as number])
      ),
    [featuredList]
  );

  const featuredLcBase = useMemo(
    () =>
      new Map<string, number>(
        featuredList
          .filter(
            (f): f is Extract<FeaturedCfg, { kind: "lightcone" }> =>
              f.kind === "lightcone"
          )
          .filter((f) => typeof f.customCost === "number" && !!f.id)
          .map((f) => [String(f.id), f.customCost as number])
      ),
    [featuredList]
  );

  // LIVE badge
  const isComplete = !!session?.is_complete || !!session?.completed_at;
  const isLive =
    !isComplete &&
    !!session?.last_activity_at &&
    Date.now() - new Date(session.last_activity_at).getTime() <
      2 * 60 * 60 * 1000;

  /* Load catalogs + Cerydra balance once */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [charRes, coneBalRes, charBalRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_BASE}/api/characters?cycle=0`, {
            credentials: "include",
          }),
          fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/cone-balance`, {
            credentials: "include",
          }),
          fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/balance`, {
            credentials: "include",
          }),
        ]);
        if (!charRes.ok || !coneBalRes.ok || !charBalRes.ok) {
          throw new Error("Static fetch failed");
        }
        const [charData, coneBalData, charBalData] = await Promise.all([
          charRes.json(),
          coneBalRes.json(),
          charBalRes.json(),
        ]);

        if (cancelled) return;

        const chars: Character[] = (charData?.data || []).map((c: any) => ({
          code: c.code,
          name: c.name,
          subname: c.subname,
          rarity: Number(c.rarity) || 5,
          image_url: c.image_url,
          limited: !!c.limited,
        }));
        const lcs: LightCone[] = (coneBalData?.cones || []).map((w: any) => ({
          id: String(w.id),
          name: w.name,
          subname: w.subname,
          rarity: Number(w.rarity) || 5,
          limited: !!w.limited,
          image_url: w.imageUrl,
        }));

        // LC costs from Cerydra DB
        const lp: Record<string, number[]> = {};
        for (const w of coneBalData?.cones || []) {
          const arr = Array.isArray(w.costs)
            ? w.costs.map((n: any) => Number(n) || 0)
            : [];
          lp[String(w.id)] = (
            arr.length === 5 ? arr : Array(5).fill(0)
          ) as number[];
        }

        // Character E0..E6 costs from Cerydra DB — map by normalized names
        const byName = new Map<string, string>();
        for (const c of chars) byName.set(normName(c.name), c.code);

        const cm: Record<string, number[]> = {};
        for (const row of (charBalData?.characters || []) as Array<{
          id: string;
          name: string;
          costs: number[];
        }>) {
          const code = byName.get(normName(row.name));
          if (!code) continue;
          const arr = Array.isArray(row.costs)
            ? row.costs.map((n) => Number(n) || 0)
            : [];
          cm[code] = (arr.length === 7 ? arr : Array(7).fill(0)) as number[];
        }

        setCharacters(chars);
        setLightcones(lcs);
        setCerydraLcPhase(lp);
        setCerydraCharMs(cm);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Subscribe to live spectator session via SSE */
  useEffect(() => {
    if (!key || isMobile) return;

    setLoading(true);
    setNotFound(false);
    setError(null);
    setReconnecting(false);

    const url = `${
      import.meta.env.VITE_API_BASE
    }/api/hsr/sessions/${key}/stream`;
    const es = new EventSource(url);

    es.onopen = () => {
      setReconnecting(false);
      setLoading(false);
    };

    const onSnapshot = (e: MessageEvent) => {
      setSession(JSON.parse(e.data));
      setLoading(false);
      setReconnecting(false);
    };
    const onUpdate = (e: MessageEvent) => {
      setSession(JSON.parse(e.data));
      setReconnecting(false);
    };
    const onNotFound = () => {
      setNotFound(true);
      setLoading(false);
      setReconnecting(false);
      es.close();
    };

    es.onerror = () => {
      if (!notFound) setReconnecting(true);
      setLoading(false);
    };

    es.addEventListener("snapshot", onSnapshot);
    es.addEventListener("update", onUpdate);
    es.addEventListener("not_found", onNotFound);

    return () => {
      es.removeEventListener("snapshot", onSnapshot);
      es.removeEventListener("update", onUpdate);
      es.removeEventListener("not_found", onNotFound);
      es.close();
      setReconnecting(false);
    };
  }, [key, isMobile, notFound]);

  /* ───────────── Cost helpers ───────────── */
  function getSlotCost(p: SpectatorState["picks"][number]) {
    if (!p) return { charCost: 0, lcCost: 0, total: 0 };

    const char = charByCode.get(p.characterCode);
    const lc = p.lightconeId ? lcById.get(String(p.lightconeId)) : undefined;

    // Character cost (prefer session preset → Cerydra rows → simple fallback)
    let charCost = 0;
    if (char) {
      const presetRow = costCharMs[char.code]; // session preset [E0..E6]
      const cerydraRow = cerydraCharMs[char.code]; // DB fallback   [E0..E6]
      const row =
        Array.isArray(presetRow) && presetRow.length === 7
          ? presetRow
          : Array.isArray(cerydraRow) && cerydraRow.length === 7
          ? cerydraRow
          : null;

      const baseOverride = featuredCharBase.get(char.code);

      if (row) {
        const baseAtE0 =
          typeof baseOverride === "number"
            ? baseOverride
            : Number((row[0] || 0).toFixed(2));
        const atEx = Number(
          (row[Math.max(0, Math.min(6, p.eidolon))] || 0).toFixed(2)
        );
        const delta = Number((atEx - (row[0] || 0)).toFixed(2));
        charCost = Number((baseAtE0 + delta).toFixed(2));
      } else {
        const normalAtE0 = calcCharCost(char, 0);
        const normalAtEx = calcCharCost(char, p.eidolon);
        const delta = Number((normalAtEx - normalAtE0).toFixed(2));
        const base =
          typeof baseOverride === "number" ? baseOverride : normalAtE0;
        charCost = Number((base + delta).toFixed(2));
      }
    }

    // Light Cone cost (prefer session preset → Cerydra rows → fallback rule)
    let lcCost = 0;
    if (lc) {
      const presetRow = costLcPhase[String(lc.id)];
      const cerydraRow = cerydraLcPhase[String(lc.id)];
      const row =
        Array.isArray(presetRow) && presetRow.length === 5
          ? presetRow
          : Array.isArray(cerydraRow) && cerydraRow.length === 5
          ? cerydraRow
          : null;

      if (row) {
        const baseOverride = featuredLcBase.get(String(lc.id));
        const baseAtP1 =
          typeof baseOverride === "number"
            ? baseOverride
            : Number((row[0] || 0).toFixed(2));
        const atPx = Number(
          (row[Math.max(1, Math.min(5, p.superimpose)) - 1] || 0).toFixed(2)
        );
        const delta = Number((atPx - (row[0] || 0)).toFixed(2));
        lcCost = Number((baseAtP1 + delta).toFixed(2));
      } else {
        const baseOverride = featuredLcBase.get(String(lc.id));
        lcCost = calcLcCostWithBase(lc, p.superimpose, baseOverride);
      }
    }

    const total = Number((charCost + lcCost).toFixed(2));
    return { charCost, lcCost, total };
  }

  function getTeamCost(prefix: "B" | "R") {
    let total = 0;
    const picks = state?.picks ?? [];
    for (let i = 0; i < draftSequence.length; i++) {
      const step = draftSequence[i];
      if (!step.startsWith(prefix)) continue;
      if (step === "BB" || step === "RR") continue;
      const slot = picks[i];
      const { total: t } = getSlotCost(slot);
      total += t;
    }
    return { total: Number(total.toFixed(2)) };
  }

  // memoize team costs
  const teamCostMemo = useMemo(
    () => ({
      B: getTeamCost("B"),
      R: getTeamCost("R"),
    }),
    [
      state?.picks,
      draftSequence,
      costCharMs,
      costLcPhase,
      featuredCharBase,
      featuredLcBase,
      cerydraLcPhase,
      cerydraCharMs,
    ]
  );

  // cycle penalties (computed)
  const blueCyclePenalty = useMemo(
    () =>
      Number((teamCostMemo.B.total / Math.max(1, cycleBreakpoint)).toFixed(2)),
    [teamCostMemo, cycleBreakpoint]
  );
  const redCyclePenalty = useMemo(
    () =>
      Number((teamCostMemo.R.total / Math.max(1, cycleBreakpoint)).toFixed(2)),
    [teamCostMemo, cycleBreakpoint]
  );

  // extra (manual) penalties if provided by session
  const extraPenaltyB = Number(state?.extraCyclePenaltyB || 0) || 0;
  const extraPenaltyR = Number(state?.extraCyclePenaltyR || 0) || 0;

  const team1Cost = teamCostMemo.B;
  const team2Cost = teamCostMemo.R;

  const draftComplete =
    (state?.currentTurn ?? 0) >= (state?.draftSequence?.length ?? 0);
  const blueLocked = !!state?.blueLocked;
  const redLocked = !!state?.redLocked;

  // Global timer penalty counts (whole draft, provided by server)
  const timerPenCount = {
    B: Number(state?.timerPenaltyCountB ?? 0) || 0,
    R: Number(state?.timerPenaltyCountR ?? 0) || 0,
  };

  // Whether timer/cycle penalties are applied to end score (owner controls this)
  const includeTimer = {
    B: state?.applyTimerPenaltyB ?? true,
    R: state?.applyTimerPenaltyR ?? true,
  };
  const includeCycle = {
    B: state?.applyCyclePenaltyB ?? true,
    R: state?.applyCyclePenaltyR ?? true,
  };

  // Featured metadata hydration for display
  const resolveFeaturedMeta = (f: FeaturedCfg) => {
    if (f.kind === "character") {
      const c = f.code ? charByCode.get(f.code) : undefined;
      return {
        title: c?.name ?? f.name ?? (f.code || "Unknown"),
        image: c?.image_url ?? f.image_url ?? "",
      };
    } else {
      const w = f.id ? lcById.get(String(f.id)) : undefined;
      return {
        title: w?.name ?? f.name ?? (f.id ? String(f.id) : "Unknown"),
        image: w?.image_url ?? f.image_url ?? "",
      };
    }
  };

  // active side + ban guards for timer UI
  const activeSide: "B" | "R" | null = useMemo(() => {
    if (draftComplete) return null;
    const tok = draftSequence[currentTurn] || "";
    if (tok.startsWith("B")) return "B";
    if (tok.startsWith("R")) return "R";
    return null;
  }, [draftComplete, draftSequence, currentTurn]);

  const isFirstTurnBan = useMemo(
    () => isFirstBanForSide(currentTurn, draftSequence),
    [currentTurn, draftSequence]
  );

  // helpers for timer UI
  const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
  const fmtClock = (s: number) => {
    const ss = Math.max(0, Math.floor(s));
    const m = Math.floor(ss / 60);
    const r = ss % 60;
    return `${m}:${pad2(r)}`;
  };

  function computeGraceReserveCycles(
    grace0: number,
    reserve0: number,
    elapsed: number,
    cycleLen = 30
  ) {
    let g = Math.max(0, grace0);
    let r = Math.max(0, reserve0);
    let e = Math.max(0, elapsed);
    let cycles = 0;
    if (e <= g) return { grace: g - e, reserve: r, cycles };
    e -= g;
    g = 0;
    if (e <= r) return { grace: 0, reserve: r - e, cycles };
    e -= r;
    r = 0;
    cycles = 1 + Math.floor(e / cycleLen);
    const within = e % cycleLen;
    g = cycleLen - within;
    return { grace: g, reserve: r, cycles };
  }

  type DisplayClocks = {
    reserve: { B: number; R: number };
    grace: number;
    cycles: { B: number; R: number };
  };

  const displayClocks: DisplayClocks = useMemo(() => {
    let g = Math.max(0, Number(graceLeft) || 0);
    let rB = Math.max(0, Number(reserveLeft.B) || 0);
    let rR = Math.max(0, Number(reserveLeft.R) || 0);
    let cB = 0,
      cR = 0;

    if (
      timerEnabled &&
      !draftComplete &&
      clockSyncedAt != null &&
      activeSide &&
      !paused[activeSide] &&
      !isFirstTurnBan
    ) {
      const elapsed = Math.max(0, (nowMs - clockSyncedAt) / 1000);
      if (activeSide === "B") {
        const res = computeGraceReserveCycles(g, rB, elapsed, MOVE_GRACE);
        g = res.grace;
        rB = res.reserve;
        cB = res.cycles;
      } else {
        const res = computeGraceReserveCycles(g, rR, elapsed, MOVE_GRACE);
        g = res.grace;
        rR = res.reserve;
        cR = res.cycles;
      }
    }
    return { reserve: { B: rB, R: rR }, grace: g, cycles: { B: cB, R: cR } };
  }, [
    timerEnabled,
    draftComplete,
    clockSyncedAt,
    activeSide,
    paused,
    isFirstTurnBan,
    graceLeft,
    reserveLeft.B,
    reserveLeft.R,
    nowMs,
  ]);

  if (isMobile) return null;

  /* ───────────── Render ───────────── */
  return (
    <div
      className="page-fade-in"
      style={{
        backgroundImage: "url('/hsr-bg.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      />
      <div className="position-relative z-2 text-white px-4">
        <Navbar />

        {/* Top-right: LIVE + Cost Preset */}
        <div
          className="position-absolute"
          style={{ top: 70, right: 20, zIndex: 10 }}
        >
          {isLive && !draftComplete && (
            <div>
              <span
                className="badge bg-danger d-block"
                style={{
                  fontWeight: 800,
                  letterSpacing: 1,
                  padding: "8px 12px",
                }}
              >
                LIVE
              </span>
            </div>
          )}
          {/* Read-only settings button */}
          <div className="mb-3 w-100 d-flex justify-content-center">
            <button
              type="button"
              className="btn btn-sm btn-glass"
              title="View settings"
              onClick={() => setShowSettingsModal(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span aria-hidden="true">⚙️</span>
            </button>
          </div>
        </div>
      </div>

      <div
        className="position-relative z-2 text-white px-2 px-md-4"
        style={{ maxWidth: "1600px", margin: "0 auto" }}
      >
        {/* Status strip */}
        {loading && (
          <div className="text-center my-4 text-white-50">
            Loading live draft…
          </div>
        )}
        {notFound && !loading && (
          <div className="text-center my-4 text-warning">
            Spectator session not found or expired.
          </div>
        )}
        {error && !loading && !notFound && (
          <div className="text-center my-4 text-danger">{error}</div>
        )}

        {/* Draft rows (read-only) */}
        <div className="d-flex flex-column align-items-center gap-3 mb-4">
          {(["B", "R"] as const).map((prefix) => {
            const name = prefix === "B" ? team1Name : team2Name;
            const color = prefix === "B" ? "#3388ff" : "#cc3333";
            const ref = prefix === "B" ? blueRowRef : redRowRef;
            const scale = prefix === "B" ? blueScale : redScale;
            const cost = prefix === "B" ? team1Cost : team2Cost;
            const locked = prefix === "B" ? blueLocked : redLocked;

            return (
              <div className="w-100 text-center" key={prefix}>
                <div className="team-header">
                  <div className="team-title" style={{ color }}>
                    <span
                      className="team-dot"
                      style={{ backgroundColor: color }}
                    />
                    {name}
                    {draftComplete && locked && (
                      <span
                        className="badge bg-secondary ms-2"
                        title="Draft locked"
                      >
                        🔒 Locked
                      </span>
                    )}
                  </div>

                  {/* RIGHT SIDE: cost + timer (read-only) */}
                  <div
                    className="d-flex align-items-center"
                    style={{ gap: 10 }}
                  >
                    {timerEnabled && (
                      <div
                        className={`btn btn-sm back-button-glass timer-pill ${
                          activeSide === prefix &&
                          !paused[prefix] &&
                          !draftComplete
                            ? "timer-active"
                            : ""
                        }`}
                        style={{ pointerEvents: "none" }}
                        title="Reserve time (read-only)"
                      >
                        {paused[prefix] ? "⏸" : "⏱"}{" "}
                        {fmtClock(displayClocks.reserve[prefix])}
                        {/* Show global timer penalties pill if any occurred */}
                        {timerPenCount[prefix] > 0 && (
                          <span
                            className="badge bg-danger ms-2"
                            title="Timer penalties this draft"
                          >
                            ×{timerPenCount[prefix]}
                          </span>
                        )}
                        {/* Live grace window on the active side */}
                        {activeSide === prefix &&
                          !draftComplete &&
                          !isFirstTurnBan && (
                            <span
                              className="ms-2 text-white-50"
                              title="Extra 30s windows after both timers hit 0"
                            >
                              (+{fmtClock(displayClocks.grace)})
                            </span>
                          )}
                        {paused[prefix] && (
                          <span className="badge bg-warning ms-2">Paused</span>
                        )}
                      </div>
                    )}

                    <div className="team-cost">Cost: {cost.total}</div>
                  </div>
                </div>

                <div ref={ref} className="draft-row-wrap">
                  <div
                    className="draft-row"
                    style={
                      {
                        "--card-scale": scale,
                        "--card-w": `${CARD_W}px`,
                        "--card-h": `${CARD_H}px`,
                        "--card-gap": `${CARD_GAP}px`,
                      } as React.CSSProperties
                    }
                  >
                    {draftSequence.map((step, i) =>
                      step.startsWith(prefix) ? (
                        <div
                          key={i}
                          className={[
                            "draft-card",
                            step.includes("ACE") ? "ace" : "",
                            step === "BB" || step === "RR" ? "ban" : "",
                            prefix === "B" ? "blue" : "red",
                            i === currentTurn ? "active" : "",
                            useSmall ? "small" : "",
                          ].join(" ")}
                          style={{ zIndex: 10 }}
                        >
                          {draftComplete && locked && (
                            <div
                              title="Draft locked"
                              style={{
                                position: "absolute",
                                top: 6,
                                left: 6,
                                fontSize: 16,
                                opacity: 0.9,
                              }}
                            >
                              🔒
                            </div>
                          )}

                          {/* Ribbon when empty & is a ban slot */}
                          {(() => {
                            const p = state?.picks?.[i] ?? null;
                            const isBanSlot = step === "BB" || step === "RR";
                            const isAceSlot = step.includes("ACE");
                            const showRibbon = !p && isBanSlot;
                            if (!showRibbon) return null;
                            return (
                              <div
                                className={`ribbon ${
                                  isAceSlot ? "ace" : "ban"
                                }`}
                              >
                                {isAceSlot ? "ACE" : "BAN"}
                              </div>
                            );
                          })()}

                          {(() => {
                            const p = state?.picks?.[i] ?? null;
                            if (!p) {
                              return (
                                <div className="d-flex w-100 h-100 align-items-center justify-content-center text-white-50">
                                  #{i + 1}
                                </div>
                              );
                            }

                            const char = charByCode.get(p.characterCode);
                            const lc = p.lightconeId
                              ? lcById.get(String(p.lightconeId))
                              : undefined;
                            const isBanSlot = step === "BB" || step === "RR";
                            const { charCost, lcCost, total } = getSlotCost(p);

                            return (
                              <>
                                {/* Character image */}
                                {char ? (
                                  <img
                                    src={char.image_url}
                                    alt={char.name}
                                    className="draft-img"
                                    style={{
                                      filter: isBanSlot
                                        ? "grayscale(100%) brightness(0.5)"
                                        : "none",
                                    }}
                                  />
                                ) : (
                                  <div className="d-flex w-100 h-100 align-items-center justify-content-center text-white-50">
                                    (loading)
                                  </div>
                                )}

                                {/* Light Cone badge (read-only) */}
                                {lc && (
                                  <img
                                    src={lc.image_url}
                                    alt={lc.name}
                                    title={lc.name}
                                    className="engine-badge"
                                  />
                                )}

                                {/* 3v3 ONLY: mini E/S + cost bubble */}
                                {useSmall && !isBanSlot && (
                                  <div className="cost-stack">
                                    <span className="cost-btn" title="Eidolon">
                                      E{p.eidolon}
                                    </span>
                                    {lc && (
                                      <span
                                        className="cost-btn"
                                        title="Superimpose"
                                      >
                                        S{p.superimpose}
                                      </span>
                                    )}
                                    <div
                                      className="cost-bubble"
                                      title={`Char ${charCost} + LC ${lcCost}`}
                                    >
                                      {total}
                                    </div>
                                  </div>
                                )}

                                {/* Bottom info (read-only) */}
                                <div className="info-bar">
                                  {/* hide long name on small cards so it doesn't clash */}
                                  {!useSmall && (
                                    <div
                                      className="char-name"
                                      title={char?.name || ""}
                                    >
                                      {char?.name || ""}
                                    </div>
                                  )}

                                  {/* show the big chip row only on 2v2 */}
                                  {!isBanSlot && !useSmall && (
                                    <div className="chip-row">
                                      <span
                                        className="chip chip-left"
                                        title="Eidolon"
                                      >
                                        E{p.eidolon}
                                      </span>
                                      <span
                                        className="chip cost chip-center"
                                        title={`Char ${charCost} + LC ${lcCost}`}
                                      >
                                        {total}
                                      </span>
                                      {lc ? (
                                        <span
                                          className="chip chip-right"
                                          title="Superimpose"
                                        >
                                          S{p.superimpose}
                                        </span>
                                      ) : (
                                        <span
                                          className="chip-spacer"
                                          aria-hidden="true"
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Featured (characters + Light Cones) */}
        {featuredList.length > 0 && (
          <div
            className="featured-wrap"
            style={{
              marginTop: 16,
              marginBottom: 12,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div
              className="d-flex align-items-center justify-content-between flex-wrap gap-2"
              style={{ marginBottom: 10 }}
            >
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontWeight: 700 }}>Featured</span>
                <span className="text-white-50 small">
                  ({featuredList.length}
                  {featuredList.length === 1 ? " item" : " items"})
                </span>
              </div>
              <div className="text-white-50 small">
                Cost shown is the E0 (or P1) override base if set. Rules still
                apply.
              </div>
            </div>

            <div
              className="featured-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              {featuredList.map((f) => {
                const ruleColor =
                  f.rule === "globalBan"
                    ? "#ef4444"
                    : f.rule === "globalPick"
                    ? "#f59e0b"
                    : "rgba(255,255,255,0.18)";
                const ruleLabel =
                  f.rule === "globalBan"
                    ? "Uni Ban"
                    : f.rule === "globalPick"
                    ? "Uni Pick"
                    : "No Rule";

                const meta = resolveFeaturedMeta(f);
                const keyStr = f.kind === "character" ? f.code : `lc-${f.id}`;

                return (
                  <div
                    key={keyStr}
                    className="featured-card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 10,
                      borderRadius: 10,
                      background:
                        "linear-gradient(0deg, rgba(255,255,255,0.03), rgba(255,255,255,0.03))",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    title={ruleLabel}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 8,
                        overflow: "hidden",
                        flex: "0 0 52px",
                        background: "rgba(0,0,0,0.3)",
                      }}
                    >
                      {meta.image ? (
                        <img
                          src={meta.image}
                          alt={meta.title}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <div
                          className="d-flex align-items-center justify-content-center text-white-50"
                          style={{
                            width: "100%",
                            height: "100%",
                            fontSize: 12,
                          }}
                        >
                          {f.kind === "character"
                            ? (f as any).code
                            : (f as any).id}
                        </div>
                      )}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        className="text-truncate"
                        style={{ fontWeight: 600, lineHeight: 1.2 }}
                        title={meta.title}
                      >
                        {meta.title}
                      </div>

                      <div className="d-flex align-items-center gap-2 mt-1">
                        <span
                          className="badge"
                          style={{
                            backgroundColor: ruleColor,
                            border: "1px solid rgba(0,0,0,0.2)",
                            color:
                              f.rule === "none"
                                ? "rgba(255,255,255,0.85)"
                                : "white",
                          }}
                        >
                          {ruleLabel}
                        </span>
                        {typeof (f as any).customCost === "number" && (
                          <span className="text-white-50 small">
                            Cost:{" "}
                            <strong style={{ color: "white" }}>
                              {(f as any).customCost.toFixed(2)}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Read-only scoring (cycle penalty model + extra penalty inputs) */}
        {state && (
          <div
            className="score-row d-flex flex-column flex-md-row gap-3 px-2 mt-4"
            style={{ maxWidth: 1000, margin: "0 auto" }}
          >
            {(["B", "R"] as const).map((side) => {
              const isBlue = side === "B";
              const scores = isBlue ? blueScores : redScores;
              const labels = isBlue ? nameLabelsBlue : nameLabelsRed;

              const includeCycleThis = includeCycle[side];
              const includeTimerThis = includeTimer[side];

              const penaltyCycles = isBlue ? blueCyclePenalty : redCyclePenalty;
              const cycleTerm = includeCycleThis ? penaltyCycles : 0;

              const extraCycles = isBlue ? extraPenaltyB : extraPenaltyR;
              const timerAdd = includeTimerThis ? timerPenCount[side] : 0;

              const adjustedTotal =
                scores.reduce((a, b) => a + b, 0) +
                cycleTerm +
                extraCycles +
                timerAdd;

              return (
                <div
                  key={side}
                  className={`score-card ${isBlue ? "blue" : "red"} w-100`}
                >
                  <div className="score-header">
                    <div className="score-title">
                      {isBlue ? (
                        <span style={{ color: "#3388ff", fontWeight: 700 }}>
                          Blue Team
                        </span>
                      ) : (
                        <span style={{ color: "#cc3333", fontWeight: 700 }}>
                          Red Team
                        </span>
                      )}
                    </div>
                    <div className="d-flex align-items-center gap-2 mt-2">
                      {timerPenCount[side] > 0 && (
                        <span
                          className="badge"
                          style={{
                            padding: "6px 10px",
                            border: "1px solid rgba(255,255,255,0.25)",
                            background: includeTimerThis
                              ? "rgba(255, 193, 7, 0.2)" // included → warm
                              : "rgba(255,255,255,0.10)", // not included → neutral
                            color: "white",
                          }}
                          title={
                            includeTimerThis
                              ? "Timer penalty is included in the end score"
                              : "Timer penalty is not included in the end score"
                          }
                        >
                          ⏱ Timer ×{timerPenCount[side]}
                        </span>
                      )}
                    </div>

                    <div className="score-draft">
                      Cycle penalty: {penaltyCycles}
                    </div>
                  </div>

                  <div className="score-inputs">
                    {(is3ban ? [0, 1, 2] : [0, 1]).map((i) => (
                      <div className="score-input-group" key={i}>
                        <label>{labels[i]}</label>
                        <div
                          className="form-control score-input"
                          style={{ opacity: 0.9 }}
                        >
                          {scores[i] || 0}
                        </div>
                      </div>
                    ))}

                    {/* NEW: extra cycle penalty (read-only mirror) */}
                    <div className="score-input-group" key="extra">
                      <label>Extra Cycle Penalty</label>
                      <input
                        className="form-control score-input"
                        value={extraCycles || 0}
                        readOnly
                        disabled
                      />
                    </div>
                  </div>

                  <div className="score-total">
                    <div className="score-total-label">Team Total</div>
                    <div className="score-total-value">
                      {scores.reduce((a, b) => a + b, 0)}
                      {(cycleTerm > 0 || extraCycles > 0 || timerAdd > 0) && (
                        <span className="score-penalty">
                          {includeCycleThis && penaltyCycles
                            ? ` +${penaltyCycles}`
                            : ""}
                          {extraCycles ? ` +${extraCycles}` : ""}
                          {timerAdd ? ` +${timerAdd}` : ""} ={" "}
                          <span className="score-adjusted">
                            {adjustedTotal}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Winner strip */}
        {state && (
          <div className="text-center mt-4 text-white">
            {(() => {
              const blueCycleTerm = includeCycle.B ? blueCyclePenalty : 0;
              const redCycleTerm = includeCycle.R ? redCyclePenalty : 0;

              const blueTimerAdd = includeTimer.B ? timerPenCount.B : 0;
              const redTimerAdd = includeTimer.R ? timerPenCount.R : 0;

              const blueAdj =
                blueScores.reduce((a, b) => a + b, 0) +
                blueCycleTerm +
                (extraPenaltyB || 0) +
                blueTimerAdd;

              const redAdj =
                redScores.reduce((a, b) => a + b, 0) +
                redCycleTerm +
                (extraPenaltyR || 0) +
                redTimerAdd;

              if (blueAdj < redAdj)
                return (
                  <h4 style={{ color: "#3388ff" }}>🏆 {team1Name} Wins!</h4>
                );
              if (redAdj < blueAdj)
                return (
                  <h4 style={{ color: "#cc3333" }}>🏆 {team2Name} Wins!</h4>
                );
              return <h4 className="text-warning">Draw!</h4>;
            })()}
          </div>
        )}
      </div>

      <Modal
        show={showSettingsModal}
        onHide={() => setShowSettingsModal(false)}
        centered
        contentClassName="custom-dark-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Draft Settings</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <div className="fw-semibold">Active Cost Preset</div>
            <span
              className="badge bg-warning text-dark"
              title="Active cost preset"
              style={{ fontWeight: 700, padding: "8px 12px" }}
            >
              {displayCostProfileName}
            </span>
          </div>

          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="fw-semibold">Cycle Breakpoint</div>
            <span
              className="badge bg-info text-dark"
              title="Penalty divider used for cycle cost"
              style={{ fontWeight: 700, padding: "8px 12px" }}
            >
              ÷ {cycleBreakpoint}
            </span>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowSettingsModal(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <ReconnectingBadge show={reconnecting && !loading && !notFound} />
    </div>
  );
}
