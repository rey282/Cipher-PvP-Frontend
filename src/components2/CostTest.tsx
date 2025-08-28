// src/pages/CostTestPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "react-bootstrap";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../components/Landing.css";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

/* ───────────── Types ───────────── */
interface CharacterInfo {
  code: string;
  name: string;
  subname: string;
  rarity: number;
  image_url: string;
  path: string;
  element: string;
}

interface CharacterCost {
  id: string;
  name: string;
  costs: number[];
}

interface LightCone {
  id: string;
  name: string;
  costs: number[];
  imageUrl: string;
  subname: string;
  rarity: string;
}

interface TeamMember {
  characterId: string;
  characterInfo?: CharacterInfo;
  eidolon: number;
  lightConeId: string;
  lightConeData?: LightCone;
  superimpose: number;
}

/* Presets (shared with TeamPresets) */
type PresetSlot = {
  characterId: string;
  eidolon: number; // 0..6
  lightConeId: string; // "" allowed
  superimpose: number; // 1..5
};
type TeamPreset = {
  id: string;
  name: string;
  description: string;
  updated_at: string;
  slots: PresetSlot[];
  expectedCycle?: number | null;
};

/* Cipher backend shapes */
type CipherCharacter = { code: string; costs: number[] | any[] };
type CipherCone = { id: string; limited: boolean };

/* ───────────── Component ───────────── */
export default function CostTestPage() {
  const { user } = useAuth();

  // Data
  const [charInfos, setCharInfos] = useState<CharacterInfo[]>([]);
  const [charCosts, setCharCosts] = useState<CharacterCost[]>([]);
  const [cones, setCones] = useState<LightCone[]>([]);

  // Cipher data
  const [cipherChars, setCipherChars] = useState<CipherCharacter[]>([]);
  const [cipherCones, setCipherCones] = useState<CipherCone[]>([]);

  // Team & UI
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearSpeed, setClearSpeed] = useState(0);

  // Cone modal
  const [showModal, setShowModal] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [selectedConeId, setSelectedConeId] = useState<string>("");
  const [coneSearch, setConeSearch] = useState("");

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
  const [exportCycleInput, setExportCycleInput] = useState<string>("");

  const presetsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const presetsPanelRef = useRef<HTMLDivElement | null>(null);

  const playerIdForPresets = user?.id;

  useEffect(() => {
    const panel = presetsPanelRef.current;
    if (!panel) return;

    if (showPresetsPanel) {
      // open: make it interactive + focus close button (or the panel)
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
      // close: if focus is still inside, send it back to the opener
      if (panel.contains(document.activeElement)) {
        presetsTriggerRef.current?.focus();
      }
      panel.setAttribute("aria-hidden", "true");
      panel.setAttribute("inert", ""); // prevents focus/interaction
    }
  }, [showPresetsPanel]);

  // mobile/touch detection + body-unlock (prevents "can't scroll after visiting" on phones)
  const isTouchDevice =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  const unlockBody = () => {
    // Only clean up body styles if there are no modals still open.
    if (!document.querySelector(".modal.show")) {
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("overflow");
    }
  };


  // unlock when all modals are closed + on unmount
  useEffect(() => {
    if (!showModal && !showExportModal) {
      const t = setTimeout(unlockBody, 0);
      return () => clearTimeout(t);
    }
  }, [showModal, showExportModal]);

  useEffect(() => () => unlockBody(), []);

  /* ───────────── Helpers ───────────── */
  const isSignatureCone = (
    cone: LightCone,
    char: CharacterInfo | undefined
  ) => {
    if (!char) return false;
    const coneSub = (cone.subname || "").toLowerCase();
    const charName = char.name.toLowerCase();
    const charSub = (char.subname || "").toLowerCase();
    return coneSub === charName || (charSub && coneSub === charSub);
  };

  const emptyMember = () => ({
    characterId: "",
    eidolon: 0,
    lightConeId: "",
    superimpose: 1,
  });

  const makeEmptyTeam = () => Array.from({ length: 4 }, () => emptyMember());

  const extractImageId = (url: string) => {
    try {
      const path = new URL(url, window.location.origin).pathname;
      const file = path.split("/").pop() ?? "";
      return file.split(".")[0];
    } catch {
      return url.match(/\/(\d+)\.(png|webp|jpg|jpeg)(\?.*)?$/i)?.[1] ?? "";
    }
  };

  const subnameToCharacterName = useMemo(() => {
    const m = new Map<string, string>();
    for (const char of charInfos)
      if (char.subname) m.set(char.subname.toLowerCase(), char.name);
    return m;
  }, [charInfos]);

  /* ───────────── Outside click to close E/S popups ───────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // 🚫 Do nothing while the cone modal is open
      if (showModal) return;

      const t = e.target as Node;
      if (slotsRef.current?.contains(t)) return;
      setEidolonOpenIndex(null);
      setSuperOpenIndex(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showModal, slotsRef]);


  /* ───────────── Base data fetch (Cerydra + Cipher) ───────────── */
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const [charRes, cerCharCostRes, cerConeRes, cipCharRes, cipConeRes] =
          await Promise.all([
            fetch(`${import.meta.env.VITE_API_BASE}/api/characters/all`, {
              credentials: "include",
              signal: ac.signal,
            }),
            fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/balance`, {
              credentials: "include",
              signal: ac.signal,
            }),
            fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/cone-balance`, {
              credentials: "include",
              signal: ac.signal,
            }),
            fetch(`${import.meta.env.VITE_API_BASE}/api/cipher/balance`, {
              credentials: "include",
              signal: ac.signal,
            }),
            fetch(`${import.meta.env.VITE_API_BASE}/api/cipher/cone-balance`, {
              credentials: "include",
              signal: ac.signal,
            }),
          ]);

        if (!charRes.ok) throw new Error("Failed to fetch characters");
        if (!cerCharCostRes.ok)
          throw new Error("Failed to fetch Cerydra char costs");
        if (!cerConeRes.ok) throw new Error("Failed to fetch Cerydra cones");
        if (!cipCharRes.ok)
          throw new Error("Failed to fetch Cipher char costs");
        if (!cipConeRes.ok)
          throw new Error("Failed to fetch Cipher cone flags");

        const [charData, cerCostData, cerConeData, cipCharData, cipConeData] =
          await Promise.all([
            charRes.json(),
            cerCharCostRes.json(),
            cerConeRes.json(),
            cipCharRes.json(),
            cipConeRes.json(),
          ]);

        setCharInfos(charData.data || charData || []);
        setCharCosts(cerCostData.characters || cerCostData || []);
        setCones(cerConeData.cones || cerConeData || []);
        setCipherChars(cipCharData.characters || cipCharData || []);
        setCipherCones(cipConeData.cones || cipConeData || []);


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
          `${import.meta.env.VITE_API_BASE}/api/player/${user.id}/presets`,
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
  // Cerydra
  const cerydraCharCostMap = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const c of charCosts) m.set(c.id, c.costs);
    return m;
  }, [charCosts]);

  const cerydraConeMap = useMemo(() => {
    const m = new Map<string, LightCone>();
    for (const c of cones) m.set(c.id, c);
    return m;
  }, [cones]);

  // Cipher
  const cipherCharCostMap = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const c of cipherChars)
      m.set((c.code || "").toLowerCase(), c.costs as number[]);
    return m;
  }, [cipherChars]);

  const cipherConeLimitedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const c of cipherCones) m.set(c.id, !!c.limited);
    return m;
  }, [cipherCones]);

  /* ───────────── Derived totals (keep hooks before any early return!) ───────────── */
  // Per-member derived costs (helpers)
  const cerydraCharCost = (member: TeamMember) =>
    member.characterInfo
      ? cerydraCharCostMap.get(
          extractImageId(member.characterInfo.image_url)
        )?.[member.eidolon] ?? 0
      : 0;

  const cerydraConeCost = (member: TeamMember) =>
    member.lightConeId
      ? cerydraConeMap.get(member.lightConeId)?.costs[member.superimpose - 1] ??
        0
      : 0;

  const cipherCharCost = (member: TeamMember) =>
    member.characterId
      ? cipherCharCostMap.get(member.characterId.toLowerCase())?.[
          member.eidolon
        ] ?? 0
      : 0;

  const cipherConeCost = (member: TeamMember) => {
    if (!member.lightConeId) return 0;
    const limited = cipherConeLimitedMap.get(member.lightConeId);
    if (!limited) return 0;
    const steps = [0.25, 0.25, 0.5, 0.5, 0.75];
    const idx = Math.min(Math.max(member.superimpose, 1), 5) - 1;
    return steps[idx];
  };

  const totalCerydraCost = useMemo(
    () =>
      team.reduce((sum, m) => sum + cerydraCharCost(m) + cerydraConeCost(m), 0),
    [team, cerydraCharCostMap, cerydraConeMap]
  );

  const totalCipherCost = useMemo(
    () =>
      team.reduce((sum, m) => sum + cipherCharCost(m) + cipherConeCost(m), 0),
    [team, cipherCharCostMap, cipherConeLimitedMap]
  );

  // Presets panel filtering (keep this useMemo BEFORE the early return as well)
  const visiblePresets = useMemo(() => {
    const q = presetSearch.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
    );
  }, [presets, presetSearch]);

  /* ───────────── Character assign/remove & cone modal ───────────── */
  const assignCharacterToSlot = (char: CharacterInfo) => {
    const firstEmpty = team.findIndex((m) => !m.characterId);
    if (firstEmpty === -1) return;

    setTeam((prev) => {
      const newTeam = [...prev];
      newTeam[firstEmpty] = {
        characterId: char.code,
        eidolon: 0,
        characterInfo: char,
        lightConeId: "",
        lightConeData: undefined,
        superimpose: 1,
      };
      return newTeam;
    });

    setSearch("");
    setConeSearch("");
    setEidolonOpenIndex(null);
    setSuperOpenIndex(null);
  };

  const removeSlot = (index: number) => {
    const filtered = team.filter((_, i) => i !== index);
    const compacted = filtered.filter((m) => m.characterId);
    const emptySlots = Array.from({ length: 4 - compacted.length }, () =>
      emptyMember()
    );
    setTeam([...compacted, ...emptySlots]);
  };

  const openConeModal = (index: number) => {
    setActiveSlotIndex(index);
    setSelectedConeId(team[index].lightConeId || "");
    setShowModal(true);
  };

  const confirmConeSelection = () => {
    if (activeSlotIndex === null) return;
    const selectedCone = cerydraConeMap.get(selectedConeId || "");
    const newTeam = [...team];
    newTeam[activeSlotIndex] = {
      ...newTeam[activeSlotIndex],
      lightConeId: selectedConeId,
      lightConeData: selectedCone,
    };
    setTeam(newTeam);
    setShowModal(false);
    setConeSearch("");
  };

  const clearTeam = () => {
    setTeam(makeEmptyTeam());
    setClearSpeed(0);
  };

  /* ───────────── Import / Export with TeamPresets ───────────── */
  const slotToMember = (slot: PresetSlot): TeamMember => {
    const char = charInfos.find((c) => c.code === slot.characterId);
    const cone = slot.lightConeId
      ? cerydraConeMap.get(slot.lightConeId)
      : undefined;
    return {
      characterId: slot.characterId,
      characterInfo: char,
      eidolon: Math.max(0, Math.min(6, slot.eidolon | 0)),
      lightConeId: slot.lightConeId || "",
      lightConeData: cone,
      superimpose: Math.max(1, Math.min(5, slot.superimpose | 0)),
    };
  };

  const importPreset = (p: TeamPreset) => {
    const four = [...p.slots].slice(0, 4);
    while (four.length < 4) {
      four.push({
        characterId: "",
        eidolon: 0,
        lightConeId: "",
        superimpose: 1,
      });
    }
    const nextTeam = four.map(slotToMember);
    setTeam(nextTeam);

    if (typeof p.expectedCycle === "number") {
      setClearSpeed(p.expectedCycle);
    }

    setSearch("");
    setConeSearch("");
    setEidolonOpenIndex(null);
    setSuperOpenIndex(null);
    setShowPresetsPanel(false);
  };

  const formatCost = (value: number) =>
    value % 1 === 0 ? value.toString() : value.toFixed(1);

  const canExport = useMemo(() => {
    const allFilled = team.every((m) => !!m.characterId);
    const unique = new Set(team.map((m) => m.characterId)).size === 4;
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
      toast.info("Fill 4 unique characters to export.");
      return;
    }
    setExportName("");
    setExportDesc("");
    setExportCycleInput(
      String(Math.max(0, Math.floor(Number(clearSpeed))) || 0)
    );
    setShowExportModal(true);
  };


  const handleCreatePreset = async () => {
    if (!user?.id) return;

    const name = exportName.trim();
    const description = exportDesc.trim();

    // Guards
    if (!name) {
      toast.info("Please enter a preset name.");
      return;
    }

    // Block duplicate names (case-insensitive) — common 500 cause server-side
    const dup = presets.some(
      (p) => p.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (dup) {
      toast.info("A preset with that name already exists. Pick another name.");
      return;
    }

    // Must be 4 unique filled characters
    const members = team.filter((m) => !!m.characterId);
    const ids = members.map((m) => String(m.characterId));
    const uniq = new Set(ids);
    if (members.length !== 4 || uniq.size !== 4) {
      toast.info("Fill 4 unique characters to export.");
      return;
    }

    // Normalize & validate slot fields
    const slots = team.slice(0, 4).map((m, i) => {
      const eid = Number.isFinite(Number(m.eidolon))
        ? Math.max(0, Math.min(6, Number(m.eidolon)))
        : 0;
      const sup = Number.isFinite(Number(m.superimpose))
        ? Math.max(1, Math.min(5, Number(m.superimpose)))
        : 1;
      const charId = String(m.characterId || "");
      const coneId = String(m.lightConeId || "");
      if (!charId) throw new Error(`Slot ${i + 1} missing characterId`);
      return {
        characterId: charId,
        eidolon: eid,
        lightConeId: coneId,
        superimpose: sup,
      };
    });

    // expectedCycle as number or null
    let expectedCycle: number | null = null;
    if (exportCycleInput.trim() !== "") {
      const n = Number(exportCycleInput);
      if (!Number.isInteger(n) || n < 0) {
        toast.error("Expected Cycle must be a non-negative integer.");
        return;
      }
      expectedCycle = n;
    }

    const body = { name, description, slots, expectedCycle };

    try {
      const url = `${import.meta.env.VITE_API_BASE}/api/player/${
        user.id
      }/presets`;
      console.log("Creating preset →", url, body); // DEBUG: see exactly what's being sent

      const r = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const text = await r.text(); // may be empty on 500
      if (!r.ok) {
        let serverMsg = "";
        try {
          const parsed = text ? JSON.parse(text) : null;
          serverMsg = parsed?.error || parsed?.message || "";
        } catch {}
        const msg =
          serverMsg ||
          (r.status === 500
            ? "Server error (500). Check backend logs for the thrown error (often duplicate name or over limit)."
            : `Create failed (HTTP ${r.status}).`);
        throw new Error(msg);
      }

      const j = text ? JSON.parse(text) : {};
      if (j?.preset) {
        setPresets((prev) => [j.preset, ...prev]);
      } else {
        // If server didn't return the new preset, reconcile
        const rr = await fetch(
          `${import.meta.env.VITE_API_BASE}/api/player/${user.id}/presets`,
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

    // quick local sanity check (prevents calling API with a bogus id)
    const existsLocally = presets.some((p) => p.id === presetId);
    if (!existsLocally) {
      toast.info("Preset already gone locally. Refreshing…");
      // re-fetch to reconcile
      try {
        const r = await fetch(
          `${
            import.meta.env.VITE_API_BASE
          }/api/player/${playerIdForPresets}/presets`,
          { credentials: "include" }
        );
        const j = await r.json();
        if (r.ok) setPresets(j.presets || []);
      } catch {}
      return;
    }

    try {
      // helpful debug log during dev; remove if you like
      console.log(
        "DELETE",
        `${
          import.meta.env.VITE_API_BASE
        }/api/player/${playerIdForPresets}/presets/${presetId}`
      );

      const r = await fetch(
        `${
          import.meta.env.VITE_API_BASE
        }/api/player/${playerIdForPresets}/presets/${presetId}`,
        { method: "DELETE", credentials: "include" }
      );

      if (r.status === 404) {
        // ...
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


      if (r.status === 404) {
        // Server says it doesn't exist — reconcile the list.
        toast.info("Preset not found on server. Refreshing list…");
        const rr = await fetch(
          `${
            import.meta.env.VITE_API_BASE
          }/api/player/${playerIdForPresets}/presets`,
          { credentials: "include" }
        );
        if (rr.ok) {
          const jj = await rr.json();
          setPresets(jj.presets || []);
        }
        return;
      }

      if (!r.ok) throw new Error(`Delete failed (HTTP ${r.status})`);

      // success (many APIs return 204 No Content)
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
        backgroundImage: "url('/background2.webp')",
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
          <Link to="/cerydra" className="btn back-button-glass">
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
              <label className="form-label small mb-1">Cycles</label>
              <input
                type="number"
                className="form-control form-control-sm bg-dark text-white mb-2"
                value={clearSpeed}
                min={0}
                step={1}
                inputMode="numeric"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setClearSpeed(0);
                    return;
                  }
                  const n = Math.max(0, Math.floor(Number(v)));
                  if (Number.isFinite(n)) setClearSpeed(n);
                }}
                title="Saved to presets as Expected Cycle"
              />

              {/* Totals: Cerydra + Cipher */}
              <div className="d-flex gap-2 flex-wrap mb-2">
                <span
                  className="badge"
                  style={{
                    background: "rgba(10, 170, 255, 0.2)",
                    border: "1px solid rgba(10,170,255,0.35)",
                  }}
                >
                  Cerydra: {totalCerydraCost.toFixed(2)}
                </span>
                <span
                  className="badge"
                  style={{
                    background: "rgba(255, 170, 20, 0.18)",
                    border: "1px solid rgba(255,170,20,0.35)",
                  }}
                >
                  Cipher: {totalCipherCost.toFixed(2)}
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
                        ? "Fill 4 unique characters to export"
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
            <div ref={slotsRef} className="ct-team-slots">
              {team.map((member, index) => {
                const char = member.characterInfo;
                const cone = member.lightConeData;

                const eCery = char ? cerydraCharCost(member) : 0; // E COST
                const sCery = cone ? cerydraConeCost(member) : 0; // LC COST

                return (
                  <div key={index} className="ct-slot">
                    {/* Card */}
                    <div
                      className="draft-card ct ct-card"
                      onClick={() => char && openConeModal(index)}
                      style={{ cursor: char ? "pointer" : "default" }}
                    >
                      {char ? (
                        <>
                          {/* Full image area */}
                          <img
                            src={char.image_url}
                            alt={char.name}
                            className="draft-img"
                            loading="lazy"
                            onError={(e) => {
                              (
                                e.currentTarget as HTMLImageElement
                              ).style.visibility = "hidden";
                            }}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />

                          {/* Light Cone overlay (doesn’t affect layout) */}
                          {cone && (
                            <img
                              src={cone.imageUrl}
                              alt={cone.name}
                              title={cone.name}
                              className="engine-badge ct-engine"
                              onClick={(e) => {
                                e.stopPropagation();
                                openConeModal(index);
                              }}
                            />
                          )}

                          {/* Eidolon slider */}
                          {eidolonOpenIndex === index && (
                            <div
                              ref={eidolonRef}
                              className="slider-panel ct-slider-panel"
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <div className="slider-label">Eidolon</div>
                              <input
                                type="range"
                                min={0}
                                max={6}
                                className="big-slider"
                                value={member.eidolon}
                                onChange={(e) => {
                                  const updated = [...team];
                                  updated[index].eidolon = Number(
                                    (e.target as HTMLInputElement).value
                                  );
                                  setTeam(updated);
                                }}
                              />
                              <div className="slider-ticks mt-1">
                                {[0, 1, 2, 3, 4, 5, 6].map((v) => (
                                  <span
                                    key={v}
                                    className={
                                      member.eidolon === v ? "active" : ""
                                    }
                                  >
                                    {v}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Superimpose slider */}
                          {superOpenIndex === index && (
                            <div
                              ref={superRef}
                              className="slider-panel ct-slider-panel"
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <div className="slider-label">
                                Superimposition
                              </div>
                              <input
                                type="range"
                                min={1}
                                max={Math.max(
                                  5,
                                  member.lightConeData?.costs.length ?? 5
                                )}
                                className="big-slider"
                                value={member.superimpose}
                                onChange={(e) => {
                                  const updated = [...team];
                                  updated[index].superimpose = Number(
                                    (e.target as HTMLInputElement).value
                                  );
                                  setTeam(updated);
                                }}
                              />
                              <div className="slider-ticks mt-1">
                                {[1, 2, 3, 4, 5].map((v) => (
                                  <span
                                    key={v}
                                    className={
                                      member.superimpose === v ? "active" : ""
                                    }
                                  >
                                    S{v}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Bottom info bar */}
                          <div
                            className="info-bar ct-info"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div
                              className="char-name"
                              title={char.name}
                              style={{ textAlign: "center", fontWeight: 700 }}
                            >
                              {char.name}
                            </div>

                            {/* Centered 4 pills: E | E COST | LC COST | S */}
                            <div className="chip-row four">
                              {/* E (open Eidolon) */}
                              <span
                                className="chip clickable"
                                title="Set Eidolon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSuperOpenIndex(null);
                                  setEidolonOpenIndex(
                                    eidolonOpenIndex === index ? null : index
                                  );
                                }}
                              >
                                E{member.eidolon}
                              </span>

                              {/* E COST */}
                              <span
                                className="chip cost"
                                title="Character cost"
                              >
                                {formatCost(eCery)}
                              </span>

                              {/* LC COST (spacer if no cone) */}
                              {cone ? (
                                <span
                                  className="chip cost"
                                  title="Light Cone cost"
                                >
                                  {formatCost(sCery)}
                                </span>
                              ) : (
                                <span
                                  className="chip-spacer"
                                  aria-hidden="true"
                                />
                              )}

                              {/* S (open Superimpose; spacer if no cone) */}
                              {cone ? (
                                <span
                                  className="chip clickable"
                                  title="Set Superimpose"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEidolonOpenIndex(null);
                                    setSuperOpenIndex(
                                      superOpenIndex === index ? null : index
                                    );
                                  }}
                                >
                                  S{member.superimpose}
                                </span>
                              ) : (
                                <span
                                  className="chip-spacer"
                                  aria-hidden="true"
                                />
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="d-flex w-100 h-100 align-items-center justify-content-center" />
                      )}
                    </div>

                    {/* Remove bar below the card */}
                    <div
                      style={{
                        marginTop: 6,
                        background: "rgba(0,0,0,0.55)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        padding: 6,
                      }}
                    >
                      <button
                        className="btn btn-outline-danger btn-sm w-100"
                        onClick={() => removeSlot(index)}
                        disabled={!char}
                        title={char ? "Remove this member" : "Empty slot"}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Character Pool */}
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
              {/* Scroll container */}
              <div
                style={{
                  height: "clamp(260px, 46vh, 560px)", // responsive height
                  overflowY: "auto",
                  WebkitOverflowScrolling: "touch",
                  overscrollBehavior: "contain",
                  touchAction: "pan-y",
                }}
              >
                {/* Sticky search inside the scroller */}
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

                {/* Grid */}
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
                    {charInfos
                      .filter((c) => {
                        const q = search.toLowerCase();
                        return (
                          c.name.toLowerCase().includes(q) ||
                          c.subname?.toLowerCase().includes(q)
                        );
                      })
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((char) => (
                        <div
                          key={char.code}
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

        {/* Light Cone Modal */}
        <Modal
          show={showModal}
          onHide={() => setShowModal(false)}
          onExited={unlockBody}
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
              placeholder="Search by name or subname..."
              value={coneSearch}
              onChange={(e) => setConeSearch(e.target.value)}
            />

            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              <ul className="list-group">
                <li
                  className={`list-group-item list-group-item-action ${
                    selectedConeId === "" ? "active" : ""
                  }`}
                  onClick={() => setSelectedConeId("")}
                  style={{ cursor: "pointer" }}
                >
                  None
                </li>
                {(() => {
                  const searchLower = coneSearch.toLowerCase();
                  const activeChar =
                    activeSlotIndex !== null
                      ? team[activeSlotIndex].characterInfo
                      : undefined;
                  const activeCharName = activeChar?.name.toLowerCase();
                  const activeCharSubname = activeChar?.subname?.toLowerCase();

                  const filteredCones = cones.filter((cone) => {
                    const name = cone.name?.toLowerCase() || "";
                    const sub = cone.subname?.toLowerCase() || "";
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

                  filteredCones.sort((a, b) => {
                    if (!activeCharName && !activeCharSubname) return 0;
                    const aSub = a.subname?.toLowerCase() || "";
                    const bSub = b.subname?.toLowerCase() || "";
                    const aMatches =
                      (activeCharName && aSub.includes(activeCharName)) ||
                      (activeCharSubname && aSub.includes(activeCharSubname));
                    const bMatches =
                      (activeCharName && bSub.includes(activeCharName)) ||
                      (activeCharSubname && bSub.includes(activeCharSubname));
                    if (aMatches && !bMatches) return -1;
                    if (!aMatches && bMatches) return 1;
                    return 0;
                  });

                  return filteredCones.map((cone) => {
                    const isSig =
                      !!activeChar && isSignatureCone(cone, activeChar);
                    return (
                      <li
                        key={cone.id}
                        className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                          selectedConeId === cone.id ? "active" : ""
                        }`}
                        onClick={() => setSelectedConeId(cone.id)}
                        style={{
                          cursor: "pointer",
                          padding: "6px 10px",
                          gap: "10px",
                        }}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <img
                            src={cone.imageUrl}
                            alt={cone.name}
                            style={{
                              width: "32px",
                              height: "32px",
                              objectFit: "cover",
                              borderRadius: "4px",
                              border: "1px solid rgba(255,255,255,0.1)",
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 600 }}>{cone.name}</div>
                            <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                              {cone.subname} ({cone.rarity}★)
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
              onClick={confirmConeSelection}
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
              {exportCycleInput !== "" && (
                <span
                  className="badge"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    fontWeight: 600,
                  }}
                  title="Will be saved as Expected Cycle"
                >
                  Cycle: {exportCycleInput}
                </span>
              )}
            </Modal.Title>
          </Modal.Header>

          <Modal.Body>
            {/* Name + Description inputs (same limits as TeamPresets) */}
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

            {/* Expected Cycle (saved to preset) */}
            <div className="mb-3">
              <label htmlFor="export-expected-cycle" className="form-label">
                Expected Cycle
              </label>
              <input
                id="export-expected-cycle"
                type="number"
                min={0}
                step={1}
                className="form-control bg-dark text-white"
                value={exportCycleInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") return setExportCycleInput("");
                  const n = Number(v);
                  if (Number.isFinite(n) && n >= 0)
                    setExportCycleInput(String(Math.floor(n)));
                }}
                placeholder="e.g. 8"
              />
              <small className="text-white-50">
                This starts from Team Info → Cycles and will be saved to the
                preset.
              </small>
            </div>

            {/* Team preview grid (non-editable, shows what will be saved) */}
            <div className="mb-2 text-white-50 small">Team</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {team.map((m, i) => {
                const char = m.characterInfo;
                const cone = m.lightConeData;
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
                            cone
                              ? ` • ${cone.name} (S${m.superimpose})`
                              : " • No LC"
                          }`
                        : ""
                    }
                  >
                    {/* Character area */}
                    {char ? (
                      <img
                        src={char.image_url}
                        alt={char.name}
                        style={{
                          width: "100%",
                          height: cone ? 140 : 200,
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

                    {/* E badge (Cerydra-only style) */}
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

                    {/* Light cone area */}
                    {cone ? (
                      <div style={{ position: "relative" }}>
                        <img
                          src={cone.imageUrl}
                          alt={cone.name}
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
            pointerEvents: showPresetsPanel ? "auto" : "none", // optional
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

                  {typeof p.expectedCycle === "number" && (
                    <div className="small text-white-50 mb-2">
                      Cycle: {p.expectedCycle}
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 4,
                    }}
                  >
                    {p.slots.slice(0, 4).map((s, i) => {
                      const ch = charInfos.find(
                        (c) => c.code === s.characterId
                      );
                      return (
                        <div
                          key={i}
                          title={
                            ch
                              ? `${ch.name} • E${s.eidolon}`
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
