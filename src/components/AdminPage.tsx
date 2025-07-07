// src/pages/AdminPage.tsx
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import "./Landing.css";

/* ────────── small type for autocomplete roster ────────── */
type PlayerMini = {
  discord_id: string;
  username: string;
  nickname: string | null;
};

export default function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  /* ────────── autocomplete state ────────── */
  const [players, setPlayers] = useState<PlayerMini[]>([]);
  const [query, setQuery] = useState("");
  const [suggest, setSuggest] = useState<PlayerMini[]>([]);
  const [fetching, setFetching] = useState(true);

  /* click-outside ref to close dropdown */
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setSuggest([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ────────── initial auth / roster fetch ────────── */
  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) {
      navigate("/");
      return;
    }

    /* fetch roster once (cached server-side) */
    fetch(`${import.meta.env.VITE_API_BASE}/api/players?season=all`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j) =>
        setPlayers(
          (j.data || []).map((p: any) => ({
            discord_id: p.discord_id,
            username: p.username,
            nickname: p.nickname ?? null,
          }))
        )
      )
      .catch(() => {
        /* ignore – search just won’t work */
      })
      .finally(() => setFetching(false));
  }, [user, loading, navigate]);

  /* ────────── live filter suggestions ────────── */
  useEffect(() => {
    if (!query.trim()) {
      setSuggest([]);
      return;
    }
    const lc = query.toLowerCase();
    setSuggest(
      players
        .filter(
          (p) =>
            p.discord_id.includes(lc) ||
            (p.username || "").toLowerCase().includes(lc) ||
            (p.nickname || "").toLowerCase().includes(lc)
        )
        .slice(0, 6)
    );
  }, [query, players]);

  /* ────────── helper to jump to editable profile ────────── */
  const jump = (uid: string) => {
    setQuery("");
    setSuggest([]);
    navigate(`/profile/${uid}`); // ← admin-editable profile path
  };

  /* ────────── card definitions ────────── */
  const cards = [
    {
      title: "Cipher PvP Balance Cost",
      desc: "Adjust cost values for Cipher PvP characters",
      url: "/admin/balance",
    },
    {
      title: "Cerydra PvP Balance Cost",
      desc: "Adjust cost values for Cerydra PvP characters",
      url: "/admin/cerydra-balance",
    },
    {
      title: "Match History",
      desc: "View and rollback submitted matches",
      url: "/admin/match-history",
    },
    {
      title: "Roster Log",
      desc: "View roster logs",
      url: "/admin/roster-log",
    },
    {
      title: "Edit Any Profile",
      desc: "Jump to a player's editable profile",
      url: "internal-edit",
    },
    { title: "Coming Soon", desc: "Coming Soon", url: null },
  ] as const;
  /* ────────── access-check loader ────────── */
  if (loading || !user) {
    return (
      <div
        className="d-flex justify-content-center align-items-center text-white"
        style={{ minHeight: "100vh", background: "#000" }}
      >
        <p>Checking admin access…</p>
      </div>
    );
  }

  /* ══════════════════ RENDER ══════════════════ */
  return (
    <div
      className="page-fade-in"
      style={{
        backgroundImage: "url('/admin.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
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
        className="position-relative z-2 text-white d-flex flex-column px-4"
        style={{ minHeight: "100vh" }}
      >
        <Navbar />

        {/* back */}
        <div className="w-100 d-flex justify-content-end mb-3 pe-4">
          <button
            onClick={() => navigate("/")}
            className="btn back-button-glass"
          >
            ← Back
          </button>
        </div>

        {/* hero */}
        <div className="text-center py-5 animate__animated animate__fadeInDown">
          <h1 className="display-4 fw-bold mb-3">Cipher Admin</h1>
          <p className="lead text-white-50">
            Welcome, {user.global_name || user.username}!
          </p>
        </div>

        {/* grid */}
        <div className="container mb-5">
          <div
            className="row g-4 animate__animated animate__fadeInUp animate__delay-1s"
            style={{ overflow: "visible" }}
          >
            {cards.map(({ title, desc, url }, i) => (
              <div className="col-sm-6 col-lg-4" key={i}>
                {/* special internal search card */}
                {url === "internal-edit" ? (
                  <div
                    ref={boxRef}
                    className="feature-card text-white text-center d-flex flex-column align-items-center justify-content-center"
                    style={{
                      height: "100%",
                      position: "relative",
                      zIndex: 5,
                    }}
                  >
                    <div className="feature-title mb-2">{title}</div>
                    <p className="feature-desc text-center mb-3">{desc}</p>

                    <form
                      style={{ width: "100%", maxWidth: 280 }}
                      onSubmit={(e: FormEvent) => {
                        e.preventDefault();
                        if (query.trim()) jump(query.trim());
                      }}
                    >
                      <input
                        className="form-control mb-2"
                        placeholder="ID / username / nickname"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        style={{
                          borderRadius: 8,
                          backgroundColor: "rgba(255, 255, 255, 0.15)",
                          color: "#fff",
                          border: "1px solid rgba(255, 255, 255, 0.3)",
                        }}
                      />

                      <button
                        className="btn btn-outline-light w-100"
                        type="submit"
                        disabled={!query.trim()}
                      >
                        Go →
                      </button>

                      {/* suggestions */}
                      {suggest.length > 0 && (
                        <ul
                          className="list-group position-absolute w-100 mt-1"
                          style={{
                            maxHeight: 180,
                            overflowY: "auto",
                            backgroundColor: "#111",
                            borderRadius: 8,
                            zIndex: 999,
                            border: "1px solid rgba(255,255,255,0.2)",
                            boxShadow: "0 0 8px rgba(0,0,0,0.5)",
                          }}
                        >
                          {suggest.map((p) => (
                            <li
                              key={p.discord_id}
                              className="list-group-item list-group-item-action py-1 px-2"
                              style={{
                                backgroundColor: "#111",
                                color: "#fff",
                                cursor: "pointer",
                                border: "none",
                              }}
                              onClick={() => jump(p.discord_id)}
                            >
                              <strong>{p.username || "-"}</strong>
                              {p.nickname && (
                                <span className="text-white-50 ms-1">
                                  ({p.nickname})
                                </span>
                              )}
                              <span className="text-info ms-2">
                                {p.discord_id}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* small loader note */}
                      {fetching && (
                        <small className="text-white-50 d-block mt-2">
                          Loading roster…
                        </small>
                      )}
                    </form>
                  </div>
                ) : url ? (
                  /* internal links */
                  <Link
                    to={url}
                    className="feature-card text-decoration-none d-flex flex-column align-items-center justify-content-center text-white link-hover"
                    onClick={() => window.scrollTo(0, 0)}
                  >
                    <div className="feature-title">{title}</div>
                    <div className="feature-desc text-center">{desc}</div>
                  </Link>
                ) : (
                  /* disabled placeholder card */
                  <div className="feature-card text-white text-center disabled-feature d-flex flex-column align-items-center justify-content-center">
                    <div className="feature-title">{title}</div>
                    <div className="feature-desc">{desc}</div>
                    <small className="text-muted">Coming&nbsp;Soon</small>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* notes */}
          <div
            className="text-center mb-4 mt-5 animate__animated animate__fadeInUp animate__delay-2s px-3"
            style={{
              maxWidth: 600,
              marginInline: "auto",
              backgroundColor: "rgba(0,0,0,0.5)",
              padding: "1rem 1.5rem",
              borderRadius: 12,
              backdropFilter: "blur(6px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <h5 className="fw-bold mb-3">Admin Notes</h5>
            <p className="mb-0">Haya is the goat.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
