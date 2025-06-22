import { useEffect, useState } from "react";
import "./Landing.css";

/* ---------- types ---------- */
type EidolonTuple = { uses: number; wins: number };

type CharacterStats = {
  code: string;
  name: string;
  image_url: string;
  rarity: number;
  path: string;
  element: string;
  pick_count: number;
  ban_count: number;
  appearance_count: number;
  preban_count: number;
  joker_count: number;
  total_wins: number | string;
  total_losses: number | string;
  e0_uses: number;
  e1_uses: number;
  e2_uses: number;
  e3_uses: number;
  e4_uses: number;
  e5_uses: number;
  e6_uses: number;
  e0_wins: number;
  e1_wins: number;
  e2_wins: number;
  e3_wins: number;
  e4_wins: number;
  e5_wins: number;
  e6_wins: number;
};

type ApiResponse = { data: CharacterStats[]; lastFetched: string };

/* ---------- constants ---------- */
const elementColors: Record<string, string> = {
  Physical: "#ececec",
  Fire: "#e62929",
  Ice: "#5cc8ff",
  Lightning: "#b54cd8",
  Wind: "#52cb95",
  Quantum: "#4f47be",
  Imaginary: "#f3df32",
};

const pathOptions = [
  "Destruction",
  "The Hunt",
  "Erudition",
  "Harmony",
  "Nihility",
  "Preservation",
  "Abundance",
  "Remembrance",
] as const;

const elementOptions = [
  "Physical",
  "Fire",
  "Ice",
  "Lightning",
  "Wind",
  "Quantum",
  "Imaginary",
] as const;

const sortOptions = [
  { label: "Alphabetical", value: "name" },
  { label: "Appearances", value: "appearance_count" },
  { label: "Wins", value: "total_wins" },
  { label: "Picks", value: "pick_count" },
  { label: "Bans", value: "ban_count" },
] as const;

const mocOptions = [
  {
    label: "All-Time Stats",
    value: -1,
    name: "All-Time Stats",
    duration: "All matches recorded",
    bossImages: ["/bosses/alltime.png"],
  },
  {
    label: "Lupine Moon-Devourer (3.3)",
    value: 0,
    name: "Lupine Moon-Devourer",
    duration: "23 Jun 2025 → 04 Aug 2025",
    bossImages: ["/bosses/sting.png", "/bosses/hoolay.png"],
  },
  {
    label: "Out of Home (3.1)",
    value: 1,
    name: "Out of Home",
    duration: "31 Mar 2025 → 12 May 2025",
    bossImages: ["/bosses/hoolay.png", "/bosses/reaver.png"],
  },
  {
    label: "Breath of the Othershore (3.2)",
    value: 2,
    name: "Breath of the Othershore",
    duration: "12 May 2025 → 23 Jun 2025",
    bossImages: ["/bosses/reaver.png", "/bosses/tv.png"],
  },
];

/* ---------- helpers ---------- */
const eidolonArr = (c: CharacterStats): EidolonTuple[] => [
  { uses: c.e0_uses, wins: c.e0_wins },
  { uses: c.e1_uses, wins: c.e1_wins },
  { uses: c.e2_uses, wins: c.e2_wins },
  { uses: c.e3_uses, wins: c.e3_wins },
  { uses: c.e4_uses, wins: c.e4_wins },
  { uses: c.e5_uses, wins: c.e5_wins },
  { uses: c.e6_uses, wins: c.e6_wins },
];
const splashSrc = (name: string) =>
  `/characters/Character_${name.replace(/\s+/g, "_")}_Splash_Art.webp`;

/* ---------- component ---------- */
export default function CharacterStats() {
  const [rows, setRows] = useState<CharacterStats[]>([]);
  const [lastFetched, setLast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [cycle, setCycle] = useState(-1);
  const [sortBy, setSort] =
    useState<(typeof sortOptions)[number]["value"]>("name");
  const [rarity, setRarity] = useState<number | null>(null);
  const [element, setElement] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const [openChar, setOpenChar] = useState<CharacterStats | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  /* ---------- data fetch ---------- */
  useEffect(() => {
    setLoading(true);

    const url =
      cycle === -1
        ? `${import.meta.env.VITE_API_BASE}/api/characters/all`
        : `${import.meta.env.VITE_API_BASE}/api/characters?cycle=${cycle}`;

    fetch(url)
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(json.error || `Request failed with status ${r.status}`);
        }
        return json;
      })
      .then((j: ApiResponse) => {
        setRows(j.data || []);
        setLast(j.lastFetched || null);
      })
      .catch((err) => {
        console.error("Character stats fetch failed:", err.message);
        alert(err.message); // or a better styled notification
      })
      .finally(() => setLoading(false));
  }, [cycle]);



  /* ---------- filter + sort ---------- */
  const list = rows
    .filter(
      (c) =>
        (!rarity || c.rarity === rarity) &&
        (!element || c.element === element) &&
        (!path || c.path === path)
    )
    .sort((a, b) => {
      if (sortBy === "name") {
        return sortAsc
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }

      const aVal = Number(a[sortBy as keyof CharacterStats]) || 0;
      const bVal = Number(b[sortBy as keyof CharacterStats]) || 0;
      return sortAsc ? aVal - bVal : bVal - aVal;
    });

  const moc = mocOptions.find((m) => m.value === cycle)!;

  /* ---------- UI ---------- */
  return (
    <div
      className="page-fade-in"
      style={{
        background: "url('/background.webp') center/cover fixed",
        minHeight: "100vh",
        position: "relative",
      }}
    >
      <div
        style={{
          background: "rgba(0,0,0,.7)",
          position: "absolute",
          inset: 0,
          zIndex: 1,
        }}
      />
      <div className="position-relative z-2 text-white px-4">
        {/* nav */}
        <nav className="w-100 py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <a href="/" className="text-decoration-none">
            <span className="logo-title d-inline-flex align-items-center gap-2">
              <img src="/logo192.png" alt="" height={36} /> Haya
            </span>
          </a>
          <button
            className="btn btn-outline-light btn-sm back-button-glass"
            onClick={() => window.history.back()}
          >
            ← Back
          </button>
        </nav>

        {/* cycle info */}
        <div className="text-center my-4">
          <h2 className="display-5 fw-bold mb-3">{moc.name}</h2>
          <div className="d-flex justify-content-center gap-4 flex-wrap mb-2">
            {moc.bossImages.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                style={{
                  width: 180,
                  borderRadius: 12,
                  boxShadow: "0 0 10px rgba(255,255,255,.15)",
                }}
              />
            ))}
          </div>
          <p className="fw-semibold" style={{ opacity: 0.8 }}>
            {moc.duration}
          </p>
          {lastFetched && (
            <p className="text-white-50" style={{ fontSize: ".85rem" }}>
              Data last updated: {new Date(lastFetched).toLocaleString()}
            </p>
          )}
        </div>

        {/* grid wrapper */}
        <div className="container pb-5 position-relative">
          {/* rarity / element / path filters */}
          <div className="d-flex justify-content-center gap-3 mb-3">
            {[5, 4].map((r) => (
              <button
                key={r}
                className={`btn btn-sm px-4 ${
                  rarity === r ? "btn-light text-dark" : "btn-outline-light"
                }`}
                onClick={() => setRarity((p) => (p === r ? null : r))}
              >
                {r}★
              </button>
            ))}
          </div>
          <div className="d-flex justify-content-center gap-2 flex-wrap mb-2">
            {elementOptions.map((el) => (
              <button
                key={el}
                className="bg-transparent border-0"
                title={el}
                style={{ opacity: element && element !== el ? 0.35 : 1 }}
                onClick={() => setElement((p) => (p === el ? null : el))}
              >
                <img
                  src={`/icons/${el.toLowerCase()}.png`}
                  alt={el}
                  style={{ height: 32 }}
                />
              </button>
            ))}
          </div>
          <div className="d-flex justify-content-center gap-2 flex-wrap mb-4">
            {pathOptions.map((pth) => (
              <button
                key={pth}
                className="bg-transparent border-0"
                title={pth}
                style={{ opacity: path && path !== pth ? 0.35 : 1 }}
                onClick={() => setPath((p) => (p === pth ? null : pth))}
              >
                <img
                  src={`/icons/${pth.toLowerCase().replace(/\s/g, "")}.png`}
                  alt={pth}
                  style={{ height: 32 }}
                />
              </button>
            ))}
          </div>

          {/* top-row controls ------------- */}
          <div className="d-flex justify-content-between align-items-center mb-2">
            <button
              className="glass-btn"
              onClick={() => setSortAsc((p) => !p)}
              title="Toggle sort direction"
            >
              {sortAsc ? "↑ Ascending" : "↓ Descending"}
            </button>

            <button
              className="glass-btn"
              onClick={() => setShowFilters((p) => !p)}
            >
              {showFilters ? "Hide Filters" : "Show Filters"}
            </button>
          </div>

          {/* floating filter panel */}
          {showFilters && (
            <div
              className="glassmorphic-card p-3"
              style={{
                position: "absolute",
                top: "-3rem",
                right: 0,
                width: 260,
                background: "rgba(0,0,0,0.85)",
                backdropFilter: "blur(10px)",
                borderRadius: 12,
                zIndex: 10,
                pointerEvents: showFilters ? "auto" : "none",
              }}
            >
              {/* MOC */}
              <div className="mb-3">
                <label className="form-label text-white">MOC Cycle</label>
                <select
                  className="form-select bg-dark text-white border-light"
                  value={cycle}
                  onChange={(e) => setCycle(+e.target.value)}
                >
                  {mocOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {/* Sort */}
              <div>
                <label className="form-label text-white">Sort By</label>
                <select
                  className="form-select bg-dark text-white border-light"
                  value={sortBy}
                  onChange={(e) => setSort(e.target.value as any)}
                >
                  {sortOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* grid + unobtrusive loader */}
          <div className="position-relative">
            {loading && (
              <div
                className="text-center mb-2"
                style={{
                  position: "absolute",
                  top: -24,
                  left: 0,
                  right: 0,
                  fontSize: 14,
                }}
              >
                <span className="text-white-50">Loading…</span>
              </div>
            )}

            <div
              className="row g-4"
              style={{
                opacity: loading ? 0.5 : 1,
                pointerEvents: loading ? "none" : "auto",
                transition: "opacity .25s",
              }}
            >
              {list.map((c) => {
                const wins = Number(c.total_wins) || 0;
                const losses = Number(c.total_losses) || 0;
                const total = wins + losses;
                const wr = total > 0 ? (wins / total) * 100 : 0;
                const colour = elementColors[c.element] || "#bbb";
                return (
                  <div key={c.code} className="col-6 col-sm-4 col-lg-3">
                    <div
                      className="char-card bg-dark bg-opacity-75 text-white rounded-3 shadow position-relative"
                      style={{
                        border: `2px solid ${colour}`,
                        boxShadow: `0 0 8px ${colour}80`,
                        cursor: "pointer",
                        transition: "transform .2s",
                      }}
                      onClick={() => setOpenChar(c)}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.transform = "translateY(-4px)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.transform = "none")
                      }
                    >
                      <img
                        src={`/icons/${c.path
                          .toLowerCase()
                          .replace(/\s/g, "")}.png`}
                        alt={c.path}
                        title={c.path}
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          width: 36,
                          height: 36,
                          padding: 6,
                        }}
                      />
                      <div
                        style={{
                          width: "100%",
                          height: 150,
                          overflow: "hidden",
                          borderTopLeftRadius: 10,
                          borderTopRightRadius: 10,
                        }}
                      >
                        <img
                          src={c.image_url}
                          alt={c.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            objectPosition: "center top",
                            padding: "6px",
                          }}
                        />
                      </div>
                      <div className="p-2 text-center">
                        <h6 className="mb-1">{c.name}</h6>
                        <small>{"⭐".repeat(c.rarity)}</small>
                        <div className="d-flex justify-content-center gap-3 mt-2 small">
                          <span>🏆 {wins}</span>
                          <span>💀 {losses}</span>
                          <span>📊 {wr.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Detail overlay ---------- */}
      {openChar && (
        <div
          className="detail-overlay d-flex align-items-center justify-content-center"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.8)",
          }}
          onClick={() => setOpenChar(null)}
        >
          <div
            className="detail-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "1000px",
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#111",
              borderRadius: "12px",
              padding: "24px",
              position: "relative",
              border: `3px solid ${elementColors[openChar.element] || "#ccc"}`,
              boxShadow: `0 0 16px ${
                elementColors[openChar.element] || "#ccc"
              }80`,
            }}
          >
            <button
              className="btn-close btn-close-white position-absolute"
              style={{ top: 12, right: 16 }}
              onClick={() => setOpenChar(null)}
            />
            <div className="d-flex flex-column flex-md-row gap-4">
              {/* splash */}
              <div
                style={{
                  flex: "0 0 400px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "1rem",
                }}
              >
                <img
                  src={splashSrc(openChar.name)}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                  alt={`${openChar.name} splash`}
                  loading="lazy"
                  style={{
                    maxHeight: "90vh",
                    maxWidth: "100%",
                    objectFit: "contain",
                    borderRadius: "10px",
                  }}
                />
              </div>

              {/* stats */}
              <div className="flex-grow-1">
                <h3 className="mb-3" style={{ color: "#fff", fontWeight: 600 }}>
                  {openChar.name}
                </h3>

                {/* quick stats */}
                {(() => {
                  const wins = Number(openChar.total_wins) || 0;
                  const losses = Number(openChar.total_losses) || 0;
                  const t = wins + losses;
                  const wr = t > 0 ? (wins / t) * 100 : 0;
                  return (
                    <>
                      <div
                        className="row gy-1 gx-3 mb-3 small"
                        style={{ color: "#fff" }}
                      >
                        <div className="col-6 col-sm-4 d-flex justify-content-between">
                          <strong>🏆 Wins</strong>
                          <span>{wins}</span>
                        </div>
                        <div className="col-6 col-sm-4 d-flex justify-content-between">
                          <strong>💀 Losses</strong>
                          <span>{losses}</span>
                        </div>
                        <div className="col-6 col-sm-4 d-flex justify-content-between">
                          <strong>🛡️ Prebans</strong>
                          <span>{openChar.preban_count}</span>
                        </div>
                        <div className="col-6 col-sm-4 d-flex justify-content-between">
                          <strong>🎯 Picks</strong>
                          <span>{openChar.pick_count}</span>
                        </div>
                        <div className="col-6 col-sm-4 d-flex justify-content-between">
                          <strong>🚫 Bans</strong>
                          <span>{openChar.ban_count}</span>
                        </div>
                        <div className="col-6 col-sm-4 d-flex justify-content-between">
                          <strong>🃏 Jokers</strong>
                          <span>{openChar.joker_count}</span>
                        </div>
                      </div>
                      <p className="text-white text-end fw-semibold mb-1">
                        📊 Win-rate: {wr.toFixed(1)}%
                      </p>
                      <div
                        className="bar-bg rounded mb-4"
                        style={{ height: 20 }}
                      >
                        <div
                          style={{
                            width: `${wr}%`,
                            height: "100%",
                            borderRadius: 4,
                            background:
                              elementColors[openChar.element] || "#888",
                          }}
                        />
                      </div>
                    </>
                  );
                })()}

                {/* Eidolon chart */}
                <h6 className="mt-2" style={{ color: "#fff" }}>
                  Eidolon performance
                </h6>
                {eidolonArr(openChar).map((e, i) => {
                  const uses = e.uses ?? 0,
                    wins = e.wins ?? 0;
                  const rate = uses > 0 ? (wins / uses) * 100 : 0;
                  const col = elementColors[openChar.element] || "#888";
                  const useBlackText = ["Physical", "Imaginary"].includes(
                    openChar.element
                  );
                  return (
                    <div
                      key={i}
                      className="d-flex align-items-center mb-1 small"
                      style={{ color: "#fff" }}
                    >
                      <div style={{ width: 28 }}>E{i}</div>
                      <div
                        className="flex-grow-1 me-2 bar-bg position-relative"
                        style={{ height: 16, borderRadius: 4 }}
                      >
                        <div
                          style={{
                            width: `${rate}%`,
                            height: "100%",
                            borderRadius: 4,
                            background: col,
                          }}
                        />
                        {uses > 0 && (
                          <div
                            className="position-absolute w-100 text-center"
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: "bold",
                              color: useBlackText
                                ? "#e62929"
                                : rate > 40
                                ? "#fff"
                                : "#ddd",
                              top: 0,
                            }}
                          >
                            {wins}W / {uses}G
                          </div>
                        )}
                      </div>
                      <div style={{ width: 46, textAlign: "right" }}>
                        {rate.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
