// src/components/admin/AdminMatchHistoryPanel.tsx
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

/* ───────── types ───────── */
type AdminMatch = {
  matchId: number;
  date: string;
  winner: "red" | "blue";
  redTeam: string[];
  blueTeam: string[];
  redPicks: string[];
  bluePicks: string[];
  redBans: string[];
  blueBans: string[];
  prebans: string[];
  jokers: string[];
  redCycles: number[];
  blueCycles: number[];
  redCyclePenalty: number;
  blueCyclePenalty: number;
};

type CharMap = Record<string, { name: string; image_url: string }>;

/* ───────── small helpers ───────── */
const CImg = ({
  code,
  map,
  size = 32,
}: {
  code: string;
  map: CharMap;
  size?: number;
}) => {
  const info = map[code] || {};
  return (
    <img
      src={info.image_url || "/default.png"}
      title={info.name || code}
      alt={code}
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        objectFit: "cover",
        marginRight: 4,
      }}
    />
  );
};

const ddmmyyyy = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB").replace(/\//g, "-");

/* ───────── embedded panel component ───────── */
export default function AdminMatchHistoryPanel() {
  const [charMap, setCharMap] = useState<CharMap>({});
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [total, setTotal] = useState(0);
  const [lastFetched, setLF] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const limit = 10;

  const confirmRollback = async (matchId: number) => {
    try {
      const r = await fetch(
        `${import.meta.env.VITE_API_BASE}/api/admin/rollback/${matchId}`,
        { method: "POST", credentials: "include" }
      );
      if (!r.ok) {
        const msg = await r.json().catch(() => ({}));
        throw new Error(msg.error || `Status ${r.status}`);
      }

      setMatches((m) => m.filter((x) => x.matchId !== matchId));
      setTotal((t) => t - 1);
      toast.success("✅ Rollback successful.");
    } catch (err: any) {
      console.error("rollback failed:", err.message);
      toast.error(`❌ Rollback failed: ${err.message}`);
    }
  };

  const handleRefresh = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/api/admin/matches/refresh`,
        { method: "POST", credentials: "include" }
      );

      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg.error || "Failed to refresh cache.");
      }

      alert("Cache cleared. Reloading matches...");
      setReloadKey((k) => k + 1);
      setPage(0);
    } catch (err: any) {
      alert("Refresh failed: " + err.message);
      console.error("Refresh error:", err);
    }
  };

  /* fetch char list once */
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/api/characters?cycle=0`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j) => {
        const map: CharMap = {};
        (j.data || []).forEach(
          (c: any) => (map[c.code] = { name: c.name, image_url: c.image_url })
        );
        setCharMap(map);
      })
      .catch((e) => console.error("char fetch failed:", e.message));
  }, []);

  /* fetch matches whenever page or reloadKey changes */
  useEffect(() => {
    const qs = new URLSearchParams();
    qs.append("limit", limit.toString());
    qs.append("offset", (page * limit).toString());

    fetch(
      `${import.meta.env.VITE_API_BASE}/api/admin/matches?${qs.toString()}`,
      { credentials: "include" }
    )
      .then((r) => r.json())
      .then((j) => {
        setMatches(j.data || []);
        setTotal(j.total || 0);
        setLF(j.lastFetched);
      })
      .catch((e) => {
        console.error("admin matches fetch failed:", e.message);
        alert(e.message);
      });
  }, [page, reloadKey]);

  const rollbackMatch = (matchId: number) => {
    toast.info(
      ({ closeToast }) => (
        <div className="d-flex flex-column gap-2">
          <span>Are you sure you want to rollback match #{matchId}?</span>
          <div className="d-flex justify-content-end gap-2 mt-2">
            <button className="btn btn-sm btn-secondary" onClick={closeToast}>
              Cancel
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => {
                closeToast();
                confirmRollback(matchId);
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      ),
      {
        position: "top-center",
        autoClose: false,
        closeOnClick: false,
        draggable: false,
        closeButton: false,
      }
    );
  };

  const filtered = matches.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.redTeam.some((n) => n.toLowerCase().includes(q)) ||
      m.blueTeam.some((n) => n.toLowerCase().includes(q))
    );
  });

  /* ───────── ui (no bg / navbar; just content) ───────── */
  return (
    <div className="admin-panel-scroll">
      <div className="container-fluid px-0 px-md-2">
        {lastFetched && (
          <p className="text-white-50 mb-2" style={{ fontSize: "0.82rem" }}>
            Data last updated: {new Date(lastFetched).toLocaleString()} –
            current season only.
          </p>
        )}

        {/* Search + refresh */}
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3">
          <input
            type="text"
            placeholder="Search by player name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              maxWidth: 420,
              padding: "0.6rem 0.9rem",
              backgroundColor: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              color: "#fff",
              backdropFilter: "blur(6px)",
              outline: "none",
            }}
          />
          <button onClick={handleRefresh} className="btn back-button-glass">
            🔄 Refresh cache
          </button>
        </div>

        <h6 className="mb-3">
          Page {page + 1} of {Math.max(Math.ceil(total / limit), 1)} – {total}{" "}
          matches
        </h6>

        {filtered.length === 0 ? (
          <p>No matches found.</p>
        ) : (
          filtered.map((m) => (
            <div
              key={m.matchId}
              className="bg-dark bg-opacity-75 p-3 rounded shadow mb-3 position-relative"
            >
              <button
                className="btn btn-sm btn-danger position-absolute"
                style={{ top: 42, right: 10 }}
                onClick={() => rollbackMatch(m.matchId)}
              >
                Rollback
              </button>

              <div className="d-flex justify-content-between flex-wrap mb-2">
                <strong>
                  #{m.matchId} – {ddmmyyyy(m.date)} –{" "}
                  <span
                    className={
                      m.winner === "red" ? "text-danger" : "text-primary"
                    }
                  >
                    {m.winner.toUpperCase()} WON
                  </span>
                </strong>
                <small>
                  Red: {m.redTeam.join(", ")} • Blue: {m.blueTeam.join(", ")}
                </small>
              </div>

              <div className="row">
                <div className="col-md-6 mb-2">
                  <h6 className="text-danger">Red Picks</h6>
                  {m.redPicks.map((c) => (
                    <CImg key={c} code={c} map={charMap} size={38} />
                  ))}
                  <p className="mt-2 mb-1">
                    <strong>Bans:</strong>
                  </p>
                  {m.redBans.map((c) => (
                    <CImg key={c} code={c} map={charMap} />
                  ))}
                  <p className="mt-2 mb-1">
                    <strong>Cycles:</strong> {m.redCycles.join(", ")}
                  </p>
                  {m.redCyclePenalty > 0 && (
                    <p className="mt-1 text-warning">
                      <strong>Cycle Penalty:</strong> {m.redCyclePenalty}
                    </p>
                  )}
                </div>

                <div className="col-md-6 mb-2">
                  <h6 className="text-primary">Blue Picks</h6>
                  {m.bluePicks.map((c) => (
                    <CImg key={c} code={c} map={charMap} size={38} />
                  ))}
                  <p className="mt-2 mb-1">
                    <strong>Bans:</strong>
                  </p>
                  {m.blueBans.map((c) => (
                    <CImg key={c} code={c} map={charMap} />
                  ))}
                  <p className="mt-2 mb-1">
                    <strong>Cycles:</strong> {m.blueCycles.join(", ")}
                  </p>
                  {m.blueCyclePenalty > 0 && (
                    <p className="mt-1 text-warning">
                      <strong>Cycle Penalty:</strong> {m.blueCyclePenalty}
                    </p>
                  )}
                </div>
              </div>

              {m.prebans.length > 0 && (
                <div className="mt-2">
                  <strong>Prebans:</strong>{" "}
                  {m.prebans.map((c) => (
                    <CImg key={c} code={c} map={charMap} />
                  ))}
                </div>
              )}
              {m.jokers.length > 0 && (
                <div className="mt-2">
                  <strong className="text-warning">Joker Picks:</strong>{" "}
                  {m.jokers.map((c) => (
                    <CImg key={c} code={c} map={charMap} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        <div className="d-flex justify-content-center gap-3 mt-3">
          <button
            className="btn btn-outline-light btn-sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← Prev
          </button>
          <button
            className="btn btn-outline-light btn-sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * limit >= total}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
