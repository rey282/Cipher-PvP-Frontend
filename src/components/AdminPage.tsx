// src/pages/AdminPage.tsx
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import AdminMatchHistoryPanel from "../components/admin/AdminMatchHistoryPanel";
import AdminRosterLogPanel from "../components/admin/AdminRosterLogPanel";
import "./Landing.css";

/* ---------- types ---------- */
type PlayerMini = {
  discord_id: string;
  username: string;
  nickname: string | null;
};

type PanelKey = "balance" | "history" | "roster" | "edit";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [activePanel, setActivePanel] = useState<PanelKey>("balance");

  /* ────────── autocomplete state ────────── */
  const [players, setPlayers] = useState<PlayerMini[]>([]);
  const [query, setQuery] = useState("");
  const [suggest, setSuggest] = useState<PlayerMini[]>([]);
  const [fetching, setFetching] = useState(true);

  const boxRef = useRef<HTMLDivElement>(null);

  /* click-outside ref to close dropdown */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) {
        setSuggest([]);
      }
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);


  /* ────────── auth + fetch players ────────── */
  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) {
      navigate("/");
      return;
    }

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
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, loading, navigate]);

  /* ────────── live filter for profile search ────────── */
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
            p.username?.toLowerCase().includes(lc) ||
            p.nickname?.toLowerCase().includes(lc)
        )
        .slice(0, 6)
    );
  }, [query, players]);

  const jump = (uid: string) => {
    setQuery("");
    setSuggest([]);
    navigate(`/profile/${uid}`);
  };

  /* ────────── loading gate ────────── */
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

  /* ────────── sidebar button helper ────────── */
  const SidebarItem = ({
    id,
    label,
    icon,
  }: {
    id: PanelKey;
    label: string;
    icon: string;
  }) => (
    <button
      type="button"
      onClick={() => setActivePanel(id)}
      className={`admin-sidebar-item d-flex align-items-center gap-2 ${
        activePanel === id ? "active" : ""
      }`}
    >
      <span className="admin-sidebar-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );

  /* ────────── right-panel renderer ────────── */
  const renderPanel = () => {
    switch (activePanel) {
      case "balance":
        return (
          <div className="admin-panel-box admin-panel-fill">
            <div className="admin-balance-inner">
              <p className="text-white-50 mb-4 fs-5 text-center">
                Choose which balance editor you want to open.
              </p>

              <div className="balance-buttons-stack">
                <button
                  type="button"
                  className="balance-giant-btn"
                  onClick={() => navigate("/admin/balance")}
                >
                  <div className="big-btn-title">Cipher PvP</div>
                  <div className="big-btn-sub">Cipher balance cost editor</div>
                </button>

                <button
                  type="button"
                  className="balance-giant-btn"
                  onClick={() => navigate("/admin/cerydra-balance")}
                >
                  <div className="big-btn-title">Cerydra PvP</div>
                  <div className="big-btn-sub">Cerydra balance cost editor</div>
                </button>
              </div>
            </div>
          </div>
        );

      case "history":
        return (
          <div className="admin-panel-box admin-panel-scroll">
            <AdminMatchHistoryPanel />
          </div>
        );

      case "roster":
        return (
          <div className="admin-panel-box admin-panel-scroll">
            <AdminRosterLogPanel />
          </div>
        );

      case "edit":
        return (
          <div className="admin-panel-box admin-panel-fill">
            <div className="admin-panel-inner d-flex flex-column justify-content-center align-items-center text-center">
              <p className="text-white-50 mb-4">
                Jump directly to any player profile and edit it.
              </p>

              {/* Centered narrow input container */}
              <div ref={boxRef} style={{ width: "100%", maxWidth: 450 }}>
                <form
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    if (query.trim()) jump(query.trim());
                  }}
                >
                  <input
                    className="form-control mb-3"
                    placeholder="ID / username / nickname"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{
                      borderRadius: 10,
                      backgroundColor: "rgba(255,255,255,0.12)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.3)",
                    }}
                  />

                  <button
                    className="btn btn-outline-light w-100"
                    type="submit"
                    disabled={!query.trim()}
                  >
                    Go →
                  </button>
                </form>

                {suggest.length > 0 && (
                  <ul
                    className="list-group mt-3"
                    style={{
                      maxHeight: 240,
                      overflowY: "auto",
                      borderRadius: 10,
                      backgroundColor: "#111",
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    {suggest.map((p) => (
                      <li
                        key={p.discord_id}
                        className="list-group-item list-group-item-action"
                        style={{
                          backgroundColor: "#111",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                        }}
                        onClick={() => jump(p.discord_id)}
                      >
                        <strong>{p.username || "-"}</strong>
                        {p.nickname && (
                          <span className="text-white-50 ms-1">
                            ({p.nickname})
                          </span>
                        )}
                        <span className="text-info ms-2">{p.discord_id}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {fetching && (
                  <small className="text-white-50 d-block mt-3">
                    Loading roster…
                  </small>
                )}
              </div>
            </div>
          </div>
        );
    }
  };

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
        className="position-relative z-2 text-white d-flex flex-column px-3 px-md-4"
        style={{ height: "100vh" }}
      >
        <Navbar />

        {/* two-column admin layout */}
        <div className="admin-shell d-flex flex-grow-1 gap-3 mb-4">
          {/* LEFT: mini nav */}
          <div className="admin-sidebar d-flex flex-column">
            <SidebarItem
              id="balance"
              label="Balance Cost"
              icon="⚖️
"
            />
            <SidebarItem id="history" label="Match History" icon="📜" />
            <SidebarItem id="roster" label="Roster Log" icon="📂" />
            <SidebarItem id="edit" label="Edit Profile" icon="👤" />
          </div>

          {/* RIGHT: content area */}
          <div className="admin-content flex-grow-1">{renderPanel()}</div>
        </div>

        <div className="text-center mb-3 small text-white-50">
          Admin: {user.global_name || user.username}
        </div>
      </div>
    </div>
  );
}
