// src/pages/Profile.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

/* ──────────── Types ──────────── */
type Profile = {
  discord_id: string;
  display_name: string;
  username: string;
  games_played: number;
  win_rate: number;
  elo: number;
  description: string | null;
  banner_url: string | null;
  color: string | null;
  avatar?: string | null; // fetched for the target user
};

/* ──────────── Season list ──────────── */
const SEASON_OPTIONS = [
  { key: "players", label: "Season 2" },
  { key: "players_1", label: "Season 1" },
  { key: "all", label: "All-Time" },
] as const;
type SeasonKey = (typeof SEASON_OPTIONS)[number]["key"];

/* ──────────── Re-usable styles ──────────── */
const glassSelectStyle: React.CSSProperties = {
  width: 160,
  padding: "0.75rem 1rem",
  backgroundColor: "rgba(0,0,0,0.5)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: "#fff",
  backdropFilter: "blur(6px)",
  outline: "none",
};

/* ──────────── Tab-scoped memory cache ──────────── */
let lastProfileCache: Profile | null = null;

/* ════════════════════════════════════════════════
   Profile page
   ════════════════════════════════════════════════ */
export default function Profile() {
  /* ------- who is viewing / being viewed? ------- */
  const { user } = useAuth();
  const { id } = useParams(); // optional :id
  const targetId = id || user?.id; // whose profile we fetch
  const isSelf = targetId === user?.id;

  const navigate = useNavigate();

  /* ------- component state ------- */
  const [profile, setProfile] = useState<Profile | null>(lastProfileCache);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [descInput, setDescInput] = useState("");
  const [bannerInput, setBannerInput] = useState("");
  const [season, setSeason] = useState<SeasonKey>("players");

  /* ------- helpers ------- */
  const MAX_DESC_LEN = 512;
  const tidy = (s: string) => s.trim();

  /* ------- FETCH whenever season / target changes ------- */
  useEffect(() => {
    if (!user || !targetId) return;
    setLoading(true);

    fetch(
      `${
        import.meta.env.VITE_API_BASE
      }/api/player/${targetId}?season=${season}`,
      { credentials: "include" }
    )
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Fetch failed");
        return j as Profile;
      })
      .then((data) => {
        setProfile(data);
        lastProfileCache = data;
        setDescInput(data.description ?? "");
        setBannerInput(data.banner_url ?? "");
      })
      .catch(() => toast.error("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [user, targetId, season]);

  /* ------- PATCH save ------- */
  const handleSave = async () => {
    if (!user || !targetId) return;

    const payload: Record<string, string | null> = {};
    const desc = tidy(descInput);
    const banner = tidy(bannerInput);

    if (desc !== (profile?.description ?? "")) {
      if (desc.length > MAX_DESC_LEN) {
        toast.error(`Description > ${MAX_DESC_LEN} characters`);
        return;
      }
      payload.description = desc || null;
    }
    if (banner !== (profile?.banner_url ?? "")) {
      payload.banner_url = banner || null;
    }
    if (!Object.keys(payload).length) {
      toast.info("Nothing to update.");
      setEditMode(false);
      return;
    }

    try {
      const r = await fetch(
        `${import.meta.env.VITE_API_BASE}/api/player/${targetId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || r.statusText);

      setProfile((p) => (p ? { ...p, ...j } : p));
      toast.success("Profile updated!");
      setEditMode(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Update failed");
    }
  };

  /* ------- guards / loaders ------- */
  if (!user) {
    return (
      <div className="text-white text-center mt-5">
        <p>User not registered – join our Discord.</p>
      </div>
    );
  }

  // Only allow access if you're the owner or an admin
  if (id && !isSelf && !user?.isAdmin) {
    return (
      <div
        className="d-flex justify-content-center align-items-center text-danger text-center"
        style={{ minHeight: "100vh", background: "#000" }}
      >
        <div>
          <h3 className="mb-3">Access Denied</h3>
          <p>What are you trying to do???</p>
        </div>
      </div>
    );
  }

  if (!profile && !loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center text-danger"
        style={{ minHeight: "100vh", background: "#000" }}
      >
        <p>Profile not found</p>
      </div>
    );
  }
  if (loading || !profile) {
    return (
      <div
        className="text-white-50 text-center mt-5 fst-italic"
        style={{ minHeight: "100vh", background: "#000", paddingTop: "4rem" }}
      >
        Loading…
      </div>
    );
  }

  /* ------- derived data ------- */
  const games = profile.games_played;
  const winRate = games > 0 ? `${(profile.win_rate * 100).toFixed(1)}%` : "—";
  const elo = profile.elo > 0 ? Math.round(profile.elo) : "—";

  /* avatar: prefer target’s avatar → default */
  const avatarUrl = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.discord_id}/${profile.avatar}.png?size=128`
    : isSelf && user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
    : "/default-avatar.png";

  /* ============= Render ============= */
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
          backgroundColor: "rgba(0,0,0,.6)",
          position: "absolute",
          inset: 0,
          zIndex: 1,
        }}
      />

      <div className="position-relative z-2 text-white px-4 pb-5">
        <Navbar />

        {/* same back-button row as Admin page */}
        <div className="w-100 d-flex justify-content-end mb-3 pe-4">
          <button
            className="btn back-button-glass"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>
        </div>

        <div className="container">
          {/* header */}
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <img
              src={avatarUrl}
              alt="avatar"
              className="rounded-circle"
              width={96}
              height={96}
              style={{ objectFit: "cover" }}
            />
            <div className="me-auto">
              <h2 className="m-0">{profile.display_name}</h2>
              <small className="text-white-50">@{profile.username}</small>
            </div>

            <select
              style={glassSelectStyle}
              value={season}
              onChange={(e) => setSeason(e.target.value as SeasonKey)}
            >
              {SEASON_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* stats */}
          <div className="row row-cols-2 row-cols-md-4 g-3 mt-4">
            {[
              { label: "Matches", value: games },
              { label: "Win Rate", value: winRate },
              { label: "ELO", value: elo },
            ].map((c) => (
              <div className="col" key={c.label}>
                <div className="card bg-dark bg-opacity-75 text-center p-3 h-100 shadow-sm">
                  <strong className="text-info fs-4">{c.value}</strong>
                  <span className="text-white-50">{c.label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* about / edit  */}
          <div
            className="mt-4 p-3"
            style={{
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 12,
              backdropFilter: "blur(6px)",
              boxShadow: "0 0 18px rgba(0,0,0,0.4)",
            }}
          >
            <h5 className="mb-3">About</h5>

            {editMode ? (
              <>
                <textarea
                  className="form-control mb-3"
                  rows={4}
                  value={descInput}
                  placeholder="Describe yourself…"
                  onChange={(e) => setDescInput(e.target.value)}
                />

                <input
                  className="form-control mb-3"
                  type="url"
                  value={bannerInput}
                  placeholder="Banner image / GIF URL"
                  onChange={(e) => setBannerInput(e.target.value)}
                />

                <div className="d-flex gap-2">
                  <button
                    className="btn btn-success px-4"
                    style={{ borderRadius: 10 }}
                    onClick={handleSave}
                  >
                    Save
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    style={{ borderRadius: 10 }}
                    onClick={() => {
                      setEditMode(false);
                      setDescInput(profile.description ?? "");
                      setBannerInput(profile.banner_url ?? "");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-2">
                  {profile.description || (
                    <span className="text-white-50 fst-italic">
                      No description
                    </span>
                  )}
                </p>
                {/* allow editing if it’s your own profile OR you’re an admin */}
                {(isSelf || user.isAdmin) && (
                  <button
                    className="btn btn-outline-light btn-sm"
                    style={{ borderRadius: 10 }}
                    onClick={() => setEditMode(true)}
                  >
                    Edit
                  </button>
                )}
              </>
            )}
          </div>

          {/* banner image at bottom */}
          {profile.banner_url && (
            <div
              className="w-100 mt-5"
              style={{
                aspectRatio: "4 / 1",
                background: `url(${profile.banner_url}) center / cover no-repeat`,
                borderRadius: 12,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
