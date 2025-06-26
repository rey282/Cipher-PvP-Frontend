// src/components/Profile.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import "./Landing.css";

/* ────────── types ────────── */
type Profile = {
  discord_id: string;
  display_name: string;
  username: string;
  games_played: number;
  win_rate: number;
  description: string | null;
  banner_url: string | null;
  color: string | null;
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [descInput, setDescInput] = useState("");
  const [bannerInput, setBannerInput] = useState("");

  useEffect(() => {
    if (!user) return;

    fetch(`${import.meta.env.VITE_API_BASE}/player/${user.id}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setDescInput(data.description ?? "");
        setBannerInput(data.banner_url ?? "");
      })
      .catch(() => toast.error("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [user]);

  const handleSave = () => {
    fetch(`${import.meta.env.VITE_API_BASE}/player/${user?.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: descInput,
        banner_url: bannerInput,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setProfile((p) => (p ? { ...p, ...data } : p));
        toast.success("Profile updated!");
        setEditMode(false);
      })
      .catch(() => toast.error("Update failed"));
  };

  if (loading || !user) {
    return (
      <div className="d-flex justify-content-center align-items-center text-white" style={{ minHeight: "100vh", background: "#000" }}>
        <p>Loading profile…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center mt-5 text-danger">Profile not found</div>
    );
  }

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
      {/* overlay */}
      <div
        style={{
          backgroundColor: "rgba(0,0,0,.6)",
          position: "absolute",
          inset: 0,
          zIndex: 1,
        }}
      />

      <div className="position-relative z-2 text-white">
        <Navbar />

        {profile.banner_url && (
          <div
            className="w-100"
            style={{
              height: "220px",
              background: `url(${profile.banner_url}) center/cover no-repeat`,
            }}
          />
        )}

        <div className="container py-4">
          {/* profile header */}
          <div className="d-flex align-items-center gap-3 mb-4">
            <img
              src={`https://cdn.discordapp.com/avatars/${profile.discord_id}/${user?.avatar}.png?size=128`}
              alt="avatar"
              className="rounded-circle"
              width={96}
              height={96}
            />
            <div>
              <h2 className="m-0">{profile.display_name}</h2>
              <small className="text-white-50">@{profile.username}</small>
            </div>
            <button
              className="btn back-button-glass ms-auto"
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>
          </div>

          {/* stats */}
          <div className="row row-cols-2 row-cols-md-4 g-3">
            <div className="col">
              <div className="card bg-dark bg-opacity-75 text-center p-3 h-100">
                <strong>{profile.games_played}</strong>
                <span className="text-white-50">Matches</span>
              </div>
            </div>
            <div className="col">
              <div className="card bg-dark bg-opacity-75 text-center p-3 h-100">
                <strong>{(profile.win_rate * 100).toFixed(1)}%</strong>
                <span className="text-white-50">Win&nbsp;Rate</span>
              </div>
            </div>
          </div>

          {/* description */}
          <div className="mt-4 card bg-dark bg-opacity-75 p-3">
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
                  <button className="btn btn-success px-4" onClick={handleSave}>
                    Save
                  </button>
                  <button
                    className="btn btn-outline-secondary"
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
                <button
                  className="btn btn-outline-light btn-sm"
                  onClick={() => setEditMode(true)}
                >
                  Edit
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
