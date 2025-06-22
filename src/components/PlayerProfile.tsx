import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { Link, useParams, useLocation } from "react-router-dom";

/* ---------- types ---------- */
type CharTiny = { code: string; name?: string; image_url?: string };
type CountChar = CharTiny & { count: number };
type WRChar = CharTiny & { wins: number; games: number; winRate: number };

type Summary = {
  playerId: string;
  username: string;
  mostPicked: CountChar[];
  mostBanned: CountChar[];
  bestWinRate: WRChar[];
  worstWinRate: WRChar[];
  fifteenCycles: number;
};

type Match = {
  matchId: number;
  date: string;
  result: "win" | "lose";
  teammateNames: string[];
  opponentNames: string[];
  myPicks: string[];
  oppPicks: string[];
  myBans: string[];
  oppBans: string[];
  prebans: string[];
  jokers: string[];
  myCyclePenalty: number;
  oppCyclePenalty: number;
  myCycles: number[];
  oppCycles: number[];
};

type CharMap = Record<string, { name: string; image_url: string }>;

/* ---------- helpers ---------- */
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
      src={info.image_url || "/placeholder.png"}
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

/* ---------- component ---------- */
export default function PlayerProfile() {
  const { id } = useParams();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const season = query.get("season") || "players";

  const [charMap, setCharMap] = useState<CharMap>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [lastFetched, setLF] = useState<string | null>(null);
  const [showHist, setShow] = useState(false);
  const [loading, setLoading] = useState(true); // initial page load
  const [summaryLoading, setSumLoad] = useState(false); // only summary refresh
  const [error, setError] = useState(false);

  /* two independent modes */
  const [summaryMode, setSummaryMode] = useState<"all" | "solo" | "duo">("all");
  const [matchMode, setMatchMode] = useState<"all" | "solo" | "duo">("all");

  /* store scroll position when changing match filter */
  const scrollRef = useRef<number>(0);

  /* ---------- fetch static char list once ---------- */
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/api/characters?cycle=0`)
      .then((r) => r.json())
      .then((j) => {
        const map: CharMap = {};
        j.data.forEach(
          (c: any) => (map[c.code] = { name: c.name, image_url: c.image_url })
        );
        setCharMap(map);
      });
  }, []);

  /* ---------- fetch SUMMARY whenever id / season / summaryMode changes ---------- */
  useEffect(() => {
    if (!id) return;
    if (!summary) setLoading(true);
    setSumLoad(true);

    const qs = new URLSearchParams();
    qs.append("season", season);
    if (summaryMode !== "all") qs.append("mode", summaryMode);

    fetch(`${import.meta.env.VITE_API_BASE}/api/player/${id}/summary?${qs}`)
      .then((r) => r.json())
      .then((s) => {
        setSummary(s);
        setLoading(false);
        setSumLoad(false);
      })
      .catch((err) => {
        console.error(err);
        setError(true);
        setLoading(false);
        setSumLoad(false);
      });
  }, [id, season, summaryMode]);

  /* ---------- fetch MATCHES whenever id / season / matchMode changes ---------- */
  useEffect(() => {
    if (!id) return;
    const qs = new URLSearchParams();
    qs.append("season", season);
    if (matchMode !== "all") qs.append("mode", matchMode);

    fetch(`${import.meta.env.VITE_API_BASE}/api/player/${id}/matches?${qs}`)
      .then((r) => r.json())
      .then((mResp) => {
        setMatches(mResp.data);
        setLF(mResp.lastFetched);
      })
      .catch((err) => {
        console.error(err);
        setError(true);
      });
  }, [id, season, matchMode]);

  /* restore scroll position after matches update */
  useLayoutEffect(() => {
    if (scrollRef.current) {
      window.scrollTo({ top: scrollRef.current });
      scrollRef.current = 0;
    }
  }, [matches]);

  /* ---------- helpers ---------- */
  const renderList = (
    title: string,
    data: CountChar[] | WRChar[],
    mode: "count" | "wr"
  ) => (
    <>
      <h5 className="mt-4 mb-2">{title}</h5>
      {data.length ? (
        data.map((c, i) => (
          <div key={i} className="d-flex align-items-center mb-1">
            <CImg code={c.code} map={charMap} />
            <span>
              {c.name || c.code}{" "}
              <small style={{ color: "#ffc107" }}>
                {mode === "count"
                  ? `(${(c as CountChar).count} ${
                      title.includes("Picked") ? "picks" : "bans"
                    })`
                  : `(${(c as WRChar).wins}/${(c as WRChar).games} → ${(
                      (c as WRChar).winRate * 100
                    ).toFixed(1)}%)`}
              </small>
            </span>
          </div>
        ))
      ) : (
        <span style={{ color: "#fff", opacity: 0.6 }}>Not enough data</span>
      )}
    </>
  );

  /* ---------- dynamic section titles ---------- */
  const titles =
    summaryMode === "solo"
      ? {
          picked: "Most Picked Characters",
          banned: "Most Banned Characters",
          best: "Best Performing Characters",
          worst: "Worse Performing Characters",
        }
      : {
          picked: "Most Picked Characters While on Team",
          banned: "Most Banned Characters While Playing",
          best: "Best Performing Characters While on Their Team",
          worst: "Worst Performing Characters While on Their Team",
        };

  /* ---------- ui ---------- */
  return (
    <div
      className="page-fade-in"
      style={{
        background: "url('/background.jpg') center/cover fixed",
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
      <div className="position-relative z-2 text-white px-4 py-4">
        {/* Top nav */}
        <nav className="w-100 d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
          <Link to="/" className="text-decoration-none">
            <span className="logo-title d-inline-flex align-items-center gap-2">
              <img src="/logo192.png" alt="" height={36} /> Haya
            </span>
          </Link>
          <Link
            to="/players"
            className="btn btn-outline-light btn-sm back-button-glass"
          >
            ← Back to Player Stats
          </Link>
        </nav>

        <div className="container">
          <h1 className="display-5 fw-bold text-center mb-1">
            Player Summary{summary?.username ? `: ${summary.username}` : ""}
          </h1>

          {season && (
            <p className="text-center text-white-50 mb-2">
              Season View:{" "}
              <strong>
                {season === "all"
                  ? "All-Time"
                  : season === "players_1"
                  ? "Season 1"
                  : "Season 2"}
              </strong>
            </p>
          )}

          {lastFetched && (
            <p
              className="text-center text-white-50 mb-4"
              style={{ fontSize: "0.85rem" }}
            >
              Data last updated: {new Date(lastFetched).toLocaleString()}
            </p>
          )}

          {loading ? (
            <p className="text-center">Loading…</p>
          ) : error || !summary ? (
            <p className="text-center text-danger">
              Failed to load player data.
            </p>
          ) : (
            <>
              {/* ------- summary card ------- */}
              <div
                className="stats-card mx-auto position-relative"
                style={{ maxWidth: 700, padding: "1.5rem" }}
              >
                {/* dropdown inside card (top-right) */}
                <select
                  value={summaryMode}
                  onChange={(e) =>
                    setSummaryMode(e.target.value as "all" | "solo" | "duo")
                  }
                  className="form-select form-select-sm bg-dark text-white border-light position-absolute"
                  style={{ top: 12, right: 12, width: "auto" }}
                >
                  <option value="all">All</option>
                  <option value="solo">Solo</option>
                  <option value="duo">Duo</option>
                </select>

                {/* mini loader */}
                {summaryLoading && (
                  <p
                    className="small text-white-50 mb-2"
                    style={{ marginTop: -4 }}
                  >
                    Updating summary…
                  </p>
                )}

                {renderList(titles.picked, summary!.mostPicked, "count")}
                {renderList(titles.banned, summary!.mostBanned, "count")}
                {renderList(titles.best, summary!.bestWinRate, "wr")}
                {renderList(titles.worst, summary!.worstWinRate, "wr")}

                <div className="mt-4 mb-4">
                  <strong>15 Cycles Counter:</strong>{" "}
                  <span className="text-warning">
                    {summary!.fifteenCycles} time
                    {summary!.fifteenCycles !== 1 && "s"}
                  </span>
                </div>
                <div className="text-center">
                  <button
                    className="btn btn-outline-light"
                    onClick={() => setShow(!showHist)}
                  >
                    {showHist ? "Hide Match History" : "Show Match History"}
                  </button>
                </div>
              </div>

              {/* ------- match history (unchanged) ------- */}
              {showHist && (
                <div className="mt-5 d-flex flex-column gap-3">
                  <div className="d-flex justify-content-between align-items-center flex-wrap">
                    <h2 className="fw-bold text-center mb-3">
                      Match History (Last {matches.length} {matches.length === 1 ? "Match" : "Matches"})
                    </h2>
                    <select
                      value={matchMode}
                      onChange={(e) => {
                        scrollRef.current = window.scrollY;
                        setMatchMode(e.target.value as "all" | "solo" | "duo");
                      }}
                      className="form-select form-select-sm w-auto bg-dark text-white border-light"
                    >
                      <option value="all">All</option>
                      <option value="solo">Solo</option>
                      <option value="duo">Duo</option>
                    </select>
                  </div>

                  {matches.map((m) => (
                    <div
                      key={m.matchId}
                      className="bg-dark bg-opacity-75 p-3 rounded shadow"
                    >
                      <div className="d-flex justify-content-between flex-wrap mb-2">
                        <strong>
                          {m.date ? ddmmyyyy(m.date) : "Unknown Date"} –{" "}
                          <span
                            className={
                              m.result === "win"
                                ? "text-success"
                                : "text-danger"
                            }
                          >
                            {m.result.toUpperCase()}
                          </span>
                        </strong>
                        <small>
                          Teammate:{" "}
                          {m.teammateNames.length
                            ? m.teammateNames.join(", ")
                            : "Solo"}{" "}
                          • Opponent:{" "}
                          {m.opponentNames.length === 1
                            ? `${m.opponentNames[0]} (Solo)`
                            : m.opponentNames.join(", ")}
                        </small>
                      </div>
                      <div className="row">
                        <div className="col-md-6 mb-2">
                          <h6 className="text-success">Your Team Picks</h6>
                          {m.myPicks.map((c) => (
                            <CImg key={c} code={c} map={charMap} size={38} />
                          ))}
                          <p className="mt-2 mb-1">
                            <strong>Bans:</strong>
                          </p>
                          {m.myBans.map((c) => (
                            <CImg key={c} code={c} map={charMap} />
                          ))}
                          <p className="mt-2 mb-1">
                            <strong>Cycles:</strong> {m.myCycles.join(", ")}
                          </p>
                          {m.myCyclePenalty > 0 && (
                            <p className="mt-1 text-warning">
                              <strong>Cycle Penalty:</strong> {m.myCyclePenalty}
                            </p>
                          )}
                        </div>
                        <div className="col-md-6 mb-2">
                          <h6 className="text-danger">Opponent Picks</h6>
                          {m.oppPicks.map((c) => (
                            <CImg key={c} code={c} map={charMap} size={38} />
                          ))}
                          <p className="mt-2 mb-1">
                            <strong>Bans:</strong>
                          </p>
                          {m.oppBans.map((c) => (
                            <CImg key={c} code={c} map={charMap} />
                          ))}
                          <p className="mt-2 mb-1">
                            <strong>Cycles:</strong> {m.oppCycles.join(", ")}
                          </p>
                          {m.oppCyclePenalty > 0 && (
                            <p className="mt-1 text-warning">
                              <strong>Cycle Penalty:</strong>{" "}
                              {m.oppCyclePenalty}
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
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
