import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Landing.css";
import Navbar from "../components/Navbar";
import { toast } from "react-toastify";

type Player = {
  discord_id: string;
  username: string;
  nickname: string;
  elo: number;
  games_played: number;
  win_rate: number;
  global_name?: string;
};

type ApiResponse = {
  data: Player[];
  lastFetched: string;
  totalMatches?: number;
};

const ROWS_PER_PAGE = 10;

import { seasonOptions } from "../data/season";
import type { SeasonValue } from "../data/season";

export default function PlayerStats() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [lastFetched, setFetched] = useState<string | null>(null);
  const [totalMatches, setTotalMatches] = useState<number | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearch] = useState("");
  const [season, setSeason] = useState<SeasonValue>("players");

  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const url =
      season === "all"
        ? `${import.meta.env.VITE_API_BASE}/api/players?season=all`
        : `${import.meta.env.VITE_API_BASE}/api/players?season=${season}`;

    fetch(url, {
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
      .then((j: ApiResponse) => {
        setPlayers(j.data);
        setFetched(j.lastFetched);
        setTotalMatches(j.totalMatches || null);
        setLoading(false);
        setPage(1);
      })
      .catch((err) => {
        console.error("Player fetch failed:", err.message);
        toast.warn(`⚠️ ${err.message}`, {
          position: "top-right",
          autoClose: 3000,
        });
        setLoading(false);
      });
      
  }, [season]);


  const filtered = players
    .filter((p) => p.games_played > 0)
    .filter((p) =>
      (p.username || p.nickname || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );


  const pageCount = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const pageData = filtered.slice(
    (page - 1) * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE
  );

  const goto = (n: number) => setPage(Math.min(Math.max(1, n), pageCount));
  const openPlayer = (id: string) => navigate(`/cipher/player/${id}?season=${season}`);

  return (
    <div
      className="page-fade-in"
      style={{
        backgroundImage: "url('/background.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        minHeight: "100vh",
        position: "relative",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0,0,0,.7)",
          position: "absolute",
          inset: 0,
          zIndex: 1,
        }}
      />
      <div
        className="position-relative z-2 text-white d-flex flex-column px-4"
        style={{ minHeight: "100vh" }}
      >
        <Navbar />

        <div className="w-100 d-flex justify-content-end mb-3 pe-4">
          <Link to="/" className="btn back-button-glass">
            ← Back
          </Link>
        </div>

        <div className="container">
          <h1 className="display-4 fw-bold text-center mb-3">
            Player Statistics
          </h1>

          {(lastFetched || totalMatches !== null) && (
            <p
              className="text-center text-white-50 mb-4"
              style={{ fontSize: "0.85rem" }}
            >
              {lastFetched && (
                <>
                  Data last updated: {new Date(lastFetched).toLocaleString()}
                  <br />
                </>
              )}
              {totalMatches !== null && (
                <>
                  Total Matches{season === "all" ? "" : " this Season"}:{" "}
                  <strong>{totalMatches}</strong>
                </>
              )}
            </p>
          )}

          {/* Search + Season Filter */}
          <div className="d-flex justify-content-center align-items-center gap-3 mb-4 flex-wrap">
            <div style={{ maxWidth: 500, width: "100%" }}>
              <input
                type="text"
                placeholder="Search by player name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  backgroundColor: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "10px",
                  color: "#fff",
                  backdropFilter: "blur(6px)",
                  outline: "none",
                }}
              />
            </div>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value as SeasonValue)}
              className="form-select"
              style={{
                width: 160,
                padding: "0.75rem 1rem",
                backgroundColor: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                color: "#fff",
                backdropFilter: "blur(6px)",
                outline: "none",
              }}
            >
              {seasonOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <p className="text-center">Loading players…</p>
          ) : (
            <>
              <div
                className="mx-auto"
                style={{
                  background: "rgba(0,0,0,0.5)",
                  backdropFilter: "blur(6px)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  boxShadow: "0 0 18px rgba(0,0,0,0.4)",
                  padding: "1rem",
                  maxWidth: 1000,
                }}
              >
                <div className="table-responsive">
                  <table
                    className="table table-hover mb-0"
                    style={{
                      backgroundColor: "transparent",
                      color: "white",
                      tableLayout: "fixed",
                      width: "100%",
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            width: "40%",
                            backgroundColor: "transparent",
                            color: "#fff",
                          }}
                        >
                          Username
                        </th>
                        <th
                          style={{
                            width: "20%",
                            backgroundColor: "transparent",
                            color: "#fff",
                          }}
                        >
                          {season === "all" ? "Average ELO" : "ELO"}
                        </th>
                        <th
                          style={{
                            width: "20%",
                            backgroundColor: "transparent",
                            color: "#fff",
                          }}
                        >
                          {season === "all"
                            ? "Total Games Played"
                            : "Games Played"}
                        </th>
                        <th
                          style={{
                            width: "20%",
                            backgroundColor: "transparent",
                            color: "#fff",
                          }}
                        >
                          {season === "all" ? "Average Win Rate" : "Win Rate"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageData.map((p) => (
                        <tr
                          key={p.discord_id}
                          style={{ cursor: "pointer" }}
                          onClick={() => openPlayer(p.discord_id)}
                          title={`${
                            p.username || p.nickname || "Unknown"
                          } details`}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "rgba(255,255,255,0.1)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "transparent")
                          }
                        >
                          <td
                            style={{
                              backgroundColor: "transparent",
                              color: "#fff",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {p.username || p.nickname || "Unknown"}
                          </td>
                          <td
                            style={{
                              backgroundColor: "transparent",
                              color: "#fff",
                            }}
                          >
                            {Math.round(p.elo)}
                          </td>
                          <td
                            style={{
                              backgroundColor: "transparent",
                              color: "#fff",
                            }}
                          >
                            {p.games_played}
                          </td>
                          <td
                            style={{
                              backgroundColor: "transparent",
                              color: "#fff",
                            }}
                          >
                            {(p.win_rate * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {pageCount > 1 && (
                <div className="d-flex justify-content-center gap-2 mt-3">
                  <button
                    className="btn btn-sm btn-outline-light"
                    disabled={page === 1}
                    onClick={() => goto(page - 1)}
                  >
                    ◀ Prev
                  </button>
                  <span className="pt-1">
                    Page {page} / {pageCount}
                  </span>
                  <button
                    className="btn btn-sm btn-outline-light"
                    disabled={page === pageCount}
                    onClick={() => goto(page + 1)}
                  >
                    Next ▶
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
