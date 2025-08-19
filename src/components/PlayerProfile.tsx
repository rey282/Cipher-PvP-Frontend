import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import { toast } from "react-toastify";

/* ---------- types ---------- */
type CharTiny = { code: string; name?: string; image_url?: string };
type CountChar = CharTiny & { count: number };
type WRChar = CharTiny & { wins: number; games: number; winRate: number };

type Summary = {
  playerId: string;
  username: string;
  global_name?: string;
  avatar?: string | null;
  mostPicked: CountChar[];
  mostBanned: CountChar[];
  mostBannedAgainst: CountChar[];
  mostPrebanned: CountChar[];
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
  redTeam: { id: string; name: string; cycles: number }[];
  blueTeam: { id: string; name: string; cycles: number }[];
  myTeamSide: "red" | "blue";
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
  const navigate = useNavigate();

  const [charMap, setCharMap] = useState<CharMap>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [lastFetched, setLF] = useState<string | null>(null);
  const [showHist, setShow] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [summaryLoading, setSumLoad] = useState(false);
  const [error, setError] = useState(false);
  const [total, setTotal] = useState(0);

  /* pagination */
  const [page, setPage] = useState(0);
  const limit = 15;

  /* two independent modes */
  const [summaryMode, setSummaryMode] = useState<"all" | "solo" | "duo">("all");
  const [matchMode, setMatchMode] = useState<"all" | "solo" | "duo">("all");

  /* store scroll position when changing match filter */
  const scrollRef = useRef<number>(0);

  const matchHistoryRef = useRef<HTMLDivElement>(null);

  const SUMMARY_TOAST_ID = "summary-fetch-failed";

  /* ---------- fetch static char list once ---------- */
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/api/characters?cycle=0`, {
      credentials: "include",
    })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(
            json.error || `Request failed with status ${r.status}`
          );
        }
        return json;
      })
      .then((j) => {
        const map: CharMap = {};
        (j.data || []).forEach(
          (c: any) => (map[c.code] = { name: c.name, image_url: c.image_url })
        );
        setCharMap(map);
      })
      .catch((err) => {
        console.error("Character fetch failed:", err.message);
        toast.warn(`⚠️ ${err.message}`, {
          position: "top-right",
          autoClose: 3000,
          toastId: SUMMARY_TOAST_ID,
        });
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

    fetch(`${import.meta.env.VITE_API_BASE}/api/player/${id}/summary?${qs}`, {
      credentials: "include",
    })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(
            json.error || `Request failed with status ${r.status}`
          );
        }
        return json;
      })
      .then((s) => {
        setSummary(s);
        setError(false);
      })
      .catch((err) => {
        console.error("Summary fetch failed:", err.message);
        toast.warn(`⚠️ ${err.message}`, {
          position: "top-right",
          autoClose: 3000,
          toastId: SUMMARY_TOAST_ID,
        });
        setError(true);
      })
      .finally(() => {
        setLoading(false);
        setSumLoad(false);
      });
  }, [id, season, summaryMode]);

  /* ---------- fetch MATCHES whenever id / season / matchMode / page changes ---------- */
  useEffect(() => {
    if (!id) return;

    const qs = new URLSearchParams();
    qs.append("season", season);
    if (matchMode !== "all") qs.append("mode", matchMode);
    qs.append("limit", limit.toString());
    qs.append("offset", (page * limit).toString());

    fetch(`${import.meta.env.VITE_API_BASE}/api/player/${id}/matches?${qs}`, {
      credentials: "include",
    })
      .then(async (r) => {
        if (!r.ok) {
          const msg = await r.json().catch(() => ({}));
          throw new Error(
            msg.error || `Request failed with status ${r.status}`
          );
        }
        return r.json();
      })
      .then((mResp) => {
        setMatches(mResp.data);
        setLF(mResp.lastFetched);
        setTotal(mResp.total);
      })
      .catch((err) => {
        console.error("Match fetch failed:", err.message);
        toast.warn(`⚠️ ${err.message}`, {
          position: "top-right",
          autoClose: 3000,
          toastId: "summary-fetch-failed",
        });
        setError(true);
      });
  }, [id, season, matchMode, page]);

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
          banned: "Most Bans You Placed",
          bannedVs: "Most Bans Used Against You",
          prebanned: "Most Prebans & Joker",
          best: "Best Performing Characters",
          worst: "Worst Performing Characters",
        }
      : {
          picked: "Most Picked Characters While on Team",
          banned: "Most Bans Your Team Placed",
          bannedVs: "Most Bans Opponents Placed vs Your Team",
          prebanned: "Most Prebans & Joker",
          best: "Best Performing Characters While on Their Team",
          worst: "Worst Performing Characters While on Their Team",
        };

  /* ---------- ui ---------- */
  return (
    <div
      className="page-fade-in"
      style={{
        background: "url('/profile-bg.webp') center/cover fixed",
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
      <div
        className="position-relative z-2 text-white d-flex flex-column px-4"
        style={{ minHeight: "100vh" }}
      >
        {/* Top nav */}
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
          <div className="d-flex justify-content-center align-items-center gap-3 mb-2">
            {summary?.avatar && summary?.playerId && (
              <img
                src={`https://cdn.discordapp.com/avatars/${summary.playerId}/${summary.avatar}.png?size=64`}
                alt="avatar"
                className="rounded-circle"
                width={48}
                height={48}
                style={{ objectFit: "cover", border: "2px solid white" }}
              />
            )}
            <h1 className="display-5 fw-bold text-center mb-1">
              Player Summary: {summary?.global_name || summary?.username}
            </h1>
          </div>
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

          {isLoading ? (
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
                {renderList(
                  titles.bannedVs,
                  summary!.mostBannedAgainst,
                  "count"
                )}
                {renderList(titles.prebanned, summary!.mostPrebanned, "count")}
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

              {/* ------- match history ------- */}
              {showHist && (
                <div
                  ref={matchHistoryRef}
                  className="mt-5 d-flex flex-column gap-3"
                >
                  <div className="d-flex justify-content-between align-items-center flex-wrap">
                    <h2 className="fw-bold text-center mb-3">
                      Match History (Page {page + 1}
                      {total > 0 &&
                        ` of ${Math.ceil(
                          total / limit
                        )}, Total Matches: ${total}`}
                      )
                    </h2>
                    <select
                      value={matchMode}
                      onChange={(e) => {
                        scrollRef.current = window.scrollY;
                        setMatchMode(e.target.value as "all" | "solo" | "duo");
                        setPage(0); // reset to first page on filter change
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
                          <h6 className="text-success">
                            Your Team Picks{" "}
                            <span
                              className={`badge bg-${
                                m.myTeamSide === "red" ? "danger" : "primary"
                              }`}
                              style={{ marginLeft: 6 }}
                            >
                              {m.myTeamSide === "red"
                                ? "Red Team"
                                : "Blue Team"}
                            </span>
                          </h6>
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
                          <h6 className="text-danger">
                            Opponent Picks{" "}
                            <span
                              className={`badge bg-${
                                m.myTeamSide === "red" ? "primary" : "danger"
                              }`}
                              style={{ marginLeft: 6 }}
                            >
                              {m.myTeamSide === "red"
                                ? "Blue Team"
                                : "Red Team"}
                            </span>
                          </h6>

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

                  {/* ---------- pagination controls ---------- */}
                  <div className="d-flex justify-content-center gap-3 mt-3">
                    <button
                      className="btn btn-outline-light btn-sm"
                      onClick={() => {
                        setPage((p) => Math.max(0, p - 1));
                        matchHistoryRef.current?.scrollIntoView({
                          behavior: "smooth",
                        });
                      }}
                      disabled={page === 0}
                    >
                      ← Prev
                    </button>

                    <button
                      className="btn btn-outline-light btn-sm"
                      onClick={() => {
                        setPage((p) => p + 1);
                        matchHistoryRef.current?.scrollIntoView({
                          behavior: "smooth",
                        });
                      }}
                      disabled={matches.length < limit}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
