// src/components/ZzzTeamPresets.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "./Navbar";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { Modal } from "react-bootstrap";

/* ───────────── Types (ZZZ) ───────────── */
interface ZzzCharacterInfo {
  code: string;
  name: string;
  subname?: string;
  rarity: number;
  image_url: string;
  limited: boolean;
}

interface WEngine {
  id: string; // keep as string
  name: string;
  subname?: string;
  rarity: number;
  imageUrl: string;
  limited: boolean;
  costs?: number[]; // R1..R5 cost array from balance endpoint
}

type ZzzPresetSlot = {
  characterId: string;
  mindscape: number; // 0..6
  wengineId: string; // "" allowed
  refinement: number; // 1..5
  characterInfo?: ZzzCharacterInfo;
  wengineData?: WEngine;
};

type ZzzTeamPreset = {
  id: string;
  name: string;
  description: string;
  updated_at: string;
  slots: ZzzPresetSlot[];
  expectedScore?: number | null;
};

const MAX_PRESETS = 50;

/* ───────────── Component ───────────── */
export default function ZzzTeamPresets() {
  const { user } = useAuth();
  const params = useParams();
  const navigate = useNavigate();

  const targetId = params.id || user?.id;
  const isSelf = targetId === user?.id;

  const SUPERUSER_ID =
    import.meta.env.VITE_SUPERUSER_ID ?? "371513247641370625";
  const isSuperuser = user?.id === SUPERUSER_ID;

  const [loading, setLoading] = useState(true);
  const [presets, setPresets] = useState<ZzzTeamPreset[]>([]);
  const [error, setError] = useState<string | null>(null);

  // preset search
  const [presetQuery, setPresetQuery] = useState("");

  // preset modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [expectedScoreInput, setExpectedScoreInput] = useState("");
  const [slotsState, setSlotsState] = useState<ZzzPresetSlot[]>([]);

  // popup state for Mindscape / Refinement (same UX as HSR)
  const [mindscapeOpenIndex, setMindscapeOpenIndex] = useState<number | null>(
    null
  );
  const [refineOpenIndex, setRefineOpenIndex] = useState<number | null>(null);
  const slotsRef = useRef<HTMLDivElement | null>(null);
  const mindscapeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const refineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // data for cards + modals
  const [characters, setCharacters] = useState<ZzzCharacterInfo[]>([]);
  const [wengines, setWengines] = useState<WEngine[]>([]);
  const [search, setSearch] = useState("");

  // maps for costs
  const [charCostMap, setCharCostMap] = useState<Map<string, number[]>>(
    new Map()
  ); // code -> M0..M6
  const [wengineCostMap, setWengineCostMap] = useState<Map<string, number[]>>(
    new Map()
  ); // id -> R1..R5

  // w-engine modal state
  const [wengineSearch, setWengineSearch] = useState("");
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [selectedWengineId, setSelectedWengineId] = useState("");
  const [showWengineModal, setShowWengineModal] = useState(false);

  // view modal state (read-only)
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewPreset, setViewPreset] = useState<ZzzTeamPreset | null>(null);

  // bulk delete modal state
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleteText, setBulkDeleteText] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const openView = (p: ZzzTeamPreset) => {
    setViewPreset(p);
    setShowViewModal(true);
  };

  /* helpers */
  const makeEmptySlot = (): ZzzPresetSlot => ({
    characterId: "",
    mindscape: 0,
    wengineId: "",
    refinement: 1,
  });

  const isTouchDevice =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  const anyModalOpen = () =>
    !!document.querySelector(".modal.show, .modal.d-block");

  const unlockBody = () => {
    if (!anyModalOpen()) {
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("overflow");
    }
  };

  useEffect(() => {
    if (!showModal && !showWengineModal) {
      const t = setTimeout(unlockBody, 0);
      return () => clearTimeout(t);
    }
  }, [showModal, showWengineModal]);

  useEffect(() => () => unlockBody(), []);

  // Accent/spacing tolerant search
  const norm = (s: string = "") =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const matchesCharacterQuery = (char: ZzzCharacterInfo, query: string) => {
    if (!query) return true;
    const safeSub =
      char.subname && String(char.subname).toLowerCase() !== "null"
        ? char.subname
        : "";
    const haystack = [char.name, safeSub].filter(Boolean).map(norm).join(" ");
    const needles = norm(query).split(" ").filter(Boolean);
    return needles.every((t) => haystack.includes(t));
  };

  /* ───────────── Fetch presets ───────────── */
  useEffect(() => {
    if (!user || !targetId) return;

    if (params.id && !isSelf && !isSuperuser) {
      setError("Access Denied");
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(
      `${import.meta.env.VITE_API_BASE}/api/zzz/player/${targetId}/presets`,
      {
        credentials: "include",
      }
    )
      .then(async (r) => {
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
        return (j ?? { presets: [] }) as { presets: ZzzTeamPreset[] };
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

  /* ───────────── Fetch ZZZ characters & wengines & costs ───────────── */
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        const [charRes, wengineRes, charCostRes, wengineCostRes] =
          await Promise.all([
            fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/characters`, {
              credentials: "include",
              signal: ac.signal,
            }),
            fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/wengines`, {
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
        if (!wengineRes.ok) throw new Error("Failed to fetch ZZZ W-Engines");
        if (!charCostRes.ok) throw new Error("Failed to fetch ZZZ balance");
        if (!wengineCostRes.ok)
          throw new Error("Failed to fetch ZZZ W-Engine balance");

        const [charJson, wengineJson, charCostJson, wengineCostJson] =
          await Promise.all([
            charRes.json(),
            wengineRes.json(),
            charCostRes.json(),
            wengineCostRes.json(),
          ]);

        setCharacters(charJson.data || charJson || []);

        setWengines(
          (wengineJson.data || wengineJson || []).map((w: any) => ({
            id: String(w.id),
            name: w.name,
            subname: w.subname,
            rarity: Number(w.rarity) || 5,
            limited: !!w.limited,
            imageUrl: w.image_url || w.imageUrl || "",
          }))
        );

        // /api/zzz/balance returns { characters: [{ id: code, costs: [...] }] }
        setCharCostMap(
          new Map(
            (charCostJson.characters || charCostJson || []).map((c: any) => [
              String(c.id),
              Array.isArray(c.costs) ? c.costs : [0, 0, 0, 0, 0, 0, 0],
            ])
          )
        );

        // /api/zzz/wengine-balance returns { wengines: [{ id, costs: [...] }] }
        setWengineCostMap(
          new Map(
            (wengineCostJson.wengines || wengineCostJson || []).map(
              (w: any) => [
                String(w.id),
                Array.isArray(w.costs) ? w.costs : [0, 0, 0, 0, 0],
              ]
            )
          )
        );
      } catch (err) {
        if ((err as any)?.name !== "AbortError") console.error(err);
      }
    })();

    return () => ac.abort();
  }, []);

  /* ───────────── Outside click to close popups ───────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (slotsRef.current?.contains(t)) return;
      setMindscapeOpenIndex(null);
      setRefineOpenIndex(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      if (
        mindscapeOpenIndex !== null &&
        mindscapeRefs.current[mindscapeOpenIndex] &&
        !mindscapeRefs.current[mindscapeOpenIndex]!.contains(target)
      ) {
        setMindscapeOpenIndex(null);
      }
      if (
        refineOpenIndex !== null &&
        refineRefs.current[refineOpenIndex] &&
        !refineRefs.current[refineOpenIndex]!.contains(target)
      ) {
        setRefineOpenIndex(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mindscapeOpenIndex, refineOpenIndex]);

  /* ───────────── Fast id -> object maps ───────────── */
  const charByCode = useMemo(() => {
    const m = new Map<string, ZzzCharacterInfo>();
    for (const c of characters) m.set(c.code, c);
    return m;
  }, [characters]);

  const wengineById = useMemo(() => {
    const m = new Map<string, WEngine>();
    for (const w of wengines) m.set(String(w.id), w);
    return m;
  }, [wengines]);

  /* ───────────── Costs ───────────── */
  const zzzCharCost = (slot: ZzzPresetSlot) => {
    const arr = charCostMap.get(slot.characterId);
    return arr?.[slot.mindscape] ?? 0;
  };

  const zzzWengineCost = (slot: ZzzPresetSlot) => {
    if (!slot.wengineId) return 0;
    const arr = wengineCostMap.get(String(slot.wengineId));
    return arr?.[Math.min(Math.max(slot.refinement, 1), 5) - 1] ?? 0;
  };

  const liveZzzTotal = useMemo(
    () =>
      slotsState.reduce(
        (sum, s) => sum + zzzCharCost(s) + zzzWengineCost(s),
        0
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slotsState, charCostMap, wengineCostMap]
  );

  const fmt = (v: number) => {
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(2).replace(/\.?0+$/, "");
  };


  /* ───────────── Create / Edit modal helpers ───────────── */
  const openCreate = () => {
    if (presets.length >= MAX_PRESETS) {
      toast.info(`You’ve reached the maximum of ${MAX_PRESETS} presets.`);
      return;
    }
    setEditingId(null);
    setNameInput("");
    setDescriptionInput("");
    setExpectedScoreInput("");
    setSlotsState([makeEmptySlot(), makeEmptySlot(), makeEmptySlot()]);
    setShowModal(true);
  };

  const openEdit = (p: ZzzTeamPreset) => {
    setEditingId(p.id);
    setNameInput(p.name);
    setDescriptionInput(p.description || "");
    setExpectedScoreInput(
      p.expectedScore !== null && p.expectedScore !== undefined
        ? String(p.expectedScore)
        : ""
    );

    // hydrate slots with characterInfo / wengineData
    const base = (p.slots || []).slice(0, 3).map((s) => ({
      ...s,
      characterInfo: charByCode.get(s.characterId),
      wengineData: s.wengineId
        ? wengineById.get(String(s.wengineId))
        : undefined,
    }));

    const padded = [
      ...base,
      ...Array.from({ length: Math.max(0, 3 - base.length) }, makeEmptySlot),
    ];

    setSlotsState(padded);
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

  /* ───────────── Assign / Remove / W-Engine modal ───────────── */
  const assignCharacterToSlot = (char: ZzzCharacterInfo) => {
    // block duplicates
    if (slotsState.some((s) => s.characterId === char.code)) {
      toast.info("That character is already in the team.");
      return;
    }
    const firstEmpty = slotsState.findIndex((s) => !s.characterId);
    if (firstEmpty === -1) return;

    setSlotsState((prev) => {
      const updated = [...prev];
      updated[firstEmpty] = {
        characterId: char.code,
        mindscape: 0,
        wengineId: "",
        refinement: 1,
        characterInfo: char,
      };
      return updated;
    });
    setSearch("");
  };

  const removeSlot = (index: number) => {
    // compact left: drop that slot, shift selected left, pad empties to 3
    setSlotsState((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      const compacted = filtered.filter((s) => !!s.characterId);
      const empties = Array.from(
        { length: 3 - compacted.length },
        makeEmptySlot
      );
      return [...compacted, ...empties];
    });
    setMindscapeOpenIndex(null);
    setRefineOpenIndex(null);
  };

  const openWengineModal = (index: number) => {
    setActiveSlotIndex(index);
    setSelectedWengineId(slotsState[index].wengineId || "");
    setWengineSearch("");
    setShowModal(false);
    setTimeout(() => setShowWengineModal(true), 0);
  };

  const confirmWengineSelection = () => {
    if (activeSlotIndex === null) return;
    const w = selectedWengineId
      ? wengineById.get(String(selectedWengineId))
      : undefined;

    setSlotsState((prev) => {
      const updated = [...prev];
      updated[activeSlotIndex] = {
        ...updated[activeSlotIndex],
        wengineId: selectedWengineId,
        wengineData: w,
        refinement: updated[activeSlotIndex].refinement || 1,
      };
      // if set to none, clear refinement to 1 but keep safe
      if (!selectedWengineId) {
        updated[activeSlotIndex].refinement = 1;
        updated[activeSlotIndex].wengineData = undefined;
      }
      return updated;
    });

    setShowWengineModal(false);
    setShowModal(true);
  };

  /* ───────────── Save preset ───────────── */
  const canSubmit = useMemo(() => {
    if (!nameInput.trim()) return false;
    return slotsState.every((s) => s.characterId);
  }, [nameInput, slotsState]);

  const handleSubmit = async () => {
    if (!targetId) return;

    // normalize expectedScore 
    let expectedScore: number | null = null;
    if (expectedScoreInput.trim() !== "") {
      const n = Number(expectedScoreInput);
      if (!Number.isInteger(n) || n < 1 || n > 65000) {
        toast.error("Expected Score must be an integer between 1 and 65000.");
        return;
      }
      expectedScore = n;
    }

    // force exactly 3 slots 
    const normalizedSlots: ZzzPresetSlot[] = [
      ...slotsState.slice(0, 3),
      ...Array.from(
        { length: Math.max(0, 3 - slotsState.length) },
        makeEmptySlot
      ),
    ];

    // validate slots
    for (const s of normalizedSlots) {
      if (
        !s.characterId ||
        !Number.isInteger(s.mindscape) ||
        s.mindscape < 0 ||
        s.mindscape > 6 ||
        typeof s.wengineId !== "string" ||
        !Number.isInteger(s.refinement) ||
        s.refinement < 1 ||
        s.refinement > 5
      ) {
        toast.error("Each slot must have a character, M0–M6, and R1–R5.");
        return;
      }
    }

    const body = {
      name: nameInput.trim(),
      description: descriptionInput.trim(),
      expectedScore,
      slots: normalizedSlots.map((s) => ({
        characterId: s.characterId,
        mindscape: s.mindscape,
        wengineId: s.wengineId,
        refinement: s.refinement,
      })),
    };

    try {
      const r = await fetch(
        !editingId
          ? `${
              import.meta.env.VITE_API_BASE
            }/api/zzz/player/${targetId}/presets`
          : `${
              import.meta.env.VITE_API_BASE
            }/api/zzz/player/${targetId}/presets/${editingId}`,
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
        }/api/zzz/player/${targetId}/presets/${presetId}`,
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

  const handleDeleteAllPresets = async () => {
    if (!targetId) return;
    if (bulkDeleteText.trim().toLowerCase() !== "confirm") {
      toast.error('Type "confirm" to enable Delete All.');
      return;
    }

    try {
      setBulkDeleting(true);

      const r = await fetch(
        `${import.meta.env.VITE_API_BASE}/api/zzz/player/${targetId}/presets`,
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

      setPresets([]);
      toast.success("All presets deleted");
      setShowBulkDelete(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };

  /* ───────────── Preset filtering (search) ───────────── */
  const filteredPresets = useMemo(() => {
    const q = presetQuery.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
    );
  }, [presets, presetQuery]);

  /* ───────────── Saved totals ───────────── */
  const savedZzzTotal = (slots: ZzzPresetSlot[]) =>
    slots.reduce((sum, s) => {
      const mArr = charCostMap.get(s.characterId);
      const mc = mArr?.[s.mindscape] ?? 0;
      const rArr = s.wengineId
        ? wengineCostMap.get(String(s.wengineId))
        : undefined;
      const rc = rArr?.[Math.min(Math.max(s.refinement, 1), 5) - 1] ?? 0;
      return sum + mc + rc;
    }, 0);

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

  return (
    <div
      className="page-fade-in"
      style={{
        backgroundImage: "url('/zzz-bg3.webp')",
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
                <h2 className="m-0">ZZZ Team Presets</h2>

                {presets.length > 0 && (
                  <button
                    className="btn back-button-glass ms-2"
                    style={{
                      borderColor: "rgba(255,0,0,0.4)",
                      color: "#ff6b6b",
                    }}
                    onClick={openBulkDelete}
                    aria-label="Delete all presets"
                    title='Delete all presets (type "confirm")'
                  >
                    Delete All
                  </button>
                )}
              </div>

              {/* Search + Button unified pill */}
              <div
                className="input-group preset-search-group"
                style={{ maxWidth: 420 }}
              >
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
                    style={{ paddingRight: 28 }}
                  />
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
                          WebkitLineClamp: 2,
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
                        Cost: {fmt(savedZzzTotal(p.slots))}
                      </span>

                      {p.expectedScore !== null &&
                        p.expectedScore !== undefined && (
                          <span
                            className="badge"
                            style={{
                              background: "rgba(255,255,255,0.08)",
                              border: "1px solid rgba(255,255,255,0.15)",
                            }}
                          >
                            Score: {p.expectedScore}
                          </span>
                        )}
                    </div>

                    {/* Saved preset slots — force 3 in one row */}
                    <div
                      className="mt-3"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: 8,
                      }}
                    >
                      {p.slots.slice(0, 3).map((s, i) => {
                        const char = charByCode.get(s.characterId);
                        return (
                          <div key={i} style={{ width: "100%" }}>
                            <div
                              className="draft-card ct preset-mini"
                              style={{
                                width: "100%",
                                height: 170,
                                position: "relative",
                              }}
                              title={char ? char.name : s.characterId}
                            >
                              {char ? (
                                <>
                                  <img
                                    src={char.image_url}
                                    alt={char.name}
                                    className="draft-img"
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                    }}
                                  />
                                  <div className="info-bar">
                                    <div
                                      className="char-name center-only"
                                      title={char.name}
                                    >
                                      {char.name}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="d-flex w-100 h-100 align-items-center justify-content-center" />
                              )}
                            </div>
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

          {/* Preset Modal (HSR-style custom modal wrapper so sliders behave identically) */}
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
                setMindscapeOpenIndex(null);
                setRefineOpenIndex(null);
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
                    {/* Name with inline live total */}
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
                            <span className="text-white-50 me-2">Cost:</span>
                            <strong>{fmt(liveZzzTotal)}</strong>
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

                    {/* Slots — CostTest-style cards with Mindscape/Refinement popups */}
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
                        WebkitOverflowScrolling: "touch",
                      }}
                    >
                      {slotsState.map((slot, idx) => {
                        const char =
                          slot.characterInfo ||
                          charByCode.get(slot.characterId);
                        const w =
                          slot.wengineData ||
                          (slot.wengineId
                            ? wengineById.get(String(slot.wengineId))
                            : undefined);

                        const mCost = zzzCharCost(slot);
                        const rCost = zzzWengineCost(slot);

                        return (
                          <div key={idx} style={{ flex: "0 0 auto" }}>
                            <div
                              className="draft-card ct preset-edit-card"
                              title={
                                char
                                  ? `${char.name} • M${slot.mindscape}${
                                      w
                                        ? ` • ${w.name} (R${slot.refinement})`
                                        : ""
                                    }`
                                  : ""
                              }
                              onClick={() => char && openWengineModal(idx)}
                            >
                              {char ? (
                                <>
                                  <img
                                    src={char.image_url}
                                    alt={char.name}
                                    className="draft-img"
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                    }}
                                    onError={(e) => {
                                      (
                                        e.currentTarget as HTMLImageElement
                                      ).style.visibility = "hidden";
                                    }}
                                  />

                                  {/* W-Engine badge overlay */}
                                  {w && (
                                    <img
                                      src={w.imageUrl}
                                      alt={w.name}
                                      title={w.name}
                                      className="engine-badge"
                                    />
                                  )}

                                  {/* Bottom info: name + 4 chips */}
                                  <div
                                    className="info-bar"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div
                                      className="char-name"
                                      style={{
                                        textAlign: "center",
                                        fontWeight: 700,
                                      }}
                                    >
                                      {char.name}
                                    </div>

                                    <div className="chip-row four">
                                      {/* M (opens Mindscape slider) */}
                                      <span
                                        className="chip clickable chip-left"
                                        title="Set Mindscape"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRefineOpenIndex(null);
                                          setMindscapeOpenIndex(
                                            mindscapeOpenIndex === idx
                                              ? null
                                              : idx
                                          );
                                        }}
                                      >
                                        M{slot.mindscape}
                                      </span>

                                      {/* M COST */}
                                      <span
                                        className="chip cost chip-center"
                                        title="Character Cost"
                                      >
                                        {fmt(mCost)}
                                      </span>

                                      {/* W COST or spacer */}
                                      {w ? (
                                        <span
                                          className="chip cost chip-center"
                                          title="W-Engine Cost"
                                        >
                                          {fmt(rCost)}
                                        </span>
                                      ) : (
                                        <span
                                          className="chip-spacer"
                                          aria-hidden="true"
                                        />
                                      )}

                                      {/* R (opens Refinement slider) or spacer */}
                                      {w ? (
                                        <span
                                          className="chip clickable chip-right"
                                          title="Set Refinement"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setMindscapeOpenIndex(null);
                                            setRefineOpenIndex(
                                              refineOpenIndex === idx
                                                ? null
                                                : idx
                                            );
                                          }}
                                        >
                                          R{slot.refinement}
                                        </span>
                                      ) : (
                                        <span
                                          className="chip-spacer"
                                          aria-hidden="true"
                                        />
                                      )}
                                    </div>
                                  </div>

                                  {/* Mindscape slider */}
                                  {mindscapeOpenIndex === idx && (
                                    <div
                                      className="slider-panel"
                                      ref={(el) => {
                                        mindscapeRefs.current[idx] = el;
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
                                        value={slot.mindscape}
                                        onChange={(e) => {
                                          const updated = [...slotsState];
                                          updated[idx].mindscape = Number(
                                            (e.target as HTMLInputElement).value
                                          );
                                          setSlotsState(updated);
                                        }}
                                      />
                                      <div
                                        className="slider-ticks"
                                        style={{ textAlign: "center" }}
                                      >
                                        {[
                                          "M0",
                                          "M1",
                                          "M2",
                                          "M3",
                                          "M4",
                                          "M5",
                                          "M6",
                                        ].map((label, i) => (
                                          <span
                                            key={label}
                                            className={
                                              slot.mindscape === i
                                                ? "active"
                                                : ""
                                            }
                                            style={{ flex: 1 }}
                                          >
                                            {label}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Refinement slider (only if W-Engine selected) */}
                                  {refineOpenIndex === idx && (
                                    <div
                                      className="slider-panel"
                                      ref={(el) => {
                                        refineRefs.current[idx] = el;
                                      }}
                                      style={{ bottom: 70 }}
                                      onClick={(e) => e.stopPropagation()}
                                      onMouseDown={(e) => e.stopPropagation()}
                                    >
                                      <div className="slider-label">
                                        Refinement
                                      </div>
                                      <input
                                        type="range"
                                        min={1}
                                        max={5}
                                        className="big-slider"
                                        value={slot.refinement}
                                        onChange={(e) => {
                                          const updated = [...slotsState];
                                          updated[idx].refinement = Number(
                                            (e.target as HTMLInputElement).value
                                          );
                                          setSlotsState(updated);
                                        }}
                                      />
                                      <div
                                        className="slider-ticks"
                                        style={{ textAlign: "center" }}
                                      >
                                        {["R1", "R2", "R3", "R4", "R5"].map(
                                          (label, i) => (
                                            <span
                                              key={label}
                                              className={
                                                slot.refinement === i + 1
                                                  ? "active"
                                                  : ""
                                              }
                                              style={{ flex: 1 }}
                                            >
                                              {label}
                                            </span>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="d-flex w-100 h-100 align-items-center justify-content-center" />
                              )}
                            </div>

                            {char && (
                              <div className="slot-action-bar">
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeSlot(idx);
                                    }}
                                    disabled={!slot.characterId}
                                    title={
                                      slot.characterId
                                        ? "Remove this member"
                                        : "Empty slot"
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Expected Score */}
                      <div className="mb-3" style={{ minWidth: 240 }}>
                        <label
                          htmlFor="preset-expected-score"
                          className="form-label m-0"
                        >
                          Expected Score
                        </label>
                        <input
                          id="preset-expected-score"
                          type="number"
                          min={1}
                          max={65000}
                          step={1}
                          className="form-control bg-dark text-white"
                          value={expectedScoreInput}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "") return setExpectedScoreInput("");
                            const n = Number(v);
                            if (!Number.isNaN(n)) {
                              const clamped = Math.max(
                                1,
                                Math.min(65000, Math.floor(n))
                              );
                              setExpectedScoreInput(String(clamped));
                            }
                          }}
                          placeholder="e.g. 42000"
                        />
                        <small className="text-white-50">
                          Optional. Leave blank if you don’t want to set a
                          target score.
                        </small>
                      </div>
                    </div>

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
                            {characters
                              .filter((c) => matchesCharacterQuery(c, search))
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

          {/* W-Engine Modal (same flow as HSR cone modal: returns to preset on close) */}
          <Modal
            show={showWengineModal}
            onHide={() => {
              setShowWengineModal(false);
              setShowModal(true);
            }}
            onExited={unlockBody}
            centered
            contentClassName="bg-dark text-white"
          >
            <Modal.Header closeButton>
              <Modal.Title>Select W-Engine</Modal.Title>
            </Modal.Header>

            <Modal.Body>
              <input
                type="text"
                className="form-control mb-2 bg-dark text-white"
                placeholder="Search by name or subname..."
                value={wengineSearch}
                onChange={(e) => setWengineSearch(e.target.value)}
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
                      selectedWengineId === "" ? "active" : ""
                    }`}
                    onClick={() => setSelectedWengineId("")}
                    style={{
                      cursor: "pointer",
                      backgroundColor:
                        selectedWengineId === "" ? "#444" : "#222",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    None
                  </li>

                  {(() => {
                    const q = (wengineSearch || "").toLowerCase();

                    const filtered = wengines.filter((w) => {
                      const name = (w.name || "").toLowerCase();
                      const sub = (w.subname || "").toLowerCase();
                      return name.includes(q) || sub.includes(q);
                    });

                    return filtered.map((w) => {
                      const active = selectedWengineId === String(w.id);
                      return (
                        <li
                          key={String(w.id)}
                          className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                            active ? "active" : ""
                          }`}
                          onClick={() => setSelectedWengineId(String(w.id))}
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
                              src={w.imageUrl}
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
                              <div
                                style={{ fontSize: "0.75rem", opacity: 0.8 }}
                              >
                                {w.subname} ({w.rarity}★)
                              </div>
                            </div>
                          </div>
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
                  setShowWengineModal(false);
                  setShowModal(true);
                }}
              >
                Cancel
              </button>
              <button
                className="btn-glass-primary"
                onClick={() => {
                  confirmWengineSelection();
                  setShowModal(true);
                }}
              >
                Confirm
              </button>
            </Modal.Footer>
          </Modal>

          {/* View Preset Modal */}
          <Modal
            show={showViewModal}
            onHide={() => setShowViewModal(false)}
            centered
            dialogClassName="preset-view-dialog-4"
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

              {viewPreset?.expectedScore !== null &&
                viewPreset?.expectedScore !== undefined && (
                  <div className="mt-2">
                    <span
                      className="badge"
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.15)",
                      }}
                    >
                      Expected Score: {viewPreset.expectedScore}
                    </span>
                  </div>
                )}

              {/* Total */}
              {viewPreset && (
                <div className="mt-2">
                  <span
                    className="badge"
                    style={{
                      background: "rgba(10, 170, 255, 0.2)",
                      border: "1px solid rgba(10,170,255,0.35)",
                    }}
                  >
                    Cost: {fmt(savedZzzTotal(viewPreset.slots))}
                  </span>
                </div>
              )}

              {/* Slots */}
              {viewPreset && (
                <div className="mt-3 preset-view-grid">
                  {viewPreset.slots.slice(0, 3).map((s, i) => {
                    const char = charByCode.get(s.characterId);
                    const w = s.wengineId
                      ? wengineById.get(String(s.wengineId))
                      : undefined;

                    const mArr = charCostMap.get(s.characterId);
                    const mCost = mArr?.[s.mindscape] ?? 0;
                    const rArr = w
                      ? wengineCostMap.get(String(s.wengineId))
                      : undefined;
                    const rCost =
                      rArr?.[Math.min(Math.max(s.refinement, 1), 5) - 1] ?? 0;

                    return (
                      <div key={i} className="preset-view-cell">
                        <div
                          className="draft-card ct preset-card"
                          title={
                            char
                              ? `${char.name} • M${s.mindscape}${
                                  w ? ` • ${w.name} (R${s.refinement})` : ""
                                }`
                              : s.characterId
                          }
                        >
                          {char && (
                            <>
                              <img
                                src={char.image_url}
                                alt={char.name}
                                className="draft-img"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                              {w && (
                                <img
                                  src={w.imageUrl}
                                  alt={w.name}
                                  title={w.name}
                                  className="engine-badge"
                                />
                              )}
                              <div className="info-bar">
                                <div
                                  className="char-name"
                                  style={{
                                    textAlign: "center",
                                    fontWeight: 700,
                                  }}
                                >
                                  {char.name}
                                </div>
                                <div className="chip-row four">
                                  <span className="chip">M{s.mindscape}</span>
                                  <span className="chip cost chip-center">
                                    {fmt(mCost)}
                                  </span>
                                  {w ? (
                                    <span className="chip cost chip-center">
                                      {fmt(rCost)}
                                    </span>
                                  ) : (
                                    <span
                                      className="chip-spacer"
                                      aria-hidden="true"
                                    />
                                  )}
                                  {w ? (
                                    <span className="chip">
                                      R{s.refinement}
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
                          )}
                        </div>
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

          {/* Bulk Delete Modal */}
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
