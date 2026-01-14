import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./Landing.css";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";


/* ---------- types ---------- */
type PlayerCharWR = {
  code: string;
  name: string;
  image_url: string;
  wins: number;
  losses: number;
  games: number;
  winRate: number;
  rarity?: number;
  path?: string;
  element?: string;
};

type EidolonStats = {
  code: string;
  name: string;
  image_url: string;
  rarity: number;
  path: string;
  element: string;
  uses: number[]; // [E0..E6]
  wins: number[];
};

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
  { label: "Games Played", value: "games" },
  { label: "Wins", value: "wins" },
  { label: "Losses", value: "losses" },
  { label: "Winrate", value: "winRate" },
] as const;

const splashSrc = (name: string) =>
  `/characters/Character_${name.replace(/\s+/g, "_")}_Splash_Art.webp`;

/* ---------- component ---------- */
export default function PlayerCharacterStats() {
  const { id: playerIdRaw } = useParams();
  const playerId = playerIdRaw ?? "";

  const [searchParams] = useSearchParams();
  const selectedSeason = searchParams.get("season") ?? "players";

  const [rows, setRows] = useState<PlayerCharWR[]>([]);
  const [eidolonMap, setEidolonMap] = useState<Record<string, EidolonStats>>(
    {}
  );
  const [playerInfo, setPlayerInfo] = useState<any>(null);

  const [openChar, setOpen] = useState<PlayerCharWR | null>(null);
  const [isLoading, setLoading] = useState(true);

  // filters
  const [sortBy, setSort] =
    useState<(typeof sortOptions)[number]["value"]>("games");
  const [sortAsc, setSortAsc] = useState(false);
  const [rarity, setRarity] = useState<number | null>(null);
  const [element, setElement] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    setLoading(true);

    fetch(
      `${
        import.meta.env.VITE_API_BASE
      }/api/player/${playerId}/summary?season=${selectedSeason}&mode=all`,
      { credentials: "include" }
    )
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(json.error || "Failed to fetch");
        return json;
      })
      .then((summary) => {
        setPlayerInfo(summary);

        const arr = summary.allCharacterWR || [];
        setRows(arr);

        const eidolons: EidolonStats[] = summary.eidolons || [];
        const map: Record<string, EidolonStats> = {};
        eidolons.forEach((e) => {
          map[e.code] = e;
        });
        setEidolonMap(map);
      })
      .catch((err) => {
        toast.error("Failed to load character stats: " + err.message);
      })
      .finally(() => setLoading(false));
  }, [playerId, selectedSeason]);

  /* ---------- filter + sort ---------- */
  const list = rows
    .filter(
      (c) =>
        (!rarity || c.rarity === rarity) &&
        (!element || c.element === element) &&
        (!path || c.path === path)
    )
    .sort((a, b) => {
      const aVal = a[sortBy as keyof PlayerCharWR] ?? 0;
      const bVal = b[sortBy as keyof PlayerCharWR] ?? 0;

      if (sortBy === "name") {
        return sortAsc
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }

      return sortAsc
        ? Number(aVal) - Number(bVal)
        : Number(bVal) - Number(aVal);
    });

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

      <div className="position-relative z-2 text-white px-4 pt-3">
        <Navbar />

        {/* Back button */}
        <div className="w-100 d-flex justify-content-end mb-3 pe-4">
          <button
            onClick={() => navigate(-1)}
            className="btn back-button-glass"
          >
            ← Back
          </button>
        </div>

        {/* ---------- PLAYER HEADER ---------- */}
        {playerInfo && (
          <div className="text-center mb-4">
            <img
              src={
                playerInfo.avatar
                  ? `https://cdn.discordapp.com/avatars/${playerId}/${playerInfo.avatar}.png`
                  : "/default.png"
              }
              alt=""
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                objectFit: "cover",
                border: "3px solid #fff",
                marginBottom: 12,
              }}
            />
            <h2 className="fw-bold">
              {playerInfo.global_name || playerInfo.username}
            </h2>

            {playerInfo.global_name &&
              playerInfo.global_name !== playerInfo.username && (
                <p className="text-white-50 mb-1">@{playerInfo.username}</p>
              )}

            <p className="text-white-50">Season: {playerInfo.seasonLabel}</p>
          </div>
        )}

        {/* ---------- Filters ---------- */}
        <div className="container mb-3">
          {/* Rarity */}
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

          {/* Element icons */}
          <div className="d-flex justify-content-center gap-2 flex-wrap mb-2">
            {elementOptions.map((el) => (
              <button
                key={el}
                className="bg-transparent border-0"
                title={el}
                style={{
                  opacity: element && element !== el ? 0.35 : 1,
                }}
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

          {/* Path icons */}
          <div className="d-flex justify-content-center gap-2 flex-wrap mb-4">
            {pathOptions.map((pth) => (
              <button
                key={pth}
                className="bg-transparent border-0"
                title={pth}
                style={{
                  opacity: path && path !== pth ? 0.35 : 1,
                }}
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

          {/* Sort controls */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <button className="glass-btn" onClick={() => setSortAsc((p) => !p)}>
              {sortAsc ? "↑ Ascending" : "↓ Descending"}
            </button>

            <select
              className="form-select bg-dark text-white border-light"
              style={{ width: 180 }}
              value={sortBy}
              onChange={(e) =>
                setSort(e.target.value as (typeof sortOptions)[number]["value"])
              }
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ---------- GRID ---------- */}
        <div className="container pb-5">
          <div className="row g-4">
            {list.map((c, i) => {
              const wr = c.winRate * 100;
              const col = elementColors[c.element || "Physical"] || "#bbb";
              return (
                <div key={i} className="col-6 col-sm-4 col-lg-3">
                  <div
                    className="char-card bg-dark bg-opacity-75 text-white rounded-3 shadow position-relative"
                    style={{
                      border: `2px solid ${col}`,
                      boxShadow: `0 0 8px ${col}80`,
                      cursor: "pointer",
                      transition: "transform .2s",
                    }}
                    onClick={() => setOpen(c)}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.transform = "translateY(-4px)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.transform = "none")
                    }
                  >
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
                          padding: "6px",
                        }}
                      />
                    </div>
                    <div className="p-2 text-center">
                      <h6 className="mb-1">{c.name}</h6>
                      <div className="d-flex justify-content-center gap-3 mt-2 small">
                        <span>🏆 {c.wins}</span>
                        <span>💀 {c.losses}</span>
                        <span>📊 {wr.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <p className="text-center text-white-50 mt-3">Loading…</p>
            )}
          </div>
        </div>
      </div>

      {/* ---------- MODAL ---------- */}
      {openChar && (
        <div
          className="detail-overlay d-flex align-items-center justify-content-center"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            zIndex: 9999,
          }}
          onClick={() => setOpen(null)}
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
              border: `3px solid ${
                elementColors[openChar.element || "Physical"]
              }`,
              boxShadow: `0 0 16px ${
                elementColors[openChar.element || "Physical"]
              }80`,
            }}
          >
            <button
              className="btn-close btn-close-white position-absolute"
              style={{ top: 12, right: 16 }}
              onClick={() => setOpen(null)}
            />

            <div className="d-flex flex-column flex-md-row gap-4">
              {/* Splash */}
              <div
                style={{
                  flex: "0 0 380px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={splashSrc(openChar.name)}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                  alt=""
                  style={{
                    maxHeight: "90vh",
                    maxWidth: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>

              {/* Stats */}
              <div className="flex-grow-1">
                <h3 className="mb-3" style={{ color: "#fff", fontWeight: 600 }}>
                  {openChar.name}
                </h3>

                <div className="mb-3 small" style={{ color: "#fff" }}>
                  <div className="row gy-1 gx-3">
                    <div className="col-6 d-flex justify-content-between">
                      <strong>🏆 Wins</strong> <span>{openChar.wins}</span>
                    </div>
                    <div className="col-6 d-flex justify-content-between">
                      <strong>💀 Losses</strong> <span>{openChar.losses}</span>
                    </div>
                    <div className="col-6 d-flex justify-content-between">
                      <strong>📊 Winrate</strong>{" "}
                      <span>{(openChar.winRate * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* Eidolon performance */}
                {eidolonMap[openChar.code] && (
                  <>
                    <h6 className="mt-2" style={{ color: "#fff" }}>
                      Eidolon Performance
                    </h6>

                    {eidolonMap[openChar.code].uses.map((uses, i) => {
                      const wins = eidolonMap[openChar.code].wins[i] ?? 0;
                      const rate = uses > 0 ? (wins / uses) * 100 : 0;

                      // Color rules identical to CharacterStats
                      const col =
                        elementColors[openChar.element || "Physical"] || "#888";
                      const useBlackText = ["Physical", "Imaginary"].includes(
                        openChar.element || ""
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
                            style={{
                              height: 16,
                              borderRadius: 4,
                            }}
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
                                    ? "#000"
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
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
