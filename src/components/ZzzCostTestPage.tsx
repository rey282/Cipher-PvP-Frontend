// src/pages/ZzzCostTestPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "react-bootstrap";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../components/Landing.css";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

/* ───────────── Types ───────────── */
interface ZzzCharacterInfo {
  code: string;
  name: string;
  subname: string;
  rarity: number;
  image_url: string;
  faction?: string;
  attribute?: string;
  specialty?: string;
}

interface ZzzCharacterCost {
  id: string; 
  name: string;
  costs: number[];
}

interface WEngine {
  id: string;
  name: string;
  costs: number[]; 
  imageUrl: string;
  subname?: string;
  rarity: number; 
}


interface TeamMember {
  characterId: string;
  characterInfo?: ZzzCharacterInfo;
  eidolon: number; 
  wengineId: string;
  wengineData?: WEngine;
  superimpose: number; 
}

type PresetSlot = {
  characterId: string;
  mindscape: number; 
  wengineId: string; 
  refinement: number; 
};

type TeamPreset = {
  id: string;
  name: string;
  description: string;
  updated_at: string;
  slots: PresetSlot[];
  expectedScore?: number | null;
  expectedCycle?: number | null; 
};

const TEAM_SIZE = 3;

export default function ZzzCostTestPage() {
  const { user } = useAuth();

  // Data
  const [charInfos, setCharInfos] = useState<ZzzCharacterInfo[]>([]);
  const uniqueCharInfos = useMemo(() => {
    const byCode = new Map<string, ZzzCharacterInfo>();
    for (const c of charInfos) {
      if (!byCode.has(c.code)) byCode.set(c.code, c);
    }
    return Array.from(byCode.values());
  }, [charInfos]);

  const [charCosts, setCharCosts] = useState<ZzzCharacterCost[]>([]);
  const [wengines, setWengines] = useState<WEngine[]>([]);

  // Team & UI
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Score: 1..65000 (ZZZ)
  const [score, setScore] = useState<number>(1);

  // W-Engine modal
  const [showModal, setShowModal] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [selectedWEngineId, setSelectedWEngineId] = useState<string>("");
  const [wengineSearch, setWengineSearch] = useState("");

  // Eidolon/Super popovers
  const [eidolonOpenIndex, setEidolonOpenIndex] = useState<number | null>(null);
  const [superOpenIndex, setSuperOpenIndex] = useState<number | null>(null);
  const eidolonRef = useRef<HTMLDivElement | null>(null);
  const superRef = useRef<HTMLDivElement | null>(null);
  const slotsRef = useRef<HTMLDivElement | null>(null);

  // Presets panel
  const [presets, setPresets] = useState<TeamPreset[]>([]);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [showPresetsPanel, setShowPresetsPanel] = useState(false);
  const [presetSearch, setPresetSearch] = useState("");

  // Export → Save Preset modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportName, setExportName] = useState("");
  const [exportDesc, setExportDesc] = useState("");
  const [exportScoreInput, setExportScoreInput] = useState<string>("");

  const presetsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const presetsPanelRef = useRef<HTMLDivElement | null>(null);

  const playerIdForPresets = user?.id;

  useEffect(() => {
    const panel = presetsPanelRef.current;
    if (!panel) return;

    if (showPresetsPanel) {
      panel.removeAttribute("inert");
      panel.removeAttribute("aria-hidden");
      setTimeout(() => {
        (
          panel.querySelector(
            '[aria-label="Close presets panel"]'
          ) as HTMLElement
        )?.focus();
      }, 0);
    } else {
      if (panel.contains(document.activeElement)) {
        presetsTriggerRef.current?.focus();
      }
      panel.setAttribute("aria-hidden", "true");
      panel.setAttribute("inert", "");
    }
  }, [showPresetsPanel]);

  // mobile/touch detection + body-unlock
  const isTouchDevice =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  const unlockBody = () => {
    if (!document.querySelector(".modal.show")) {
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("overflow");
    }
  };

  useEffect(() => {
    if (!showModal && !showExportModal) {
      const t = setTimeout(unlockBody, 0);
      return () => clearTimeout(t);
    }
  }, [showModal, showExportModal]);

  function animatePick(fromEl: HTMLElement, toEl: HTMLElement) {
    const from = fromEl.getBoundingClientRect();
    const to = toEl.getBoundingClientRect();

    const clone = fromEl.cloneNode(true) as HTMLElement;
    document.body.appendChild(clone);

    clone.style.position = "fixed";
    clone.style.left = `${from.left}px`;
    clone.style.top = `${from.top}px`;
    clone.style.width = `${from.width}px`;
    clone.style.height = `${from.height}px`;
    clone.style.margin = "0";
    clone.style.zIndex = "9999";
    clone.style.pointerEvents = "none";
    clone.style.transition =
      "transform 420ms cubic-bezier(.22,1,.36,1), opacity 420ms ease";

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);

    requestAnimationFrame(() => {
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.4)`;
      clone.style.opacity = "0.2";
    });

    clone.addEventListener("transitionend", () => clone.remove(), {
      once: true,
    });
  }


  useEffect(() => () => unlockBody(), []);

  function animateReturn(fromEl: HTMLElement, toEl: HTMLElement) {
    const from = fromEl.getBoundingClientRect();
    const to = toEl.getBoundingClientRect();

    const clone = fromEl.cloneNode(true) as HTMLElement;
    document.body.appendChild(clone);

    clone.style.position = "fixed";
    clone.style.left = `${from.left}px`;
    clone.style.top = `${from.top}px`;
    clone.style.width = `${from.width}px`;
    clone.style.height = `${from.height}px`;
    clone.style.margin = "0";
    clone.style.zIndex = "9999";
    clone.style.pointerEvents = "none";
    clone.style.transition =
      "transform 420ms cubic-bezier(.22,1,.36,1), opacity 420ms ease";

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);

    requestAnimationFrame(() => {
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.5)`;
      clone.style.opacity = "0.1";
    });

    clone.addEventListener("transitionend", () => clone.remove(), {
      once: true,
    });
  }


  /* ───────────── Helpers ───────────── */
  const isSignatureWEngine = (
    engine: WEngine,
    char: ZzzCharacterInfo | undefined
  ) => {
    if (!char || !engine.subname) return false;
    const e = engine.subname.toLowerCase();
    return (
      e === char.name.toLowerCase() ||
      (char.subname && e === char.subname.toLowerCase())
    );
  };


  const emptyMember = () => ({
    characterId: "",
    eidolon: 0,
    wengineId: "",
    superimpose: 1,
  });

  const makeEmptyTeam = () =>
    Array.from({ length: TEAM_SIZE }, () => emptyMember());


  const subnameToCharacterName = useMemo(() => {
    const m = new Map<string, string>();
    for (const char of charInfos)
      if (char.subname) m.set(char.subname.toLowerCase(), char.name);
    return m;
  }, [charInfos]);

  /* ───────────── Outside click to close E/S popups ───────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showModal) return;

      const t = e.target as Node;
      if (slotsRef.current?.contains(t)) return;
      setEidolonOpenIndex(null);
      setSuperOpenIndex(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showModal, slotsRef]);

  /* ───────────── Base data fetch (ZZZ) ───────────── */
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const [charRes, zzzCharCostRes, zzzWEngineRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/characters`, {
            credentials: "include",
            signal: ac.signal,
          }),
          fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/balance`, {
            credentials: "include",
            signal: ac.signal,
          }),
          fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/wengine-balance`, {
            credentials: "include",
            signal: ac.signal,
          }),
        ]);

        if (!charRes.ok) throw new Error("Failed to fetch ZZZ characters");
        if (!zzzCharCostRes.ok)
          throw new Error("Failed to fetch ZZZ char costs");
        if (!zzzWEngineRes.ok) throw new Error("Failed to fetch ZZZ W-Engines");

        const [charData, zzzCostData, zzzWEngineData] = await Promise.all([
          charRes.json(),
          zzzCharCostRes.json(),
          zzzWEngineRes.json(),
        ]);

        // Shapes: allow either {data:[]} or direct []
        setCharInfos(charData.data || charData || []);
        // Expect either {characters:[...]} or direct [...]
        setCharCosts(zzzCostData.characters || zzzCostData || []);
        // Expect either {wengines:[...]} or {engines:[...]} or direct [...]
        const engines =
          zzzWEngineData.wengines ||
          zzzWEngineData.engines ||
          zzzWEngineData.weapons ||
          zzzWEngineData ||
          [];
        setWengines(engines);

        setTeam(makeEmptyTeam());
        setLoad(false);
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.error(err);
          setError("Failed to load data");
          setLoad(false);
        }
      }
    })();
    return () => ac.abort();
  }, []);

  /* ───────────── Fetch presets (self) ───────────── */
  useEffect(() => {
    if (!user?.id) return;
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch(
          `${import.meta.env.VITE_API_BASE}/api/zzz/player/${user.id}/presets`,
          { credentials: "include", signal: ac.signal }
        );


        let j: any = null;
        try {
          j = await r.json();
        } catch {}

        if (!r.ok) {
          const msg =
            j?.error ||
            (r.status === 401
              ? "Not logged in."
              : r.status === 403
              ? "Private: you can only view your own presets."
              : `Failed to load presets (${r.status}).`);
          throw new Error(msg);
        }

        setPresets((j?.presets ?? []) as TeamPreset[]);
        setPresetsError(null);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          console.error(e);
          setPresetsError(e.message || "Failed to load presets");
          setPresets([]);
        }
      }
    })();
    return () => ac.abort();
  }, [user?.id]);

  /* ───────────── Maps for fast lookups ───────────── */
  const zzzCharCostMap = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const c of charCosts) {
      if (c.id) m.set(c.id.toLowerCase(), c.costs);
    }
    return m;
  }, [charCosts]);


  const zzzWEngineMap = useMemo(() => {
    const m = new Map<string, WEngine>();
    for (const w of wengines) m.set(w.id, w);
    return m;
  }, [wengines]);

  /* ───────────── Derived totals (keep hooks before any early return!) ───────────── */
  const zzzCharCost = (member: TeamMember) =>
    member.characterId
      ? zzzCharCostMap.get(member.characterId.toLowerCase())?.[
          member.eidolon
        ] ?? 0
      : 0;

  const zzzWEngineCost = (member: TeamMember) =>
    member.wengineId
      ? zzzWEngineMap.get(member.wengineId)?.costs[
          Math.min(Math.max(member.superimpose, 1), 5) - 1
        ] ?? 0
      : 0;

  const totalZzzCost = useMemo(
    () => team.reduce((sum, m) => sum + zzzCharCost(m) + zzzWEngineCost(m), 0),
    [team, zzzCharCostMap, zzzWEngineMap]
  );

  const visiblePresets = useMemo(() => {
    const q = presetSearch.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
    );
  }, [presets, presetSearch]);

  /* ───────────── Character assign/remove & engine modal ───────────── */
  const assignCharacterToSlot = (char: ZzzCharacterInfo) => {
    const firstEmpty = team.findIndex((m) => !m.characterId);
    if (firstEmpty === -1) return;

    const fromEl = document.querySelector(
      `.zzz-char-pool-item[data-char-code="${char.code}"]`
    ) as HTMLElement | null;

    const toEl = document.querySelector(
      `[data-slot-index="${firstEmpty}"]`
    ) as HTMLElement | null;

    if (fromEl && toEl) {
      animatePick(fromEl, toEl);
    }

    setTeam((prev) => {
      const newTeam = [...prev];
      newTeam[firstEmpty] = {
        characterId: char.code,
        eidolon: 0,
        characterInfo: char,
        wengineId: "",
        wengineData: undefined,
        superimpose: 1,
      };
      return newTeam;
    });

    setSearch("");
    setWengineSearch("");
    setEidolonOpenIndex(null);
    setSuperOpenIndex(null);
  };


  const removeSlot = (index: number) => {
    const member = team[index];
    if (!member?.characterId) return;

    const fromEl = document.querySelector(
      `[data-slot-index="${index}"] .zzz-slot-char`
    ) as HTMLElement | null;

    const toEl = document.querySelector(
      `.zzz-char-pool-item[data-char-code="${member.characterId}"]`
    ) as HTMLElement | null;

    if (fromEl && toEl) {
      animateReturn(fromEl, toEl);
    }

    const filtered = team.filter((_, i) => i !== index);
    const compacted = filtered.filter((m) => m.characterId);
    const emptySlots = Array.from(
      { length: TEAM_SIZE - compacted.length },
      () => emptyMember()
    );

    setTeam([...compacted, ...emptySlots]);
  };


  const openWEngineModal = (index: number) => {
    setActiveSlotIndex(index);
    setSelectedWEngineId(team[index].wengineId || "");
    setShowModal(true);
  };

  const confirmWEngineSelection = () => {
    if (activeSlotIndex === null) return;
    const selected = zzzWEngineMap.get(selectedWEngineId || "");
    const newTeam = [...team];
    newTeam[activeSlotIndex] = {
      ...newTeam[activeSlotIndex],
      wengineId: selectedWEngineId,
      wengineData: selected,
    };
    setTeam(newTeam);
    setShowModal(false);
    setWengineSearch("");
  };

  const clearTeam = () => {
    team.forEach((member, index) => {
      if (!member.characterId) return;

      const fromEl = document.querySelector(
        `[data-slot-index="${index}"] .zzz-slot-char`
      ) as HTMLElement | null;

      const toEl = document.querySelector(
        `.zzz-char-pool-item[data-char-code="${member.characterId}"]`
      ) as HTMLElement | null;

      if (fromEl && toEl) {
        setTimeout(() => {
          animateReturn(fromEl, toEl);
        }, index * 80); // stagger
      }
    });

    // let animations start before clearing
    setTimeout(() => {
      setTeam(makeEmptyTeam());
      setScore(1);
    }, 200);
  };


  /* ───────────── Import / Export with TeamPresets ───────────── */
  const slotToMember = (slot: PresetSlot): TeamMember => {
    const char = charInfos.find((c) => c.code === slot.characterId);
    const engine = slot.wengineId
      ? zzzWEngineMap.get(slot.wengineId)
      : undefined;
    return {
      characterId: slot.characterId,
      characterInfo: char,
      eidolon: Math.max(0, Math.min(6, slot.mindscape | 0)),
      wengineId: slot.wengineId || "",
      wengineData: engine,
      superimpose: Math.max(1, Math.min(5, slot.refinement | 0)),
    };
  };

  const importPreset = (p: TeamPreset) => {
    const three = [...p.slots].slice(0, 3);
    while (three.length < 3) {
      three.push({
        characterId: "",
        mindscape: 0,
        wengineId: "",
        refinement: 1,
      });
    }
    const nextTeam = three.map(slotToMember);
    setTeam(nextTeam);

    const importedScore =
      typeof p.expectedScore === "number" ? p.expectedScore : null;

    if (typeof importedScore === "number") {
      setScore(Math.max(1, Math.min(65000, Math.floor(importedScore))));
    }

    setSearch("");
    setWengineSearch("");
    setEidolonOpenIndex(null);
    setSuperOpenIndex(null);
    setShowPresetsPanel(false);
  };

  const formatCost = (value: number) => {
    if (Number.isInteger(value)) return value.toString();

    if (
      Math.round(value * 10) % 10 === 0 ||
      Math.round(value * 10) % 10 === 5
    ) {
      return value.toFixed(1);
    }

    return value.toFixed(2);
  };


  const canExport = useMemo(() => {
    const allFilled = team.every((m) => !!m.characterId);
    const unique = new Set(team.map((m) => m.characterId)).size === TEAM_SIZE;
    return allFilled && unique;
  }, [team]);

  const MAX_PRESETS = 50; // keep in sync with backend

  const exportToTeamPresets = () => {
    if (!user?.id) {
      toast.error("Please sign in first.");
      return;
    }
    if (presets.length >= MAX_PRESETS) {
      toast.info(`You’ve reached the maximum of ${MAX_PRESETS} presets.`);
      return;
    }
    if (!canExport) {
      toast.info("Fill 3 unique characters to export.");
      return;
    }
    setExportName("");
    setExportDesc("");
    setExportScoreInput(String(Math.max(1, Math.floor(Number(score))) || 1));
    setShowExportModal(true);
  };

  const handleCreatePreset = async () => {
    if (!user?.id) return;

    const name = exportName.trim();
    const description = exportDesc.trim();

    if (!name) {
      toast.info("Please enter a preset name.");
      return;
    }

    const dup = presets.some(
      (p) => p.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (dup) {
      toast.info("A preset with that name already exists. Pick another name.");
      return;
    }

    const members = team.filter((m) => !!m.characterId);
    const ids = members.map((m) => String(m.characterId));
    const uniq = new Set(ids);
    if (members.length !== 3 || uniq.size !== 3) {
      toast.info("Fill 3 unique characters to export.");
      return;
    }

    const slots = team.slice(0, 3).map((m, i) => {
      const eid = Number.isFinite(Number(m.eidolon))
        ? Math.max(0, Math.min(6, Number(m.eidolon)))
        : 0;
      const sup = Number.isFinite(Number(m.superimpose))
        ? Math.max(1, Math.min(5, Number(m.superimpose)))
        : 1;
      const charId = String(m.characterId || "");
      const engineId = String(m.wengineId || "");
      if (!charId) throw new Error(`Slot ${i + 1} missing characterId`);
      return {
        characterId: charId,
        mindscape: eid,
        wengineId: engineId,
        refinement: sup,
      };
    });

    let expectedScore: number | null = null;
    if (exportScoreInput.trim() !== "") {
      const n = Number(exportScoreInput);
      if (!Number.isInteger(n) || n < 1 || n > 65000) {
        toast.error("Expected Score must be an integer from 1 to 65000.");
        return;
      }
      expectedScore = n;
    }

    const body = { name, description, slots, expectedScore };

    try {
      const url = `${import.meta.env.VITE_API_BASE}/api/zzz/player/${
        user.id
      }/presets`;
      console.log("Creating ZZZ preset →", url, body);

      const r = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const text = await r.text();
      if (!r.ok) {
        let serverMsg = "";
        try {
          const parsed = text ? JSON.parse(text) : null;
          serverMsg = parsed?.error || parsed?.message || "";
        } catch {}
        const msg =
          serverMsg ||
          (r.status === 500
            ? "Server error (500). Check backend logs (often duplicate name or over limit)."
            : `Create failed (HTTP ${r.status}).`);
        throw new Error(msg);
      }

      const j = text ? JSON.parse(text) : {};
      if (j?.preset) {
        setPresets((prev) => [j.preset, ...prev]);
      } else {
        const rr = await fetch(
          `${import.meta.env.VITE_API_BASE}/api/zzz/player/${user.id}/presets`,
          { credentials: "include" }
        );
        if (rr.ok) {
          const jj = await rr.json();
          setPresets(jj.presets || []);
        }
      }

      toast.success("Preset created");
      setShowExportModal(false);
    } catch (err: any) {
      console.error("Create preset failed:", err);
      toast.error(err.message || "Failed to create preset");
    }
  };

  const handleDeletePreset = async (presetId: string) => {
    if (!playerIdForPresets) return;

    const existsLocally = presets.some((p) => p.id === presetId);
    if (!existsLocally) {
      toast.info("Preset already gone locally. Refreshing…");
      try {
        const r = await fetch(
          `${
            import.meta.env.VITE_API_BASE
          }/api/zzz/player/${playerIdForPresets}/presets`,
          { credentials: "include" }
        );
        const j = await r.json();
        if (r.ok) setPresets(j.presets || []);
      } catch {}
      return;
    }

    try {
      console.log(
        "DELETE",
        `${
          import.meta.env.VITE_API_BASE
        }/api/zzz/player/${playerIdForPresets}/presets/${presetId}`
      );

      const r = await fetch(
        `${
          import.meta.env.VITE_API_BASE
        }/api/zzz/player/${playerIdForPresets}/presets/${presetId}`,
        { method: "DELETE", credentials: "include" }
      );

      if (r.status === 404) {
        toast.info("Preset not found on server. Refreshing list…");
        const rr = await fetch(
          `${
            import.meta.env.VITE_API_BASE
          }/api/zzz/player/${playerIdForPresets}/presets`,
          { credentials: "include" }
        );

        if (rr.ok) {
          const jj = await rr.json();
          setPresets(jj.presets || []);
        }
        return;
      } else if (!r.ok) {
        let j: any = null;
        try {
          j = await r.json();
        } catch {}
        const msg =
          j?.error ||
          (r.status === 401
            ? "Not logged in."
            : r.status === 403
            ? "Private: you can only delete your own presets."
            : `Delete failed (${r.status}).`);
        throw new Error(msg);
      }

      setPresets((prev) => prev.filter((p) => p.id !== presetId));
      toast.success("Preset deleted");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete preset");
    }
  };

  /* ───────────── Early error/loading return ───────────── */
  if (loading || error) {
    return (
      <div
        className="d-flex justify-content-center align-items-center text-white"
        style={{ minHeight: "100vh", background: "#000" }}
      >
        <p>{error || "Loading team cost data…"}</p>
      </div>
    );
  }

  /* ───────────── Render ───────────── */
  return (
    <div
      className="page-fade-in"
      style={{
        backgroundImage: "url('/zzz-bg2.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: isTouchDevice ? "initial" : "fixed",
        minHeight: isTouchDevice ? "100dvh" : "100vh",
        position: "relative",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0,0,0,.6)",
          position: "absolute",
          inset: 0,
          zIndex: 1,
        }}
      />

      <div
        className="position-relative z-2 text-white d-flex flex-column px-2 px-md-4"
        style={{ minHeight: "100vh" }}
      >
        <Navbar />

        <div className="d-flex justify-content-end mb-3 pe-4">
          <Link to="/" className="btn back-button-glass">
            ← Back
          </Link>
        </div>

        <div
          className="flex-grow-1 px-2"
          style={{ maxWidth: "1600px", margin: "0 auto" }}
        >
          {/* Team + Info */}
          <div
            className="d-flex flex-column flex-md-row gap-4 mb-4 align-items-start"
            style={{ width: "100%" }}
          >
            {/* Team Info */}
            <div
              className="p-3 rounded"
              style={{
                background: "rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(6px)",
                minWidth: 260,
                flexShrink: 0,
              }}
            >
              <h5 className="mb-3">Team Info</h5>

              <label className="form-label small mb-1">Score</label>
              <input
                type="number"
                className="form-control form-control-sm bg-dark text-white mb-2"
                value={score}
                min={1}
                max={65000}
                step={1}
                inputMode="numeric"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setScore(1);
                    return;
                  }
                  const n = Math.floor(Number(v));
                  if (Number.isFinite(n)) {
                    setScore(Math.max(1, Math.min(65000, n)));
                  }
                }}
                title="Saved to presets as Expected Score"
              />

              {/* Total: ZZZ */}
              <div className="d-flex gap-2 flex-wrap mb-2">
                <span
                  className="badge"
                  style={{
                    background: "rgba(255, 50, 180, 0.18)",
                    border: "1px solid rgba(255,50,180,0.35)",
                  }}
                >
                  Total Cost: {formatCost(totalZzzCost)}
                </span>
              </div>

              <div className="row g-2 mt-2">
                <div className="col">
                  <button
                    className="btn btn-outline-light btn-sm w-100"
                    onClick={clearTeam}
                  >
                    Clear
                  </button>
                </div>

                <div className="col">
                  <button
                    className="btn btn-outline-light btn-sm w-100"
                    disabled={!canExport}
                    onClick={exportToTeamPresets}
                    title={
                      !canExport
                        ? "Fill 3 unique characters to export"
                        : "Export to Team Presets"
                    }
                  >
                    Export
                  </button>
                </div>

                <div className="col">
                  <button
                    ref={presetsTriggerRef}
                    className="btn btn-outline-info btn-sm w-100"
                    onClick={() => setShowPresetsPanel(true)}
                    title="Show your saved Team Presets"
                  >
                    Presets
                  </button>
                </div>
              </div>
            </div>

            {/* Team slots */}
            <div
              ref={slotsRef}
              className="d-flex justify-content-between gap-2"
              style={{
                flexWrap: "nowrap",
                overflowX: "auto",
                overflowY: "hidden",
                width: "100%",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {team.map((member, index) => {
                const char = member.characterInfo;
                const engine = member.wengineData;

                const eCost = char ? zzzCharCost(member) : 0;
                const sCost = engine ? zzzWEngineCost(member) : 0;

                return (
                  <div
                    key={index}
                    data-slot-index={index}
                    onClick={() => char && openWEngineModal(index)}
                    style={{
                      flex: "0 0 auto",
                      width: "22vw",
                      maxWidth: "120px",
                      minWidth: "80px",
                      height: "220px",
                      borderRadius: "12px",
                      background: "rgba(0,0,0,0.7)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      cursor: char ? "pointer" : "default",
                      overflow: "visible",
                      padding: 0,
                      margin: 0,
                      display: "inline-block",
                      position: "relative",
                    }}
                  >
                    {char ? (
                      <div style={{ position: "relative" }}>
                        <img
                          className="zzz-slot-char"
                          src={char.image_url}
                          alt={char.name}
                          loading="lazy"
                          onError={(e) => {
                            (
                              e.currentTarget as HTMLImageElement
                            ).style.visibility = "hidden";
                          }}
                          style={{
                            width: "100%",
                            height: engine ? "140px" : "220px",
                            objectFit: "cover",
                            transition: "height 0.3s ease",
                          }}
                        />

                        {/* Eidolon badge */}
                        <div
                          style={{
                            position: "absolute",
                            top: 4,
                            left: 4,
                            zIndex: 10,
                          }}
                        >
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setEidolonOpenIndex(
                                eidolonOpenIndex === index ? null : index
                              );
                            }}
                            style={{
                              position: "relative",
                              display: "inline-block",
                              cursor: "pointer",
                            }}
                          >
                            <div
                              style={{
                                background: "#000",
                                color: "#fff",
                                fontSize: "0.75rem",
                                padding: "2px 6px",
                                borderRadius: "6px",
                              }}
                            >
                              E{member.eidolon} | {formatCost(eCost)}
                            </div>

                            {eidolonOpenIndex === index && (
                              <div
                                ref={eidolonRef}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: "absolute",
                                  top: "calc(100% - 1px)",
                                  left: index === team.length - 1 ? "auto" : 0,
                                  right: index === team.length - 1 ? 0 : "auto",
                                  width: "180px",
                                  background: "rgba(0,0,0,0.85)",
                                  padding: "8px",
                                  borderRadius: "10px",
                                  boxShadow: "0 0 6px rgba(0,0,0,0.6)",
                                  backdropFilter: "blur(4px)",
                                  zIndex: 999,
                                }}
                              >
                                <input
                                  type="range"
                                  min={0}
                                  max={6}
                                  step={1}
                                  value={member.eidolon}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const updated = [...team];
                                    updated[index].eidolon = Number(
                                      e.target.value
                                    );
                                    setTeam(updated);
                                  }}
                                  style={{
                                    width: "100%",
                                    accentColor: "#0af",
                                    cursor: "pointer",
                                  }}
                                />
                                <div
                                  className="d-flex justify-content-between text-white mt-1"
                                  style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 500,
                                    color: "#ccc",
                                  }}
                                >
                                  {[
                                    "E0",
                                    "E1",
                                    "E2",
                                    "E3",
                                    "E4",
                                    "E5",
                                    "E6",
                                  ].map((label, i) => (
                                    <span
                                      key={i}
                                      style={{
                                        color:
                                          member.eidolon === i
                                            ? "#0af"
                                            : "#ccc",
                                        fontWeight:
                                          member.eidolon === i
                                            ? "bold"
                                            : "normal",
                                      }}
                                    >
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSlot(index);
                          }}
                          className="btn btn-sm btn-danger position-absolute"
                          style={{
                            top: 4,
                            right: 4,
                            padding: "2px 6px",
                            fontSize: "0.75rem",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "140px",
                          background: "rgba(255,255,255,0.05)",
                        }}
                      />
                    )}

                    {/* W-Engine area */}
                    {engine ? (
                      <div style={{ position: "relative" }}>
                        <img
                          src={engine.imageUrl}
                          alt={engine.name}
                          loading="lazy"
                          onError={(e) => {
                            (
                              e.currentTarget as HTMLImageElement
                            ).style.visibility = "hidden";
                          }}
                          style={{
                            width: "100%",
                            height: "80px",
                            objectFit: "cover",
                          }}
                        />

                        <div
                          style={{
                            position: "absolute",
                            bottom: 4,
                            left: 4,
                            zIndex: 10,
                          }}
                        >
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSuperOpenIndex(
                                superOpenIndex === index ? null : index
                              );
                            }}
                            style={{
                              position: "relative",
                              display: "inline-block",
                              cursor: "pointer",
                            }}
                          >
                            <div
                              style={{
                                background: "#000",
                                color: "#fff",
                                fontSize: "0.75rem",
                                padding: "2px 6px",
                                borderRadius: "6px",
                              }}
                            >
                              S{member.superimpose} | {formatCost(sCost)}
                            </div>

                            {superOpenIndex === index && (
                              <div
                                ref={superRef}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: "absolute",
                                  bottom: "calc(100% - 1px)",
                                  left: index === team.length - 1 ? "auto" : 0,
                                  right: index === team.length - 1 ? 0 : "auto",
                                  width: "180px",
                                  background: "rgba(0,0,0,0.85)",
                                  padding: "8px",
                                  borderRadius: "10px",
                                  boxShadow: "0 0 6px rgba(0,0,0,0.6)",
                                  backdropFilter: "blur(4px)",
                                  zIndex: 999,
                                }}
                              >
                                <input
                                  type="range"
                                  min={1}
                                  max={engine?.costs.length ?? 5}
                                  step={1}
                                  value={member.superimpose}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const updated = [...team];
                                    updated[index].superimpose = Number(
                                      e.target.value
                                    );
                                    setTeam(updated);
                                  }}
                                  style={{
                                    width: "100%",
                                    accentColor: "#0af",
                                    cursor: "pointer",
                                  }}
                                />
                                <div
                                  className="d-flex justify-content-between text-white mt-1"
                                  style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 500,
                                    color: "#ccc",
                                  }}
                                >
                                  {["S1", "S2", "S3", "S4", "S5"].map(
                                    (label, i) => (
                                      <span
                                        key={i}
                                        style={{
                                          color:
                                            member.superimpose === i + 1
                                              ? "#0af"
                                              : "#ccc",
                                          fontWeight:
                                            member.superimpose === i + 1
                                              ? "bold"
                                              : "normal",
                                        }}
                                      >
                                        {label}
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "80px",
                          background: "rgba(255,255,255,0.05)",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Character Pool (self-scrolling) */}
          <div className="mb-5">
            <div
              style={{
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.55)",
                boxShadow: "0 6px 20px rgba(0,0,0,.35)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "clamp(260px, 46vh, 560px)",
                  overflowY: "auto",
                  WebkitOverflowScrolling: "touch",
                  overscrollBehavior: "contain",
                  touchAction: "pan-y",
                }}
              >
                <div
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                    background:
                      "linear-gradient(rgba(0,0,0,.85), rgba(0,0,0,.75))",
                    padding: "10px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <input
                    type="text"
                    className="form-control form-control-sm bg-dark text-white"
                    placeholder="Search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div style={{ padding: 10 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(60px, 1fr))",
                      gap: 6,
                      justifyContent: "center",
                    }}
                  >
                    {uniqueCharInfos
                      .filter((c) => {
                        const q = search.toLowerCase();
                        return (
                          (c.name || "").toLowerCase().includes(q) ||
                          (c.subname || "").toLowerCase().includes(q)
                        );
                      })
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((char) => (
                        <div
                          key={char.code}
                          className="zzz-char-pool-item"
                          data-char-code={char.code}
                          onClick={() => assignCharacterToSlot(char)}
                          title={char.name}
                          style={{
                            width: 70,
                            height: 70,
                            borderRadius: 8,
                            border: "2px solid #555",
                            backgroundImage: `url(${char.image_url})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            cursor: "pointer",
                            transition:
                              "transform 0.15s ease, box-shadow 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.1)";
                            e.currentTarget.style.boxShadow =
                              "0 0 8px rgba(255,255,255,0.4)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        />
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* W-Engine Modal */}
        <Modal
          show={showModal}
          onHide={() => setShowModal(false)}
          onExited={unlockBody}
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
              placeholder="Search by name or subname..."
              value={wengineSearch}
              onChange={(e) => setWengineSearch(e.target.value)}
            />

            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              <ul className="list-group">
                <li
                  className={`list-group-item list-group-item-action ${
                    selectedWEngineId === "" ? "active" : ""
                  }`}
                  onClick={() => setSelectedWEngineId("")}
                  style={{ cursor: "pointer" }}
                >
                  None
                </li>

                {(() => {
                  const searchLower = wengineSearch.toLowerCase();
                  const activeChar =
                    activeSlotIndex !== null
                      ? team[activeSlotIndex].characterInfo
                      : undefined;
                  const filtered = wengines.filter((w) => {
                    const name = w.name?.toLowerCase() || "";
                    const sub = w.subname?.toLowerCase() || "";
                    if (name.includes(searchLower) || sub.includes(searchLower))
                      return true;

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

                  filtered.sort((a, b) => {
                    if (!activeChar) return 0;

                    const aSig = isSignatureWEngine(a, activeChar);
                    const bSig = isSignatureWEngine(b, activeChar);

                    if (aSig && !bSig) return -1;
                    if (!aSig && bSig) return 1;
                    return 0;
                  });

                  return filtered.map((w) => {
                    const isSig =
                      !!activeChar && isSignatureWEngine(w, activeChar);
                    return (
                      <li
                        key={w.id}
                        className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                          selectedWEngineId === w.id ? "active" : ""
                        }`}
                        onClick={() => setSelectedWEngineId(w.id)}
                        style={{
                          cursor: "pointer",
                          padding: "6px 10px",
                          gap: "10px",
                        }}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <img
                            src={w.imageUrl}
                            alt={w.name}
                            style={{
                              width: "32px",
                              height: "32px",
                              objectFit: "cover",
                              borderRadius: "4px",
                              border: "1px solid rgba(255,255,255,0.1)",
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 600 }}>{w.name}</div>
                            <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                              {w.subname} ({w.rarity}★)
                            </div>
                          </div>
                        </div>
                        {isSig && (
                          <span
                            className="badge bg-warning text-dark"
                            style={{
                              fontSize: "0.65rem",
                              fontWeight: 600,
                              borderRadius: "6px",
                              padding: "2px 6px",
                            }}
                          >
                            💠 Signature
                          </span>
                        )}
                      </li>
                    );
                  });
                })()}
              </ul>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              className="btn-glass-muted"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn-glass-primary"
              onClick={confirmWEngineSelection}
            >
              Confirm
            </button>
          </Modal.Footer>
        </Modal>

        {/* Save Team Preset Modal */}
        <Modal
          show={showExportModal}
          onHide={() => setShowExportModal(false)}
          onExited={unlockBody}
          centered
          contentClassName="bg-dark text-white"
        >
          <Modal.Header closeButton>
            <Modal.Title className="d-flex align-items-center gap-2">
              Save Team Preset
              {exportScoreInput !== "" && (
                <span
                  className="badge"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    fontWeight: 600,
                  }}
                  title="Will be saved as Expected Score"
                >
                  Score: {exportScoreInput}
                </span>
              )}
            </Modal.Title>
          </Modal.Header>

          <Modal.Body>
            <div className="mb-3">
              <label className="form-label">Name</label>
              <input
                type="text"
                className="form-control bg-dark text-white"
                value={exportName}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.length <= 40) setExportName(v);
                }}
                maxLength={40}
                autoComplete="off"
                spellCheck={false}
              />
              <small className="text-white-50">{exportName.length}/40</small>
            </div>

            <div className="mb-3">
              <label className="form-label">Description</label>
              <textarea
                className="form-control bg-dark text-white"
                rows={3}
                value={exportDesc}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.length <= 200) setExportDesc(v);
                }}
                autoComplete="off"
                spellCheck={false}
              />
              <small className="text-white-50">{exportDesc.length}/200</small>
            </div>

            <div className="mb-3">
              <label htmlFor="export-expected-score" className="form-label">
                Expected Score
              </label>
              <input
                id="export-expected-score"
                type="number"
                min={1}
                max={65000}
                step={1}
                className="form-control bg-dark text-white"
                value={exportScoreInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") return setExportScoreInput("");
                  const n = Number(v);
                  if (Number.isFinite(n))
                    setExportScoreInput(
                      String(Math.max(1, Math.min(65000, Math.floor(n))))
                    );
                }}
                placeholder="e.g. 42000"
              />
              <small className="text-white-50">
                This starts from Team Info → Score and will be saved to the
                preset.
              </small>
            </div>

            <div className="mb-2 text-white-50 small">Team</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {team.map((m, i) => {
                const char = m.characterInfo;
                const eng = m.wengineData;
                return (
                  <div
                    key={i}
                    style={{
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(0,0,0,0.7)",
                      overflow: "hidden",
                      position: "relative",
                      height: 190,
                    }}
                    title={
                      char
                        ? `${char.name} • E${m.eidolon}${
                            eng
                              ? ` • ${eng.name} (S${m.superimpose})`
                              : " • No W-Engine"
                          }`
                        : ""
                    }
                  >
                    {char ? (
                      <img
                        src={char.image_url}
                        alt={char.name}
                        style={{
                          width: "100%",
                          height: eng ? 140 : 200,
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: 200,
                          background: "rgba(255,255,255,0.05)",
                        }}
                      />
                    )}

                    {char && (
                      <div
                        style={{
                          position: "absolute",
                          top: 6,
                          left: 6,
                          zIndex: 2,
                        }}
                      >
                        <div
                          style={{
                            background: "#000",
                            color: "#fff",
                            fontSize: "0.75rem",
                            padding: "2px 6px",
                            borderRadius: "6px",
                            border: "1px solid rgba(255,255,255,0.15)",
                          }}
                        >
                          E{m.eidolon}
                        </div>
                      </div>
                    )}

                    {eng ? (
                      <div style={{ position: "relative" }}>
                        <img
                          src={eng.imageUrl}
                          alt={eng.name}
                          style={{
                            width: "100%",
                            height: 60,
                            objectFit: "cover",
                            display: "block",
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            bottom: 6,
                            left: 6,
                            background: "#000",
                            color: "#fff",
                            fontSize: "0.75rem",
                            padding: "2px 6px",
                            borderRadius: "6px",
                            border: "1px solid rgba(255,255,255,0.15)",
                          }}
                        >
                          S{m.superimpose}
                        </div>
                      </div>
                    ) : (
                      char && (
                        <div
                          style={{
                            width: "100%",
                            height: 60,
                            background: "rgba(255,255,255,0.05)",
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                          }}
                        />
                      )
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-white-50 small mt-2">
              (Edit the team in Cost Test if you want to change members/values.)
            </div>
          </Modal.Body>

          <Modal.Footer>
            <button
              className="btn-glass-muted"
              onClick={() => setShowExportModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn-glass-primary"
              disabled={!exportName.trim()}
              onClick={handleCreatePreset}
            >
              Save Preset
            </button>
          </Modal.Footer>
        </Modal>

        {/* === Slide-in Presets Panel === */}
        {showPresetsPanel && (
          <div
            onClick={() => setShowPresetsPanel(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(2px)",
              zIndex: 1050,
            }}
          />
        )}

        <div
          ref={presetsPanelRef}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            height: "100vh",
            width: "min(92vw, 360px)",
            background: "rgba(10,10,10,0.92)",
            transform: showPresetsPanel ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 260ms ease",
            zIndex: 1051,
            display: "flex",
            flexDirection: "column",
            pointerEvents: showPresetsPanel ? "auto" : "none",
          }}
        >
          <div
            className="d-flex align-items-center px-3 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", gap: 8 }}
          >
            <strong style={{ fontSize: "1.05rem" }}>Your Team Presets</strong>
            <button
              className="btn btn-sm btn-outline-light ms-auto"
              onClick={() => setShowPresetsPanel(false)}
              aria-label="Close presets panel"
            >
              ✕
            </button>
          </div>

          <div className="px-3 pt-3">
            <input
              className="form-control form-control-sm bg-dark text-white"
              placeholder="Search presets…"
              value={presetSearch}
              onChange={(e) => setPresetSearch(e.target.value)}
            />
            {presetsError && (
              <div className="text-danger small mt-2">{presetsError}</div>
            )}
          </div>

          <div
            style={{
              overflowY: "auto",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              WebkitOverflowScrolling: "touch",
            }}
          >
            {visiblePresets.length === 0 ? (
              <div className="text-white-50 small px-2">
                {presetSearch ? "No results." : "No presets yet."}
              </div>
            ) : (
              visiblePresets.map((p) => (
                <div
                  key={p.id}
                  className="p-2"
                  style={{
                    borderRadius: 10,
                    background: "rgba(0,0,0,0.55)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div className="d-flex align-items-center mb-2">
                    <strong
                      className="text-info"
                      style={{ textShadow: "0 0 8px rgba(0,170,255,.25)" }}
                    >
                      {p.name}
                    </strong>

                    <button
                      className="btn btn-sm btn-outline-light ms-auto me-2"
                      onClick={() => importPreset(p)}
                    >
                      Import
                    </button>

                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDeletePreset(p.id)}
                      title="Delete preset"
                    >
                      ✕
                    </button>
                  </div>

                  {p.description && (
                    <div
                      className="small text-white-50 mb-2"
                      style={{ lineHeight: 1.2 }}
                    >
                      {p.description}
                    </div>
                  )}

                  {typeof (p as any).expectedScore === "number" && (
                    <div className="small text-white-50 mb-2">
                      Score: {(p as any).expectedScore}
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 4,
                    }}
                  >
                    {p.slots.slice(0, 3).map((s, i) => {
                      const ch = charInfos.find(
                        (c) => c.code === s.characterId
                      );
                      return (
                        <div
                          key={i}
                          title={
                            ch
                              ? `${ch.name} • E${s.mindscape}`
                              : s.characterId || "Empty"
                          }
                          style={{
                            width: "100%",
                            height: 52,
                            borderRadius: 6,
                            border: "1px solid rgba(255,255,255,0.1)",
                            backgroundImage: ch
                              ? `url(${ch.image_url})`
                              : "none",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            backgroundColor: ch
                              ? "transparent"
                              : "rgba(255,255,255,0.06)",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        {/* === /Slide-in Presets Panel === */}
      </div>
    </div>
  );
}
