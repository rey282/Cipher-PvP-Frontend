// src/pages/Profile.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { seasonOptions } from "../data/season";
import type { SeasonValue } from "../data/season";

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
  avatar?: string | null;
};

type RosterCharacter = { id: string; eidolon: number };
type DraftUser = { discordId: string; profileCharacters: RosterCharacter[] };

type CharMeta = {
  code: string;
  name: string;
  rarity: number;
  image_url: string;
  id: string; // extracted from image_url
};

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

let lastProfileCache: Profile | null = null;

export default function Profile() {
  const { user } = useAuth();
  const { id } = useParams();
  const targetId = id || user?.id;
  const isSelf = targetId === user?.id;
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(lastProfileCache);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [descInput, setDescInput] = useState("");
  const [bannerInput, setBannerInput] = useState("");
  const [season, setSeason] = useState<SeasonValue>("players");

  const [charMap, setCharMap] = useState<Record<string, CharMeta>>({});
  const [ownedRoster, setOwnedRoster] = useState<Record<string, number>>({}); // id -> eidolon

  const MAX_DESC_LEN = 512;
  const tidy = (s: string) => s.trim();

  useEffect(() => {
    if (!user || !targetId) return;
    setLoading(true);

    fetch(
      `${
        import.meta.env.VITE_API_BASE
      }/api/player/${targetId}?season=${season}`,
      {
        credentials: "include",
      }
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

  useEffect(() => {
    if (!targetId) return;

    Promise.all([
      fetch(`${import.meta.env.VITE_YANYAN_URL}/getUsers`).then((r) =>
        r.json()
      ),
      fetch(`${import.meta.env.VITE_API_BASE}/api/characters?cycle=0`).then(
        (r) => r.json()
      ),
    ])
      .then(([users, res]: [DraftUser[], { data: any[] }]) => {
        const map: Record<string, CharMeta> = {};
        res.data.forEach((c) => {
          const id = c.image_url.match(/\/(\d+)\.png$/)?.[1];
          if (id) {
            map[id] = { ...c, id };
          }
        });
        setCharMap(map);

        const found = users.find((u) => u.discordId === targetId);
        if (!found) return;

        const rosterMap: Record<string, number> = {};
        found.profileCharacters.forEach((pc) => {
          if (map[pc.id]) {
            rosterMap[pc.id] = pc.eidolon;
          }
        });

        setOwnedRoster(rosterMap);
      })
      .catch(() => console.warn("Failed to load roster or character data"));
  }, [targetId]);

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

  if (id && !isSelf && !user?.isAdmin) {
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

  if (!profile && !loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center text-danger text-center"
        style={{ minHeight: "100vh", background: "#000" }}
      >
        <p>Profile not found</p>
        <a href="/" className="btn btn-outline-light mt-3">
          Back to Home
        </a>
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

  const games = profile.games_played;
  const winRate = games > 0 ? `${(profile.win_rate * 100).toFixed(1)}%` : "—";
  const elo = profile.elo > 0 ? Math.round(profile.elo) : "—";
  const avatarUrl = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.discord_id}/${profile.avatar}.png?size=128`
    : isSelf && user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
    : "/default-avatar.png";

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
        <div className="w-100 d-flex justify-content-end mb-3 pe-4">
          <button
            className="btn back-button-glass"
            onClick={() => navigate("/hsrhome")}
          >
            ← Back
          </button>
        </div>

        <div className="container">
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
              onChange={(e) => setSeason(e.target.value as SeasonValue)}
            >
              {seasonOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

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

          {Object.keys(charMap).length > 0 && (
            <div
              className="mt-5 p-3"
              style={
                {
                  position: "relative",
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 12,
                  backdropFilter: "blur(6px)",
                  boxShadow: "0 0 18px rgba(0,0,0,0.4)",
                } as React.CSSProperties
              }
            >
              <div className="d-flex align-items-center gap-2 mb-3">
                <img
                  src={avatarUrl}
                  alt="avatar"
                  className="rounded-circle"
                  width={24}
                  height={24}
                  style={{ objectFit: "cover" }}
                />
                <h5 className="m-0">{profile.display_name}&apos;s Roster</h5>
              </div>
              <div className="d-flex flex-wrap gap-2 justify-content-start">
                {Object.values(charMap)
                  .sort((a, b) => {
                    const ownedA = ownedRoster[a.id] !== undefined;
                    const ownedB = ownedRoster[b.id] !== undefined;
                    if (ownedA !== ownedB) return ownedB ? 1 : -1;
                    return a.name.localeCompare(b.name);
                  })
                  .map((char) => {
                    const isOwned = ownedRoster[char.id] !== undefined;
                    const eidolon = ownedRoster[char.id] ?? 0;
                    const borderColor =
                      char.rarity === 5
                        ? "2px solid gold"
                        : char.rarity === 4
                        ? "2px solid #b666d2"
                        : "none";

                    return (
                      <div
                        key={char.id}
                        title={char.name}
                        style={{
                          zIndex: 1,
                          width: 64,
                          height: 64,
                          position: "relative",
                          borderRadius: 8,
                          overflow: "hidden",
                          border: borderColor,
                          backgroundColor: "#222",
                          filter: isOwned
                            ? "none"
                            : "grayscale(100%) brightness(0.4)",
                        }}
                      >
                        <img
                          src={char.image_url}
                          alt={char.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                        {isOwned && (
                          <span
                            className="position-absolute bottom-0 start-0"
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              backgroundColor: "rgba(0, 0, 0, 0.7)",
                              color: "#fff",
                              padding: "2px 6px",
                              borderTopRightRadius: 6,
                              lineHeight: 1,
                            }}
                          >
                            E{eidolon}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
              <div className="d-flex justify-content-end mt-3">
                <a
                  href="https://draft.cipher.uno/player"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Edit your roster"
                  className="position-absolute edit-roster-btn"
                  style={{
                    right: 16,
                    bottom: 16,
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    backdropFilter: "blur(6px)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    color: "#fff",
                    textDecoration: "none",
                    fontSize: "1.1rem",
                    zIndex: 10,
                    cursor: "pointer",
                    transition: "transform 0.2s ease-in-out",
                  }}
                >
                  ✎
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
