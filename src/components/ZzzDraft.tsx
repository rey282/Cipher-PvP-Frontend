// components/ZzzDraft.tsx
import { useEffect, useState, useRef, useMemo } from "react";
import Navbar from "../components/Navbar";
import "../components/Landing.css";
import { useLocation, useNavigate } from "react-router-dom";
import { Modal, Button } from "react-bootstrap";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

/* ───────────── Types ───────────── */
type Character = {
  code: string;
  name: string;
  subname?: string;
  rarity: number; // 5 = S, 4 = A
  image_url: string;
  limited: boolean;
};

type WEngine = {
  id: string;
  name: string;
  subname?: string;
  rarity: number; // 5 = S, 4/A/B below
  image_url: string;
  limited: boolean;
};

type DraftPick = {
  character: Character;
  eidolon: number; // Mindscape M0..M6
  wengine?: WEngine;
  superimpose: number; // W1..W5 (1..5)
};

type ServerPick = {
  characterCode: string;
  eidolon: number;
  wengineId: string | null;
  superimpose: number;
};

type SpectatorState = {
  draftSequence: string[];
  currentTurn: number;
  picks: Array<ServerPick | null>;
  blueScores: number[];
  redScores: number[];
  // per-side draft locks after draft complete
  blueLocked?: boolean;
  redLocked?: boolean;
};

type FeaturedCfg = {
  kind: "character" | "wengine";
  code?: string; // for characters
  id?: string; // for W-Engines
  name?: string;
  image_url?: string;
  rule: "none" | "globalBan" | "globalPick";
  customCost?: number | null;
};

function normalizeFeatured(list: any[]): FeaturedCfg[] {
  return (Array.isArray(list) ? list : []).map((f: any) => {
    const kind: "character" | "wengine" =
      f?.kind === "wengine" || f?.id ? "wengine" : "character";
    return {
      kind,
      code: f.code ?? undefined,
      id: f.id ?? undefined,
      name: f.name ?? undefined,
      image_url: f.image_url ?? undefined,
      rule: f.rule === "globalBan" || f.rule === "globalPick" ? f.rule : "none",
      customCost: typeof f.customCost === "number" ? f.customCost : null,
    };
  });
}


const MOBILE_QUERY = "(pointer:coarse), (max-width: 820px)";
const SCORE_MIN = 0;
const SCORE_MAX = 65000;

/* ───────────── Responsive row sizing ───────────── */
const CARD_W = 170;
const CARD_H = 240;
const CARD_GAP = 12;
const CARD_MIN_SCALE = 0.68;

const CREATE_LOCK_KEY = "zzzSpectatorCreateLock";
const SNAPSHOT_PREFIX = "zzzDraftLocal:";

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
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [ref, cardCount]);
  return scale;
}

/* ───────────── Cost Rules Helpers ───────────── */
function calcAgentCost(agent: Character, mindscape: number): number {
  const ms = Math.max(0, Math.min(6, mindscape));
  if (agent.rarity === 4) return 0.5;
  if (agent.rarity === 5) {
    if (agent.limited) {
      const bumpMilestones = [1, 2, 4, 6];
      const bumps = bumpMilestones.filter((m) => ms >= m).length;
      return 1 + 0.5 * bumps;
    } else {
      return ms >= 6 ? 1.5 : 1;
    }
  }
  return 0;
}

function calcWEngineCost(we: WEngine | undefined, phase: number): number {
  if (!we) return 0;
  const p = Math.max(1, Math.min(5, phase));

  // New: all 4★ (and lower) are free at every phase
  if (we.rarity <= 4) return 0;

  if (we.limited) {
    // Limited 5★: P1–P2 0.25, P3–P4 0.5, P5 0.75
    if (p <= 2) return 0.25;
    if (p <= 4) return 0.5;
    return 0.75; // P5
  }

  return p >= 3 ? 0.25 : 0;
}


/* ───────────── Penalty ───────────── */
const PENALTY_PER_POINT = 2500;

export default function ZzzDraftPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  type DraftInit = {
    team1?: string;
    team2?: string;
    mode?: "2v2" | "3v3";
    featured?: FeaturedCfg[];
  };

  /* ───────── Player mode via token ─────────
   ?key=SESSION_KEY&pt=PLAYER_TOKEN
*/
  const keyFromUrl = query.get("key");
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [playerSide, setPlayerSide] = useState<"B" | "R" | null>(null);
  const isPlayerClient = !!(keyFromUrl && playerToken);

  const [blueToken, setBlueToken] = useState<string | null>(null);
  const [redToken, setRedToken] = useState<string | null>(null);

  useEffect(() => {
    const k = query.get("key");
    const pt = query.get("pt");
    if (!k || !pt) return;

    (async () => {
      try {
        const res = await fetch(
          `${
            import.meta.env.VITE_API_BASE
          }/api/zzz/sessions/${k}/resolve-token?pt=${encodeURIComponent(pt)}`,
          { credentials: "include" }
        );
        if (!res.ok) return; // invalid token -> read-only
        const data = await res.json(); // { side: "B" | "R" }
        setPlayerToken(pt);
        setPlayerSide(data.side);
        setSpectatorKey(k);
        sessionStorage.setItem("zzzSpectatorKey", k);
      } catch {}
    })();
  }, [location.search]);

  // allow link joins + prior session keys
  const joiningViaLink = !!keyFromUrl;
  const hasKeyInSession = (() => {
    try {
      return !!sessionStorage.getItem("zzzSpectatorKey");
    } catch {
      return false;
    }
  })();

  const navState = (location.state as DraftInit) || null;

  const stored: DraftInit | null = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("zzzDraftInit") || "null");
    } catch {
      return null;
    }
  })();

  const seed = navState ?? stored ?? {};

  // Featured config (owner sets it on Start, players receive via GET/SSE)
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

  const featuredCostOverride = useMemo(
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

  const featuredWeCostOverride = useMemo(
    () =>
      new Map<string, number>(
        featuredList
          .filter(
            (f) =>
              f.kind === "wengine" && typeof f.customCost === "number" && f.id
          )
          .map((f) => [String(f.id), f.customCost as number])
      ),
    [featuredList]
  );

  // W-Engine universal bans (server ignores "globalPick" for WEs)
  const wengineGlobalBan = useMemo(
    () =>
      new Set(
        featuredList
          .filter((f) => f.kind === "wengine" && f.rule === "globalBan")
          .map((f) => String(f.id))
      ),
    [featuredList]
  );

  /* ───────── Make mode & names stateful (will be overwritten by SSE/GET) ───────── */
  const [mode, setMode] = useState<"2v2" | "3v3">(
    ((seed.mode || (query.get("mode") as "2v2" | "3v3") || "2v2") as any) ===
      "3v3"
      ? "3v3"
      : "2v2"
  );
  const is3v3 = mode === "3v3";

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

  // HARD mobile/narrow-touch guard
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
    navigate("/", { replace: true, state: { blocked: "zzz-draft-mobile" } });
  }, [isMobile, navigate]);

  // DON’T kick player links
  useEffect(() => {
    if (joiningViaLink) return;
    if (!cameFromStart && !isMobile) {
      navigate("/", { replace: true, state: { blocked: "zzz-draft-no-team" } });
    }
  }, [cameFromStart, isMobile, navigate, joiningViaLink]);

  // Only strip the querystring if it’s the owner flow (keep ?key or ?pt for players)
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

  const { user } = useAuth(); // truthy if logged in
  const [spectatorKey, setSpectatorKey] = useState<string | null>(null);

  // If link has ?key=..., trust it immediately (player joins)
  useEffect(() => {
    const k = query.get("key");
    if (k) {
      setSpectatorKey(k);
      sessionStorage.setItem("zzzSpectatorKey", k);
    }
  }, [location.search]);

  // Otherwise hydrate from previous tab if any
  useEffect(() => {
    if (spectatorKey) return; // already set
    const k = sessionStorage.getItem("zzzSpectatorKey");
    if (k) setSpectatorKey(k);
  }, [spectatorKey]);

  const COST_LIMIT = is3v3 ? 9 : 6;

  const draftSequence: string[] = is3v3
    ? [
        "B",
        "R",
        "R",
        "B",
        "RR",
        "BB",
        "R",
        "B",
        "B(ACE)",
        "R(ACE)",
        "R",
        "B",
        "B",
        "R",
        "R",
        "B",
        "B(ACE)",
        "R(ACE)",
        "R",
        "B",
      ]
    : [
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
        "R(ACE)",
        "B(ACE)",
        "B",
        "R",
      ];

  const [characters, setCharacters] = useState<Character[]>([]);
  const [wengines, setWengines] = useState<WEngine[]>([]);
  const [draftPicks, setDraftPicks] = useState<(DraftPick | null)[]>(
    Array(draftSequence.length).fill(null)
  );
  const [currentTurn, setCurrentTurn] = useState(0);
  const [, setError] = useState<string | null>(null);

  const [eidolonOpenIndex, setEidolonOpenIndex] = useState<number | null>(null);
  const [superOpenIndex, setSuperOpenIndex] = useState<number | null>(null);

  const [showWengineModal, setShowWengineModal] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [selectedWengineId, setSelectedWengineId] = useState<string>("");
  const [wengineSearch, setWengineSearch] = useState("");
  const [keyboardSearch, setKeyboardSearch] = useState("");

  const [blueScores, setBlueScores] = useState<number[]>(
    is3v3 ? [0, 0, 0] : [0, 0]
  );
  const [redScores, setRedScores] = useState<number[]>(
    is3v3 ? [0, 0, 0] : [0, 0]
  );

  // per-side locks after draft complete
  const [blueLocked, setBlueLocked] = useState<boolean>(false);
  const [redLocked, setRedLocked] = useState<boolean>(false);

  const [hydrated, setHydrated] = useState(false);
  const pendingServerStateRef = useRef<SpectatorState | null>(null);

  // DB timing for "LIVE" status (no keepalive)
  const [createdAtMs, setCreatedAtMs] = useState<number | null>(null);
  const [finishedFromServer, setFinishedFromServer] = useState<boolean>(false);

  // derived "live": created < 2h ago AND not finished
  const isLive =
    !!createdAtMs &&
    !finishedFromServer &&
    Date.now() - createdAtMs < 2 * 60 * 60 * 1000; // 2 hours

  const draftComplete = currentTurn >= draftSequence.length;

  // Player labels (derive from stateful names)
  const nPlayers = is3v3 ? 3 : 2;
  const rawTeam1List = (team1Name || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const rawTeam2List = (team2Name || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  function buildNameLabels(rawList: string[], count: number): string[] {
    const primary = rawList.find(Boolean) || "";
    return Array(count)
      .fill("")
      .map((_, i) => rawList[i] || primary);
  }

  const blueLabels = buildNameLabels(rawTeam1List, nPlayers);
  const redLabels = buildNameLabels(rawTeam2List, nPlayers);

  /* Completion + lock */
  const allScoresFilled = (arr: number[]) => arr.every((v) => v > 0);
  const [uiLocked, setUiLocked] = useState(false); // controls read-only UI for scoring/finalize
  const canFinalize =
    draftComplete && allScoresFilled(blueScores) && allScoresFilled(redScores);
  const isComplete = draftComplete && uiLocked;

  // Build state payload (owner PUT)
  const collectSpectatorState = (): SpectatorState => ({
    draftSequence,
    currentTurn,
    picks: draftPicks.map((p) =>
      p
        ? {
            characterCode: p.character.code,
            eidolon: p.eidolon,
            wengineId: p.wengine?.id ?? null,
            superimpose: p.superimpose,
          }
        : null
    ),
    blueScores,
    redScores,
    blueLocked,
    redLocked,
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
      const w = wengines.find((x) => String(x.id) === String(f.id));
      return {
        name: w?.name ?? f.name ?? (f.id ? String(f.id) : "Unknown"),
        image_url: w?.image_url ?? f.image_url ?? "",
      };
    }
  };

  // ⬇️ replace the beginning of renderFeaturedPill with this
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

    const meta = resolveFeaturedMeta(f); // ✅ get name & image from catalogs
    const title = meta.name;
    const img = meta.image_url;

    return (
      <div
        key={f.kind === "character" ? f.code : `we-${f.id}`}
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
        onClick={() => setShowFeaturedPopup(true)} // whole pill opens modal
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

  /* ───────────── Session: auto-create on page load (Owner only) ───────────── */
  const [creating, setCreating] = useState(false);

  const generateSpectatorSession = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const payload = {
        team1: team1Name,
        team2: team2Name,
        mode,
        featured: featuredList,
        state: collectSpectatorState(),
      };
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/api/zzz/sessions`,
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
      sessionStorage.setItem("zzzSpectatorKey", data.key);

      if (data.blueToken) {
        setBlueToken(data.blueToken);
        sessionStorage.setItem("zzzBlueToken", data.blueToken);
      }
      if (data.redToken) {
        setRedToken(data.redToken);
        sessionStorage.setItem("zzzRedToken", data.redToken);
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

    const fromSSBlue = sessionStorage.getItem("zzzBlueToken");
    const fromSSRed = sessionStorage.getItem("zzzRedToken");
    if (fromSSBlue || fromSSRed) {
      if (fromSSBlue) setBlueToken(fromSSBlue);
      if (fromSSRed) setRedToken(fromSSRed);
      return;
    }

    (async () => {
      try {
        const r = await fetch(
          `${import.meta.env.VITE_API_BASE}/api/zzz/sessions/open`,
          { credentials: "include" }
        );
        if (!r.ok) return;
        const d = await r.json();
        if (d?.blueToken) {
          setBlueToken(d.blueToken);
          sessionStorage.setItem("zzzBlueToken", d.blueToken);
        }
        if (d?.redToken) {
          setRedToken(d.redToken);
          sessionStorage.setItem("zzzRedToken", d.redToken);
        }
        if (d?.key && !spectatorKey) {
          setSpectatorKey(d.key);
          sessionStorage.setItem("zzzSpectatorKey", d.key);
        }
      } catch {}
    })();
  }, [blueToken, redToken, spectatorKey]);

  // Owner auto-create (skip if we already have a key or URL carries a key)
  useEffect(() => {
    if (!user) return;
    if (spectatorKey) return; // have a key (maybe from URL)
    if (keyFromUrl) return; // URL join, don't create

    const storedKey = sessionStorage.getItem("zzzSpectatorKey");
    if (storedKey) {
      setSpectatorKey(storedKey);
      return;
    }

    if (sessionStorage.getItem(CREATE_LOCK_KEY)) return;

    sessionStorage.setItem(CREATE_LOCK_KEY, "1");
    (async () => {
      try {
        await generateSpectatorSession(); // POST creates exactly one session
      } finally {
        sessionStorage.removeItem(CREATE_LOCK_KEY);
      }
    })();
  }, [user, spectatorKey, keyFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // If user logs out mid-session, clear local key
  useEffect(() => {
    if (!user && spectatorKey) {
      sessionStorage.removeItem("zzzSpectatorKey");
      setSpectatorKey(null);
    }
  }, [user]); // eslint-disable-next-line

  /* ───────────── Derived helpers ───────────── */
  const bannedCodes = draftPicks
    .map((pick, i) =>
      draftSequence[i] === "BB" || draftSequence[i] === "RR"
        ? pick?.character.code
        : null
    )
    .filter((c): c is string => !!c);

  // Add featured global bans (but never consider a globalPick as banned)
  const effectiveBanned = new Set([
    ...bannedCodes.filter((c) => !featuredGlobalPick.has(c)),
    ...Array.from(featuredGlobalBan).filter((c) => !featuredGlobalPick.has(c)),
  ]);

  const lastPayloadRef = useRef<string>("");

  // Save trigger: increments when we want to persist to DB
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

  /* ───────────── SSE: subscribe like spectator (owner + players) ───────────── */

  const esRef = useRef<EventSource | null>(null);

  const ignoreSseUntilRef = useRef<number>(0);
  const expectedTurnRef = useRef<number | null>(null);
  const expectedModeRef = useRef<"ge" | "le" | "eq" | null>(null);

  const bumpIgnoreSse = (
    expectedTurn?: number,
    mode: "ge" | "le" | "eq" = "ge"
  ) => {
    ignoreSseUntilRef.current = Date.now() + 1200; // was 800
    expectedTurnRef.current = expectedTurn ?? null;
    expectedModeRef.current = expectedTurn != null ? mode : null;
  };

  // owner convenience
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
      const wengine =
        p.wengineId != null
          ? wengines.find((w) => String(w.id) === String(p.wengineId))
          : undefined;
      return {
        character,
        eidolon: p.eidolon,
        wengine,
        superimpose: p.superimpose,
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
    };
  };

  useEffect(() => {
    if (!spectatorKey) return;

    esRef.current?.close();
    const url = `${
      import.meta.env.VITE_API_BASE
    }/api/zzz/sessions/${spectatorKey}/stream`;
    const es = new EventSource(url);

    const handleSnapshotOrUpdate = (payload: any) => {
      // Pick up DB timestamps / completion for "live" without polling
      if (payload?.createdAt || payload?.created_at) {
        const ts = new Date(payload.createdAt || payload.created_at).getTime();
        if (!Number.isNaN(ts)) setCreatedAtMs(ts);
      }

      // Prefer explicit isComplete; otherwise infer from completedAt if present
      if (typeof payload?.isComplete === "boolean") {
        setFinishedFromServer(payload.isComplete);
      } else if (payload?.completedAt || payload?.completed_at) {
        setFinishedFromServer(true);
      }

      // sync mode/team names from server truth
      if (payload?.mode === "2v2" || payload?.mode === "3v3") {
        setMode(payload.mode);
      }

      if (typeof payload?.team1 === "string") setTeam1Name(payload.team1);
      if (typeof payload?.team2 === "string") setTeam2Name(payload.team2);

      // right after syncing mode/team names
      if (Array.isArray(payload?.featured)) {
        setFeaturedList(normalizeFeatured(payload.featured));
      }

      try {
        sessionStorage.setItem(
          "zzzDraftInit",
          JSON.stringify({
            team1: payload.team1,
            team2: payload.team2,
            mode: payload.mode,
            featured: Array.isArray(payload?.featured)
              ? payload.featured
              : featuredList,
          })
        );
      } catch {}

      const serverState: SpectatorState | undefined = payload?.state;
      if (!serverState) return;

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
          // accept & clear expectation
          expectedTurnRef.current = null;
          expectedModeRef.current = null;
        } else {
          // fallback: drop echoes that don't move the turn
          if (serverState.currentTurn === currentTurn) return;
        }
      }

      // If characters/wengines not loaded yet, store and wait
      if (characters.length === 0 || wengines.length === 0) {
        pendingServerStateRef.current = serverState;
        return;
      }

      // map + set (LIVE lock visibility stays in sync here)
      const mapped = mapServerStateToLocal(serverState);
      setDraftPicks(mapped.picks);
      setCurrentTurn(mapped.currentTurn);
      setBlueScores(mapped.blueScores);
      setRedScores(mapped.redScores);
      setBlueLocked(mapped.blueLocked);
      setRedLocked(mapped.redLocked);
      setHydrated(true);

      if (
        !Array.isArray(payload?.featured) &&
        featuredList.length === 0 &&
        spectatorKey
      ) {
        fetch(
          `${import.meta.env.VITE_API_BASE}/api/zzz/sessions/${spectatorKey}`
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d && Array.isArray(d.featured)) setFeaturedList(d.featured);
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
      // let browser handle reconnects
    };

    esRef.current = es;
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spectatorKey, characters, wengines, currentTurn]);

  /* ───────────── Fallback initial GET (in case SSE races) ───────────── */
  useEffect(() => {
    if (!spectatorKey) return;
    // run GET if we aren't hydrated OR we don't have featured yet
    if (hydrated && featuredList.length > 0) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/api/zzz/sessions/${spectatorKey}`,
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

        if (data?.mode === "2v2" || data?.mode === "3v3") setMode(data.mode);
        if (typeof data?.team1 === "string") setTeam1Name(data.team1);
        if (typeof data?.team2 === "string") setTeam2Name(data.team2);

        // hydrate featured even if SSE missed it
        if (Array.isArray(data?.featured)) {
          setFeaturedList(normalizeFeatured(data.featured));
        }

        // Capture DB timing/completion for "live"
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
            "zzzDraftInit",
            JSON.stringify({
              team1: data.team1,
              team2: data.team2,
              mode: data.mode,
              featured: Array.isArray(data?.featured)
                ? data.featured
                : featuredList,
            })
          );
        } catch {}
        if (data?.state)
          pendingServerStateRef.current = data.state as SpectatorState;
      } catch {}
    })();
    return () => ctrl.abort();
  }, [spectatorKey, hydrated, featuredList.length]);

  /* ───────────── Autosave PUTs (OWNER ONLY) ───────────── */
  useEffect(() => {
    if (!user || !spectatorKey || isPlayerClient) return;
    if (!hydrated) return; // don't overwrite server with empty local state

    const payload = JSON.stringify({
      featured: featuredList,
      state: collectSpectatorState(),
      isComplete: isComplete || undefined,
    });

    if (payload === lastPayloadRef.current) return; // nothing changed
    lastPayloadRef.current = payload;

    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/api/zzz/sessions/${spectatorKey}`,
          {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: payload,
            signal: ctrl.signal,
          }
        );

        if (res.ok) {
          writeLocalSnapshot(spectatorKey, collectSpectatorState());
        }

        if (res.status === 401 || res.status === 403 || res.status === 404) {
          sessionStorage.removeItem("zzzSpectatorKey");
          setSpectatorKey(null);
        }
      } catch (e) {
        console.warn("spectator PUT failed", e);
      }
    })();

    return () => ctrl.abort();
    // ✅ only run when saveSeq increments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSeq]);

  /* Row refs + scales */
  const blueRowRef = useRef<HTMLDivElement>(null);
  const redRowRef = useRef<HTMLDivElement>(null);
  const blueCount = draftSequence.filter((s) => s.startsWith("B")).length;
  const redCount = draftSequence.filter((s) => s.startsWith("R")).length;
  const blueScale = useRowScale(blueRowRef, blueCount);
  const redScale = useRowScale(redRowRef, redCount);

  function getSlotCost(pick: DraftPick | null | undefined) {
    if (!pick) return { agentCost: 0, weCost: 0, total: 0 };

    // ——— Character cost: base at M0 (override if set) + delta(Mx - M0)
    const normalAtM0 = calcAgentCost(pick.character, 0);
    const normalAtMx = calcAgentCost(pick.character, pick.eidolon);
    const mDelta = Number((normalAtMx - normalAtM0).toFixed(2));

    const featuredBaseChar =
      typeof featuredCostOverride.get(pick.character.code) === "number"
        ? (featuredCostOverride.get(pick.character.code) as number)
        : normalAtM0;

    const agentCost = Number((featuredBaseChar + mDelta).toFixed(2));

    // ——— W-Engine cost: base at P1 (override if set) + delta(Px - P1)
    let weCost = 0;
    if (pick.wengine) {
      const normalAtP1 = calcWEngineCost(pick.wengine, 1);
      const normalAtPx = calcWEngineCost(pick.wengine, pick.superimpose);
      const pDelta = Number((normalAtPx - normalAtP1).toFixed(2));

      const weOverride =
        pick.wengine.id != null
          ? featuredWeCostOverride.get(String(pick.wengine.id))
          : undefined;

      const featuredBaseWE =
        typeof weOverride === "number" ? weOverride : normalAtP1;

      weCost = Number((featuredBaseWE + pDelta).toFixed(2));
    }

    const total = Number((agentCost + weCost).toFixed(2));
    return { agentCost, weCost, total };
  }


  /* ───────────── Data Fetch (characters & W-engines) ───────────── */
  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/characters`, {
        credentials: "include",
      }),
      fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/wengines`, {
        credentials: "include",
      }),
    ])
      .then(async ([charRes, wengRes]) => {
        const charData = await charRes.json();
        const wengData = await wengRes.json();
        if (!charRes.ok || !wengRes.ok) throw new Error("Failed to fetch data");
        setCharacters((charData.data || []) as Character[]);
        setWengines((wengData.data || []) as WEngine[]);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load data");
      });
  }, []);

  // Apply any pending server state once data is loaded
  useEffect(() => {
    if (hydrated) return;
    const pending = pendingServerStateRef.current;
    if (!pending) return;
    if (characters.length === 0 || wengines.length === 0) return;

    const mappedPicks: (DraftPick | null)[] = pending.picks.map((p) => {
      if (!p) return null;
      const character = characters.find((c) => c.code === p.characterCode);
      if (!character) return null;
      const wengine =
        p.wengineId != null
          ? wengines.find((w) => String(w.id) === String(p.wengineId))
          : undefined;

      return {
        character,
        eidolon: p.eidolon,
        wengine,
        superimpose: p.superimpose,
      };
    });

    setDraftPicks(mappedPicks);
    setCurrentTurn(
      Math.max(0, Math.min(pending.draftSequence.length, pending.currentTurn))
    );

    if (Array.isArray(pending.blueScores) && pending.blueScores.length)
      setBlueScores(pending.blueScores);
    if (Array.isArray(pending.redScores) && pending.redScores.length)
      setRedScores(pending.redScores);

    setBlueLocked(!!pending.blueLocked);
    setRedLocked(!!pending.redLocked);

    pendingServerStateRef.current = null;
    setHydrated(true);
  }, [characters, wengines, hydrated]);

  /* ───────────── Click-outside sliders ───────────── */
  const eidolonRefs = useRef<(HTMLDivElement | null)[]>([]);
  const superimposeRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      const bootstrapModal = document.querySelector(".modal-content");
      if (bootstrapModal && bootstrapModal.contains(target)) return;

      if (
        superOpenIndex !== null &&
        superimposeRefs.current[superOpenIndex] &&
        !superimposeRefs.current[superOpenIndex]!.contains(target)
      ) {
        setSuperOpenIndex(null);
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
  }, [superOpenIndex, eidolonOpenIndex]);

  /* ───────────── Player gating helpers ───────────── */
  const isPlayer = isPlayerClient && (playerSide === "B" || playerSide === "R");
  const isMyTurn = (() => {
    if (!isPlayer) return false;
    const step = draftSequence[currentTurn] || "";
    const side = step.startsWith("B") ? "B" : step.startsWith("R") ? "R" : "";
    return side === playerSide;
  })();

  async function postPlayerAction(action: any) {
    if (!spectatorKey || !playerToken) return;
    try {
      const res = await fetch(
        `${
          import.meta.env.VITE_API_BASE
        }/api/zzz/sessions/${spectatorKey}/actions`,
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
      }
    } catch (e) {
      console.warn("player action network error", e);
    }
  }

  useEffect(() => {
    // only warn for owner-ish flow (not player link joins)
    if (!user && !isPlayer && cameFromStart) {
      toast.warning("You are not logged in — this match will NOT be recorded.");
    }
  }, [user, isPlayer, cameFromStart]);

  /* ───────────── Draft Side Lock helpers ───────────── */
  const sideOfIndex = (index: number) =>
    draftSequence[index]?.startsWith("B") ? "B" : "R";

  const isSideLocked = (side: "B" | "R") =>
    side === "B" ? blueLocked : redLocked;

  const toggleSideLock = (side: "B" | "R", nextLocked: boolean) => {
    // Player: can LOCK only; cannot UNLOCK (owner only)
    if (isPlayer) {
      if (playerSide !== side) return;
      if (!nextLocked) return; // block unlock on player client
      // 🟦 OPTIMISTIC: update immediately
      if (side === "B") setBlueLocked(true);
      else setRedLocked(true);
      bumpIgnoreSse();
      postPlayerAction({ op: "setLock", side, locked: true });
      return;
    }
    // Owner: toggle locally; autosave will persist
    if (side === "B") setBlueLocked(nextLocked);
    else setRedLocked(nextLocked);
    requestSave(0);
  };

  const handleCharacterPick = (char: Character) => {
    if (uiLocked || draftComplete) return;

    const currentStep = draftSequence[currentTurn];
    if (!currentStep) return;

    const mySideNow = currentStep.startsWith("B") ? "B" : "R";
    const isBanSlot = currentStep === "BB" || currentStep === "RR";

    // Cannot ban a global-pick
    if (isBanSlot && featuredGlobalPick.has(char.code)) return;

    // Common validations (respect featured rules)
    if (effectiveBanned.has(char.code)) return;

    // ───── Player flow ─────
    if (isPlayer) {
      if (mySideNow !== playerSide) return;

      // 🟦 OPTIMISTIC local apply
      setDraftPicks((prev) => {
        const updated = [...prev];
        updated[currentTurn] = { character: char, eidolon: 0, superimpose: 1 };
        return updated;
      });
      setCurrentTurn((t) => t + 1);
      setKeyboardSearch("");
      bumpIgnoreSse(currentTurn + 1, "ge");

      // Persist to server (ban vs pick)
      postPlayerAction({
        op: isBanSlot ? "ban" : "pick",
        side: playerSide,
        index: currentTurn,
        characterCode: char.code,
      });
      return;
    }

    // ───── Owner flow ─────
    const mySide = mySideNow;

    // prevent duplicate per team
    const myTeamPicks = draftPicks.filter((_, i) =>
      draftSequence[i].startsWith(mySide)
    );
    const alreadyPickedByMyTeam = myTeamPicks.some(
      (p) => p?.character.code === char.code
    );

    if (!isBanSlot) {
      if (alreadyPickedByMyTeam) return; // one per team

      if (!featuredGlobalPick.has(char.code)) {
        // Normal rule: can’t take opponent’s pick unless ACE
        const opponentSide = mySide === "B" ? "R" : "B";
        const opponentHas = draftPicks
          .filter((_, i) => draftSequence[i].startsWith(opponentSide))
          .some((p) => p?.character.code === char.code);
        const isAce = currentStep.includes("ACE");
        if (opponentHas && !isAce) return;
      }
    }

    // ✅ Actually write the pick/ban locally and advance turn
    setDraftPicks((prev) => {
      const updated = [...prev];
      updated[currentTurn] = { character: char, eidolon: 0, superimpose: 1 };
      return updated;
    });
    setCurrentTurn((prev) => prev + 1);
    setKeyboardSearch("");

    // persist via owner autosave
    ownerOptimisticSave(0, currentTurn + 1, "ge");
  };

  const handleUndo = () => {
    if (currentTurn === 0) return;

    const lastIdx = currentTurn - 1;
    const lastTok = draftSequence[lastIdx];
    const lastSide = sideOfToken(lastTok);

    // OWNER flow
    if (!isPlayer) {
      // prevent undo if any side is locked or UI is locked
      if (uiLocked || blueLocked || redLocked) return;

      // optimistic revert
      setDraftPicks((prev) => {
        const next = [...prev];
        next[lastIdx] = null;
        return next;
      });
      setCurrentTurn(lastIdx);

      // stop SSE echo flicker, then persist
      ownerOptimisticSave(0, lastIdx, "le");
      return;
    }

    // PLAYER flow
    // must be my side’s last pick, not locked, and draft not complete
    if (draftComplete) return;
    if (playerSide !== lastSide) return;
    if (sideLocked(playerSide)) return;

    // optimistic revert
    setDraftPicks((prev) => {
      const next = [...prev];
      next[lastIdx] = null;
      return next;
    });
    setCurrentTurn(lastIdx);
    bumpIgnoreSse(currentTurn - 1, "le");

    // send undo to server (include index for compatibility)
    postPlayerAction({
      op: "undoLast",
      side: playerSide,
      index: lastIdx, // safe both for old (requires index) and new (ignores it)
    });
  };

  const slotIsBan = (i: number) =>
    draftSequence[i] === "BB" || draftSequence[i] === "RR";
  const sideOfToken = (tok: string) =>
    tok?.startsWith("B") ? "B" : tok?.startsWith("R") ? "R" : "";
  const sideLocked = (side: "B" | "R") =>
    side === "B" ? blueLocked : redLocked;

  const updateEidolon = (index: number, eidolon: number) => {
    if (uiLocked) return;
    if (!draftPicks[index] || slotIsBan(index)) return;

    const side = sideOfIndex(index);
    // allow after draft only if that side is not locked
    if (draftComplete && isSideLocked(side)) return;

    if (isPlayer) {
      if (side !== playerSide) return;

      // 🟦 OPTIMISTIC
      setDraftPicks((prev) => {
        const updated = [...prev];
        if (updated[index]) updated[index] = { ...updated[index]!, eidolon };
        return updated;
      });
      bumpIgnoreSse();

      postPlayerAction({
        op: "setMindscape",
        side: playerSide,
        index,
        eidolon,
      });
      return;
    }

    // owner local change
    const updated = [...draftPicks];
    updated[index] = { ...updated[index]!, eidolon };
    setDraftPicks(updated);
    requestSave(250);

    ownerOptimisticSave(150);
  };

  const isSignatureWengine = (weng: WEngine, char: Character | undefined) => {
    if (!char) return false;
    const wengSub = weng.subname?.toLowerCase() || "";
    const charName = char.name.toLowerCase();
    return wengSub === charName;
  };

  const openWengineModal = (index: number) => {
    if (uiLocked) return;
    if (slotIsBan(index)) return;
    if (!draftPicks[index]) return; // need a character first

    const side = sideOfIndex(index);
    if (draftComplete && isSideLocked(side)) return; // locked post-draft

    // players may open modal on any of their own team’s picked slots
    if (isPlayer && side !== playerSide) return;

    const currentConeId = draftPicks[index]?.wengine?.id || "";
    setSelectedWengineId(currentConeId);
    setActiveSlotIndex(index);
    setShowWengineModal(true);
  };

  const confirmWengine = (index: number) => {
    const side = sideOfIndex(index);
    if (uiLocked) {
      setShowWengineModal(false);
      return;
    }
    if (slotIsBan(index) || !draftPicks[index]) {
      setShowWengineModal(false);
      return;
    }
    if (draftComplete && isSideLocked(side)) {
      setShowWengineModal(false);
      return;
    }

    const selected =
      selectedWengineId === ""
        ? null
        : wengines.find((w) => String(w.id) === String(selectedWengineId))
            ?.id ?? null;

    // ❌ If globally banned, block immediately (no optimistic update, no POST)
    if (selected !== null && wengineGlobalBan.has(String(selected))) {
      toast.error("That W-Engine is universally banned.");
      setShowWengineModal(false);
      setTimeout(() => setActiveSlotIndex(null), 100);
      setSelectedWengineId("");
      setWengineSearch("");
      return;
    }


    if (isPlayer) {
      if (side !== playerSide) {
        setShowWengineModal(false);
        return;
      }

      // 🟦 OPTIMISTIC
      setDraftPicks((prev) => {
        const updated = [...prev];
        if (updated[index]) {
          if (selected === null) {
            const { wengine, ...rest } = updated[index]!;
            updated[index] = { ...rest, wengine: undefined };
          } else {
            const weObj = wengines.find(
              (w) => String(w.id) === String(selected)
            );
            updated[index] = {
              ...updated[index]!,
              wengine: weObj ?? undefined,
            };
          }
        }
        return updated;
      });
      bumpIgnoreSse();

      postPlayerAction({
        op: "setWengine",
        side: playerSide,
        index,
        wengineId: selected,
      });

      setShowWengineModal(false);
      setTimeout(() => setActiveSlotIndex(null), 100);
      setSelectedWengineId("");
      setWengineSearch("");
      return;
    }

    // owner local change
    setDraftPicks((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        if (selected === null) {
          const { wengine, ...rest } = updated[index]!;
          updated[index] = { ...rest, wengine: undefined };
        } else {
          const weObj = wengines.find((w) => String(w.id) === String(selected));
          updated[index] = { ...updated[index]!, wengine: weObj ?? undefined };
        }
      }
      return updated;
    });

    setShowWengineModal(false);
    setTimeout(() => setActiveSlotIndex(null), 100);
    setSelectedWengineId("");
    setWengineSearch("");
    ownerOptimisticSave(150);
  };

  const updateSuperimpose = (index: number, superimpose: number) => {
    if (uiLocked) return;
    if (!draftPicks[index] || slotIsBan(index)) return;

    const side = sideOfIndex(index);
    if (draftComplete && isSideLocked(side)) return;

    if (isPlayer) {
      if (side !== playerSide) return;

      // 🟦 OPTIMISTIC
      setDraftPicks((prev) => {
        const updated = [...prev];
        if (updated[index])
          updated[index] = { ...updated[index]!, superimpose };
        return updated;
      });
      bumpIgnoreSse();

      postPlayerAction({
        op: "setSuperimpose",
        side: playerSide,
        index,
        superimpose,
      });
      return;
    }

    const updated = [...draftPicks];
    updated[index] = { ...updated[index]!, superimpose };
    setDraftPicks(updated);

    ownerOptimisticSave(150);
  };

  /* For signature sort hinting */
  const subnameToCharacterName = new Map<string, string>();
  characters.forEach((char) => {
    if (char.subname) {
      subnameToCharacterName.set(char.subname.toLowerCase(), char.name);
    }
  });

  /* ───────────── Team Cost using new rules ───────────── */
  const getTeamCost = (prefix: "B" | "R") => {
    let total = 0;
    for (let i = 0; i < draftSequence.length; i++) {
      if (!draftSequence[i].startsWith(prefix)) continue;
      if (slotIsBan(i)) continue;
      const pick = draftPicks[i];
      if (!pick) continue;

      const { total: slotTotal } = getSlotCost(pick);
      total += slotTotal;
    }
    const penalty = Math.max(0, total - COST_LIMIT);
    const penaltyPoints = Math.floor(penalty / 0.25) * PENALTY_PER_POINT;
    return { total: Number(total.toFixed(2)), penaltyPoints };
  };

  /* ───────────── Share / Invite modal ───────────── */
  const [showShareModal, setShowShareModal] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const spectatorUrl = spectatorKey ? `${origin}/zzz/s/${spectatorKey}` : "";

  const bluePlayerUrl =
    spectatorKey && blueToken
      ? `${origin}/zzz/draft?key=${encodeURIComponent(
          spectatorKey
        )}&pt=${encodeURIComponent(blueToken)}`
      : "";

  const redPlayerUrl =
    spectatorKey && redToken
      ? `${origin}/zzz/draft?key=${encodeURIComponent(
          spectatorKey
        )}&pt=${encodeURIComponent(redToken)}`
      : "";

  if (isMobile || !cameFromStart) return null;

  /* ───────────── Render ───────────── */
  const scoresLocked = uiLocked || isPlayer; // players can't edit scores

  return (
    <div
      className="page-fade-in"
      style={{
        backgroundImage: "url('/zzzdraft.webp')",
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
        {/* Draft Box */}
        <div className="d-flex flex-column align-items-center gap-3 mb-4">
          {(() => {
            const team1Cost = getTeamCost("B");
            const team2Cost = getTeamCost("R");

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
            ].map(({ prefix, name, color, cost, ref, scale, locked }) => (
              <div className="w-100 text-center" key={prefix}>
                <div className="team-header">
                  <div className="team-title" style={{ color }}>
                    <span
                      className="team-dot"
                      style={{ backgroundColor: color }}
                    />
                    {name}

                    {/* keep LIVE tag (pre-draft) */}
                    {isLive && !draftComplete && (
                      <span className="badge bg-danger ms-2">LIVE</span>
                    )}

                    {/* inline lock controls once draft is complete */}
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
                            {/* Owner only unlocks */}
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
                            {/* Owner sees all lock buttons */}
                            {!isPlayer && (
                              <button
                                className="btn back-button-glass ms-2"
                                onClick={() => toggleSideLock(prefix, true)}
                                title="Lock this team's draft"
                              >
                                🔒 Lock
                              </button>
                            )}

                            {/* Player sees only their own team button */}
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

                  <div
                    className={`team-cost ${
                      cost.total > COST_LIMIT ? "over" : ""
                    }`}
                  >
                    Cost: {cost.total} / {COST_LIMIT}
                  </div>
                </div>

                {/* measured wrapper */}
                <div ref={ref} className="draft-row-wrap">
                  {/* scaled row */}
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
                    {draftSequence.map((side, i) =>
                      side.startsWith(prefix) ? (
                        <div
                          key={i}
                          className={[
                            "draft-card",
                            side.includes("ACE") ? "ace" : "",
                            side === "BB" || side === "RR" ? "ban" : "",
                            prefix === "B" ? "blue" : "red",
                            i === currentTurn && !draftComplete ? "active" : "",
                          ].join(" ")}
                          style={{
                            zIndex: 10,
                            // If draft is complete and this side is locked, freeze this slot
                            pointerEvents:
                              draftComplete && locked ? "none" : "auto",
                            opacity: draftComplete && locked ? 0.8 : 1,
                            position: "relative",
                          }}
                          onClick={(e) => {
                            if (uiLocked) return;
                            const isBanSlot = side === "BB" || side === "RR";
                            if (isBanSlot) return;

                            // If post-draft and side is locked, no edits
                            if (draftComplete && locked) return;

                            // Players can open W-Engine modal on ANY of their own team’s picked slots
                            if (isPlayer && prefix !== playerSide) return;

                            if (
                              eidolonOpenIndex === i ||
                              superOpenIndex === i
                            ) {
                              e.stopPropagation();
                              return;
                            }
                            if (draftPicks[i]?.character) openWengineModal(i);
                          }}
                        >
                          {/* Lock badge after draft */}
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

                          {/* Ribbon (only when empty) */}
                          {(() => {
                            const isBanSlot = side === "BB" || side === "RR";
                            const isAceSlot = side.includes("ACE");
                            const showRibbon =
                              !draftPicks[i] && (isBanSlot || isAceSlot);
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
                                    side === "BB" || side === "RR"
                                      ? "grayscale(100%) brightness(0.5)"
                                      : "none",
                                }}
                              />

                              {/* Engine badge */}
                              {draftPicks[i]?.wengine && (
                                <img
                                  src={draftPicks[i]!.wengine!.image_url}
                                  alt={draftPicks[i]!.wengine!.name}
                                  title={draftPicks[i]!.wengine!.name}
                                  className="engine-badge"
                                  onClick={(e) => {
                                    if (uiLocked) return;
                                    if (draftComplete && locked) return;
                                    if (isPlayer && prefix !== playerSide)
                                      return;
                                    e.stopPropagation();
                                    openWengineModal(i);
                                  }}
                                />
                              )}

                              {/* Mindscape slider */}
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
                                      Mindscape
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
                                            (e.target as HTMLInputElement).value
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

                              {/* Superimpose slider */}
                              {superOpenIndex === i &&
                                !uiLocked &&
                                !(draftComplete && locked) && (
                                  <div
                                    className="slider-panel"
                                    ref={(el) => {
                                      superimposeRefs.current[i] = el;
                                    }}
                                    style={{ bottom: 70 }}
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                  >
                                    <div className="slider-label">Phase</div>
                                    <input
                                      type="range"
                                      min={1}
                                      max={5}
                                      className="big-slider"
                                      value={draftPicks[i]!.superimpose}
                                      onChange={(e) =>
                                        updateSuperimpose(
                                          i,
                                          parseInt(
                                            (e.target as HTMLInputElement).value
                                          )
                                        )
                                      }
                                    />
                                    <div className="slider-ticks mt-1">
                                      {[1, 2, 3, 4, 5].map((v) => (
                                        <span
                                          key={v}
                                          className={
                                            draftPicks[i]!.superimpose === v
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

                              {/* Bottom info */}
                              {(() => {
                                const c = getSlotCost(draftPicks[i]);
                                const name = draftPicks[i]!.character.name;
                                const bannedSlot =
                                  side === "BB" || side === "RR";
                                const hasWengine = !!draftPicks[i]?.wengine;

                                return (
                                  <div
                                    className="info-bar"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="char-name" title={name}>
                                      {name}
                                    </div>

                                    {!bannedSlot && (
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
                                              : "Set Mindscape"
                                          }
                                          onClick={(e) => {
                                            if (uiLocked) return;
                                            if (draftComplete && locked) return;
                                            if (
                                              isPlayer &&
                                              prefix !== playerSide
                                            )
                                              return;
                                            e.stopPropagation();
                                            setSuperOpenIndex(null);
                                            setEidolonOpenIndex(
                                              eidolonOpenIndex === i ? null : i
                                            );
                                          }}
                                        >
                                          M{draftPicks[i]!.eidolon}
                                        </span>

                                        <span
                                          className="chip cost chip-center"
                                          title={`Agent ${c.agentCost} + W-Eng ${c.weCost}`}
                                        >
                                          {c.total}
                                        </span>

                                        {hasWengine ? (
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
                                                : "Set Phase"
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
                                              setSuperOpenIndex(
                                                superOpenIndex === i ? null : i
                                              );
                                            }}
                                          >
                                            P{draftPicks[i]!.superimpose}
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
            ));
          })()}
        </div>

        {/* ───────────── Featured (clickable section opens modal) ───────────── */}
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
              cursor: "pointer", // clickable area
            }}
            onClick={() => setShowFeaturedPopup(true)} // ✅ whole bar opens modal
          >
            {/* header */}
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
                Cost shown is the M0 (or WE) override if set. Rules still apply.
              </div>
            </div>

            {/* row */}
            <div
              className="d-flex align-items-center gap-2 flex-wrap"
              style={{ overflow: "hidden", whiteSpace: "nowrap" }}
            >
              {featuredList.map(renderFeaturedPill)}
            </div>
          </div>
        )}

        {/* Search Bar + Undo + Share */}
        <div className="mb-3 w-100 d-flex justify-content-center align-items-center gap-2 flex-wrap">
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

              if (!isPlayer) {
                // owner: only blocked by UI lock or any side lock
                return uiLocked || blueLocked || redLocked;
              }

              // player: only undo last move of *their* side, not locked, not complete
              if (draftComplete) return true;
              if (playerSide !== lastSide) return true;
              if (sideLocked(playerSide)) return true;

              return false;
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

          {/* OWNER ONLY */}
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

        {/* Character Grid (hidden when draft complete) */}
        {!draftComplete && (
          <div
            className="mb-5 px-2"
            style={{ maxWidth: "1000px", margin: "0 auto" }}
          >
            <div
              className="character-pool-scroll"
              style={{
                pointerEvents:
                  uiLocked || (isPlayer && !isMyTurn) ? "none" : "auto",
                opacity: uiLocked || (isPlayer && !isMyTurn) ? 0.6 : 1,
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
                    const opponentSide = mySide === "B" ? "R" : "B";

                    const myPicks = draftPicks.filter((_, i) =>
                      draftSequence[i]?.startsWith(mySide)
                    );
                    const opponentPicks = draftPicks.filter((_, i) =>
                      draftSequence[i]?.startsWith(opponentSide)
                    );

                    const alreadyPickedByMe = myPicks.some(
                      (p) => p?.character.code === char.code
                    );
                    const alreadyPickedByOpponent = opponentPicks.some(
                      (p) => p?.character.code === char.code
                    );

                    const isBanned = effectiveBanned.has(char.code);
                    const isAcePickStep = currentStep.includes("ACE");
                    const isOpponentPicked = alreadyPickedByOpponent;

                    const isBanSlot =
                      currentStep === "BB" || currentStep === "RR";

                    let isDisabled =
                      uiLocked ||
                      (isBanSlot && featuredGlobalPick.has(char.code)) || // cannot ban global-pick
                      isBanned;

                    // Picking rules
                    if (!isDisabled) {
                      if (featuredGlobalPick.has(char.code)) {
                        // Both teams can pick once per team, anytime (like ACE), still unique per team
                        if (alreadyPickedByMe) isDisabled = true;
                      } else {
                        // Normal rules: needs ACE to steal opponent’s pick
                        if (
                          !isAcePickStep &&
                          (alreadyPickedByMe || alreadyPickedByOpponent)
                        ) {
                          isDisabled = true;
                        }
                        if (isAcePickStep && alreadyPickedByMe) {
                          isDisabled = true; // still one copy per team
                        }
                      }
                    }

                    // Player turn gating (unchanged)
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
                          border:
                            isAcePickStep && isOpponentPicked
                              ? "2px solid gold"
                              : isBanned
                              ? "2px dashed #888"
                              : alreadyPickedByMe || alreadyPickedByOpponent
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
                const setScores = isBlue ? setBlueScores : setRedScores;
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

                const { total, penaltyPoints } = getTeamCost(side);
                const adjustedTotal =
                  scores.reduce((a, b) => a + b, 0) - penaltyPoints;

                return (
                  <div
                    key={side}
                    className={`score-card ${isBlue ? "blue" : "red"} w-100`}
                    style={{ opacity: scoresLocked ? 0.8 : 1 }}
                  >
                    <div className="score-header">
                      <div className="score-title">{label}</div>
                      <div
                        className={`score-draft ${
                          total > COST_LIMIT ? "over" : ""
                        }`}
                      >
                        Cost: {total} / {COST_LIMIT}
                      </div>
                    </div>

                    <div className="score-inputs">
                      {(is3v3 ? [0, 1, 2] : [0, 1]).map((i) => (
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
                            value={scores[i] === 0 ? "" : String(scores[i])}
                            onChange={(e) => {
                              if (scoresLocked) return;
                              const v = e.target.value;
                              const updated = [...scores];
                              if (v === "") {
                                updated[i] = 0;
                              } else {
                                const n = parseInt(v, 10) || 0;
                                updated[i] = Math.max(
                                  SCORE_MIN,
                                  Math.min(SCORE_MAX, n)
                                );
                              }
                              setScores(updated);
                            }}
                            onBlur={() => {
                              if (scoresLocked) return;
                              const updated = [...scores];
                              updated[i] = Math.max(
                                SCORE_MIN,
                                Math.min(SCORE_MAX, updated[i] || 0)
                              );
                              setScores(updated);
                              requestSave(0);
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="score-total">
                      <div className="score-total-label">Team Total</div>
                      <div className="score-total-value">
                        {scores.reduce((a, b) => a + b, 0)}
                        {penaltyPoints > 0 && (
                          <span className="score-penalty">
                            −{penaltyPoints} ={" "}
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

            {/* Finalize / Complete control (owner only) */}
            {!isPlayer && (
              <div className="text-center mt-3">
                <button
                  className="btn back-button-glass"
                  onClick={() => {
                    if (uiLocked) {
                      setUiLocked(false); // unlock to edit scores/draft (DB remains completed)
                    } else if (canFinalize) {
                      setUiLocked(true); // lock UI and flag as complete
                      requestSave(0);
                    }
                  }}
                  disabled={!uiLocked && !canFinalize}
                  title={
                    uiLocked
                      ? "Unlock to edit scores/draft"
                      : canFinalize
                      ? "Marks this match as complete and locks editing"
                      : "Enter all player scores to complete the match"
                  }
                >
                  {uiLocked ? "Unlock to Edit" : "Mark Match Complete"}
                </button>
              </div>
            )}

            {/* Winner banner */}
            <div className="text-center mt-4 text-white">
              {(() => {
                const blueTotal =
                  blueScores.reduce((a, b) => a + b, 0) -
                  getTeamCost("B").penaltyPoints;
                const redTotal =
                  redScores.reduce((a, b) => a + b, 0) -
                  getTeamCost("R").penaltyPoints;
                if (blueTotal > redTotal)
                  return (
                    <h4 style={{ color: "#3388ff" }}>🏆 {team1Name} Wins!</h4>
                  );
                if (redTotal > blueTotal)
                  return (
                    <h4 style={{ color: "#cc3333" }}>🏆 {team2Name} Wins!</h4>
                  );
                return <h4 className="text-warning">Draw!</h4>;
              })()}
            </div>
          </>
        )}

        {/* W-Engine Modal */}
        <Modal
          show={showWengineModal}
          onHide={() => setShowWengineModal(false)}
          centered
          contentClassName="custom-black-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>Select W-Engine</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <input
              type="text"
              className="form-control mb-2"
              placeholder="Search W-Engine..."
              value={wengineSearch}
              onChange={(e) => setWengineSearch(e.target.value)}
              disabled={uiLocked}
            />
            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              <ul className="list-group">
                <li
                  className={`list-group-item list-group-item-action ${
                    selectedWengineId === "" ? "active" : ""
                  }`}
                  onClick={() => !uiLocked && setSelectedWengineId("")}
                  style={{ cursor: uiLocked ? "not-allowed" : "pointer" }}
                >
                  None
                </li>
                {(() => {
                  const searchLower = wengineSearch.toLowerCase();
                  const activeChar =
                    activeSlotIndex !== null
                      ? draftPicks[activeSlotIndex]?.character
                      : undefined;
                  const activeCharName = activeChar?.name?.toLowerCase();
                  const activeCharSubname = activeChar?.subname?.toLowerCase();

                  const filteredWengines = wengines.filter((w: WEngine) => {
                    const name = w.name?.toLowerCase() || "";
                    const sub = w.subname?.toLowerCase() || "";
                    if (name.includes(searchLower) || sub.includes(searchLower))
                      return true;

                    // Signature search hint support
                    for (const [
                      subname,
                      charName,
                    ] of subnameToCharacterName.entries()) {
                      if (
                        subname.includes(searchLower) &&
                        (name.includes(charName.toLowerCase()) ||
                          sub.includes(charName.toLowerCase()))
                      ) {
                        return true;
                      }
                    }
                    return false;
                  });

                  // signature first
                  filteredWengines.sort((a: WEngine, b: WEngine) => {
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

                  return filteredWengines.map((w: WEngine) => {
                    const isSig =
                      !!activeChar && isSignatureWengine(w, activeChar);
                    const isBannedWE = wengineGlobalBan.has(String(w.id));

                    return (
                      <li
                        key={w.id}
                        className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center
        ${selectedWengineId === String(w.id) ? "active" : ""} ${
                          isBannedWE ? "disabled" : ""
                        }`}
                        onClick={() => {
                          if (uiLocked || isBannedWE) return; // 🔒 no selection if banned
                          setSelectedWengineId(String(w.id));
                        }}
                        style={{
                          cursor:
                            uiLocked || isBannedWE ? "not-allowed" : "pointer",
                          padding: "6px 10px",
                          gap: "10px",
                          opacity: uiLocked || isBannedWE ? 0.5 : 1,
                        }}
                        title={isBannedWE ? "Universally banned" : w.name}
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

                        {isBannedWE ? (
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
            <Button
              variant="secondary"
              onClick={() => setShowWengineModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (uiLocked) return;
                if (activeSlotIndex !== null) confirmWengine(activeSlotIndex);
              }}
              disabled={
                uiLocked ||
                (selectedWengineId !== "" &&
                  wengineGlobalBan.has(String(selectedWengineId)))
              }
            >
              Confirm
            </Button>
          </Modal.Footer>
        </Modal>
        {/* Featured: full list popup (landing-style tiles) */}
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
                const fk = f.kind === "character" ? f.code! : `we-${f.id!}`;
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

                const meta = resolveFeaturedMeta(f); // ✅ hydrate from catalogs

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

        {/* Share / Invite Modal (OWNER ONLY) */}
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
      </div>
    </div>
  );
}
