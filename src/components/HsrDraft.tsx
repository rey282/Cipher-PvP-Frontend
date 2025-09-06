// components/CerydraDraft.tsx
import { useEffect, useState, useRef, useMemo } from "react";
import Navbar from "../components/Navbar";
import "../components/Landing.css";
import { useLocation, useNavigate } from "react-router-dom";
import { Modal, Button } from "react-bootstrap";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

/* ───────────── Types (HSR) ───────────── */
type Character = {
  code: string;
  name: string;
  subname?: string;
  rarity: number; // 5★/4★
  image_url: string;
  limited?: boolean;
};

type LightCone = {
  id: string; // numeric-ish but treat as string
  name: string;
  subname?: string;
  rarity: number; // 5★ / 4★
  image_url: string;
  limited: boolean;
};

type DraftPick = {
  character: Character;
  eidolon: number; // E0..E6
  lightcone?: LightCone;
  phase: number; // P1..P5 == 1..5
};

type ServerPick = {
  characterCode: string;
  eidolon: number; // 0..6
  lightconeId: string | null;
  superimpose: number; // 1..5
};

type SpectatorState = {
  draftSequence: string[];
  currentTurn: number;
  picks: Array<ServerPick | null>;
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

type FeaturedCfg = {
  kind: "character" | "lightcone";
  code?: string; // for characters
  id?: string; // for light cones
  name?: string;
  image_url?: string;
  rule: "none" | "globalBan" | "globalPick";
  customCost?: number | null;
};

type HsrMode = "2ban" | "3ban" | "6ban";

const coerceMode = (v: any): HsrMode =>
  v === "3ban" ? "3ban" : v === "6ban" ? "6ban" : "2ban";

// Landing seeds this
type DraftInit = {
  team1?: string;
  team2?: string;
  mode?: "2ban" | "3ban" | "6ban";
  featured?: FeaturedCfg[];
  costProfileId?: string | null;
  costLimit?: number;
  penaltyPerPoint?: number;
  draftId?: string;
  timerEnabled?: boolean;
  reserveSeconds?: number;
};

function normalizeFeatured(list: any[]): FeaturedCfg[] {
  return (Array.isArray(list) ? list : []).map((f: any) => {
    const kind: "character" | "lightcone" =
      f?.kind === "lightcone" || f?.id ? "lightcone" : "character";
    return {
      kind,
      code: f.code ?? undefined,
      id: f.id != null ? String(f.id) : undefined,
      name: f.name ?? undefined,
      image_url: f.image_url ?? undefined,
      rule: f.rule === "globalBan" || f.rule === "globalPick" ? f.rule : "none",
      customCost: typeof f.customCost === "number" ? f.customCost : null,
    };
  });
}

const MOBILE_QUERY = "(pointer:coarse), (max-width: 820px)";
const SCORE_MIN = 0;
const SCORE_MAX = 15;

/* ───────────── Responsive row sizing ───────────── */
const CARD_W = 170;
const CARD_H = 240;
const CARD_GAP = 12;
const CARD_MIN_SCALE = 0.68;

/* Storage keys aligned with CerydraSection */
const CREATE_LOCK_KEY = "hsrSpectatorCreateLock";
const SNAPSHOT_PREFIX = "hsrDraftLocal:";
const SPECTATOR_KEY_SS = "hsrSpectatorKey";
const DRAFT_INIT_SS = "hsrDraftInit";
const BLUE_TOKEN_SS = "hsrBlueToken";
const RED_TOKEN_SS = "hsrRedToken";

function writeLocalSnapshot(key: string, state: SpectatorState) {
  try {
    const payload = { updatedAt: Date.now(), state };
    sessionStorage.setItem(SNAPSHOT_PREFIX + key, JSON.stringify(payload));
  } catch {}
}
function tryReadLocalSnapshot(key: string): SpectatorState | null {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state ?? null;
  } catch {
    return null;
  }
}

function useRowScale<T extends HTMLElement>(
  ref: React.MutableRefObject<T | null>,
  cardCount: number
) {
  const [scale, setScale] = useState<number>(1);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const compute = () => {
      const available = el.clientWidth;
      const needed = cardCount * CARD_W + (cardCount - 1) * CARD_GAP;
      const s = Math.min(1, Math.max(CARD_MIN_SCALE, available / needed));
      setScale(s);
    };
    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [ref, cardCount]);
  return scale;
}

/* ───────────── Cost Helpers (fallback rules if preset rows missing) ───────────── */
function calcCharCostHSR(char: Character, eidolon: number): number {
  const e = Math.max(0, Math.min(6, eidolon));
  if (char.rarity <= 4) return 0.5; // cheap 4★ baseline if no preset
  // 5★: limited more expensive — rough fallback, presets will usually override
  if (char.limited) {
    const bumps = [1, 2, 4, 6].filter((m) => e >= m).length;
    return 1 + 0.5 * bumps; // 1.0 → up to 3.0
  }
  return e >= 6 ? 1.5 : 1.0;
}

function calcLcCostHSR(lc: LightCone | undefined, phase: number): number {
  if (!lc) return 0;
  const p = Math.max(1, Math.min(5, phase));
  if (lc.rarity <= 4) return 0; // all 4★ free by fallback
  if (lc.limited) {
    if (p <= 2) return 0.25;
    if (p <= 4) return 0.5;
    return 0.75;
  }
  return p >= 3 ? 0.25 : 0;
}

/* ───────────── Build default local sequences (server may override via SSE) ───────────── */
function buildSequenceForMode(mode: HsrMode): string[] {
  if (mode === "6ban") {
    return [
      "BB",
      "RR",
      "B",
      "R",
      "R",
      "B",
      "RR",
      "BB",
      "R",
      "B",
      "B",
      "R",
      "BB",
      "RR",
      "B",
      "R",
      "R",
      "B",
      "B",
      "R",
      "R",
      "B",
    ];
  }

  if (mode === "3ban") {
    return [
      "BB",
      "RR",
      "B",
      "R",
      "R",
      "B",
      "B",
      "R",
      "R",
      "B",
      "B",
      "R",
      "R(ACE)",
      "B(ACE)",
      "B",
      "R",
      "R",
      "B",
      "B",
      "R",
      "R",
      "B",
      "B",
      "R",
      "B(ACE)",
      "R(ACE)",
    ];
  }

  // 2ban default
  return [
    "BB",
    "RR",
    "B",
    "R",
    "R",
    "B",
    "RR",
    "BB",
    "R",
    "B",
    "B",
    "R",
    "R",
    "B",
    "B",
    "R",
    "R",
    "B",
    "B",
    "R",
  ];
}

/* Draft page */
export default function CerydraDraftPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);

  /* Player linking */
  const keyFromUrl = query.get("key");
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [playerSide, setPlayerSide] = useState<"B" | "R" | null>(null);
  const isPlayerClient = !!(keyFromUrl && playerToken);

  const [blueToken, setBlueToken] = useState<string | null>(null);
  const [redToken, setRedToken] = useState<string | null>(null);

  function forceResetGraceOnTurnChange(srv: Partial<SpectatorState>) {
    if (!timerEnabled) return;
    const srvTurn = Number.isFinite(Number(srv.currentTurn))
      ? Number(srv.currentTurn)
      : null;
    if (srvTurn == null) return;

    const seq =
      Array.isArray(srv.draftSequence) && srv.draftSequence.length
        ? srv.draftSequence
        : draftSequence;
    if (!isFirstBanForSide(srvTurn, seq) && srvTurn !== currentTurn) {
      graceRef.current = MOVE_GRACE;
      setGraceLeft(MOVE_GRACE);
    }
  }

  function normName(s: string) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/[^a-z0-9]/g, ""); // keep a–z/0–9 only
  }

  useEffect(() => {
    const k = query.get("key");
    const pt = query.get("pt");
    if (!k || !pt) return;

    (async () => {
      try {
        const res = await fetch(
          `${
            import.meta.env.VITE_API_BASE
          }/api/hsr/sessions/${k}/resolve-token?pt=${encodeURIComponent(pt)}`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const data = await res.json(); // { side: "B" | "R" }
        setPlayerToken(pt);
        setPlayerSide(data.side);
        setSpectatorKey(k);
        sessionStorage.setItem(SPECTATOR_KEY_SS, k);
      } catch {}
    })();
  }, [location.search]);

  const joiningViaLink = !!keyFromUrl;
  const hasKeyInSession = (() => {
    try {
      return !!sessionStorage.getItem(SPECTATOR_KEY_SS);
    } catch {
      return false;
    }
  })();

  const round2 = (x: number) =>
    Math.round((Number(x) + Number.EPSILON) * 100) / 100;

  const navState = (location.state as DraftInit) || null;
  const stored: DraftInit | null = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(DRAFT_INIT_SS) || "null");
    } catch {
      return null;
    }
  })();
  const seed = navState ?? stored ?? {};

  /* Featured from seed; will be overwritten by SSE/GET from server */
  const [featuredList, setFeaturedList] = useState<FeaturedCfg[]>(
    Array.isArray(seed.featured) ? normalizeFeatured(seed.featured) : []
  );

  const featuredGlobalBan = useMemo(
    () =>
      new Set(
        featuredList
          .filter((f) => f.kind === "character" && f.rule === "globalBan")
          .map((f) => f.code as string)
          .filter(Boolean)
      ),
    [featuredList]
  );
  const featuredGlobalPick = useMemo(
    () =>
      new Set(
        featuredList
          .filter((f) => f.kind === "character" && f.rule === "globalPick")
          .map((f) => f.code as string)
          .filter(Boolean)
      ),
    [featuredList]
  );
  const featuredCharCostOverride = useMemo(
    () =>
      new Map<string, number>(
        featuredList
          .filter(
            (f) =>
              f.kind === "character" &&
              typeof f.customCost === "number" &&
              f.code
          )
          .map((f) => [f.code as string, f.customCost as number])
      ),
    [featuredList]
  );
  const featuredLcCostOverride = useMemo(
    () =>
      new Map<string, number>(
        featuredList
          .filter(
            (f) =>
              f.kind === "lightcone" && typeof f.customCost === "number" && f.id
          )
          .map((f) => [String(f.id), f.customCost as number])
      ),
    [featuredList]
  );
  const lightconeGlobalBan = useMemo(
    () =>
      new Set(
        featuredList
          .filter((f) => f.kind === "lightcone" && f.rule === "globalBan")
          .map((f) => String(f.id))
      ),
    [featuredList]
  );

  /* Mode & team names (owner seeds, server truth overrides via SSE/GET) */
  const [mode, setMode] = useState<HsrMode>(
    coerceMode(seed.mode ?? (query.get("mode") as string | null))
  );

  const is3ban = mode === "3ban";

  const [team1Name, setTeam1Name] = useState<string>(
    seed.team1 || query.get("team1") || "Blue Team"
  );
  const [team2Name, setTeam2Name] = useState<string>(
    seed.team2 || query.get("team2") || "Red Team"
  );

  const hasAnyName = (s?: string) =>
    (s || "")
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean).length > 0;

  const cameFromStart =
    joiningViaLink ||
    hasKeyInSession ||
    !!(navState as any)?.draftId ||
    (!!stored && (hasAnyName(stored.team1) || hasAnyName(stored.team2)));

  const [costProfileId, setCostProfileId] = useState<string | null>(
    (navState?.costProfileId ??
      (stored as any)?.costProfileId ??
      query.get("cp") ??
      null) as string | null
  );

  const [costProfileName, setCostProfileName] = useState<string | null>(null);
  const displayCostProfileName = costProfileName?.trim() || "Cerydra (Default)";
  const [costCharMs, setCostCharMs] = useState<Record<string, number[]>>({});
  const [costLcPhase, setCostLcPhase] = useState<Record<string, number[]>>({});

  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // mobile guard
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
    if (!isMobile) return;
    navigate("/", { replace: true, state: { blocked: "hsr-draft-mobile" } });
  }, [isMobile, navigate]);

  // nudge owner back if no seed
  useEffect(() => {
    if (joiningViaLink) return;
    if (!cameFromStart && !isMobile) {
      navigate("/", { replace: true, state: { blocked: "hsr-draft-no-team" } });
    }
  }, [cameFromStart, isMobile, navigate, joiningViaLink]);

  // Strip query for owner flow (keep ?key / ?pt for players)
  useEffect(() => {
    if (!cameFromStart) return;
    if (!location.search) return;
    const qs = new URLSearchParams(location.search);
    if (qs.get("key") || qs.get("pt")) return;
    navigate(location.pathname, {
      replace: true,
      state: { team1: team1Name, team2: team2Name, mode },
    });
  }, [
    cameFromStart,
    location.pathname,
    location.search,
    team1Name,
    team2Name,
    mode,
    navigate,
  ]);

  const { user } = useAuth();
  const [spectatorKey, setSpectatorKey] = useState<string | null>(null);

  const [cycleBreakpoint, setCycleBreakpoint] = useState<number>(() => {
    const fromSeed = Number(
      (navState as any)?.penaltyPerPoint ?? (stored as any)?.penaltyPerPoint
    );
    return Number.isFinite(fromSeed) && fromSeed > 0
      ? Math.max(1, Math.floor(fromSeed))
      : 4;
  });

  const [cycleBpStr, setCycleBpStr] = useState<string>(String(cycleBreakpoint));
  useEffect(() => setCycleBpStr(String(cycleBreakpoint)), [cycleBreakpoint]);

  const lastLocalSettingsAtRef = useRef(0);
  const cycleBreakpointRef = useRef(cycleBreakpoint);
  useEffect(() => {
    cycleBreakpointRef.current = cycleBreakpoint;
  }, [cycleBreakpoint]);

  // NEW: ACK gating for breakpoint updates
  const pendingCycleBpRef = useRef<number | null>(null);
  const pendingBpExpiresAtRef = useRef<number>(0);

  const applyCycleBreakpoint = (nextValue: number) => {
    const v = Math.max(1, Math.floor(nextValue || 0));

    lastLocalSettingsAtRef.current = Date.now();
    pendingCycleBpRef.current = v;
    pendingBpExpiresAtRef.current = Date.now() + 8000;

    setCycleBreakpoint(v);
    setCycleBpStr(String(v));

    try {
      const raw = sessionStorage.getItem("hsrDraftInit");
      if (raw) {
        const init = JSON.parse(raw);
        init.penaltyPerPoint = v;
        sessionStorage.setItem("hsrDraftInit", JSON.stringify(init));
      }
    } catch {}

    if (isOwner) ownerOptimisticSave(300);
  };

  // If link has ?key, trust immediately (player joins)
  useEffect(() => {
    const k = query.get("key");
    if (k) {
      setSpectatorKey(k);
      sessionStorage.setItem(SPECTATOR_KEY_SS, k);
    }
  }, [location.search]);

  // Otherwise hydrate session key
  useEffect(() => {
    if (spectatorKey) return;
    const k = sessionStorage.getItem(SPECTATOR_KEY_SS);
    if (k) setSpectatorKey(k);
  }, [spectatorKey]);

  // Load cost profile by id or from embedded session
  useEffect(() => {
    let abort = false;
    (async () => {
      if (!costProfileId) {
        setCostProfileName(null);
        setCostCharMs({});
        setCostLcPhase({});
        return;
      }
      // 1) direct preset by id (owner)
      try {
        const r = await fetch(
          `${
            import.meta.env.VITE_API_BASE
          }/api/hsr/cost-presets/${costProfileId}`,
          { credentials: "include" }
        );
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (abort) return;

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
        return;
      } catch {
        // 2) fallback from session (players)
        try {
          if (!spectatorKey) throw new Error("no session");
          const s = await fetch(
            `${import.meta.env.VITE_API_BASE}/api/hsr/sessions/${spectatorKey}`
          );
          if (!s.ok) throw new Error("session fetch failed");
          const d = await s.json();
          if (abort) return;

          if (
            d?.costProfile &&
            (d.costProfile.charMs || d.costProfile.lcPhase)
          ) {
            const cp = d.costProfile;
            setCostProfileName(cp.name || "Preset");
            setCostCharMs(cp.charMs || {});
            setCostLcPhase(cp.lcPhase || {});
            return;
          }

          setCostProfileName("(failed to load)");
          setCostCharMs({});
          setCostLcPhase({});
        } catch {
          if (abort) return;
          setCostProfileName("(failed to load)");
          setCostCharMs({});
          setCostLcPhase({});
        }
      }
    })();
    return () => {
      abort = true;
    };
  }, [costProfileId, spectatorKey]);

  /* Draft sequence (local default; server snapshot can override) */
  const [draftSequence, setDraftSequence] = useState<string[]>(
    buildSequenceForMode(mode)
  );

  useEffect(() => {
    // if we change mode locally (before server snapshot), adopt a new local sequence
    setDraftSequence(buildSequenceForMode(mode));
  }, [mode]);

  /* Catalogs */
  const [characters, setCharacters] = useState<Character[]>([]);

  const [lightcones, setLightcones] = useState<LightCone[]>([]);
  const [draftPicks, setDraftPicks] = useState<(DraftPick | null)[]>(
    Array(draftSequence.length).fill(null)
  );
  const [currentTurn, setCurrentTurn] = useState(0);
  // Live mirror of currentTurn so handlers don't read a stale value
  const currentTurnRef = useRef(currentTurn);
  useEffect(() => {
    currentTurnRef.current = currentTurn;
  }, [currentTurn]);

  // "Busy" flag while a player action is in-flight (prevents double-picks)
  const [actionBusy, setActionBusy] = useState(false);
  const actionBusyRef = useRef(false);
  const setBusy = (v: boolean) => {
    actionBusyRef.current = v;
    setActionBusy(v);
  };

  // Expect SSE to advance to this turn after we optimistically pick
  const pendingAckTurnRef = useRef<number | null>(null);

  // Track which way we expect the server turn to move for the ack
  const pendingAckModeRef = useRef<"ge" | "le" | "eq">("ge");

  // Helper: clear busy once server turn satisfies the expected relation
  const clearBusyIfAcked = (srvTurn: number) => {
    if (pendingAckTurnRef.current == null) return;
    const target = pendingAckTurnRef.current;
    const mode = pendingAckModeRef.current;
    const ok =
      (mode === "ge" && srvTurn >= target) ||
      (mode === "le" && srvTurn <= target) ||
      (mode === "eq" && srvTurn === target);
    if (ok) {
      pendingAckTurnRef.current = null;
      setBusy(false);
    }
  };

  const [, setError] = useState<string | null>(null);

  const [eidolonOpenIndex, setEidolonOpenIndex] = useState<number | null>(null);
  const [phaseOpenIndex, setPhaseOpenIndex] = useState<number | null>(null);

  const [showLcModal, setShowLcModal] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [selectedLcId, setSelectedLcId] = useState<string>("");
  const [lcSearch, setLcSearch] = useState("");
  const [keyboardSearch, setKeyboardSearch] = useState("");

  const [blueScores, setBlueScores] = useState<number[]>(
    is3ban ? [0, 0, 0] : [0, 0]
  );
  const [redScores, setRedScores] = useState<number[]>(
    is3ban ? [0, 0, 0] : [0, 0]
  );
  // keep fast string drafts while typing; commit to numbers on blur/enter
  const [blueDraft, setBlueDraft] = useState<string[]>(
    (is3ban ? [0, 1, 2] : [0, 1]).map((i) => String(blueScores[i] ?? 0))
  );
  const [redDraft, setRedDraft] = useState<string[]>(
    (is3ban ? [0, 1, 2] : [0, 1]).map((i) => String(redScores[i] ?? 0))
  );
  const [extraCyclePenaltyB, setExtraCyclePenaltyB] = useState<number>(0);
  const [extraCyclePenaltyR, setExtraCyclePenaltyR] = useState<number>(0);

  // Draft strings so users can backspace to "" and type freely (with decimal)
  const [extraCycleDraftB, setExtraCycleDraftB] = useState<string>("");
  const [extraCycleDraftR, setExtraCycleDraftR] = useState<string>("");

  // keep drafts in sync when numeric values change (e.g., from SSE)
  useEffect(() => {
    setExtraCycleDraftB(extraCyclePenaltyB ? String(extraCyclePenaltyB) : "");
  }, [extraCyclePenaltyB]);
  useEffect(() => {
    setExtraCycleDraftR(extraCyclePenaltyR ? String(extraCyclePenaltyR) : "");
  }, [extraCyclePenaltyR]);

  // allow digits and a single dot; turn "." into "0."
  const sanitizeDec = (s: string) => {
    let x = s.replace(/[^\d.]/g, "");
    const firstDot = x.indexOf(".");
    if (firstDot !== -1) {
      x = x.slice(0, firstDot + 1) + x.slice(firstDot + 1).replace(/\./g, "");
    }
    if (x === ".") x = "0.";
    return x;
  };

  // keep drafts in sync if scores or mode change
  useEffect(() => {
    setBlueDraft(
      (is3ban ? [0, 1, 2] : [0, 1]).map((i) => String(blueScores[i] ?? 0))
    );
  }, [blueScores, is3ban]);
  useEffect(() => {
    setRedDraft(
      (is3ban ? [0, 1, 2] : [0, 1]).map((i) => String(redScores[i] ?? 0))
    );
  }, [redScores, is3ban]);

  const clampScore = (n: number) => Math.max(SCORE_MIN, Math.min(SCORE_MAX, n));

  function commitScore(side: "B" | "R", i: number) {
    const drafts = side === "B" ? blueDraft : redDraft;
    const n = clampScore(parseInt(drafts[i] || "0", 10) || 0);

    const src = side === "B" ? blueScores : redScores;
    if (src[i] !== n) {
      const next = [...src];
      next[i] = n;
      (side === "B" ? setBlueScores : setRedScores)(next);
      requestSave(0); // save only when we commit
    }

    // normalize the draft display too
    const dnext = side === "B" ? [...blueDraft] : [...redDraft];
    dnext[i] = String(n);
    (side === "B" ? setBlueDraft : setRedDraft)(dnext);
  }

  const [blueLocked, setBlueLocked] = useState<boolean>(false);
  const [redLocked, setRedLocked] = useState<boolean>(false);

  const [hydrated, setHydrated] = useState(false);
  const pendingServerStateRef = useRef<SpectatorState | null>(null);

  // LIVE badge (no keepalive polling)
  const [createdAtMs, setCreatedAtMs] = useState<number | null>(null);
  const [finishedFromServer, setFinishedFromServer] = useState<boolean>(false);
  const isLive =
    !!createdAtMs &&
    !finishedFromServer &&
    Date.now() - createdAtMs < 2 * 60 * 60 * 1000;

  const draftComplete = currentTurn >= draftSequence.length;

  const nPlayers = is3ban ? 3 : 2;
  const rawTeam1List = (team1Name || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const rawTeam2List = (team2Name || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const buildNameLabels = (rawList: string[], count: number): string[] => {
    const primary = rawList.find(Boolean) || "";
    return Array(count)
      .fill("")
      .map((_, i) => rawList[i] || primary);
  };
  const blueLabels = buildNameLabels(rawTeam1List, nPlayers);
  const redLabels = buildNameLabels(rawTeam2List, nPlayers);

  const [applyCyclePenaltyB, setApplyCyclePenaltyB] = useState<boolean>(true);
  const [applyCyclePenaltyR, setApplyCyclePenaltyR] = useState<boolean>(true);

  const [applyTimerPenaltyB, setApplyTimerPenaltyB] = useState(true);
  const [applyTimerPenaltyR, setApplyTimerPenaltyR] = useState(true);

  const [uiLocked, setUiLocked] = useState(false);
  const canFinalize = useMemo(() => {
    const idxs = is3ban ? [0, 1, 2] : [0, 1];
    const filled = (arr: string[]) =>
      idxs.every((i) => (arr[i] ?? "").trim() !== "");
    return draftComplete && filled(blueDraft) && filled(redDraft);
  }, [draftComplete, is3ban, blueDraft, redDraft]);
  const isComplete = draftComplete && uiLocked;

  const collectSpectatorState = (): SpectatorState => ({
    draftSequence,
    currentTurn,
    picks: draftPicks.map((p) =>
      p
        ? {
            characterCode: p.character.code,
            eidolon: p.eidolon,
            lightconeId: p.lightcone?.id ?? null,
            superimpose: p.phase,
          }
        : null
    ),
    blueScores,
    redScores,
    blueLocked,
    redLocked,

    timerEnabled,
    paused,
    reserveSeconds: Math.min(reserveLeft.B, reserveLeft.R),
    reserveLeft: { ...reserveLeft },
    graceLeft,
    timerUpdatedAt: Date.now(),

    extraCyclePenaltyB,
    extraCyclePenaltyR,

    applyCyclePenaltyB,
    applyCyclePenaltyR,

    timerPenaltyCountB: timerPenCount.B,
    timerPenaltyCountR: timerPenCount.R,
    applyTimerPenaltyB,
    applyTimerPenaltyR,
  });

  // Compact Featured preview / popup
  const [showFeaturedPopup, setShowFeaturedPopup] = useState(false);
  const resolveFeaturedMeta = (f: FeaturedCfg) => {
    if (f.kind === "character") {
      const c = characters.find((x) => x.code === f.code);
      return {
        name: c?.name ?? f.name ?? (f.code || "Unknown"),
        image_url: c?.image_url ?? f.image_url ?? "",
      };
    } else {
      const w = lightcones.find((x) => String(x.id) === String(f.id));
      return {
        name: w?.name ?? f.name ?? (f.id ? String(f.id) : "Unknown"),
        image_url: w?.image_url ?? f.image_url ?? "",
      };
    }
  };
  const renderFeaturedPill = (f: FeaturedCfg) => {
    const ruleColor =
      f.rule === "globalBan"
        ? "#ef4444"
        : f.rule === "globalPick"
        ? "#f59e0b"
        : "rgba(255,255,255,0.28)";
    const ruleLabel =
      f.rule === "globalBan"
        ? "Uni Ban"
        : f.rule === "globalPick"
        ? "Uni Pick"
        : "No Rule";
    const meta = resolveFeaturedMeta(f);
    const title = meta.name;
    const img = meta.image_url;
    return (
      <div
        key={f.kind === "character" ? f.code : `lc-${f.id}`}
        className="d-inline-flex align-items-center"
        style={{
          gap: 10,
          padding: "6px 8px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          minWidth: 0,
          maxWidth: 260,
          cursor: "pointer",
        }}
        title={ruleLabel}
        onClick={() => setShowFeaturedPopup(true)}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            overflow: "hidden",
            background: "rgba(0,0,0,0.3)",
            flex: "0 0 28px",
          }}
        >
          {img ? (
            <img
              src={img}
              alt={title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            className="text-truncate"
            style={{ fontWeight: 600, lineHeight: 1 }}
          >
            {title}
          </div>
          <div
            className="d-flex align-items-center gap-2"
            style={{ marginTop: 2 }}
          >
            <span
              className="badge"
              style={{
                backgroundColor: ruleColor,
                border: "1px solid rgba(0,0,0,0.25)",
                color: f.rule === "none" ? "rgba(255,255,255,0.85)" : "white",
              }}
            >
              {ruleLabel}
            </span>
            {typeof f.customCost === "number" && (
              <span className="text-white-50 small">
                Cost:{" "}
                <strong style={{ color: "white" }}>
                  {f.customCost.toFixed(2)}
                </strong>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    // Only hydrate if we DON'T already have a profile from server/preset
    if (costProfileId) return; // a real preset is selected
    if (Object.keys(costCharMs).length > 0) return; // already hydrated (server or earlier)
    if (characters.length === 0) return; // need catalog to map names → codes

    let aborted = false;
    (async () => {
      try {
        const [resChars, resCones] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/balance`, {
            credentials: "include",
          }),
          fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/cone-balance`, {
            credentials: "include",
          }),
        ]);
        if (!resChars.ok || !resCones.ok) return;

        const [dataChars, dataCones] = await Promise.all([
          resChars.json(), // { characters: [{ id, name, costs }] }
          resCones.json(), // { cones: [{ id, name, costs, ... }] }
        ]);

        // Build name → code map from HSR catalog
        const byName = new Map<string, string>();
        for (const c of characters) byName.set(normName(c.name), c.code);

        // code -> [E0..E6]
        const cm: Record<string, number[]> = {};
        for (const row of (dataChars.characters || []) as Array<{
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

        // light cone id -> [P1..P5]
        const lp: Record<string, number[]> = {};
        for (const cone of (dataCones.cones || []) as Array<{
          id: string;
          costs: number[];
        }>) {
          const arr = Array.isArray(cone.costs)
            ? cone.costs.map((n) => Number(n) || 0)
            : [];
          lp[String(cone.id)] = (
            arr.length === 5 ? arr : Array(5).fill(0)
          ) as number[];
        }

        if (aborted) return;
        setCostProfileName("Cerydra Default");
        setCostCharMs(cm);
        setCostLcPhase(lp); // ✅ now sourced from cone-balance
      } catch {
        /* ignore */
      }
    })();

    return () => {
      aborted = true;
    };
  }, [costProfileId, costCharMs, characters]);

  /* Auto-create session (OWNER ONLY) */
  const [creating, setCreating] = useState(false);

  const generateSpectatorSession = async () => {
    if (creating) return;
    setCreating(true);
    try {
      // POST (generateSpectatorSession)
      const payload = {
        team1: team1Name,
        team2: team2Name,
        mode,
        featured: featuredList,
        costProfileId,
        state: collectSpectatorState(),
        penaltyPerPoint: cycleBreakpoint,
        timerEnabled,
        reserveSeconds: Math.min(reserveLeft.B, reserveLeft.R),
      };

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/api/hsr/sessions`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json(); // { key, url, blueToken?, redToken? }
      setSpectatorKey(data.key);
      sessionStorage.setItem(SPECTATOR_KEY_SS, data.key);

      if (data.blueToken) {
        setBlueToken(data.blueToken);
        sessionStorage.setItem(BLUE_TOKEN_SS, data.blueToken);
      }
      if (data.redToken) {
        setRedToken(data.redToken);
        sessionStorage.setItem(RED_TOKEN_SS, data.redToken);
      }
      setHydrated(true);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (blueToken && redToken) return;
    const fromSSBlue = sessionStorage.getItem(BLUE_TOKEN_SS);
    const fromSSRed = sessionStorage.getItem(RED_TOKEN_SS);
    if (fromSSBlue || fromSSRed) {
      if (fromSSBlue) setBlueToken(fromSSBlue);
      if (fromSSRed) setRedToken(fromSSRed);
      return;
    }
    (async () => {
      try {
        const r = await fetch(
          `${import.meta.env.VITE_API_BASE}/api/hsr/sessions/open`,
          {
            credentials: "include",
          }
        );
        if (!r.ok) return;
        const d = await r.json();
        if (d?.blueToken) {
          setBlueToken(d.blueToken);
          sessionStorage.setItem(BLUE_TOKEN_SS, d.blueToken);
        }
        if (d?.redToken) {
          setRedToken(d.redToken);
          sessionStorage.setItem(RED_TOKEN_SS, d.redToken);
        }
        if (d?.key && !spectatorKey) {
          setSpectatorKey(d.key);
          sessionStorage.setItem(SPECTATOR_KEY_SS, d.key);
        }
      } catch {}
    })();
  }, [blueToken, redToken, spectatorKey]);

  // Owner auto-create
  useEffect(() => {
    if (!user) return;
    if (spectatorKey) return;
    if (keyFromUrl) return;

    const storedKey = sessionStorage.getItem(SPECTATOR_KEY_SS);
    if (storedKey) {
      setSpectatorKey(storedKey);
      return;
    }
    if (sessionStorage.getItem(CREATE_LOCK_KEY)) return;

    sessionStorage.setItem(CREATE_LOCK_KEY, "1");
    (async () => {
      try {
        await generateSpectatorSession();
      } finally {
        sessionStorage.removeItem(CREATE_LOCK_KEY);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, spectatorKey, keyFromUrl]);

  // If user logs out mid-session, clear local key
  useEffect(() => {
    if (!user && spectatorKey) {
      sessionStorage.removeItem(SPECTATOR_KEY_SS);
      setSpectatorKey(null);
    }
  }, [user]); // eslint-disable-line

  /* Derived bans */
  const bannedCodes = draftPicks
    .map((pick, i) =>
      draftSequence[i] === "BB" || draftSequence[i] === "RR"
        ? pick?.character.code
        : null
    )
    .filter((c): c is string => !!c);

  const effectiveBanned = new Set([
    ...bannedCodes.filter((c) => !featuredGlobalPick.has(c)),
    ...Array.from(featuredGlobalBan).filter((c) => !featuredGlobalPick.has(c)),
  ]);

  const lastPayloadRef = useRef<string>("");

  const [saveSeq, setSaveSeq] = useState(0);
  const saveTimerRef = useRef<number | null>(null);
  function requestSave(delayMs = 0) {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (delayMs > 0) {
      saveTimerRef.current = window.setTimeout(() => {
        setSaveSeq((s) => s + 1);
        saveTimerRef.current = null;
      }, delayMs) as unknown as number;
    } else {
      setSaveSeq((s) => s + 1);
    }
  }

  /* SSE subscription (owner + players) */
  const esRef = useRef<EventSource | null>(null);
  const ignoreSseUntilRef = useRef<number>(0);
  const expectedTurnRef = useRef<number | null>(null);
  const expectedModeRef = useRef<"ge" | "le" | "eq" | null>(null);
  const bumpIgnoreSse = (
    expectedTurn?: number,
    mode: "ge" | "le" | "eq" = "ge"
  ) => {
    ignoreSseUntilRef.current = Date.now() + 1200;
    expectedTurnRef.current = expectedTurn ?? null;
    expectedModeRef.current = expectedTurn != null ? mode : null;
  };
  function ownerOptimisticSave(
    delayMs = 0,
    expectedTurn?: number,
    mode: "ge" | "le" | "eq" = "ge"
  ) {
    bumpIgnoreSse(expectedTurn, mode);
    requestSave(delayMs);
  }

  const mapServerStateToLocal = (state: SpectatorState) => {
    const mapped: (DraftPick | null)[] = state.picks.map((p) => {
      if (!p) return null;
      const character = characters.find((c) => c.code === p.characterCode);
      if (!character) return null;
      const lightcone =
        p.lightconeId != null
          ? lightcones.find((w) => String(w.id) === String(p.lightconeId))
          : undefined;
      return {
        character,
        eidolon: p.eidolon,
        lightcone,
        phase: (p as any).superimpose ?? 1,
      };
    });
    return {
      picks: mapped,
      currentTurn: Math.max(
        0,
        Math.min(state.draftSequence.length, state.currentTurn)
      ),
      blueScores: Array.isArray(state.blueScores)
        ? state.blueScores
        : blueScores,
      redScores: Array.isArray(state.redScores) ? state.redScores : redScores,
      blueLocked: !!state.blueLocked,
      redLocked: !!state.redLocked,
      draftSequence: state.draftSequence,
      paused: state.paused ?? paused,
    };
  };

  

  /* ───────────── Timers (reserve + per-move grace) ───────────── */
  const MOVE_GRACE = 30; // seconds before reserve burns

  const has = (o: any, k: string) =>
    o && Object.prototype.hasOwnProperty.call(o, k);

  const seedTimerEnabled = has(navState, "timerEnabled")
    ? !!(navState as any).timerEnabled
    : has(stored, "timerEnabled")
    ? !!(stored as any).timerEnabled
    : false;

  const seedReserveSeconds = has(navState, "reserveSeconds")
    ? Math.max(0, Number((navState as any).reserveSeconds) || 0)
    : has(stored, "reserveSeconds")
    ? Math.max(0, Number((stored as any).reserveSeconds) || 0)
    : 0;

  const [timerEnabled, setTimerEnabled] = useState<boolean>(seedTimerEnabled);
  const [reserveLeft, setReserveLeft] = useState<{ B: number; R: number }>({
    B: seedReserveSeconds,
    R: seedReserveSeconds,
  });

  // per-pick grace (ticks down first on the active side)
  const [graceLeft, setGraceLeft] = useState<number>(MOVE_GRACE);

  // pause flags (owner can toggle by clicking timer)
  const [paused, setPaused] = useState<{ B: boolean; R: boolean }>({
    B: false,
    R: false,
  });

  // Persist per-session so a reload doesn’t kill the clocks
  const timersPersistKey = useMemo(
    () => (spectatorKey ? `hsrDraftTimers:${spectatorKey}` : null),
    [spectatorKey]
  );

  // Display-only clock baseline from the last server sync (or local action)
  const [clockSyncedAt, setClockSyncedAt] = useState<number | null>(null);

  // A lightweight tick just to refresh the UI (doesn't mutate clocks)
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    let id: number | null = null;
    const tick = () => {
      setNowMs(Date.now());
      id = window.setTimeout(tick, 200) as unknown as number; // ~5 fps is plenty
    };
    id = window.setTimeout(tick, 200) as unknown as number;
    return () => {
      if (id) window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    if (!timersPersistKey) return;
    try {
      const raw = sessionStorage.getItem(timersPersistKey);
      if (!raw) return;
      const j = JSON.parse(raw);
      if (
        typeof j?.reserveLeft?.B === "number" &&
        typeof j?.reserveLeft?.R === "number" &&
        typeof j?.graceLeft === "number"
      ) {
        setReserveLeft({
          B: Math.max(0, j.reserveLeft.B),
          R: Math.max(0, j.reserveLeft.R),
        });
        setGraceLeft(Math.max(0, j.graceLeft));
        if (typeof j?.timerEnabled === "boolean")
          setTimerEnabled(j.timerEnabled);
        if (
          j?.paused &&
          typeof j.paused.B === "boolean" &&
          typeof j.paused.R === "boolean"
        ) {
          setPaused({ B: j.paused.B, R: j.paused.R });
        }
      }
    } catch {}
  }, [timersPersistKey]);

  useEffect(() => {
    if (!timersPersistKey) return;
    try {
      sessionStorage.setItem(
        timersPersistKey,
        JSON.stringify({ reserveLeft, graceLeft, timerEnabled, paused })
      );
    } catch {}
  }, [reserveLeft, graceLeft, timerEnabled, paused, timersPersistKey]);

  // Helpers
  const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
  const fmtClock = (s: number) => {
    const ss = Math.max(0, Math.floor(s));
    const m = Math.floor(ss / 60);
    const r = ss % 60;
    return `${m}:${pad2(r)}`;
  };

  // GRACE-first model with repeating +30s cycles once both timers hit 0
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

    if (e <= g) return { grace: g - e, reserve: r, cycles }; // still burning the initial grace

    e -= g; // grace spent
    g = 0;
    if (e <= r) return { grace: 0, reserve: r - e, cycles }; // now burning reserve

    // both initial grace and reserve are gone; we're into 30s penalty cycles
    e -= r;
    r = 0;
    cycles = 1 + Math.floor(e / cycleLen); // +1 for the first “both=0” event
    const within = e % cycleLen; // time into current 30s window
    g = cycleLen - within; // new grace window is ticking
    return { grace: g, reserve: r, cycles };
  }

  function materializeActiveBurn(now = Date.now()) {
    if (!timerEnabled || draftComplete || clockSyncedAt == null) return false;
    const side = activeSideRef.current;
    if (!side || pausedRef.current[side] || isFirstTurnBan) return false;

    const elapsed = Math.max(0, (now - clockSyncedAt) / 1000);
    const res = computeGraceReserveCycles(
      graceRef.current,
      reserveRef.current[side],
      elapsed,
      MOVE_GRACE
    );

    setGraceLeft(res.grace);
    setReserveLeft((prev) => ({ ...prev, [side]: res.reserve }));
    setClockSyncedAt(now);
    return true;
  }

  const activeSide: "B" | "R" | null = useMemo(() => {
    if (draftComplete) return null;
    const tok = draftSequence[currentTurn];
    if (!tok) return null;
    return tok.startsWith("B") ? "B" : "R";
  }, [draftComplete, draftSequence, currentTurn]);

  function isFirstBanForSide(idx: number, seq: string[]) {
    const tok = seq[idx];
    if (tok !== "BB" && tok !== "RR") return false;

    for (let i = 0; i < idx; i++) {
      if (seq[i] === tok) return false;
    }
    return true;
  }

  const isFirstTurnBan = useMemo(
    () => isFirstBanForSide(currentTurn, draftSequence),
    [currentTurn, draftSequence]
  );

  const togglePause = (side: "B" | "R") => {
    if (!isOwner) return;
    materializeActiveBurn();
    setPaused((prev) => {
      const next = { ...prev, [side]: !prev[side] };
      ownerOptimisticSave(0, currentTurn, "eq");
      setClockSyncedAt(Date.now());
      return next;
    });
  };

  const graceRef = useRef(graceLeft);
  useEffect(() => {
    graceRef.current = graceLeft;
  }, [graceLeft]);

  const reserveRef = useRef(reserveLeft);
  useEffect(() => {
    reserveRef.current = reserveLeft;
  }, [reserveLeft]);

  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const activeSideRef = useRef<"B" | "R" | null>(null);
  useEffect(() => {
    activeSideRef.current = activeSide;
  }, [activeSide]);

  const resetGraceNow = () => {
    // update ref first so the rAF loop sees it immediately
    graceRef.current = MOVE_GRACE;
    setGraceLeft(MOVE_GRACE);
    setClockSyncedAt(Date.now());
  };

  type DisplayClocks = {
    reserve: { B: number; R: number };
    grace: number;
    cycles: { B: number; R: number }; // NEW: how many +30 penalties so far this turn
  };

  const displayClocks: DisplayClocks = useMemo(() => {
    let g = Math.max(0, Number(graceLeft) || 0);
    let rB = Math.max(0, Number(reserveLeft.B) || 0);
    let rR = Math.max(0, Number(reserveLeft.R) || 0);
    let cB = 0,
      cR = 0;

    if (
      timerEnabled &&
      hydrated &&
      !draftComplete &&
      clockSyncedAt != null &&
      activeSide &&
      !paused[activeSide]
    ) {
      const elapsed = Math.max(0, (nowMs - clockSyncedAt) / 1000);

      if (!isFirstTurnBan) {
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
    }
    return { reserve: { B: rB, R: rR }, grace: g, cycles: { B: cB, R: cR } };
  }, [
    timerEnabled,
    hydrated,
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

  // NEW: global total penalties for the whole draft
  const [timerPenCount, setTimerPenCount] = useState<{ B: number; R: number }>({
    B: 0,
    R: 0,
  });

  // Tracks how many penalties we already counted in the *current* turn per team
  const creditedThisTurnRef = useRef<{ B: number; R: number }>({ B: 0, R: 0 });

  // Reset per-turn credited *only* when the turn index changes
  useEffect(() => {
    creditedThisTurnRef.current = { B: 0, R: 0 };
  }, [currentTurn]);

  // When cycles grow for the active side, add the delta to the global total
  useEffect(() => {
    if (
      !timerEnabled ||
      draftComplete ||
      !activeSide ||
      isFirstTurnBan ||
      paused[activeSide]
    )
      return;
    const side = activeSide;
    const nowCycles = displayClocks.cycles[side];
    const credited = creditedThisTurnRef.current[side] || 0;
    if (nowCycles > credited) {
      setTimerPenCount((prev) => ({
        ...prev,
        [side]: prev[side] + (nowCycles - credited),
      }));
      creditedThisTurnRef.current[side] = nowCycles;
    }
  }, [
    timerEnabled,
    draftComplete,
    activeSide,
    isFirstTurnBan,
    paused.B,
    paused.R,
    displayClocks.cycles.B,
    displayClocks.cycles.R,
  ]);

  useEffect(() => {
    if (timerEnabled && clockSyncedAt == null) setClockSyncedAt(Date.now());
  }, [timerEnabled, clockSyncedAt]);

  useEffect(() => {
    if (!timerEnabled) return;
    if (isFirstTurnBan) return; // don't start grace on the very first ban slot
    setGraceLeft(MOVE_GRACE); // always reset to 30s, no carry from previous pick
  }, [currentTurn, timerEnabled, isFirstTurnBan]);

  useEffect(() => {
    if (!spectatorKey) return;

    esRef.current?.close();
    const url = `${
      import.meta.env.VITE_API_BASE
    }/api/hsr/sessions/${spectatorKey}/stream`;
    const es = new EventSource(url);

    const handleSnapshotOrUpdate = (payload: any) => {
      if (payload?.createdAt || payload?.created_at) {
        const ts = new Date(payload.createdAt || payload.created_at).getTime();
        if (!Number.isNaN(ts)) setCreatedAtMs(ts);
      }
      if (typeof payload?.is_complete === "boolean") {
        setFinishedFromServer(!!payload.is_complete);
      } else if (payload?.completed_at) {
        setFinishedFromServer(true);
      }

      if (payload?.mode) setMode(coerceMode(payload.mode));

      if (typeof payload?.team1 === "string") setTeam1Name(payload.team1);
      if (typeof payload?.team2 === "string") setTeam2Name(payload.team2);

      if (Object.prototype.hasOwnProperty.call(payload, "costProfileId")) {
        setCostProfileId(payload.costProfileId ?? null);
      }
      if (typeof payload?.penaltyPerPoint === "number") {
        const incoming = Math.max(1, Math.floor(payload.penaltyPerPoint));
        const current = cycleBreakpointRef.current;
        const pending = pendingCycleBpRef.current;
        const stillPending = Date.now() < pendingBpExpiresAtRef.current;
        const recentLocalEdit =
          Date.now() - lastLocalSettingsAtRef.current < 5000;

        if (pending != null) {
          if (incoming === pending) {
            pendingCycleBpRef.current = null; // ACK
            if (incoming !== current) setCycleBreakpoint(incoming);
          } else if (stillPending) {
            // ignore older echo while pending
          } else {
            pendingCycleBpRef.current = null; // timed out; accept server
            if (incoming !== current) setCycleBreakpoint(incoming);
          }
        } else if (recentLocalEdit && incoming !== current) {
          // likely stale; ignore
        } else if (incoming !== current) {
          setCycleBreakpoint(incoming);
        }
      }

      // ── Timer + penalties from server/session ────────────────────────────────────
      const st = payload?.state || {};

      // include-cycle-penalty toggles
      if (typeof st.applyCyclePenaltyB === "boolean")
        setApplyCyclePenaltyB(st.applyCyclePenaltyB);
      if (typeof st.applyCyclePenaltyR === "boolean")
        setApplyCyclePenaltyR(st.applyCyclePenaltyR);

      if (Number.isFinite(Number(st.timerPenaltyCountB))) {
        setTimerPenCount((p) => ({
          ...p,
          B: Math.max(0, Number(st.timerPenaltyCountB)),
        }));
      }
      if (Number.isFinite(Number(st.timerPenaltyCountR))) {
        setTimerPenCount((p) => ({
          ...p,
          R: Math.max(0, Number(st.timerPenaltyCountR)),
        }));
      }
      if (typeof st.applyTimerPenaltyB === "boolean")
        setApplyTimerPenaltyB(st.applyTimerPenaltyB);
      if (typeof st.applyTimerPenaltyR === "boolean")
        setApplyTimerPenaltyR(st.applyTimerPenaltyR);

      // timerEnabled (support both camel/snake, state > top-level)
      const timerFrom =
        typeof st.timerEnabled === "boolean"
          ? st.timerEnabled
          : typeof st.timer_enabled === "boolean"
          ? st.timer_enabled
          : typeof payload?.timerEnabled === "boolean"
          ? payload.timerEnabled
          : typeof payload?.timer_enabled === "boolean"
          ? payload.timer_enabled
          : undefined;
      if (typeof timerFrom === "boolean") setTimerEnabled(timerFrom);

      // paused flags
      if (
        st.paused &&
        typeof st.paused.B === "boolean" &&
        typeof st.paused.R === "boolean"
      ) {
        setPaused({ B: !!st.paused.B, R: !!st.paused.R });
      }

      // Prefer precise timer fields (reserveLeft/graceLeft/timerUpdatedAt); fallback to legacy reserveSeconds
      const incomingReserve =
        st.reserveLeft &&
        typeof st.reserveLeft.B === "number" &&
        typeof st.reserveLeft.R === "number"
          ? {
              B: Math.max(0, Number(st.reserveLeft.B)),
              R: Math.max(0, Number(st.reserveLeft.R)),
            }
          : Number.isFinite(Number(st.reserveSeconds)) ||
            Number.isFinite(Number(st.reserve_seconds))
          ? (() => {
              const seed = Number.isFinite(Number(st.reserveSeconds))
                ? Number(st.reserveSeconds)
                : Number(st.reserve_seconds);
              const v = Math.max(0, Number(seed) || 0);
              return { B: v, R: v };
            })()
          : null;

      const incomingGrace = Number.isFinite(Number(st.graceLeft))
        ? Math.max(0, Number(st.graceLeft))
        : null;

      const ts = Number.isFinite(Number(st.timerUpdatedAt))
        ? Number(st.timerUpdatedAt)
        : null;

      // Apply + catch up locally using server timestamp so spectator/owner stay in sync
      if (incomingReserve) {
        let nextReserve = incomingReserve;
        let nextGrace =
          typeof incomingGrace === "number" ? incomingGrace : graceLeft;

        if (ts && timerFrom) {
          const elapsed = Math.max(0, (Date.now() - ts) / 1000);

          // Determine active side from server's view (prefer st fields)
          const srvSeq =
            Array.isArray(st.draftSequence) && st.draftSequence.length
              ? st.draftSequence
              : draftSequence;
          const srvTurn = Number.isFinite(Number(st.currentTurn))
            ? Number(st.currentTurn)
            : currentTurn;
          const activeSide = srvSeq[srvTurn]?.startsWith("B")
            ? "B"
            : srvSeq[srvTurn]?.startsWith("R")
            ? "R"
            : null;
          const firstBanFreeze = isFirstBanForSide(srvTurn, srvSeq);

          if (activeSide && !st.paused?.[activeSide] && !firstBanFreeze) {
            // burn grace/reserve using elapsed
            const burnFromGrace = Math.min(nextGrace, elapsed);
            nextGrace = Math.max(0, nextGrace - burnFromGrace);
            const over = Math.max(0, elapsed - burnFromGrace);
            if (over > 0) {
              nextReserve = {
                ...nextReserve,
                [activeSide]: Math.max(0, nextReserve[activeSide] - over),
              };
            }
          }
        }

        setReserveLeft(nextReserve);
        if (incomingGrace != null) setGraceLeft(nextGrace);
      }
      setClockSyncedAt(Date.now());
      creditedThisTurnRef.current = { B: 0, R: 0 };

      // ── Extra per-team manual cycle penalties ───────────────────────────────────
      if (Number.isFinite(Number(st.extraCyclePenaltyB))) {
        setExtraCyclePenaltyB(
          round2(Math.max(0, Number(st.extraCyclePenaltyB)))
        );
      }
      if (Number.isFinite(Number(st.extraCyclePenaltyR))) {
        setExtraCyclePenaltyR(
          round2(Math.max(0, Number(st.extraCyclePenaltyR)))
        );
      }

      if (
        payload?.costProfile &&
        (payload.costProfile.charMs || payload.costProfile.lcPhase)
      ) {
        const cp = payload.costProfile;
        setCostProfileName(cp.name || "Preset");
        setCostCharMs(cp.charMs || {});
        setCostLcPhase(cp.lcPhase || {});
      }

      if (Array.isArray(payload?.featured)) {
        setFeaturedList(normalizeFeatured(payload.featured));
      }

      const rsFrom: number | undefined = incomingReserve
        ? Math.floor(Math.min(incomingReserve.B, incomingReserve.R))
        : undefined;

      try {
        sessionStorage.setItem(
          DRAFT_INIT_SS,
          JSON.stringify({
            team1: payload.team1,
            team2: payload.team2,
            mode: payload.mode,
            featured: Array.isArray(payload?.featured)
              ? payload.featured
              : featuredList,
            costProfileId: Object.prototype.hasOwnProperty.call(
              payload,
              "costProfileId"
            )
              ? payload.costProfileId
              : costProfileId,
            penaltyPerPoint:
              typeof payload?.penaltyPerPoint === "number"
                ? Math.max(1, Math.floor(payload.penaltyPerPoint))
                : cycleBreakpoint,

            // ✅ normalized & re-used
            timerEnabled:
              typeof timerFrom === "boolean" ? timerFrom : seedTimerEnabled,
            reserveSeconds:
              typeof rsFrom === "number" ? rsFrom : seedReserveSeconds,
          })
        );
      } catch {}

      const serverState: SpectatorState | undefined = payload?.state;
      if (!serverState) return;

      // NEW: make sure everyone resets grace when server turn changes
      forceResetGraceOnTurnChange(serverState);

      if (Date.now() < ignoreSseUntilRef.current) {
        const exp = expectedTurnRef.current;
        const mode = expectedModeRef.current;
        if (typeof exp === "number" && mode) {
          const srv = serverState.currentTurn;
          const drop =
            (mode === "ge" && srv < exp) ||
            (mode === "le" && srv > exp) ||
            (mode === "eq" && srv !== exp);
          if (drop) return;
          expectedTurnRef.current = null;
          expectedModeRef.current = null;
        } else {
          if (serverState.currentTurn === currentTurn) return;
        }
      }

      // if catalogs aren’t ready yet, queue the state
      if (characters.length === 0 || lightcones.length === 0) {
        pendingServerStateRef.current = serverState;
        return;
      }

      const mapped = mapServerStateToLocal(serverState);
      if (mapped.currentTurn !== currentTurn) {
        resetGraceNow();
      }
      setDraftPicks(mapped.picks);
      setCurrentTurn(mapped.currentTurn);
      setBlueScores(mapped.blueScores);
      setRedScores(mapped.redScores);
      setBlueLocked(mapped.blueLocked);
      setRedLocked(mapped.redLocked);
      if (Array.isArray(mapped.draftSequence) && mapped.draftSequence.length) {
        setDraftSequence(mapped.draftSequence);
      }
      if (
        mapped.paused &&
        typeof mapped.paused.B === "boolean" &&
        typeof mapped.paused.R === "boolean"
      ) {
        setPaused(mapped.paused);
      }
      setHydrated(true);

      clearBusyIfAcked(mapped.currentTurn);

      // late-load featured (in case SSE joined midstream)
      if (
        !Array.isArray(payload?.featured) &&
        featuredList.length === 0 &&
        spectatorKey
      ) {
        fetch(
          `${import.meta.env.VITE_API_BASE}/api/hsr/sessions/${spectatorKey}`
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d && Array.isArray(d.featured))
              setFeaturedList(normalizeFeatured(d.featured));
          })
          .catch(() => {});
      }
    };

    es.addEventListener("snapshot", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        handleSnapshotOrUpdate(data);
      } catch {}
    });
    es.addEventListener("update", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        handleSnapshotOrUpdate(data);
      } catch {}
    });
    es.addEventListener("not_found", () => {
      console.warn("Session not found");
      es.close();
    });
    es.onerror = () => {
      // let browser’s EventSource auto-reconnect
    };

    esRef.current = es;
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spectatorKey, characters, lightcones, currentTurn]);

  /* ───────────── Fallback initial GET (race with SSE) ───────────── */
  useEffect(() => {
    if (!spectatorKey) return;
    if (hydrated && featuredList.length > 0) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/api/hsr/sessions/${spectatorKey}`,
          {
            signal: ctrl.signal,
          }
        );
        if (!res.ok) {
          const local = tryReadLocalSnapshot(spectatorKey);
          if (local) pendingServerStateRef.current = local;
          return;
        }
        const data = await res.json();

        if (data?.mode) setMode(coerceMode(data.mode));

        if (typeof data?.team1 === "string") setTeam1Name(data.team1);
        if (typeof data?.team2 === "string") setTeam2Name(data.team2);

        if (
          typeof data?.costProfileId === "string" ||
          data?.costProfileId === null
        ) {
          setCostProfileId(data.costProfileId);
        }
        if (typeof data?.penaltyPerPoint === "number") {
          const incoming = Math.max(1, Math.floor(data.penaltyPerPoint));
          const current = cycleBreakpointRef.current;
          const pending = pendingCycleBpRef.current;
          const stillPending = Date.now() < pendingBpExpiresAtRef.current;

          if (pending != null && stillPending && incoming !== pending) {
            // ignore snapshot while a local save is pending
          } else if (incoming !== current) {
            setCycleBreakpoint(incoming);
          }
        }

        // ── Timer + penalties from server/session (GET fallback) ─────────────────────
        const st = data?.state || {};

        // include-cycle-penalty toggles
        if (typeof st.applyCyclePenaltyB === "boolean")
          setApplyCyclePenaltyB(st.applyCyclePenaltyB);
        if (typeof st.applyCyclePenaltyR === "boolean")
          setApplyCyclePenaltyR(st.applyCyclePenaltyR);

        if (Number.isFinite(Number(st.timerPenaltyCountB))) {
          setTimerPenCount((p) => ({
            ...p,
            B: Math.max(0, Number(st.timerPenaltyCountB)),
          }));
        }
        if (Number.isFinite(Number(st.timerPenaltyCountR))) {
          setTimerPenCount((p) => ({
            ...p,
            R: Math.max(0, Number(st.timerPenaltyCountR)),
          }));
        }
        if (typeof st.applyTimerPenaltyB === "boolean")
          setApplyTimerPenaltyB(st.applyTimerPenaltyB);
        if (typeof st.applyTimerPenaltyR === "boolean")
          setApplyTimerPenaltyR(st.applyTimerPenaltyR);

        if (data?.state) {
          forceResetGraceOnTurnChange(data.state);
        }

        // timerEnabled
        const timerFrom =
          typeof st.timerEnabled === "boolean"
            ? st.timerEnabled
            : typeof st.timer_enabled === "boolean"
            ? st.timer_enabled
            : typeof data?.timerEnabled === "boolean"
            ? data.timerEnabled
            : typeof data?.timer_enabled === "boolean"
            ? data.timer_enabled
            : undefined;
        if (typeof timerFrom === "boolean") setTimerEnabled(timerFrom);

        // paused flags
        if (
          st.paused &&
          typeof st.paused.B === "boolean" &&
          typeof st.paused.R === "boolean"
        ) {
          setPaused({ B: !!st.paused.B, R: !!st.paused.R });
        }

        // Prefer precise timer fields; fallback to legacy reserveSeconds
        const incomingReserve =
          st.reserveLeft &&
          typeof st.reserveLeft.B === "number" &&
          typeof st.reserveLeft.R === "number"
            ? {
                B: Math.max(0, Number(st.reserveLeft.B)),
                R: Math.max(0, Number(st.reserveLeft.R)),
              }
            : Number.isFinite(Number(st.reserveSeconds)) ||
              Number.isFinite(Number(st.reserve_seconds))
            ? (() => {
                const seed = Number.isFinite(Number(st.reserveSeconds))
                  ? Number(st.reserveSeconds)
                  : Number(st.reserve_seconds);
                const v = Math.max(0, Number(seed) || 0);
                return { B: v, R: v };
              })()
            : null;

        const incomingGrace = Number.isFinite(Number(st.graceLeft))
          ? Math.max(0, Number(st.graceLeft))
          : null;

        const ts = Number.isFinite(Number(st.timerUpdatedAt))
          ? Number(st.timerUpdatedAt)
          : null;

        if (incomingReserve) {
          let nextReserve = incomingReserve;
          let nextGrace =
            typeof incomingGrace === "number" ? incomingGrace : graceLeft;

          if (ts && timerFrom) {
            const elapsed = Math.max(0, (Date.now() - ts) / 1000);

            const srvSeq =
              Array.isArray(st.draftSequence) && st.draftSequence.length
                ? st.draftSequence
                : draftSequence;
            const srvTurn = Number.isFinite(Number(st.currentTurn))
              ? Number(st.currentTurn)
              : currentTurn;
            const activeSide = srvSeq[srvTurn]?.startsWith("B")
              ? "B"
              : srvSeq[srvTurn]?.startsWith("R")
              ? "R"
              : null;
            const firstBanFreeze = isFirstBanForSide(srvTurn, srvSeq);

            if (activeSide && !st.paused?.[activeSide] && !firstBanFreeze) {
              const burnFromGrace = Math.min(nextGrace, elapsed);
              nextGrace = Math.max(0, nextGrace - burnFromGrace);
              const over = Math.max(0, elapsed - burnFromGrace);
              if (over > 0) {
                nextReserve = {
                  ...nextReserve,
                  [activeSide]: Math.max(0, nextReserve[activeSide] - over),
                };
              }
            }
          }

          setReserveLeft(nextReserve);
          if (incomingGrace != null) setGraceLeft(nextGrace);
        }
        setClockSyncedAt(Date.now());
        creditedThisTurnRef.current = { B: 0, R: 0 };

        if (Number.isFinite(Number(st.extraCyclePenaltyB))) {
          setExtraCyclePenaltyB(
            round2(Math.max(0, Number(st.extraCyclePenaltyB)))
          );
        }
        if (Number.isFinite(Number(st.extraCyclePenaltyR))) {
          setExtraCyclePenaltyR(
            round2(Math.max(0, Number(st.extraCyclePenaltyR)))
          );
        }

        if (
          data?.costProfile &&
          (data.costProfile.charMs || data.costProfile.lcPhase)
        ) {
          const cp = data.costProfile;
          setCostProfileName(cp.name || "Preset");
          setCostCharMs(cp.charMs || {});
          setCostLcPhase(cp.lcPhase || {});
        }

        if (Array.isArray(data?.featured))
          setFeaturedList(normalizeFeatured(data.featured));

        if (
          Array.isArray(data?.state?.draftSequence) &&
          data.state.draftSequence.length
        ) {
          setDraftSequence(data.state.draftSequence);
        }

        if (data?.createdAt || data?.created_at) {
          const ts = new Date(data.createdAt || data.created_at).getTime();
          if (!Number.isNaN(ts)) setCreatedAtMs(ts);
        }
        if (typeof data?.isComplete === "boolean") {
          setFinishedFromServer(data.isComplete);
        } else if (data?.completedAt || data?.completed_at) {
          setFinishedFromServer(true);
        }

        try {
          sessionStorage.setItem(
            DRAFT_INIT_SS,
            JSON.stringify({
              team1: data.team1,
              team2: data.team2,
              mode: data.mode,
              featured: Array.isArray(data?.featured)
                ? data.featured
                : featuredList,
              costProfileId: data?.costProfileId ?? costProfileId,
              penaltyPerPoint:
                typeof data?.penaltyPerPoint === "number"
                  ? Math.max(1, Math.floor(data.penaltyPerPoint))
                  : cycleBreakpoint,

              // normalized timer fields
              timerEnabled:
                typeof st.timerEnabled === "boolean"
                  ? st.timerEnabled
                  : typeof st.timer_enabled === "boolean"
                  ? st.timer_enabled
                  : typeof data?.timerEnabled === "boolean"
                  ? data.timerEnabled
                  : typeof data?.timer_enabled === "boolean"
                  ? data.timer_enabled
                  : seedTimerEnabled,

              reserveSeconds: Number.isFinite(Number(st.reserveSeconds))
                ? Number(st.reserveSeconds)
                : Number.isFinite(Number(st.reserve_seconds))
                ? Number(st.reserve_seconds)
                : Number.isFinite(Number(data?.reserveSeconds))
                ? Number(data.reserveSeconds)
                : Number.isFinite(Number(data?.reserve_seconds))
                ? Number(data.reserve_seconds)
                : seedReserveSeconds,
            })
          );
        } catch {}
        if (data?.state) {
          pendingServerStateRef.current = data.state as SpectatorState;

          // If server already progressed to/over our expected turn, drop busy now
          const srvTurn = Math.max(
            0,
            Math.min(
              data.state.draftSequence?.length ?? draftSequence.length,
              Number(data.state.currentTurn ?? 0)
            )
          );
          clearBusyIfAcked(srvTurn);
        }
      } catch {}
    })();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    spectatorKey,
    hydrated,
    featuredList.length,
    costProfileId,
    cycleBreakpoint,
  ]);

  /* ───────────── Autosave (OWNER ONLY) ───────────── */
  useEffect(() => {
    if (!user || !spectatorKey || isPlayerClient) return;
    if (!hydrated) return;

    const payload = JSON.stringify({
      featured: featuredList,
      costProfileId,
      mode,
      state: collectSpectatorState(),
      isComplete: isComplete || undefined,
      penaltyPerPoint: cycleBreakpoint,
      timerEnabled,
      reserveSeconds: Math.floor(
        Math.max(0, Math.min(reserveLeft.B, reserveLeft.R))
      ),
    });

    if (payload === lastPayloadRef.current) return;
    lastPayloadRef.current = payload;

    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/api/hsr/sessions/${spectatorKey}`,
          {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: payload,
            signal: ctrl.signal,
          }
        );
        if (res.ok) writeLocalSnapshot(spectatorKey, collectSpectatorState());
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          sessionStorage.removeItem(SPECTATOR_KEY_SS);
          setSpectatorKey(null);
        }
      } catch (e) {
        console.warn("spectator PUT failed", e);
      }
    })();

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSeq]);

  /* Row refs + scales */
  const blueRowRef = useRef<HTMLDivElement>(null);
  const redRowRef = useRef<HTMLDivElement>(null);
  const blueCount = draftSequence.filter((s) => s.startsWith("B")).length;
  const redCount = draftSequence.filter((s) => s.startsWith("R")).length;
  const blueScale = useRowScale(blueRowRef, blueCount);
  const redScale = useRowScale(redRowRef, redCount);

  /* ───────────── Slot Cost (preset + featured overrides; fallback rules) ───────────── */
  function getSlotCost(pick: DraftPick | null | undefined) {
    if (!pick) return { charCost: 0, lcCost: 0, total: 0 };

    // Character cost
    let charCost: number;
    const cpRow = costCharMs[pick.character.code]; // [E0..E6]
    const featuredBase = featuredCharCostOverride.get(pick.character.code);

    if (Array.isArray(cpRow) && cpRow.length === 7) {
      const baseAtE0 =
        typeof featuredBase === "number"
          ? featuredBase
          : Number((cpRow[0] || 0).toFixed(2));
      const atEx = Number(
        (cpRow[Math.max(0, Math.min(6, pick.eidolon))] || 0).toFixed(2)
      );
      const delta = Number((atEx - (cpRow[0] || 0)).toFixed(2));
      charCost = Number((baseAtE0 + delta).toFixed(2));
    } else {
      const normalAtE0 = calcCharCostHSR(pick.character, 0);
      const normalAtEx = calcCharCostHSR(pick.character, pick.eidolon);
      const eDelta = Number((normalAtEx - normalAtE0).toFixed(2));
      const base = typeof featuredBase === "number" ? featuredBase : normalAtE0;
      charCost = Number((base + eDelta).toFixed(2));
    }

    // Light Cone cost
    let lcCost = 0;
    if (pick.lightcone) {
      const row = costLcPhase[String(pick.lightcone.id)];
      const lcBaseOverride = featuredLcCostOverride.get(
        String(pick.lightcone.id)
      ); // treated as P1 base if using fallback rule
      if (row && row.length === 5) {
        lcCost = Number(
          (row[Math.max(1, Math.min(5, pick.phase)) - 1] || 0).toFixed(2)
        );
      } else {
        const normalAtP1 = calcLcCostHSR(pick.lightcone, 1);
        const normalAtPx = calcLcCostHSR(pick.lightcone, pick.phase);
        const pDelta = Number((normalAtPx - normalAtP1).toFixed(2));
        const base =
          typeof lcBaseOverride === "number" ? lcBaseOverride : normalAtP1;
        lcCost = Number((base + pDelta).toFixed(2));
      }
    }

    const total = Number((charCost + lcCost).toFixed(2));
    return { charCost, lcCost, total };
  }

  /* ───────────── Catalog fetch ───────────── */
  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.VITE_API_BASE}/api/characters?cycle=0`, {
        credentials: "include",
      }),
      fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/cone-balance`, {
        credentials: "include",
      }),
    ])
      .then(async ([cRes, lcRes]) => {
        const cJson = await cRes.json();
        const lcJson = await lcRes.json();
        if (!cRes.ok || !lcRes.ok)
          throw new Error("Failed to fetch HSR catalogs");

        const chars: Character[] = (cJson?.data || []).map((c: any) => ({
          code: c.code,
          name: c.name,
          subname: c.subname,
          image_url: c.image_url,
          rarity: Number(c.rarity) || 5,
          limited: !!c.limited,
        }));
        const lcs: LightCone[] = (lcJson?.cones || []).map((w: any) => ({
          id: String(w.id),
          name: w.name,
          subname: w.subname,
          rarity: Number(w.rarity) || 5,
          limited: !!w.limited,
          image_url: w.imageUrl,
        }));

        setCharacters(chars);
        setLightcones(lcs);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load data");
      });
  }, []);

  // Apply pending server state once catalogs are available
  useEffect(() => {
    if (hydrated) return;
    const pending = pendingServerStateRef.current;
    if (!pending) return;
    if (characters.length === 0 || lightcones.length === 0) return;

    const mappedPicks: (DraftPick | null)[] = pending.picks.map((p) => {
      if (!p) return null;
      const character = characters.find((c) => c.code === p.characterCode);
      if (!character) return null;
      const lightcone =
        p.lightconeId != null
          ? lightcones.find((w) => String(w.id) === String(p.lightconeId))
          : undefined;
      return {
        character,
        eidolon: p.eidolon,
        lightcone,
        phase: (p as any).superimpose ?? 1, // <-- here too
      };
    });

    setDraftPicks(mappedPicks);
    const appliedTurn = Math.max(
      0,
      Math.min(pending.draftSequence.length, pending.currentTurn)
    );
    setCurrentTurn(appliedTurn);
    clearBusyIfAcked(appliedTurn);

    if (Array.isArray(pending.draftSequence) && pending.draftSequence.length) {
      setDraftSequence(pending.draftSequence);
    }

    if (Array.isArray(pending.blueScores) && pending.blueScores.length)
      setBlueScores(pending.blueScores);
    if (Array.isArray(pending.redScores) && pending.redScores.length)
      setRedScores(pending.redScores);

    setBlueLocked(!!pending.blueLocked);
    setRedLocked(!!pending.redLocked);

    if (
      pending.paused &&
      typeof pending.paused.B === "boolean" &&
      typeof pending.paused.R === "boolean"
    ) {
      setPaused({ B: !!pending.paused.B, R: !!pending.paused.R });
    }

    // ⬇️ NEW: hydrate timer from pending.state for players too
    if (typeof pending.timerEnabled === "boolean") {
      setTimerEnabled(!!pending.timerEnabled);
    }
    if (Number.isFinite(Number(pending.reserveSeconds))) {
      const sv = Math.max(0, Number(pending.reserveSeconds));
      setReserveLeft((prev) => {
        const untouched =
          prev.B === prev.R && (prev.B === 0 || prev.B === seedReserveSeconds);
        return untouched ? { B: sv, R: sv } : prev;
      });
    }

    pendingServerStateRef.current = null;
    setHydrated(true);
  }, [characters, lightcones, hydrated]);
  /* ───────────── Outside click for sliders ───────────── */
  const eidolonRefs = useRef<(HTMLDivElement | null)[]>([]);
  const phaseRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const bootstrapModal = document.querySelector(".modal-content");
      if (bootstrapModal && bootstrapModal.contains(target)) return;

      if (
        phaseOpenIndex !== null &&
        phaseRefs.current[phaseOpenIndex] &&
        !phaseRefs.current[phaseOpenIndex]!.contains(target)
      ) {
        setPhaseOpenIndex(null);
      }
      if (
        eidolonOpenIndex !== null &&
        eidolonRefs.current[eidolonOpenIndex] &&
        !eidolonRefs.current[eidolonOpenIndex]!.contains(target)
      ) {
        setEidolonOpenIndex(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [phaseOpenIndex, eidolonOpenIndex]);

  /* ───────────── Player gating ───────────── */
  const isPlayer = isPlayerClient && (playerSide === "B" || playerSide === "R");
  const isOwner = !!user && !isPlayerClient;
  const isMyTurn = (() => {
    if (!isPlayer) return false;
    const step = draftSequence[currentTurn] || "";
    const side = step.startsWith("B") ? "B" : step.startsWith("R") ? "R" : "";
    return side === playerSide;
  })();

  useEffect(() => {
    if (isOwner && spectatorKey && hydrated) {
      // push new mode + new draftSequence in state
      requestSave(0); // or ownerOptimisticSave(0)
    }
  }, [mode, isOwner, spectatorKey, hydrated]);


  async function postPlayerAction(action: any): Promise<boolean> {
    if (!spectatorKey || !playerToken) return false;
    try {
      const res = await fetch(
        `${
          import.meta.env.VITE_API_BASE
        }/api/hsr/sessions/${spectatorKey}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...action, pt: playerToken }),
          credentials: "include",
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn("player action failed", res.status, err);
        return false;
      }
      return true;
    } catch (e) {
      console.warn("player action network error", e);
      return false;
    }
  }

  useEffect(() => {
    if (!user && !isPlayer && cameFromStart) {
      toast.warning("You are not logged in — this match will NOT be recorded.");
    }
  }, [user, isPlayer, cameFromStart]);

  /* ───────────── Helpers & handlers ───────────── */
  const slotIsBan = (i: number) =>
    draftSequence[i] === "BB" || draftSequence[i] === "RR";
  type Side = "B" | "R";

  const tokenIsAce = (tok?: string) => !!tok && /\(ace\)/i.test(tok);
  const slotIsAce = (i: number) => tokenIsAce(draftSequence[i]);

  const sideOfToken = (tok?: string): Side =>
    tok?.startsWith("B") ? "B" : "R";

  const sideOfIndex = (index: number): Side =>
    draftSequence[index]?.startsWith("B") ? "B" : "R";
  const sideLocked = (side: "B" | "R") =>
    side === "B" ? blueLocked : redLocked;

  const isSignatureLC = (lc: LightCone, char: Character | undefined) => {
    if (!char) return false;
    const lcSub = lc.subname?.toLowerCase() || "";
    const charName = char.name.toLowerCase();
    return lcSub === charName;
  };

  const toggleSideLock = (side: "B" | "R", nextLocked: boolean) => {
    if (isPlayer) {
      if (playerSide !== side) return;
      if (!nextLocked) return; // players can only lock, not unlock
      if (side === "B") setBlueLocked(true);
      else setRedLocked(true);
      bumpIgnoreSse();
      postPlayerAction({ op: "setLock", side, locked: true });
      return;
    }
    if (side === "B") setBlueLocked(nextLocked);
    else setRedLocked(nextLocked);
    requestSave(0);
  };

  const handleCharacterPick = (char: Character) => {
    if (uiLocked || draftComplete) return;

    const currentStep = draftSequence[currentTurn];
    if (!currentStep) return;

    const mySideNow: "B" | "R" = currentStep.startsWith("B") ? "B" : "R";
    const isBanSlot = currentStep === "BB" || currentStep === "RR";

    const isAce = tokenIsAce(currentStep);

    // Cannot ban a global-pick character
    if (isBanSlot && featuredGlobalPick.has(char.code)) return;

    // Common bans
    if (effectiveBanned.has(char.code)) return;

    // Player gating
    if (isPlayer && mySideNow !== playerSide) return;

    const myTeamPicks = draftPicks.filter((_, i) =>
      draftSequence[i].startsWith(mySideNow)
    );
    const oppSide = mySideNow === "B" ? "R" : "B";
    const opponentPicks = draftPicks.filter((_, i) =>
      draftSequence[i].startsWith(oppSide)
    );

    const alreadyPickedByMe = myTeamPicks.some(
      (p) => p?.character.code === char.code
    );
    const alreadyPickedByOpp = opponentPicks.some(
      (p) => p?.character.code === char.code
    );

    if (!isBanSlot) {
      if (featuredGlobalPick.has(char.code)) {
        // Uni-pick: each team can take once
        if (alreadyPickedByMe) return;
      } else {
        // Normal: one copy per team; opponent's copy allowed ONLY on ACE
        if (alreadyPickedByMe) return;
        if (!isAce && alreadyPickedByOpp) return;
      }
    }

    // Apply pick/ban
    const nextPick: DraftPick = { character: char, eidolon: 0, phase: 1 };
    materializeActiveBurn();
    // ───── Player flow ─────
    if (isPlayer) {
      // Use live ref to avoid stale turn during super-fast clicks
      const turn = currentTurnRef.current;
      const currentStepNow = draftSequence[turn];
      if (!currentStepNow) return;

      const mySideNow2: "B" | "R" = currentStepNow.startsWith("B") ? "B" : "R";
      const isBanSlot = currentStepNow === "BB" || currentStepNow === "RR";
      const isAce = tokenIsAce(currentStepNow);

      if (mySideNow2 !== playerSide) return;
      if (actionBusyRef.current) return; // block double-pick while waiting for ack

      // Cannot ban a global-pick; also guard against effective bans
      if (isBanSlot && featuredGlobalPick.has(char.code)) return;
      if (effectiveBanned.has(char.code)) return;

      // Enforce uniqueness rules (same as before)
      const myTeamPicks = draftPicks.filter((_, i) =>
        draftSequence[i].startsWith(mySideNow2)
      );
      const oppSide = mySideNow2 === "B" ? "R" : "B";
      const opponentPicks = draftPicks.filter((_, i) =>
        draftSequence[i].startsWith(oppSide)
      );
      const alreadyPickedByMe = myTeamPicks.some(
        (p) => p?.character.code === char.code
      );
      const alreadyPickedByOpp = opponentPicks.some(
        (p) => p?.character.code === char.code
      );
      if (!isBanSlot) {
        if (featuredGlobalPick.has(char.code)) {
          // Uni-pick: each team can take once
          if (alreadyPickedByMe) return;
        } else {
          // Normal: one copy per team; opponent copy allowed ONLY on ACE
          if (alreadyPickedByMe) return;
          if (!isAce && alreadyPickedByOpp) return;
        }
      }

      // Enter busy & remember the expected server turn
      pendingAckModeRef.current = "ge"; // ✅ picks move the turn forward
      setBusy(true);
      pendingAckTurnRef.current = turn + 1;

      // Optimistic local write using the exact turn we read
      const nextPick: DraftPick = { character: char, eidolon: 0, phase: 1 };
      materializeActiveBurn();
      setDraftPicks((prev) => {
        const updated = [...prev];
        updated[turn] = nextPick;
        return updated;
      });
      setCurrentTurn((t) => t + 1);
      currentTurnRef.current = turn + 1; // keep ref in sync immediately
      resetGraceNow();
      setKeyboardSearch("");

      // Don't ignore the ack we're expecting
      bumpIgnoreSse(turn + 1, "ge");

      // Persist to server with the same index
      postPlayerAction({
        op: isBanSlot ? "ban" : "pick",
        side: playerSide,
        index: turn,
        characterCode: char.code,
      }).then((ok) => {
        if (!ok) {
          // POST failed → let player try again; SSE/GET will resync state anyway
          setBusy(false);
          pendingAckTurnRef.current = null;
        }
      });

      return;
    }

    // Owner
    setDraftPicks((prev) => {
      const updated = [...prev];
      updated[currentTurn] = nextPick;
      return updated;
    });
    setCurrentTurn((prev) => prev + 1);
    resetGraceNow();
    setKeyboardSearch("");
    ownerOptimisticSave(0, currentTurn + 1, "ge");
  };

  const handleUndo = () => {
    // Use the live ref for players to avoid races; normal state for owner.
    const turnNow = isPlayer ? currentTurnRef.current : currentTurn;
    if (turnNow === 0) return;

    // Burn timer up to now (only once).
    materializeActiveBurn();

    /* ───────────── Player undo ───────────── */
    if (isPlayer) {
      const lastIdx = turnNow - 1;
      const lastTok = draftSequence[lastIdx];
      const lastSide = sideOfToken(lastTok);

      // Only the side that made the last move can undo it
      if (playerSide !== lastSide) return;
      if (sideLocked(playerSide)) return;
      if (actionBusyRef.current) return; // prevent double-undo while waiting for ack

      // Expect the server turn to move backward to lastIdx
      pendingAckModeRef.current = "le";
      pendingAckTurnRef.current = lastIdx;
      setBusy(true);

      // Optimistic local revert
      setDraftPicks((prev) => {
        const next = [...prev];
        next[lastIdx] = null;
        return next;
      });
      setCurrentTurn(lastIdx);
      currentTurnRef.current = lastIdx; // keep ref in sync
      resetGraceNow();
      setEidolonOpenIndex(null);
      setPhaseOpenIndex(null);

      // Ignore out-of-order SSE briefly; expect <= lastIdx
      bumpIgnoreSse(lastIdx, "le");

      // Tell server
      postPlayerAction({
        op: "undoLast",
        side: playerSide,
        index: lastIdx,
      }).then((ok) => {
        if (!ok) {
          // Let the user try again; SSE/GET will resync state anyway
          pendingAckTurnRef.current = null;
          setBusy(false);
        }
      });
      return;
    }

    /* ───────────── Owner undo ───────────── */
    if (uiLocked || blueLocked || redLocked) return; // respect locks
    if (draftComplete) return;

    const lastIdx = currentTurn - 1;

    setDraftPicks((prev) => {
      const next = [...prev];
      next[lastIdx] = null;
      return next;
    });
    setCurrentTurn(lastIdx);
    resetGraceNow();
    setEidolonOpenIndex(null);
    setPhaseOpenIndex(null);

    // Save and temporarily ignore out-of-order SSE; expect the turn to move back
    ownerOptimisticSave(0, lastIdx, "le");
  };

  const updateEidolon = (index: number, eidolon: number) => {
    if (uiLocked) return;
    if (!draftPicks[index] || slotIsBan(index)) return;

    const side = sideOfIndex(index);
    if (draftComplete && sideLocked(side)) return;

    if (isPlayer) {
      if (side !== playerSide) return;
      setDraftPicks((prev) => {
        const updated = [...prev];
        if (updated[index]) updated[index] = { ...updated[index]!, eidolon };
        return updated;
      });
      bumpIgnoreSse();
      postPlayerAction({ op: "setEidolon", side: playerSide, index, eidolon });
      return;
    }

    const updated = [...draftPicks];
    updated[index] = { ...updated[index]!, eidolon };
    setDraftPicks(updated);
    ownerOptimisticSave(150);
  };

  const openLcModal = (index: number) => {
    if (uiLocked) return;
    if (slotIsBan(index)) return;
    if (!draftPicks[index]) return;

    const side = sideOfIndex(index);
    if (draftComplete && sideLocked(side)) return;
    if (isPlayer && side !== playerSide) return;

    const currentLcId = draftPicks[index]?.lightcone?.id || "";
    setSelectedLcId(currentLcId);
    setActiveSlotIndex(index);
    setShowLcModal(true);
  };

  const confirmLightCone = (index: number) => {
    const side = sideOfIndex(index);
    if (uiLocked) {
      setShowLcModal(false);
      return;
    }
    if (slotIsBan(index) || !draftPicks[index]) {
      setShowLcModal(false);
      return;
    }
    if (draftComplete && sideLocked(side)) {
      setShowLcModal(false);
      return;
    }

    const selected =
      selectedLcId === ""
        ? null
        : lightcones.find((w) => String(w.id) === String(selectedLcId))?.id ??
          null;

    // reject universally banned LC
    if (selected !== null && lightconeGlobalBan.has(String(selected))) {
      toast.error("That Light Cone is universally banned.");
      setShowLcModal(false);
      setTimeout(() => setActiveSlotIndex(null), 100);
      setSelectedLcId("");
      setLcSearch("");
      return;
    }

    if (isPlayer) {
      if (side !== playerSide) {
        setShowLcModal(false);
        return;
      }
      setDraftPicks((prev) => {
        const updated = [...prev];
        if (updated[index]) {
          if (selected === null) {
            const { lightcone, ...rest } = updated[index]!;
            updated[index] = { ...rest, lightcone: undefined };
          } else {
            const lcObj = lightcones.find(
              (w) => String(w.id) === String(selected)
            );
            updated[index] = {
              ...updated[index]!,
              lightcone: lcObj ?? undefined,
            };
          }
        }
        return updated;
      });
      bumpIgnoreSse();
      postPlayerAction({
        op: "setLightcone",
        side: playerSide,
        index,
        lightconeId: selected,
      });

      setShowLcModal(false);
      setTimeout(() => setActiveSlotIndex(null), 100);
      setSelectedLcId("");
      setLcSearch("");
      return;
    }

    // owner
    setDraftPicks((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        if (selected === null) {
          const { lightcone, ...rest } = updated[index]!;
          updated[index] = { ...rest, lightcone: undefined };
        } else {
          const lcObj = lightcones.find(
            (w) => String(w.id) === String(selected)
          );
          updated[index] = {
            ...updated[index]!,
            lightcone: lcObj ?? undefined,
          };
        }
      }
      return updated;
    });
    setShowLcModal(false);
    setTimeout(() => setActiveSlotIndex(null), 100);
    setSelectedLcId("");
    setLcSearch("");
    ownerOptimisticSave(150);
  };

  const updatePhase = (index: number, phase: number) => {
    if (uiLocked) return;
    if (!draftPicks[index] || slotIsBan(index)) return;

    const side = sideOfIndex(index);
    if (draftComplete && sideLocked(side)) return;

    if (isPlayer) {
      if (side !== playerSide) return;
      setDraftPicks((prev) => {
        const updated = [...prev];
        if (updated[index]) updated[index] = { ...updated[index]!, phase };
        return updated;
      });
      bumpIgnoreSse();
      postPlayerAction({
        op: "setSuperimpose",
        side: playerSide,
        index,
        superimpose: phase,
      });

      return;
    }

    const updated = [...draftPicks];
    updated[index] = { ...updated[index]!, phase };
    setDraftPicks(updated);
    ownerOptimisticSave(150);
  };

  // Signature hint support for LC search ordering
  const subnameToCharacterName = useMemo(() => {
    const m = new Map<string, string>();
    characters.forEach((c) => {
      if (c.subname) m.set(c.subname.toLowerCase(), c.name);
    });
    return m;
  }, [characters]);

  /* ───────────── Team Cost & penalties ───────────── */
  function getTeamCost(prefix: "B" | "R") {
    let total = 0;
    for (let i = 0; i < draftSequence.length; i++) {
      if (!draftSequence[i].startsWith(prefix)) continue;
      if (slotIsBan(i)) continue;
      const pick = draftPicks[i];
      if (!pick) continue;
      const { total: slotTotal } = getSlotCost(pick);
      total += slotTotal;
    }
    return { total: Number(total.toFixed(2)) };
  }

  /* ───────────── Share links ───────────── */
  const [showShareModal, setShowShareModal] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const spectatorUrl = spectatorKey ? `${origin}/hsr/s/${spectatorKey}` : "";
  const bluePlayerUrl =
    spectatorKey && blueToken
      ? `${origin}/hsr/draft?key=${encodeURIComponent(
          spectatorKey
        )}&pt=${encodeURIComponent(blueToken)}`
      : "";
  const redPlayerUrl =
    spectatorKey && redToken
      ? `${origin}/hsr/draft?key=${encodeURIComponent(
          spectatorKey
        )}&pt=${encodeURIComponent(redToken)}`
      : "";

  if (isMobile || !cameFromStart) return null;

  // memoize team costs once per relevant change
  const teamCostMemo = useMemo(
    () => ({
      B: getTeamCost("B"),
      R: getTeamCost("R"),
    }),
    [
      draftPicks,
      draftSequence,
      costCharMs,
      costLcPhase,
      featuredCharCostOverride,
      featuredLcCostOverride,
    ]
  );

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

  /* ───────────── Render ───────────── */
  const scoresLocked = uiLocked || isPlayer;
  const canEditSettings = isOwner;

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
        </div>
      </div>

      {/* Player banner */}
      {isPlayer && (
        <div
          className="position-relative z-2 text-center py-2"
          style={{
            color: playerSide === "B" ? "#7fb2ff" : "#ff9a9a",
            fontWeight: 700,
          }}
        >
          You are drafting for {playerSide === "B" ? "Blue" : "Red"} Team
          {draftComplete
            ? " • Draft Complete"
            : isMyTurn
            ? " • Your Turn"
            : " • Opponent Turn"}
        </div>
      )}

      <div
        className="position-relative z-2 text-white px-2 px-md-4"
        style={{ maxWidth: "1600px", margin: "0 auto" }}
      >
        {/* Draft rows */}
        <div className="d-flex flex-column align-items-center gap-3 mb-4">
          {(() => {
            const team1Cost = teamCostMemo.B;
            const team2Cost = teamCostMemo.R;
            return [
              {
                prefix: "B" as const,
                name: team1Name,
                color: "#3388ff",
                cost: team1Cost,
                ref: blueRowRef,
                scale: blueScale,
                locked: blueLocked,
              },
              {
                prefix: "R" as const,
                name: team2Name,
                color: "#cc3333",
                cost: team2Cost,
                ref: redRowRef,
                scale: redScale,
                locked: redLocked,
              },
            ].map(({ prefix, name, color, cost, ref, scale, locked }) => {
              const useSmall = mode === "3ban" || mode === "6ban";

              return (
                <div className="w-100 text-center" key={prefix}>
                  <div className="team-header">
                    <div className="team-title" style={{ color }}>
                      <span
                        className="team-dot"
                        style={{ backgroundColor: color }}
                      />
                      {name}
                      {draftComplete && (
                        <>
                          {locked ? (
                            <>
                              <span
                                className="badge bg-secondary ms-2"
                                title="Draft locked"
                              >
                                🔒 Locked
                              </span>
                              {!isPlayer && (
                                <button
                                  className="btn back-button-glass ms-2"
                                  onClick={() => toggleSideLock(prefix, false)}
                                  title="Unlock this team's draft"
                                >
                                  🔓 Unlock
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              {!isPlayer && (
                                <button
                                  className="btn back-button-glass ms-2"
                                  onClick={() => toggleSideLock(prefix, true)}
                                  title="Lock this team's draft"
                                >
                                  🔒 Lock
                                </button>
                              )}
                              {isPlayer && playerSide === prefix && (
                                <button
                                  className="btn back-button-glass ms-2"
                                  onClick={() => toggleSideLock(prefix, true)}
                                  title="Lock your draft"
                                >
                                  🔒 Lock
                                </button>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {/* RIGHT SIDE: cost + timer */}
                    <div
                      className="d-flex align-items-center"
                      style={{ gap: 10 }}
                    >
                      {timerEnabled &&
                        (isOwner ? (
                          // Owner: clickable pause/resume
                          <button
                            type="button"
                            className="btn btn-sm back-button-glass"
                            onClick={() => togglePause(prefix)}
                            title={
                              paused[prefix] ? "Resume timer" : "Pause timer"
                            }
                            style={{
                              opacity:
                                activeSide === prefix &&
                                !paused[prefix] &&
                                !draftComplete
                                  ? 1
                                  : 0.8,
                              cursor: "pointer",
                            }}
                          >
                            {paused[prefix] ? "⏸" : "⏱"}{" "}
                            {fmtClock(displayClocks.reserve[prefix])}
                            {timerPenCount[prefix] > 0 && (
                              <span
                                className="badge bg-danger ms-2"
                                title="Timer penalties this draft"
                              >
                                ×{timerPenCount[prefix]}
                              </span>
                            )}
                            {activeSide === prefix &&
                              !draftComplete &&
                              !isFirstTurnBan && (
                                <span className="ms-2 text-white-50">
                                  (+{fmtClock(displayClocks.grace)})
                                </span>
                              )}
                            {paused[prefix] && (
                              <span className="badge bg-warning ms-2">
                                Paused
                              </span>
                            )}
                          </button>
                        ) : (
                          // Player: read-only when enabled
                          <div
                            className="btn btn-sm back-button-glass disabled"
                            style={{ pointerEvents: "none" }}
                          >
                            {paused[prefix] ? "⏸" : "⏱"}{" "}
                            {fmtClock(displayClocks.reserve[prefix])}
                            {timerPenCount[prefix] > 0 && (
                              <span
                                className="badge bg-danger ms-2"
                                title="Timer penalties this draft"
                              >
                                ×{timerPenCount[prefix]}
                              </span>
                            )}
                            {activeSide === prefix &&
                              !draftComplete &&
                              !isFirstTurnBan && (
                                <span className="ms-2 text-white-50">
                                  (+{fmtClock(displayClocks.grace)})
                                </span>
                              )}
                            {paused[prefix] && (
                              <span className="badge bg-warning ms-2">
                                Paused
                              </span>
                            )}
                          </div>
                        ))}

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
                          pointerEvents: uiLocked ? "none" : "auto",
                          opacity: uiLocked ? 0.7 : 1,
                        } as React.CSSProperties
                      }
                    >
                      {draftSequence.map((tok, i) =>
                        tok.startsWith(prefix) ? (
                          <div
                            key={i}
                            className={[
                              "draft-card",
                              tok === "BB" || tok === "RR" ? "ban" : "",
                              prefix === "B" ? "blue" : "red",
                              i === currentTurn && !draftComplete
                                ? "active"
                                : "",
                              useSmall ? "small" : "",
                              slotIsAce(i) ? "ace" : "",
                            ].join(" ")}
                            style={{
                              zIndex: 10,
                              pointerEvents:
                                draftComplete && locked ? "none" : "auto",
                              opacity: draftComplete && locked ? 0.8 : 1,
                              position: "relative",
                            }}
                            onClick={(e) => {
                              if (uiLocked) return;
                              const isBan = tok === "BB" || tok === "RR";
                              if (isBan) return;
                              if (draftComplete && locked) return;
                              if (isPlayer && prefix !== playerSide) return;

                              if (
                                eidolonOpenIndex === i ||
                                phaseOpenIndex === i
                              ) {
                                e.stopPropagation();
                                return;
                              }
                              if (draftPicks[i]?.character) openLcModal(i);
                            }}
                          >
                            {/* Lock badge */}
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

                            {/* Ribbon (only when empty & ban slot) */}
                            {(() => {
                              const isBan = tok === "BB" || tok === "RR";
                              const isAceSlot = slotIsAce(i);
                              const showRibbon =
                                !draftPicks[i] && (isBan || isAceSlot);
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

                            {draftPicks[i] ? (
                              <>
                                {/* Character image */}
                                <img
                                  src={draftPicks[i]!.character.image_url}
                                  alt={draftPicks[i]!.character.name}
                                  className="draft-img"
                                  style={{
                                    filter:
                                      tok === "BB" || tok === "RR"
                                        ? "grayscale(100%) brightness(0.5)"
                                        : "none",
                                  }}
                                />

                                {/* Light Cone badge */}
                                {draftPicks[i]?.lightcone && (
                                  <img
                                    src={draftPicks[i]!.lightcone!.image_url}
                                    alt={draftPicks[i]!.lightcone!.name}
                                    title={draftPicks[i]!.lightcone!.name}
                                    className="engine-badge"
                                    onClick={(e) => {
                                      if (uiLocked) return;
                                      if (draftComplete && locked) return;
                                      if (isPlayer && prefix !== playerSide)
                                        return;
                                      e.stopPropagation();
                                      openLcModal(i);
                                    }}
                                  />
                                )}

                                {/* Eidolon slider */}
                                {eidolonOpenIndex === i &&
                                  !uiLocked &&
                                  !(draftComplete && locked) && (
                                    <div
                                      className="slider-panel"
                                      ref={(el) => {
                                        eidolonRefs.current[i] = el;
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      onMouseDown={(e) => e.stopPropagation()}
                                    >
                                      <div className="slider-label">
                                        Eidolon
                                      </div>
                                      <input
                                        type="range"
                                        min={0}
                                        max={6}
                                        className="big-slider"
                                        value={draftPicks[i]!.eidolon}
                                        onChange={(e) =>
                                          updateEidolon(
                                            i,
                                            parseInt(
                                              (e.target as HTMLInputElement)
                                                .value
                                            )
                                          )
                                        }
                                      />
                                      <div className="slider-ticks mt-1">
                                        {[0, 1, 2, 3, 4, 5, 6].map((v) => (
                                          <span
                                            key={v}
                                            className={
                                              draftPicks[i]!.eidolon === v
                                                ? "active"
                                                : ""
                                            }
                                          >
                                            {v}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                {/* Phase slider */}
                                {phaseOpenIndex === i &&
                                  !uiLocked &&
                                  !(draftComplete && locked) && (
                                    <div
                                      className="slider-panel"
                                      ref={(el) => {
                                        phaseRefs.current[i] = el;
                                      }}
                                      style={{ bottom: 70 }}
                                      onClick={(e) => e.stopPropagation()}
                                      onMouseDown={(e) => e.stopPropagation()}
                                    >
                                      <div className="slider-label">
                                        Superimposition
                                      </div>
                                      <input
                                        type="range"
                                        min={1}
                                        max={5}
                                        className="big-slider"
                                        value={draftPicks[i]!.phase}
                                        onChange={(e) =>
                                          updatePhase(
                                            i,
                                            parseInt(
                                              (e.target as HTMLInputElement)
                                                .value
                                            )
                                          )
                                        }
                                      />
                                      <div className="slider-ticks mt-1">
                                        {[1, 2, 3, 4, 5].map((v) => (
                                          <span
                                            key={v}
                                            className={
                                              draftPicks[i]!.phase === v
                                                ? "active"
                                                : ""
                                            }
                                          >
                                            {v}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                {/* Cost + Info */}
                                {(() => {
                                  const costInfo = getSlotCost(draftPicks[i]);
                                  const name = draftPicks[i]!.character.name;
                                  const banSlot = tok === "BB" || tok === "RR";
                                  const hasLc = !!draftPicks[i]?.lightcone;

                                  return (
                                    <>
                                      {/* 3v3 ONLY: mini E/S beside the cost bubble */}
                                      {useSmall && !banSlot && (
                                        <div className="cost-stack">
                                          <button
                                            type="button"
                                            className={[
                                              "cost-btn",
                                              uiLocked ||
                                              (draftComplete && locked) ||
                                              (isPlayer &&
                                                prefix !== playerSide)
                                                ? "disabled"
                                                : "",
                                            ].join(" ")}
                                            title={
                                              uiLocked ||
                                              (draftComplete && locked)
                                                ? "Locked"
                                                : "Set Eidolon"
                                            }
                                            onClick={(e) => {
                                              if (
                                                uiLocked ||
                                                (draftComplete && locked)
                                              )
                                                return;
                                              if (
                                                isPlayer &&
                                                prefix !== playerSide
                                              )
                                                return;
                                              e.stopPropagation();
                                              setPhaseOpenIndex(null);
                                              setEidolonOpenIndex(
                                                eidolonOpenIndex === i
                                                  ? null
                                                  : i
                                              );
                                            }}
                                          >
                                            E{draftPicks[i]!.eidolon}
                                          </button>

                                          {hasLc && (
                                            <button
                                              type="button"
                                              className={[
                                                "cost-btn",
                                                uiLocked ||
                                                (draftComplete && locked) ||
                                                (isPlayer &&
                                                  prefix !== playerSide)
                                                  ? "disabled"
                                                  : "",
                                              ].join(" ")}
                                              title={
                                                uiLocked ||
                                                (draftComplete && locked)
                                                  ? "Locked"
                                                  : "Set Superimposition"
                                              }
                                              onClick={(e) => {
                                                if (
                                                  uiLocked ||
                                                  (draftComplete && locked)
                                                )
                                                  return;
                                                if (
                                                  isPlayer &&
                                                  prefix !== playerSide
                                                )
                                                  return;
                                                e.stopPropagation();
                                                setEidolonOpenIndex(null);
                                                setPhaseOpenIndex(
                                                  phaseOpenIndex === i
                                                    ? null
                                                    : i
                                                );
                                              }}
                                            >
                                              S{draftPicks[i]!.phase}
                                            </button>
                                          )}

                                          <div
                                            className="cost-bubble"
                                            title={`Char ${costInfo.charCost} + LC ${costInfo.lcCost}`}
                                          >
                                            {costInfo.total}
                                          </div>
                                        </div>
                                      )}

                                      {/* Bottom info bar */}
                                      <div
                                        className="info-bar"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {/* Hide the long name on small cards to avoid overlap */}
                                        {!useSmall && (
                                          <div
                                            className="char-name"
                                            title={name}
                                          >
                                            {name}
                                          </div>
                                        )}

                                        {/* Normal (2v2) chip row */}
                                        {!banSlot && !useSmall && (
                                          <div className="chip-row">
                                            <span
                                              className={`chip clickable chip-left ${
                                                uiLocked ||
                                                (draftComplete && locked)
                                                  ? "disabled"
                                                  : ""
                                              }`}
                                              title={
                                                uiLocked ||
                                                (draftComplete && locked)
                                                  ? "Locked"
                                                  : "Set Eidolon"
                                              }
                                              onClick={(e) => {
                                                if (uiLocked) return;
                                                if (draftComplete && locked)
                                                  return;
                                                if (
                                                  isPlayer &&
                                                  prefix !== playerSide
                                                )
                                                  return;
                                                e.stopPropagation();
                                                setPhaseOpenIndex(null);
                                                setEidolonOpenIndex(
                                                  eidolonOpenIndex === i
                                                    ? null
                                                    : i
                                                );
                                              }}
                                            >
                                              E{draftPicks[i]!.eidolon}
                                            </span>

                                            <span
                                              className="chip cost chip-center"
                                              title={`Char ${costInfo.charCost} + LC ${costInfo.lcCost}`}
                                            >
                                              {costInfo.total}
                                            </span>

                                            {hasLc ? (
                                              <span
                                                className={`chip clickable chip-right ${
                                                  uiLocked ||
                                                  (draftComplete && locked)
                                                    ? "disabled"
                                                    : ""
                                                }`}
                                                title={
                                                  uiLocked ||
                                                  (draftComplete && locked)
                                                    ? "Locked"
                                                    : "Set Superimposition"
                                                }
                                                onClick={(e) => {
                                                  if (uiLocked) return;
                                                  if (draftComplete && locked)
                                                    return;
                                                  if (
                                                    isPlayer &&
                                                    prefix !== playerSide
                                                  )
                                                    return;
                                                  e.stopPropagation();
                                                  setEidolonOpenIndex(null);
                                                  setPhaseOpenIndex(
                                                    phaseOpenIndex === i
                                                      ? null
                                                      : i
                                                  );
                                                }}
                                              >
                                                S{draftPicks[i]!.phase}
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
                              </>
                            ) : (
                              <div className="d-flex w-100 h-100 align-items-center justify-content-center text-white-50">
                                #{i + 1}
                              </div>
                            )}
                          </div>
                        ) : null
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* Featured preview bar */}
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
              cursor: "pointer",
            }}
            onClick={() => setShowFeaturedPopup(true)}
          >
            <div
              className="d-flex align-items-center justify-content-between flex-wrap gap-2"
              style={{ marginBottom: 8 }}
            >
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontWeight: 700 }}>Featured</span>
                <span className="text-white-50 small">
                  ({featuredList.length}
                  {featuredList.length === 1 ? " item" : " items"})
                </span>
              </div>
              <div className="text-white-50 small">
                Cost shown is the E0 / LC override base if set. Rules still
                apply.
              </div>
            </div>
            <div
              className="d-flex align-items-center gap-2 flex-wrap"
              style={{ overflow: "hidden", whiteSpace: "nowrap" }}
            >
              {featuredList.map(renderFeaturedPill)}
            </div>
          </div>
        )}

        {/* Search + Undo + Share */}
        <div className="mb-3 w-100 d-flex justify-content-center align-items-center gap-2 flex-wrap">
          {/* Settings */}
          <button
            type="button"
            className="btn btn-sm btn-glass"
            title={
              isOwner ? "Draft Settings" : "View settings (owner can edit)"
            }
            onClick={() => setShowSettingsModal(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span aria-hidden="true">⚙️</span>
          </button>
          <input
            type="text"
            className="form-control"
            placeholder="Search characters..."
            value={keyboardSearch}
            onChange={(e) => setKeyboardSearch(e.target.value)}
            disabled={uiLocked || (isPlayer && !isMyTurn) || draftComplete}
            style={{
              maxWidth: "300px",
              backgroundColor: "rgba(255,255,255,0.08)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.25)",
              opacity: uiLocked ? 0.6 : 1,
            }}
          />
          <button
            className="btn back-button-glass"
            onClick={handleUndo}
            disabled={(() => {
              if (currentTurn === 0) return true;
              const lastIdx = currentTurn - 1;
              const lastTok = draftSequence[lastIdx];
              const lastSide = sideOfToken(lastTok);
              if (!isPlayer) return uiLocked || blueLocked || redLocked;
              if (draftComplete) return true;
              if (playerSide !== lastSide) return true;
              if (sideLocked(playerSide)) return true;
              return actionBusy;
            })()}
            title={(() => {
              if (currentTurn === 0) return "Nothing to undo";
              if (!isPlayer && (uiLocked || blueLocked || redLocked))
                return "Locked";
              if (isPlayer && draftComplete) return "Draft complete";
              return "Undo last pick";
            })()}
            style={{ whiteSpace: "nowrap" }}
          >
            ⟲ Undo
          </button>

          {user && !isPlayer && (
            <button
              className="btn back-button-glass"
              onClick={() => setShowShareModal(true)}
              disabled={!spectatorKey}
              title={
                spectatorKey ? "Share spectator + player links" : "Preparing…"
              }
            >
              Share / Invite
            </button>
          )}
        </div>

        {/* Character Grid */}
        {!draftComplete && (
          <div
            className="mb-5 px-2"
            style={{ maxWidth: "1000px", margin: "0 auto" }}
          >
            <div
              className="character-pool-scroll"
              style={{
                pointerEvents:
                  uiLocked || (isPlayer && (!isMyTurn || actionBusy))
                    ? "none"
                    : "auto",
                opacity:
                  uiLocked || (isPlayer && (!isMyTurn || actionBusy)) ? 0.6 : 1,
              }}
            >
              <div className="character-pool-grid upscaled">
                {characters
                  .filter((char) => {
                    const q = keyboardSearch.toLowerCase();
                    const name = char.name.toLowerCase();
                    const sub =
                      char.subname && char.subname.toLowerCase() !== "null"
                        ? char.subname.toLowerCase()
                        : "";
                    return name.includes(q) || sub.includes(q);
                  })
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((char) => {
                    const currentStep = draftSequence[currentTurn];
                    if (!currentStep) return null;

                    const mySide = currentStep.startsWith("B") ? "B" : "R";
                    const oppSide = mySide === "B" ? "R" : "B";

                    const myPicks = draftPicks.filter((_, i) =>
                      draftSequence[i]?.startsWith(mySide)
                    );
                    const oppPicks = draftPicks.filter((_, i) =>
                      draftSequence[i]?.startsWith(oppSide)
                    );

                    const pickedByMe = myPicks.some(
                      (p) => p?.character.code === char.code
                    );
                    const pickedByOpp = oppPicks.some(
                      (p) => p?.character.code === char.code
                    );

                    const isBanned = effectiveBanned.has(char.code);
                    const isBanSlot =
                      currentStep === "BB" || currentStep === "RR";
                    const isAcePickStep = tokenIsAce(currentStep);

                    let isDisabled =
                      uiLocked ||
                      (isBanSlot && featuredGlobalPick.has(char.code)) || // cannot ban a global-pick char
                      isBanned;

                    if (!isDisabled) {
                      if (featuredGlobalPick.has(char.code)) {
                        if (pickedByMe) isDisabled = true;
                      } else {
                        if (pickedByMe) isDisabled = true;
                        if (!isAcePickStep && pickedByOpp) isDisabled = true; // opponent’s copy allowed on ACE
                      }
                    }

                    if (isPlayer && mySide !== playerSide) isDisabled = true;

                    return (
                      <div
                        key={char.code}
                        title={char.name}
                        onClick={() => !isDisabled && handleCharacterPick(char)}
                        style={{
                          width: "70px",
                          height: "70px",
                          borderRadius: "8px",
                          border: isBanned
                            ? "2px dashed #888"
                            : pickedByMe || pickedByOpp
                            ? "2px solid #aaa"
                            : "2px solid #555",
                          backgroundImage: `url(${char.image_url})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          cursor: isDisabled ? "not-allowed" : "pointer",
                          opacity: isDisabled ? 0.4 : 1,
                          filter: isDisabled
                            ? "grayscale(100%) brightness(0.6)"
                            : "none",
                          transition:
                            "transform 0.15s ease, box-shadow 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!isDisabled)
                            (
                              e.currentTarget as HTMLDivElement
                            ).style.transform = "scale(1.1)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.transform =
                            "scale(1)";
                        }}
                      />
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Post-draft scoring */}
        {draftComplete && (
          <>
            <div
              className="score-row d-flex flex-column flex-md-row gap-3 px-2 mt-4"
              style={{ maxWidth: 1000, margin: "0 auto" }}
            >
              {(["B", "R"] as const).map((side) => {
                const isBlue = side === "B";
                const scores = isBlue ? blueScores : redScores;
                const label = isBlue ? (
                  <span style={{ color: "#3388ff", fontWeight: 700 }}>
                    Blue Team
                  </span>
                ) : (
                  <span style={{ color: "#cc3333", fontWeight: 700 }}>
                    Red Team
                  </span>
                );
                const nameLabels = isBlue ? blueLabels : redLabels;

                const penaltyCycles =
                  side === "B" ? blueCyclePenalty : redCyclePenalty;
                const includeCycle =
                  side === "B" ? applyCyclePenaltyB : applyCyclePenaltyR;
                const cycleTerm = includeCycle ? penaltyCycles : 0;

                const extraCycles = round2(
                  side === "B" ? extraCyclePenaltyB : extraCyclePenaltyR
                );
                const timerAdd = (
                  isBlue ? applyTimerPenaltyB : applyTimerPenaltyR
                )
                  ? isBlue
                    ? timerPenCount.B
                    : timerPenCount.R
                  : 0;

                const adjustedTotal = Number(
                  (
                    scores.reduce((a, b) => a + b, 0) +
                    cycleTerm +
                    extraCycles +
                    timerAdd
                  ).toFixed(2)
                );

                return (
                  <div
                    key={side}
                    className={`score-card ${isBlue ? "blue" : "red"} w-100`}
                    style={{ opacity: scoresLocked ? 0.8 : 1 }}
                  >
                    <div className="score-header">
                      <div className="score-title">{label}</div>
                      <div className="d-flex align-items-center gap-2 me-2">
                        {/* Timer penalty pill (only visible if any occurred) */}
                        {timerPenCount[side] > 0 && (
                          <span
                            className="badge"
                            style={{
                              cursor: scoresLocked ? "default" : "pointer",
                              userSelect: "none",
                              padding: "6px 10px",
                              border: "1px solid rgba(255,255,255,0.25)",
                              background: (
                                side === "B"
                                  ? applyTimerPenaltyB
                                  : applyTimerPenaltyR
                              )
                                ? "rgba(255, 193, 7, 0.2)" // included → warm pill
                                : "rgba(255, 255, 255, 0.10)", // excluded → neutral pill
                              color: "white",
                              opacity: scoresLocked ? 0.6 : 1,
                            }}
                            title={
                              (
                                side === "B"
                                  ? applyTimerPenaltyB
                                  : applyTimerPenaltyR
                              )
                                ? "Included in end score — click to remove"
                                : "Not included — click to include in end score"
                            }
                            onClick={() => {
                              if (scoresLocked) return;
                              if (side === "B")
                                setApplyTimerPenaltyB((v) => !v);
                              else setApplyTimerPenaltyR((v) => !v);
                              requestSave(150);
                            }}
                          >
                            ⏱ Timer ×{timerPenCount[side]}
                          </span>
                        )}
                      </div>

                      <div className="score-draft">
                        Cycle penalty: {penaltyCycles}
                        {!includeCycle && (
                          <span className="text-white-50 ms-2">
                            (not applied)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="score-inputs">
                      {(is3ban ? [0, 1, 2] : [0, 1]).map((i) => (
                        <div className="score-input-group" key={i}>
                          <label>{nameLabels[i] || `Player ${i + 1}`}</label>
                          <input
                            type="number"
                            className="form-control score-input"
                            placeholder="0"
                            inputMode="numeric"
                            min={SCORE_MIN}
                            max={SCORE_MAX}
                            disabled={scoresLocked}
                            value={isBlue ? blueDraft[i] : redDraft[i]}
                            onChange={(e) => {
                              if (scoresLocked) return;
                              const raw = e.target.value.replace(/[^\d]/g, "");
                              if (isBlue) {
                                setBlueDraft((d) => {
                                  const a = [...d];
                                  a[i] = raw;
                                  return a;
                                });
                              } else {
                                setRedDraft((d) => {
                                  const a = [...d];
                                  a[i] = raw;
                                  return a;
                                });
                              }
                            }}
                            onBlur={() => {
                              if (scoresLocked) return;
                              commitScore(isBlue ? "B" : "R", i);
                              // commitScore() also normalizes the draft text and calls requestSave(0)
                            }}
                          />
                        </div>
                      ))}
                      <div className="score-input-group" key="extra">
                        <label>Extra Cycle Penalty</label>
                        <input
                          type="text" // text so we can show "" while typing
                          inputMode="decimal" // mobile decimal keypad
                          className="form-control score-input"
                          placeholder="0"
                          disabled={scoresLocked} // keep as-is; owner-only edits post-draft
                          value={
                            side === "B" ? extraCycleDraftB : extraCycleDraftR
                          }
                          onChange={(e) => {
                            if (scoresLocked) return;
                            const raw = sanitizeDec(e.target.value);
                            if (side === "B") setExtraCycleDraftB(raw);
                            else setExtraCycleDraftR(raw);
                          }}
                          onBlur={() => {
                            if (scoresLocked) return;
                            if (side === "B") {
                              const v = Math.max(
                                0,
                                parseFloat(extraCycleDraftB || "0") || 0
                              );
                              const vv = round2(v);
                              setExtraCyclePenaltyB(vv);
                              setExtraCycleDraftB(vv ? String(vv) : ""); // keep placeholder when 0
                            } else {
                              const v = Math.max(
                                0,
                                parseFloat(extraCycleDraftR || "0") || 0
                              );
                              const vv = round2(v);
                              setExtraCyclePenaltyR(vv);
                              setExtraCycleDraftR(vv ? String(vv) : ""); // keep placeholder when 0
                            }
                            requestSave(0);
                          }}
                        />
                      </div>
                    </div>

                    <div className="score-total">
                      <div className="score-total-label">Team Total</div>
                      <div className="score-total-value">
                        {scores.reduce((a, b) => a + b, 0)}
                        {(cycleTerm > 0 || extraCycles > 0 || timerAdd > 0) && (
                          <span className="score-penalty">
                            {includeCycle && penaltyCycles
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

            {/* Finalize / Complete (owner only) */}
            {!isPlayer && (
              <div className="text-center mt-3">
                <button
                  className="btn back-button-glass"
                  onClick={() => {
                    if (uiLocked) {
                      setUiLocked(false);
                      return;
                    }
                    if (!canFinalize) return;

                    const idxs = is3ban ? [0, 1, 2] : [0, 1];
                    const coerce = (
                      drafts: string[],
                      prev: number[],
                      set: React.Dispatch<React.SetStateAction<number[]>>
                    ) => {
                      const next = [...prev];
                      for (const i of idxs) {
                        const n = Math.max(
                          SCORE_MIN,
                          Math.min(
                            SCORE_MAX,
                            parseInt(drafts[i] || "0", 10) || 0
                          )
                        );
                        next[i] = n;
                      }
                      set(next);
                    };

                    coerce(blueDraft, blueScores, setBlueScores);
                    coerce(redDraft, redScores, setRedScores);

                    setUiLocked(true);
                    requestSave(0);
                  }}
                  disabled={!uiLocked && !canFinalize}
                >
                  {uiLocked ? "Unlock to Edit" : "Mark Match Complete"}
                </button>
              </div>
            )}

            {/* Winner banner */}
            <div className="text-center mt-4 text-white">
              {(() => {
                const blueTimerAdd = applyTimerPenaltyB ? timerPenCount.B : 0;
                const redTimerAdd = applyTimerPenaltyR ? timerPenCount.R : 0;

                const redCycleTerm = applyCyclePenaltyR ? redCyclePenalty : 0;
                const blueCycleTerm = applyCyclePenaltyB ? blueCyclePenalty : 0;

                const blueAdjusted =
                  blueScores.reduce((a, b) => a + b, 0) +
                  blueCycleTerm +
                  extraCyclePenaltyB +
                  blueTimerAdd;
                const redAdjusted =
                  redScores.reduce((a, b) => a + b, 0) +
                  redCycleTerm +
                  extraCyclePenaltyR +
                  redTimerAdd;

                if (blueAdjusted < redAdjusted)
                  return (
                    <h4 style={{ color: "#3388ff" }}>🏆 {team1Name} Wins!</h4>
                  );
                if (redAdjusted < blueAdjusted)
                  return (
                    <h4 style={{ color: "#cc3333" }}>🏆 {team2Name} Wins!</h4>
                  );
                return <h4 className="text-warning">Draw!</h4>;
              })()}
            </div>
          </>
        )}

        {/* Light Cone Modal */}
        <Modal
          show={showLcModal}
          onHide={() => setShowLcModal(false)}
          centered
          contentClassName="custom-black-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>Select Light Cone</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <input
              type="text"
              className="form-control mb-2"
              placeholder="Search Light Cone..."
              value={lcSearch}
              onChange={(e) => setLcSearch(e.target.value)}
              disabled={uiLocked}
            />
            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              <ul className="list-group">
                <li
                  className={`list-group-item list-group-item-action ${
                    selectedLcId === "" ? "active" : ""
                  }`}
                  onClick={() => !uiLocked && setSelectedLcId("")}
                  style={{ cursor: uiLocked ? "not-allowed" : "pointer" }}
                >
                  None
                </li>
                {(() => {
                  const searchLower = lcSearch.toLowerCase();
                  const activeChar =
                    activeSlotIndex !== null
                      ? draftPicks[activeSlotIndex]?.character
                      : undefined;
                  const activeCharName = activeChar?.name?.toLowerCase();
                  const activeCharSubname = activeChar?.subname?.toLowerCase();

                  const filtered = lightcones.filter((w: LightCone) => {
                    const name = w.name?.toLowerCase() || "";
                    const sub = w.subname?.toLowerCase() || "";
                    if (name.includes(searchLower) || sub.includes(searchLower))
                      return true;

                    // signature hint: match character-name subname
                    for (const [
                      subn,
                      charName,
                    ] of subnameToCharacterName.entries()) {
                      if (
                        subn.includes(searchLower) &&
                        (name.includes(charName.toLowerCase()) ||
                          sub.includes(charName.toLowerCase()))
                      ) {
                        return true;
                      }
                    }
                    return false;
                  });

                  // signature first
                  filtered.sort((a: LightCone, b: LightCone) => {
                    if (!activeCharName && !activeCharSubname) return 0;
                    const aSub = a.subname?.toLowerCase() || "";
                    const bSub = b.subname?.toLowerCase() || "";
                    const aMatches =
                      (activeCharName && aSub === activeCharName) ||
                      (activeCharSubname && aSub === activeCharSubname);
                    const bMatches =
                      (activeCharName && bSub === activeCharName) ||
                      (activeCharSubname && bSub === activeCharSubname);
                    if (aMatches && !bMatches) return -1;
                    if (!aMatches && bMatches) return 1;
                    return 0;
                  });

                  return filtered.map((w: LightCone) => {
                    const isSig = !!activeChar && isSignatureLC(w, activeChar);
                    const isBanned = lightconeGlobalBan.has(String(w.id));
                    return (
                      <li
                        key={w.id}
                        className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center
                          ${selectedLcId === String(w.id) ? "active" : ""} ${
                          isBanned ? "disabled" : ""
                        }`}
                        onClick={() => {
                          if (uiLocked || isBanned) return;
                          setSelectedLcId(String(w.id));
                        }}
                        style={{
                          cursor:
                            uiLocked || isBanned ? "not-allowed" : "pointer",
                          padding: "6px 10px",
                          gap: "10px",
                          opacity: uiLocked || isBanned ? 0.5 : 1,
                        }}
                        title={isBanned ? "Universally banned" : w.name}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <img
                            src={w.image_url}
                            alt={w.name}
                            style={{
                              width: 32,
                              height: 32,
                              objectFit: "cover",
                              borderRadius: 4,
                              border: "1px solid rgba(255,255,255,0.1)",
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 600 }}>{w.name}</div>
                            <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                              {w.subname ? `${w.subname} ` : ""}({w.rarity}★)
                              {w.limited ? " • Limited" : ""}
                            </div>
                          </div>
                        </div>

                        {isBanned ? (
                          <span className="badge bg-danger">Uni Ban</span>
                        ) : isSig ? (
                          <span className="badge bg-warning text-dark">
                            💠 Signature
                          </span>
                        ) : null}
                      </li>
                    );
                  });
                })()}
              </ul>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowLcModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (uiLocked) return;
                if (activeSlotIndex !== null) confirmLightCone(activeSlotIndex);
              }}
              disabled={
                uiLocked ||
                (selectedLcId !== "" &&
                  lightconeGlobalBan.has(String(selectedLcId)))
              }
            >
              Confirm
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Featured full list popup */}
        <Modal
          show={showFeaturedPopup}
          onHide={() => setShowFeaturedPopup(false)}
          centered
          contentClassName="custom-dark-modal"
          size="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>All Featured</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              {featuredList.map((f) => {
                const fk = f.kind === "character" ? f.code! : `lc-${f.id!}`;
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
                return (
                  <div
                    key={`full-${fk}`}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background:
                        "linear-gradient(0deg, rgba(255,255,255,0.04), rgba(255,255,255,0.04))",
                      border: "1px solid rgba(255,255,255,0.10)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 10,
                        overflow: "hidden",
                        background: "rgba(0,0,0,0.28)",
                        flex: "0 0 56px",
                      }}
                    >
                      {meta.image_url ? (
                        <img
                          src={meta.image_url}
                          alt={meta.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : null}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        title={meta.name}
                        style={{
                          fontWeight: 700,
                          lineHeight: 1.15,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {meta.name}
                      </div>
                      <div
                        className="d-flex align-items-center flex-wrap"
                        style={{ gap: 8, marginTop: 6 }}
                      >
                        <span
                          className="badge"
                          style={{
                            backgroundColor: ruleColor,
                            border: "1px solid rgba(0,0,0,0.2)",
                            color:
                              f.rule === "none"
                                ? "rgba(255,255,255,0.9)"
                                : "white",
                          }}
                        >
                          {ruleLabel}
                        </span>
                        {typeof f.customCost === "number" && (
                          <span
                            className="text-white-50 small"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            Cost:{" "}
                            <strong style={{ color: "white" }}>
                              {f.customCost.toFixed(2)}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setShowFeaturedPopup(false)}
            >
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Share / Invite (OWNER ONLY) */}
        <Modal
          show={showShareModal}
          onHide={() => setShowShareModal(false)}
          centered
          contentClassName="custom-dark-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>Links</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="mb-3">
              <div className="fw-semibold mb-1">Spectator</div>
              <div className="d-flex gap-2">
                <input className="form-control" value={spectatorUrl} readOnly />
                <Button
                  onClick={() =>
                    spectatorUrl && navigator.clipboard.writeText(spectatorUrl)
                  }
                  disabled={!spectatorUrl}
                  variant="secondary"
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className="mb-3">
              <div className="fw-semibold mb-1">Blue Team</div>
              <div className="d-flex gap-2">
                <input
                  className="form-control"
                  value={bluePlayerUrl}
                  readOnly
                />
                <Button
                  onClick={() =>
                    bluePlayerUrl &&
                    navigator.clipboard.writeText(bluePlayerUrl)
                  }
                  disabled={!bluePlayerUrl}
                  variant="secondary"
                >
                  Copy
                </Button>
              </div>
              <small className="text-white-50">For blue team players.</small>
            </div>

            <div className="mb-2">
              <div className="fw-semibold mb-1">Red Team</div>
              <div className="d-flex gap-2">
                <input className="form-control" value={redPlayerUrl} readOnly />
                <Button
                  onClick={() =>
                    redPlayerUrl && navigator.clipboard.writeText(redPlayerUrl)
                  }
                  disabled={!redPlayerUrl}
                  variant="secondary"
                >
                  Copy
                </Button>
              </div>
              <small className="text-white-50">For red team players.</small>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setShowShareModal(false)}
            >
              Close
            </Button>
          </Modal.Footer>
        </Modal>
        <Modal
          show={showSettingsModal}
          onHide={() => {
            setShowSettingsModal(false);
            setCycleBpStr(String(cycleBreakpoint)); // reset any unsaved edits
          }}
          centered
          contentClassName="custom-dark-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>
              Draft Settings{" "}
              {!canEditSettings && (
                <span className="badge bg-secondary ms-2"></span>
              )}
            </Modal.Title>
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
            <label className="form-label">Cycle breakpoint</label>
            <div className="d-flex align-items-center gap-2 mb-1">
              <input
                type="text"
                inputMode="numeric"
                pattern="\d*"
                className="form-control"
                style={{ maxWidth: 160 }}
                placeholder="4"
                value={cycleBpStr}
                onChange={(e) =>
                  setCycleBpStr(e.target.value.replace(/[^\d]/g, ""))
                }
                onKeyDown={(e) => {
                  if (!canEditSettings) return; // read-only
                  if (e.key === "Enter") {
                    const parsed = parseInt(cycleBpStr || "4", 10);
                    const next =
                      Number.isFinite(parsed) && parsed >= 1 ? parsed : 4;
                    applyCycleBreakpoint(next);
                    setShowSettingsModal(false);
                  }
                }}
                disabled={!canEditSettings}
              />
              <span className="text-white-50 small">Default is 4</span>
            </div>

            <small className="text-white-50">
              Each{" "}
              <strong>
                {(canEditSettings
                  ? Number(cycleBpStr || cycleBreakpoint)
                  : cycleBreakpoint
                ).toFixed(2)}
              </strong>{" "}
              total cost adds <strong>1.00</strong> cycle penalty.
            </small>
          </Modal.Body>

          <Modal.Footer>
            <Button
              className="btn-glass btn-glass-secondary"
              onClick={() => {
                setShowSettingsModal(false);
                setCycleBpStr(String(cycleBreakpoint));
              }}
            >
              Close
            </Button>
            <Button
              className="btn-glass btn-glass-warning"
              onClick={() => {
                if (!canEditSettings) return; // read-only
                const parsed = parseInt(cycleBpStr || "4", 10);
                const next =
                  Number.isFinite(parsed) && parsed >= 1 ? parsed : 4;
                applyCycleBreakpoint(next);
                setShowSettingsModal(false);
              }}
              disabled={!canEditSettings}
            >
              Save
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </div>
  );
}
