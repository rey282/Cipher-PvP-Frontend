// src/components/TeamPresets.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "./Navbar";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { Modal } from "react-bootstrap";

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

interface LightCone {
  id: string;
  name: string;
  costs: number[]; // Cerydra S costs
  imageUrl: string;
  subname: string;
  rarity: string;
}

type PresetSlot = {
  characterId: string;
  eidolon: number; // 0..6
  lightConeId: string; // "" allowed
  superimpose: number; // 1..5
  characterInfo?: CharacterInfo;
  lightConeData?: LightCone;
};

type TeamPreset = {
  id: string;
  name: string;
  description: string;
  updated_at: string;
  slots: PresetSlot[];
  expectedCycle?: number | null;
};

const MAX_PRESETS = 50;

/* Cipher backend shapes */
type CipherCharacter = { code: string; costs: number[] | any[] }; // cost[E0..E6]
type CipherCone = { id: string; limited: boolean };

/* ───────────── Component ───────────── */
export default function TeamPresets() {
  const { user } = useAuth();
  const params = useParams();
  const navigate = useNavigate();

  const targetId = params.id || user?.id;
  const isSelf = targetId === user?.id;

  const [loading, setLoading] = useState(true);
  const [presets, setPresets] = useState<TeamPreset[]>([]);
  const [error, setError] = useState<string | null>(null);

  // preset modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [slotsState, setSlotsState] = useState<PresetSlot[]>([]);
  const [expectedCycleInput, setExpectedCycleInput] = useState<string>("");

  // popup state for E/S (like CostTest)
  const [eidolonOpenIndex, setEidolonOpenIndex] = useState<number | null>(null);
  const [superOpenIndex, setSuperOpenIndex] = useState<number | null>(null);
  const slotsRef = useRef<HTMLDivElement | null>(null);
  const eidolonRefs = useRef<(HTMLDivElement | null)[]>([]);
  const superimposeRefs = useRef<(HTMLDivElement | null)[]>([]);

  // data (for cards + modal)
  const [charInfos, setCharInfos] = useState<CharacterInfo[]>([]);
  const [cones, setCones] = useState<LightCone[]>([]); // Cerydra cone costs
  const [search, setSearch] = useState("");

  const SUPERUSER_ID =
    import.meta.env.VITE_SUPERUSER_ID ?? "371513247641370625";
  const isSuperuser = user?.id === SUPERUSER_ID;

  // Cerydra character E-costs (via image id)
  const [cerCharCosts, setCerCharCosts] = useState<
    { id: string; costs: number[] }[]
  >([]);

  // Cipher datasets
  const [cipherChars, setCipherChars] = useState<CipherCharacter[]>([]);
  const [cipherCones, setCipherCones] = useState<CipherCone[]>([]);

  // cone modal state
  const [coneSearch, setConeSearch] = useState("");
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [selectedConeId, setSelectedConeId] = useState("");
  const [showConeModal, setShowConeModal] = useState(false);

  // view modal state (read-only)
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewPreset, setViewPreset] = useState<TeamPreset | null>(null);

  // bulk delete modal state
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleteText, setBulkDeleteText] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const openView = (p: TeamPreset) => {
    setViewPreset(p);
    setShowViewModal(true);
  };

  /* helpers */
  const makeEmptySlot = (): PresetSlot => ({
    characterId: "",
    eidolon: 0,
    lightConeId: "",
    superimpose: 1,
  });

  // mobile + body-unlock helpers
  const isTouchDevice =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  const anyModalOpen = () =>
    !!document.querySelector(".modal.show, .modal.d-block");

  const unlockBody = () => {
    // Only clean up body styles when no modal of any kind is open.
    if (!anyModalOpen()) {
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("overflow");
    }
    // Do NOT remove .modal-backdrop — React-Bootstrap owns those.
  };

  // ensure body unlocked whenever no modal is open, and on unmount
  useEffect(() => {
    if (!showModal && !showConeModal) {
      const t = setTimeout(unlockBody, 0);
      return () => clearTimeout(t);
    }
  }, [showModal, showConeModal]);

  useEffect(() => () => unlockBody(), []);

  /* ───────────── Fetch presets ───────────── */
  useEffect(() => {
    if (!user || !targetId) return;

    // Frontend guard: only self or superuser may view another user's presets
    if (params.id && !isSelf && !isSuperuser) {
      setError("Access Denied");
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`${import.meta.env.VITE_API_BASE}/api/player/${targetId}/presets`, {
      credentials: "include",
    })
      .then(async (r) => {
        let j: any = null;
        try {
          j = await r.json();
        } catch {
          // ignore JSON parse errors for non-200s
        }

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
        return (j ?? { presets: [] }) as { presets: TeamPreset[] };
      })
      .then((data) => {
        setPresets(data.presets || []);
        setError(null);
      })
      .catch((err: any) => {
        console.error(err);
        setPresets([]);
        setError(err.message || "Failed to load presets");
      })
      .finally(() => setLoading(false));
  }, [user, targetId, params.id, isSelf, isSuperuser]);

  /* ───────────── Fetch characters & cones & costs ───────────── */
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const [charRes, cerConeRes, cerCharCostRes, cipCharRes, cipConeRes] =
          await Promise.all([
            fetch(`${import.meta.env.VITE_API_BASE}/api/characters/all`, {
              credentials: "include",
              signal: ac.signal,
            }),
            fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/cone-balance`, {
              credentials: "include",
              signal: ac.signal,
            }),
            fetch(`${import.meta.env.VITE_API_BASE}/api/cerydra/balance`, {
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
        if (!cerConeRes.ok) throw new Error("Failed to fetch cerydra cones");
        if (!cerCharCostRes.ok)
          throw new Error("Failed to fetch cerydra char costs");
        if (!cipCharRes.ok)
          throw new Error("Failed to fetch cipher char costs");
        if (!cipConeRes.ok)
          throw new Error("Failed to fetch cipher cone flags");

        const [charData, cerConeData, cerCostData, cipCharData, cipConeData] =
          await Promise.all([
            charRes.json(),
            cerConeRes.json(),
            cerCharCostRes.json(),
            cipCharRes.json(),
            cipConeRes.json(),
          ]);

        setCharInfos(charData.data || charData || []);
        setCones(cerConeData.cones || cerConeData || []);
        setCerCharCosts(cerCostData.characters || cerCostData || []);
        setCipherChars(cipCharData.characters || cipCharData || []);
        setCipherCones(cipConeData.cones || cipConeData || []);
      } catch (err) {
        if ((err as any)?.name !== "AbortError") {
          console.error(err);
        }
      }
    })();
    return () => ac.abort();
  }, []);

  /* ───────────── Outside click to close E/S popups ───────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (slotsRef.current?.contains(t)) return;
      setEidolonOpenIndex(null);
      setSuperOpenIndex(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      if (
        eidolonOpenIndex !== null &&
        eidolonRefs.current[eidolonOpenIndex] &&
        !eidolonRefs.current[eidolonOpenIndex]!.contains(target)
      ) {
        setEidolonOpenIndex(null);
      }
      if (
        superOpenIndex !== null &&
        superimposeRefs.current[superOpenIndex] &&
        !superimposeRefs.current[superOpenIndex]!.contains(target)
      ) {
        setSuperOpenIndex(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [eidolonOpenIndex, superOpenIndex]);

  /* ───────────── Modal open helpers ───────────── */
  const openCreate = () => {
    if (presets.length >= MAX_PRESETS) {
      toast.info(`You’ve reached the maximum of ${MAX_PRESETS} presets.`);
      return;
    }
    setEditingId(null);
    setNameInput("");
    setDescriptionInput("");
    setExpectedCycleInput("");
    setSlotsState([
      makeEmptySlot(),
      makeEmptySlot(),
      makeEmptySlot(),
      makeEmptySlot(),
    ]);
    setShowModal(true);
  };
  const openEdit = (p: TeamPreset) => {
    setEditingId(p.id);
    setNameInput(p.name);
    setDescriptionInput(p.description || "");
    setExpectedCycleInput(
      p.expectedCycle !== null && p.expectedCycle !== undefined
        ? String(p.expectedCycle)
        : ""
    );
    setSlotsState(p.slots);
    setShowModal(true);
  };

  const openBulkDelete = () => {
    if (!presets.length) {
      toast.info("No presets to delete.");
      return;
    }
    setBulkDeleteText("");
    setShowBulkDelete(true);
  };

  const handleDeleteAllPresets = async () => {
    if (!targetId) return;
    if (bulkDeleteText.trim().toLowerCase() !== "confirm") {
      toast.error('Type "confirm" to enable Delete All.');
      return;
    }

    try {
      setBulkDeleting(true);

      // Adjust this URL if you prefer a different route (see backend snippet below).
      const r = await fetch(
        `${import.meta.env.VITE_API_BASE}/api/player/${targetId}/presets`,
        {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }
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
            ? "Private: you can only delete your own presets."
            : `Bulk delete failed (${r.status}).`);
        throw new Error(msg);
      }

      setPresets([]); // wipe from UI
      toast.success("All presets deleted");
      setShowBulkDelete(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };


  /* ───────────── Assign character / cone ───────────── */
  const assignCharacterToSlot = (char: CharacterInfo) => {
    // block duplicates
    if (slotsState.some((s) => s.characterId === char.code)) {
      toast.info("That character is already in the team.");
      return;
    }
    // find first empty
    const firstEmpty = slotsState.findIndex((s) => !s.characterId);
    if (firstEmpty === -1) return;

    setSlotsState((prev) => {
      const updated = [...prev];
      updated[firstEmpty] = {
        characterId: char.code,
        eidolon: 0,
        lightConeId: "",
        superimpose: 1,
        characterInfo: char,
      };
      return updated;
    });
    setSearch("");
  };

  const removeSlot = (index: number) => {
    // compact left: drop that slot, shift all selected to the left, pad empties
    setSlotsState((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      const compacted = filtered.filter((s) => !!s.characterId);
      const empties = Array.from(
        { length: 4 - compacted.length },
        makeEmptySlot
      );
      return [...compacted, ...empties];
    });
    // also close popups if they were on this index
    setEidolonOpenIndex(null);
    setSuperOpenIndex(null);
  };

  const openConeModal = (index: number) => {
    setActiveSlotIndex(index);
    setSelectedConeId(slotsState[index].lightConeId || "");
    setConeSearch("");
    setShowModal(false);
    setTimeout(() => setShowConeModal(true), 0);
  };

  const confirmConeSelection = () => {
    if (activeSlotIndex === null) return;
    const cone = cones.find((c) => c.id === selectedConeId);
    setSlotsState((prev) => {
      const updated = [...prev];
      updated[activeSlotIndex] = {
        ...updated[activeSlotIndex],
        lightConeId: selectedConeId,
        lightConeData: cone,
      };
      return updated;
    });
    setShowConeModal(false);
    setShowModal(true);
  };

  // Resolve ids -> objects
  const charByCode = useMemo(() => {
    const m = new Map<string, CharacterInfo>();
    for (const c of charInfos) m.set(c.code, c);
    return m;
  }, [charInfos]);

  const coneById = useMemo(() => {
    const m = new Map<string, LightCone>();
    for (const c of cones) m.set(c.id, c);
    return m;
  }, [cones]);

  // Maps for fast cost lookups
  const cerCharCostMap = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const c of cerCharCosts) m.set(c.id, c.costs);
    return m;
  }, [cerCharCosts]);

  const cipherCharCostMap = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const c of cipherChars) m.set(c.code.toLowerCase(), c.costs);
    return m;
  }, [cipherChars]);

  const cipherConeLimitedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const c of cipherCones) m.set(c.id, !!c.limited);
    return m;
  }, [cipherCones]);

  // Utility: extract imageId from character image_url for Cerydra char cost map
  const extractImageId = (url: string) => {
    try {
      const path = new URL(url, window.location.origin).pathname;
      const file = path.split("/").pop() ?? "";
      return file.split(".")[0];
    } catch {
      return url.match(/\/(\d+)\.(png|webp|jpg|jpeg)(\?.*)?$/i)?.[1] ?? "";
    }
  };

  // Per-slot costs
  const cerydraCharCost = (slot: PresetSlot) => {
    const char = slot.characterInfo || charByCode.get(slot.characterId);
    if (!char) return 0;
    const id = extractImageId(char.image_url);
    const arr = cerCharCostMap.get(id);
    return arr?.[slot.eidolon] ?? 0;
  };
  const cerydraConeCost = (slot: PresetSlot) => {
    if (!slot.lightConeId) return 0;
    const cone = slot.lightConeData || coneById.get(slot.lightConeId);
    if (!cone) return 0;
    return cone.costs?.[slot.superimpose - 1] ?? 0;
  };

  const cipherCharCost = (slot: PresetSlot) => {
    const arr = cipherCharCostMap.get(slot.characterId.toLowerCase());
    return arr?.[slot.eidolon] ?? 0;
  };

  const cipherConeCost = (slot: PresetSlot) => {
    if (!slot.lightConeId) return 0;
    const limited = cipherConeLimitedMap.get(slot.lightConeId);
    if (!limited) return 0;
    const steps = [0.25, 0.25, 0.5, 0.5, 0.75];
    return steps[Math.min(Math.max(slot.superimpose, 1), 5) - 1];
  };

  // Live totals (modal)
  const liveCerydraTotal = useMemo(
    () =>
      slotsState.reduce(
        (sum, s) => sum + cerydraCharCost(s) + cerydraConeCost(s),
        0
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slotsState, cerCharCostMap, coneById]
  );

  const liveCipherTotal = useMemo(
    () =>
      slotsState.reduce(
        (sum, s) => sum + cipherCharCost(s) + cipherConeCost(s),
        0
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slotsState, cipherCharCostMap, cipherConeLimitedMap]
  );

  /* ───────────── Save preset ───────────── */
  const canSubmit = useMemo(() => {
    if (!nameInput.trim()) return false;
    return slotsState.every((s) => s.characterId);
  }, [nameInput, slotsState]);

  const handleSubmit = async () => {
    if (!targetId) return;

    // Validate expectedCycle
    let expectedCycle: number | null = null;
    if (expectedCycleInput.trim() !== "") {
      const n = Number(expectedCycleInput);
      if (!Number.isInteger(n) || n < 0) {
        toast.error("Expected Cycle must be a non-negative integer.");
        return;
      }
      expectedCycle = n;
    }

    // Optional: client-side slot validation for UX (server enforces as well)
    for (const s of slotsState) {
      if (
        !s.characterId ||
        !Number.isInteger(s.eidolon) ||
        s.eidolon < 0 ||
        s.eidolon > 6 ||
        typeof s.lightConeId !== "string" ||
        !Number.isInteger(s.superimpose) ||
        s.superimpose < 1 ||
        s.superimpose > 5
      ) {
        toast.error("Each slot must have a character, E0–E6, and S1–S5.");
        return;
      }
    }

    const body = {
      name: nameInput.trim(),
      description: descriptionInput.trim(),
      expectedCycle,
      slots: slotsState.map((s) => ({
        characterId: s.characterId,
        eidolon: s.eidolon,
        lightConeId: s.lightConeId,
        superimpose: s.superimpose,
      })),
    };

    try {
      const r = await fetch(
        !editingId
          ? `${import.meta.env.VITE_API_BASE}/api/player/${targetId}/presets`
          : `${
              import.meta.env.VITE_API_BASE
            }/api/player/${targetId}/presets/${editingId}`,
        {
          method: editingId ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
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
            ? "Private: you can only manage your own presets."
            : `${editingId ? "Update" : "Create"} failed (${r.status}).`);
        throw new Error(msg);
      }

      if (!editingId) {
        setPresets((prev) => [j.preset, ...prev]);
        toast.success("Preset created");
      } else {
        setPresets((prev) =>
          prev.map((p) => (p.id === editingId ? j.preset : p))
        );
        toast.success("Preset updated");
      }
      setShowModal(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Save failed");
    }
  };

  const handleDelete = async (presetId: string) => {
    if (!targetId) return;
    if (!confirm("Delete this preset?")) return;
    try {
      const r = await fetch(
        `${
          import.meta.env.VITE_API_BASE
        }/api/player/${targetId}/presets/${presetId}`,
        { method: "DELETE", credentials: "include" }
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
            ? "Private: you can only delete your own presets."
            : `Delete failed (${r.status}).`);
        throw new Error(msg);
      }

      setPresets((prev) => prev.filter((p) => p.id !== presetId));
      toast.success("Preset deleted");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Delete failed");
    }
  };

  /* ───────────── Signature helpers (cone modal) ───────────── */
  const subnameToCharacterName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of charInfos) {
      if (c.subname) m.set(c.subname.toLowerCase(), c.name);
    }
    return m;
  }, [charInfos]);

  const isSignatureCone = (
    cone: LightCone,
    char: CharacterInfo | undefined
  ) => {
    if (!char) return false;
    const coneSub = (cone.subname || "").toLowerCase();
    const charName = char.name.toLowerCase();
    const charSub = (char.subname || "").toLowerCase();
    return coneSub === charName || (!!charSub && coneSub === charSub);
  };

  /* ───────────── Render ───────────── */
  if (!user) {
    return (
      <div
        className="text-white text-center mt-5"
        style={{ minHeight: "100vh", background: "#000" }}
      >
        <p>User not registered – join our Discord.</p>
        <a href="/" className="btn btn-outline-light mt-3">
          Back to Home
        </a>
      </div>
    );
  }
  if (params.id && !isSelf && !isSuperuser) {
    return (
      <div
        className="d-flex justify-content-center align-items-center text-danger text-center"
        style={{ minHeight: "100vh", background: "#000" }}
      >
        <div>
          <h3 className="mb-3">Access Denied</h3>
          <p>What are you trying to do???</p>
          <a href="/" className="btn btn-outline-light mt-3">
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  // Search for presets (separate from character-pool `search`)
  const [presetQuery, setPresetQuery] = useState("");

  const filteredPresets = useMemo(() => {
    const q = presetQuery.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
    );
  }, [presets, presetQuery]);

  // Saved card total calculators (computed on-the-fly)
  const savedCerydraTotal = (slots: PresetSlot[]) =>
    slots.reduce((sum, s) => {
      const char = charByCode.get(s.characterId);
      const imageId = char ? extractImageId(char.image_url) : "";
      const eArr = imageId ? cerCharCostMap.get(imageId) : undefined;
      const e = eArr?.[s.eidolon] ?? 0;

      const cone = s.lightConeId ? coneById.get(s.lightConeId) : undefined;
      const sc = cone?.costs?.[s.superimpose - 1] ?? 0;
      return sum + e + sc;
    }, 0);

  const savedCipherTotal = (slots: PresetSlot[]) =>
    slots.reduce((sum, s) => {
      const eArr = cipherCharCostMap.get(s.characterId.toLowerCase());
      const e = eArr?.[s.eidolon] ?? 0;
      const limited = cipherConeLimitedMap.get(s.lightConeId);
      const steps = [0.25, 0.25, 0.5, 0.5, 0.75];
      const sc = limited
        ? steps[Math.min(Math.max(s.superimpose, 1), 5) - 1]
        : 0;
      return sum + e + sc;
    }, 0);

  return (
    <div
      className="page-fade-in"
      style={{
        backgroundImage: "url('/profile-bg.webp')",
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
      <div className="position-relative z-2 text-white px-4 pb-5">
        <Navbar />
        <div className="w-100 d-flex justify-content-end mb-3 pe-4">
          <button
            onClick={() => navigate(-1)}
            className="btn back-button-glass"
          >
            ← Back
          </button>
        </div>

        <div className="container">
          <div className="container mb-3">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
              {/* Avatar + Title */}
              <div className="d-flex align-items-center gap-3 flex-wrap">
                {user?.avatar && (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`}
                    alt="avatar"
                    className="rounded-circle"
                    width={40}
                    height={40}
                  />
                )}
                <h2 className="m-0">Team Presets</h2>

                {presets.length > 0 && (
                  <button
                    className="btn back-button-glass ms-2"
                    style={{
                      borderColor: "rgba(255,0,0,0.4)",
                      color: "#ff6b6b",
                    }}
                    onClick={openBulkDelete}
                    aria-label="Delete all presets"
                    title="Delete all presets (requires typing confirm)"
                  >
                    🗑️ Delete All
                  </button>
                )}
              </div>

              {/* Search + Button unified pill */}
              <div
                className="input-group preset-search-group"
                style={{ maxWidth: 420 }}
              >
                {/* WRAP THE INPUT — this is the positioning anchor for the X */}
                <div className="preset-input-wrap flex-grow-1">
                  <input
                    type="text"
                    className="form-control bg-dark text-white border-secondary preset-search-input"
                    placeholder="Search presets..."
                    value={presetQuery}
                    onChange={(e) => setPresetQuery(e.target.value)}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    style={{ paddingRight: 28 }} // room for the X inside the input
                  />

                  {/* X sits INSIDE the input now (relative to .preset-input-wrap) */}
                  {presetQuery && (
                    <button
                      type="button"
                      className="preset-clear-x"
                      onClick={() => setPresetQuery("")}
                      title="Clear search"
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>

                <button
                  className="btn back-button-glass"
                  onClick={openCreate}
                  disabled={presets.length >= MAX_PRESETS}
                >
                  ＋ New Preset
                </button>
              </div>
            </div>

            {/* Small subtitle / count */}
            <div className="text-white-50 small mt-1">
              {presetQuery
                ? `${filteredPresets.length} result${
                    filteredPresets.length === 1 ? "" : "s"
                  }`
                : `${presets.length} preset${presets.length === 1 ? "" : "s"}`}
            </div>
          </div>

          {loading ? (
            <div className="text-white-50 text-center mt-5 fst-italic">
              Loading…
            </div>
          ) : error ? (
            <div className="text-danger mt-4">{error}</div>
          ) : filteredPresets.length === 0 ? (
            <div className="text-white-50 mt-4">
              {presetQuery ? (
                <>
                  No matches for “<em>{presetQuery}</em>”.
                </>
              ) : (
                <>
                  No presets yet. Click <em>New Preset</em> to add one.
                </>
              )}
            </div>
          ) : (
            <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3 mt-3">
              {filteredPresets.map((p) => (
                <div className="col" key={p.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openView(p)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openView(p);
                      }
                    }}
                    className="card bg-dark bg-opacity-75 p-3 h-100 shadow-sm"
                    style={{
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.1)",
                      cursor: "pointer",
                      transition:
                        "transform .12s ease, box-shadow .12s ease, border-color .12s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.boxShadow =
                        "0 0 0 1px rgba(10,170,255,.35), 0 6px 18px rgba(0,0,0,.35)";
                      (e.currentTarget as HTMLDivElement).style.transform =
                        "translateY(-1px)";
                      (e.currentTarget as HTMLDivElement).style.borderColor =
                        "rgba(10,170,255,.35)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.boxShadow =
                        "none";
                      (e.currentTarget as HTMLDivElement).style.transform =
                        "none";
                      (e.currentTarget as HTMLDivElement).style.borderColor =
                        "rgba(255,255,255,0.1)";
                    }}
                    aria-label={`View preset: ${p.name}`}
                  >
                    <div className="d-flex align-items-center">
                      <strong
                        className="fs-5"
                        style={{
                          color: "#0af",
                          textShadow: "0 0 8px rgba(0,170,255,.35)",
                          cursor: "pointer",
                        }}
                        onClick={() => openView(p)}
                        title="View preset"
                      >
                        {p.name}
                      </strong>

                      <span className="ms-auto text-white-50 small">
                        {new Date(p.updated_at).toLocaleString()}
                      </span>
                    </div>

                    {p.description && (
                      <button
                        className="mt-2 text-white-50 small text-start p-0 border-0 bg-transparent"
                        onClick={() => openView(p)}
                        title="View full details"
                        style={{
                          cursor: "pointer",
                          display: "-webkit-box",
                          WebkitLineClamp: 2, // ← number of lines before truncation
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "normal",
                        }}
                      >
                        {p.description}
                      </button>
                    )}

                    {/* Totals */}
                    <div className="mt-2 d-flex gap-2 flex-wrap">
                      <span
                        className="badge"
                        style={{
                          background: "rgba(10, 170, 255, 0.2)",
                          border: "1px solid rgba(10,170,255,0.35)",
                        }}
                      >
                        Cerydra: {savedCerydraTotal(p.slots).toFixed(2)}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: "rgba(255, 170, 20, 0.18)",
                          border: "1px solid rgba(255,170,20,0.35)",
                        }}
                      >
                        Cipher: {savedCipherTotal(p.slots).toFixed(2)}
                      </span>

                      {p.expectedCycle !== null &&
                        p.expectedCycle !== undefined && (
                          <span
                            className="badge"
                            style={{
                              background: "rgba(255,255,255,0.08)",
                              border: "1px solid rgba(255,255,255,0.15)",
                            }}
                          >
                            Cycle: {p.expectedCycle}
                          </span>
                        )}
                    </div>

                    {/* Saved preset slots — force 4 in one row */}
                    <div
                      className="mt-3"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: 8,
                      }}
                    >
                      {p.slots.map((s, i) => {
                        const char = charByCode.get(s.characterId);
                        const cone = s.lightConeId
                          ? coneById.get(s.lightConeId)
                          : undefined;

                        return (
                          <div
                            key={i}
                            title={
                              char
                                ? `${char.name} • E${s.eidolon}` +
                                  (cone
                                    ? ` • ${cone.name} (S${s.superimpose})`
                                    : " • No LC")
                                : s.characterId
                            }
                            style={{
                              width: "100%",
                              height: 190,
                              borderRadius: 12,
                              background: "rgba(0,0,0,0.65)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              overflow: "hidden",
                              position: "relative",
                            }}
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
                                  transition: "height .2s ease",
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

                            {/* E badge */}
                            {char && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: 6,
                                  left: 6,
                                  background: "#000",
                                  color: "#fff",
                                  fontSize: "0.75rem",
                                  padding: "2px 6px",
                                  borderRadius: 6,
                                  border: "1px solid rgba(255,255,255,0.15)",
                                }}
                              >
                                E{s.eidolon}
                              </div>
                            )}

                            {/* Light cone area */}
                            {cone ? (
                              <div style={{ position: "relative" }}>
                                <img
                                  src={cone.imageUrl}
                                  alt={cone.name}
                                  loading="lazy"
                                  style={{
                                    width: "100%",
                                    height: 60,
                                    objectFit: "cover",
                                    display: "block",
                                    borderTop:
                                      "1px solid rgba(255,255,255,0.08)",
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
                                    borderRadius: 6,
                                    border: "1px solid rgba(255,255,255,0.15)",
                                  }}
                                >
                                  S{s.superimpose}
                                </div>
                              </div>
                            ) : (
                              char && (
                                <div
                                  style={{
                                    width: "100%",
                                    height: 60,
                                    background: "rgba(255,255,255,0.05)",
                                    borderTop:
                                      "1px solid rgba(255,255,255,0.08)",
                                  }}
                                />
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 d-flex gap-2">
                      <button
                        className="btn-glass"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(p);
                        }}
                      >
                        <span className="btn-ico">✏️</span>
                        Edit
                      </button>

                      <button
                        className="btn-glass-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(p.id);
                        }}
                      >
                        <span className="btn-ico">🗑️</span>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Preset Modal */}
          {showModal && (
            <div
              className="modal d-block"
              tabIndex={-1}
              role="dialog"
              style={{
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(4px)",
                height: "100dvh",
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
              }}
              onClick={() => {
                setEidolonOpenIndex(null);
                setSuperOpenIndex(null);
                setShowModal(false);
              }}
            >
              <div
                role="document"
                className="modal-dialog modal-xl modal-dialog-centered"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-content bg-dark text-white">
                  <div className="modal-header">
                    <h5 className="modal-title">
                      {editingId ? "Edit Preset" : "New Preset"}
                    </h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      onClick={() => setShowModal(false)}
                    />
                  </div>

                  <div className="modal-body">
                    {/* Name with inline live costs (right side of the label) */}
                    <div className="mb-3">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <label htmlFor="preset-name" className="form-label m-0">
                          Name
                        </label>

                        <div className="d-flex align-items-center gap-2">
                          <div
                            className="rounded-pill px-2 py-1"
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              fontSize: "0.85rem",
                              lineHeight: 1,
                              minWidth: 92,
                              textAlign: "right",
                            }}
                          >
                            <span className="text-white-50 me-2">Cerydra</span>
                            <strong>{liveCerydraTotal.toFixed(2)}</strong>
                          </div>
                          <div
                            className="rounded-pill px-2 py-1"
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              fontSize: "0.85rem",
                              lineHeight: 1,
                              minWidth: 92,
                              textAlign: "right",
                            }}
                          >
                            <span className="text-white-50 me-2">Cipher</span>
                            <strong>{liveCipherTotal.toFixed(2)}</strong>
                          </div>
                        </div>
                      </div>

                      <input
                        id="preset-name"
                        type="text"
                        className="form-control bg-dark text-white"
                        value={nameInput}
                        maxLength={40}
                        onChange={(e) => setNameInput(e.target.value)}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        inputMode="text"
                      />
                    </div>

                    {/* Description */}
                    <div className="mb-3">
                      <label htmlFor="preset-desc" className="form-label">
                        Description
                      </label>
                      <textarea
                        id="preset-desc"
                        className="form-control bg-dark text-white"
                        value={descriptionInput}
                        rows={3}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next.length <= 300) setDescriptionInput(next);
                        }}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                      />
                      <small className="text-white-50">
                        {descriptionInput.length}/300
                      </small>
                    </div>

                    {/* Slots — CostTest-style cards with E/S popups */}
                    <div
                      ref={slotsRef}
                      className="d-flex gap-2 mb-3"
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "nowrap",
                        overflowX: "auto",
                        overflowY: "hidden",
                        paddingBottom: 4,
                      }}
                    >
                      {slotsState.map((slot, idx) => {
                        const char =
                          slot.characterInfo ||
                          charInfos.find((c) => c.code === slot.characterId);
                        const cone =
                          slot.lightConeData ||
                          cones.find((c) => c.id === slot.lightConeId);

                        return (
                          <div
                            key={idx}
                            onClick={() => char && openConeModal(idx)}
                            style={{
                              flex: "0 0 auto",
                              width: 120,
                              height: 220,
                              borderRadius: 12,
                              background: "rgba(0,0,0,0.7)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              cursor: char ? "pointer" : "default",
                              overflow: "visible",
                              position: "relative",
                            }}
                          >
                            {char ? (
                              <>
                                {/* character area */}
                                <div style={{ position: "relative" }}>
                                  <img
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
                                      height: cone ? 140 : 220,
                                      objectFit: "cover",
                                      transition: "height 0.3s ease",
                                      borderTopLeftRadius: 12,
                                      borderTopRightRadius: 12,
                                    }}
                                  />

                                  {/* EIDOLON badge + popup */}
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
                                        setSuperOpenIndex(null);
                                        setEidolonOpenIndex(
                                          eidolonOpenIndex === idx ? null : idx
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
                                          borderRadius: 6,
                                        }}
                                      >
                                        E{slot.eidolon}
                                      </div>

                                      {eidolonOpenIndex === idx && (
                                        <div
                                          ref={(el) => {
                                            eidolonRefs.current[idx] = el;
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          style={{
                                            position: "absolute",
                                            top: "calc(100% - 1px)",
                                            left: 0,
                                            width: 180,
                                            background: "rgba(0,0,0,0.85)",
                                            padding: 8,
                                            borderRadius: 10,
                                            boxShadow:
                                              "0 0 6px rgba(0,0,0,0.6)",
                                            backdropFilter: "blur(4px)",
                                            zIndex: 999,
                                          }}
                                        >
                                          <input
                                            type="range"
                                            min={0}
                                            max={6}
                                            step={1}
                                            value={slot.eidolon}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              const updated = [...slotsState];
                                              updated[idx].eidolon = Number(
                                                e.target.value
                                              );
                                              setSlotsState(updated);
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
                                                    slot.eidolon === i
                                                      ? "#0af"
                                                      : "#ccc",
                                                  fontWeight:
                                                    slot.eidolon === i
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

                                  {/* remove char */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeSlot(idx);
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

                                {/* cone area — only render if we actually have a cone */}
                                {cone && (
                                  <div style={{ position: "relative" }}>
                                    <img
                                      src={cone.imageUrl}
                                      alt={cone.name}
                                      loading="lazy"
                                      onError={(e) => {
                                        (
                                          e.currentTarget as HTMLImageElement
                                        ).style.visibility = "hidden";
                                      }}
                                      style={{
                                        width: "100%",
                                        height: 80,
                                        objectFit: "cover",
                                        borderBottomLeftRadius: 12,
                                        borderBottomRightRadius: 12,
                                      }}
                                    />

                                    {/* SUPER badge + popup */}
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
                                          setEidolonOpenIndex(null);
                                          setSuperOpenIndex(
                                            superOpenIndex === idx ? null : idx
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
                                            borderRadius: 6,
                                          }}
                                        >
                                          S{slot.superimpose}
                                        </div>

                                        {superOpenIndex === idx && (
                                          <div
                                            ref={(el) => {
                                              superimposeRefs.current[idx] = el;
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                              position: "absolute",
                                              bottom: "calc(100% - 1px)",
                                              left: 0,
                                              width: 180,
                                              background: "rgba(0,0,0,0.85)",
                                              padding: 8,
                                              borderRadius: 10,
                                              boxShadow:
                                                "0 0 6px rgba(0,0,0,0.6)",
                                              backdropFilter: "blur(4px)",
                                              zIndex: 999,
                                            }}
                                          >
                                            <input
                                              type="range"
                                              min={1}
                                              max={5}
                                              step={1}
                                              value={slot.superimpose}
                                              onChange={(e) => {
                                                e.stopPropagation();
                                                const updated = [...slotsState];
                                                updated[idx].superimpose =
                                                  Number(e.target.value);
                                                setSlotsState(updated);
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
                                                "S1",
                                                "S2",
                                                "S3",
                                                "S4",
                                                "S5",
                                              ].map((label, i) => (
                                                <span
                                                  key={i}
                                                  style={{
                                                    color:
                                                      slot.superimpose === i + 1
                                                        ? "#0af"
                                                        : "#ccc",
                                                    fontWeight:
                                                      slot.superimpose === i + 1
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
                                  </div>
                                )}
                              </>
                            ) : (
                              // EMPTY: one solid block, no cone strip
                              <div
                                style={{
                                  width: "100%",
                                  height: 220,
                                  background: "rgba(255,255,255,0.05)",
                                  borderRadius: 12,
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                      {/* Expected Cycle */}
                      <div className="mb-3">
                        <label
                          htmlFor="preset-expected-cycle"
                          className="form-label m-0"
                        >
                          Expected Cycle
                        </label>
                        <input
                          id="preset-expected-cycle"
                          type="number"
                          min={0}
                          step={1}
                          className="form-control bg-dark text-white"
                          value={expectedCycleInput}
                          onChange={(e) => {
                            const v = e.target.value;
                            // allow empty string to mean "unset"
                            if (v === "") return setExpectedCycleInput("");
                            // only allow non-negative integers
                            const n = Number(v);
                            if (!Number.isNaN(n) && n >= 0)
                              setExpectedCycleInput(String(Math.floor(n)));
                          }}
                          placeholder="e.g. 8"
                        />
                        <small className="text-white-50">
                          Optional. Leave blank if you don’t want to set a
                          target cycle.
                        </small>
                      </div>
                    </div>

                    {/* Character Pool */}
                    {/* Character Pool (self-scrolling inside modal) */}
                    <div
                      style={{
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(0,0,0,0.45)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "clamp(220px, 42vh, 480px)",
                          overflowY: "auto",
                          WebkitOverflowScrolling: "touch",
                          overscrollBehavior: "contain",
                          touchAction: "pan-y",
                        }}
                      >
                        {/* Sticky search */}
                        <div
                          style={{
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                            background: "rgba(0,0,0,.85)",
                            padding: 10,
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
                              .map((char) => {
                                const alreadyPicked = slotsState.some(
                                  (s) => s.characterId === char.code
                                );
                                return (
                                  <div
                                    key={char.code}
                                    onClick={() =>
                                      !alreadyPicked &&
                                      assignCharacterToSlot(char)
                                    }
                                    title={
                                      alreadyPicked
                                        ? `${char.name} is already selected`
                                        : char.name
                                    }
                                    style={{
                                      width: 60,
                                      height: 60,
                                      borderRadius: 6,
                                      border: "1px solid #444",
                                      backgroundImage: `url(${char.image_url})`,
                                      backgroundSize: "cover",
                                      backgroundPosition: "center",
                                      cursor: alreadyPicked
                                        ? "not-allowed"
                                        : "pointer",
                                      opacity: alreadyPicked ? 0.35 : 1,
                                      pointerEvents: alreadyPicked
                                        ? "none"
                                        : "auto",
                                      filter: alreadyPicked
                                        ? "grayscale(80%)"
                                        : "none",
                                    }}
                                  />
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      className="btn-glass-muted"
                      onClick={() => setShowModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn-glass-primary"
                      disabled={!canSubmit}
                      onClick={handleSubmit}
                    >
                      {editingId ? "Save Changes" : "Create Preset"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Light Cone Modal (signature-first, dark items, returns to preset on close) */}
          <Modal
            show={showConeModal}
            onHide={() => {
              setShowConeModal(false);
              setShowModal(true);
            }}
            onExited={unlockBody}
            centered
            contentClassName="bg-dark text-white"
          >
            <Modal.Header closeButton>
              <Modal.Title>Select Light Cone</Modal.Title>
            </Modal.Header>

            <Modal.Body>
              <input
                type="text"
                className="form-control mb-2 bg-dark text-white"
                placeholder="Search by name or subname..."
                value={coneSearch}
                onChange={(e) => setConeSearch(e.target.value)}
              />

              <div
                style={{
                  maxHeight: 300,
                  overflowY: "auto",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                <ul className="list-group">
                  {/* None option */}
                  <li
                    className={`list-group-item list-group-item-action ${
                      selectedConeId === "" ? "active" : ""
                    }`}
                    onClick={() => setSelectedConeId("")}
                    style={{
                      cursor: "pointer",
                      backgroundColor: selectedConeId === "" ? "#444" : "#222",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    None
                  </li>

                  {(() => {
                    const searchLower = coneSearch.toLowerCase();

                    const activeChar =
                      activeSlotIndex !== null
                        ? slotsState[activeSlotIndex].characterInfo ||
                          charInfos.find(
                            (c) =>
                              c.code === slotsState[activeSlotIndex].characterId
                          )
                        : undefined;

                    const filtered = cones
                      .filter((cone) => {
                        const name = (cone.name || "").toLowerCase();
                        const sub = (cone.subname || "").toLowerCase();
                        if (
                          name.includes(searchLower) ||
                          sub.includes(searchLower)
                        )
                          return true;

                        for (const [
                          subKey,
                          charName,
                        ] of subnameToCharacterName.entries()) {
                          if (
                            subKey.includes(searchLower) &&
                            (name.includes(charName.toLowerCase()) ||
                              sub.includes(charName.toLowerCase()))
                          ) {
                            return true;
                          }
                        }
                        return false;
                      })
                      .slice();

                    filtered.sort((a, b) => {
                      const aSig = isSignatureCone(a, activeChar);
                      const bSig = isSignatureCone(b, activeChar);
                      if (aSig && !bSig) return -1;
                      if (!aSig && bSig) return 1;
                      return 0;
                    });

                    return filtered.map((cone) => {
                      const active = selectedConeId === cone.id;
                      const sig = isSignatureCone(cone, activeChar);

                      return (
                        <li
                          key={cone.id}
                          className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                            active ? "active" : ""
                          }`}
                          onClick={() => setSelectedConeId(cone.id)}
                          style={{
                            cursor: "pointer",
                            padding: "6px 10px",
                            gap: "10px",
                            backgroundColor: active ? "#444" : "#222",
                            color: "white",
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          <div className="d-flex align-items-center gap-2">
                            <img
                              src={cone.imageUrl}
                              alt={cone.name}
                              style={{
                                width: 32,
                                height: 32,
                                objectFit: "cover",
                                borderRadius: 4,
                                border: "1px solid rgba(255,255,255,0.1)",
                              }}
                            />
                            <div>
                              <div style={{ fontWeight: 600 }}>{cone.name}</div>
                              <div
                                style={{ fontSize: "0.75rem", opacity: 0.8 }}
                              >
                                {cone.subname} ({cone.rarity}★)
                              </div>
                            </div>
                          </div>

                          {sig && (
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
                onClick={() => {
                  setShowConeModal(false);
                  setShowModal(true);
                }}
              >
                Cancel
              </button>
              <button
                className="btn-glass-primary"
                onClick={() => {
                  confirmConeSelection();
                  setShowModal(true);
                }}
              >
                Confirm
              </button>
            </Modal.Footer>
          </Modal>
          {/* View Preset Modal (read-only) */}
          <Modal
            show={showViewModal}
            onHide={() => setShowViewModal(false)}
            centered
            contentClassName="bg-dark text-white"
          >
            <Modal.Header closeButton>
              <Modal.Title>
                {viewPreset?.name}
                <span
                  className="ms-2 text-white-50"
                  style={{ fontSize: "0.9rem" }}
                >
                  {viewPreset &&
                    new Date(viewPreset.updated_at).toLocaleString()}
                </span>
              </Modal.Title>
            </Modal.Header>

            <Modal.Body>
              {viewPreset?.description ? (
                <p className="text-white-75" style={{ whiteSpace: "pre-wrap" }}>
                  {viewPreset.description}
                </p>
              ) : (
                <p className="text-white-50 fst-italic m-0">No description.</p>
              )}

              {/* Totals */}
              {viewPreset && (
                <div className="mt-3 d-flex gap-2 flex-wrap">
                  <span
                    className="badge"
                    style={{
                      background: "rgba(10,170,255,0.2)",
                      border: "1px solid rgba(10,170,255,0.35)",
                    }}
                  >
                    Cerydra: {savedCerydraTotal(viewPreset.slots).toFixed(2)}
                  </span>
                  <span
                    className="badge"
                    style={{
                      background: "rgba(255,170,20,0.18)",
                      border: "1px solid rgba(255,170,20,0.35)",
                    }}
                  >
                    Cipher: {savedCipherTotal(viewPreset.slots).toFixed(2)}
                  </span>
                  {viewPreset.expectedCycle !== null &&
                    viewPreset.expectedCycle !== undefined && (
                      <span
                        className="badge"
                        style={{
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.15)",
                        }}
                      >
                        Cycle: {viewPreset.expectedCycle}
                      </span>
                    )}
                </div>
              )}

              {/* Slots preview (same look as cards) */}
              {viewPreset && (
                <div
                  className="mt-3"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0,1fr))",
                    gap: 8,
                  }}
                >
                  {viewPreset.slots.map((s, i) => {
                    const char = charByCode.get(s.characterId);
                    const cone = s.lightConeId
                      ? coneById.get(s.lightConeId)
                      : undefined;
                    return (
                      <div
                        key={i}
                        style={{
                          width: "100%",
                          height: 190,
                          borderRadius: 12,
                          background: "rgba(0,0,0,0.65)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          overflow: "hidden",
                          position: "relative",
                        }}
                        title={
                          char
                            ? `${char.name} • E${s.eidolon}${
                                cone
                                  ? ` • ${cone.name} (S${s.superimpose})`
                                  : " • No LC"
                              }`
                            : s.characterId
                        }
                      >
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
                        {char && (
                          <div
                            style={{
                              position: "absolute",
                              top: 6,
                              left: 6,
                              background: "#000",
                              color: "#fff",
                              fontSize: "0.75rem",
                              padding: "2px 6px",
                              borderRadius: 6,
                              border: "1px solid rgba(255,255,255,0.15)",
                            }}
                          >
                            E{s.eidolon}
                          </div>
                        )}
                        {cone ? (
                          <div style={{ position: "relative" }}>
                            <img
                              src={cone.imageUrl}
                              alt={cone.name}
                              loading="lazy"
                              style={{
                                width: "100%",
                                height: 60,
                                objectFit: "cover",
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
                                borderRadius: 6,
                                border: "1px solid rgba(255,255,255,0.15)",
                              }}
                            >
                              S{s.superimpose}
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
              )}
            </Modal.Body>

            <Modal.Footer>
              <button
                className="btn-glass-primary"
                onClick={() => setShowViewModal(false)}
              >
                Close
              </button>
            </Modal.Footer>
          </Modal>

          <Modal
            show={showBulkDelete}
            onHide={() => setShowBulkDelete(false)}
            centered
            contentClassName="bg-dark text-white"
          >
            <Modal.Header closeButton>
              <Modal.Title>Delete All Presets</Modal.Title>
            </Modal.Header>

            <Modal.Body>
              <p className="mb-2">
                This will permanently delete <strong>all</strong> your team
                presets
                {isSuperuser && !isSelf ? " for this user" : ""}. This action
                cannot be undone.
              </p>
              <p className="text-warning">
                To proceed, type <code>confirm</code> below.
              </p>

              <input
                type="text"
                className="form-control bg-dark text-white"
                placeholder='Type "confirm" to enable'
                value={bulkDeleteText}
                onChange={(e) => setBulkDeleteText(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </Modal.Body>

            <Modal.Footer>
              <button
                className="btn-glass-muted"
                onClick={() => setShowBulkDelete(false)}
                disabled={bulkDeleting}
              >
                Cancel
              </button>
              <button
                className="btn-glass-danger"
                onClick={handleDeleteAllPresets}
                disabled={
                  bulkDeleting ||
                  bulkDeleteText.trim().toLowerCase() !== "confirm"
                }
              >
                {bulkDeleting ? "Deleting…" : "Delete All"}
              </button>
            </Modal.Footer>
          </Modal>
        </div>
      </div>
    </div>
  );
}
