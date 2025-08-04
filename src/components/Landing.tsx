import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Landing.css";
import Navbar from "../components/Navbar";
import { Modal, Button, Form } from "react-bootstrap";
import { toast } from "react-toastify";

const games = [
  {
    id: "zzz",
    name: "Vivian PvP",
    bg: "/zzz-bg.webp",
    icon: "/zzz-icon.jpeg",
    live: true,
    link: "/zzz",
  },
  {
    id: "hsr",
    name: "Cipher PvP",
    bg: "/HsrBackground.webp",
    icon: "/cipher-icon.webp",
    live: true,
    link: "/cipher",
  },
  {
    id: "hsr2",
    name: "Cerydra PvP",
    bg: "/cerydra-bg.webp",
    icon: "/cerydra-icon.jpg",
    live: true,
    link: "/cerydra",
  },
];

// Team member IDs + roles
const hsrTeamIds: { id: string; role: string }[] = [
  { id: "663145925807702029", role: "Server Owner / Balancer" },
  { id: "249042315736252417", role: "Developer" },
  { id: "371513247641370625", role: "Developer" },
  { id: "693052597812330536", role: "Balancer" },
  { id: "478408402700206081", role: "Balancer" },
  { id: "381948397591986220", role: "Balancer" },
];

const genshinTeamIds: { id: string; role: string }[] = [
  { id: "663145925807702029", role: "Server Owner / Balancer" },
  { id: "249042315736252417", role: "Developer" },
  { id: "371513247641370625", role: "Developer" },
  { id: "486164092931932179", role: "Balancer" },
  { id: "841509164673269792", role: "Balancer" },
  { id: "115890480813703175", role: "Balancer" },
  { id: "265624516762271745", role: "Balancer" },
  { id: "693052597812330536", role: "Balancer" },
];

// ─── In-memory cache ───
const teamCache: {
  hsr: any[] | null;
  genshin: any[] | null;
} = {
  hsr: null,
  genshin: null,
};

export default function Landing() {
  const [selected, setSelected] = useState(1);
  const [currentBg, setCurrentBg] = useState(games[1].bg);
  const [fadeBg, setFadeBg] = useState("");
  const [bgFading, setBgFading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [team1Name, setTeam1Name] = useState("");
  const [team2Name, setTeam2Name] = useState("");
  const [mode, setMode] = useState("2v2");
  const [hsrTeamProfiles, setHsrTeamProfiles] = useState<any[]>([]);
  const [genshinTeamProfiles, setGenshinTeamProfiles] = useState<any[]>([]);

  const navigate = useNavigate();

  const handleStart = () => {
    if (!team1Name.trim() || !team2Name.trim()) {
      toast.warn("Please enter both team names.");
      return;
    }
    const names = [team1Name.trim(), team2Name.trim()];
    const [team1, team2] = Math.random() < 0.5 ? names : [names[1], names[0]];
    const query = new URLSearchParams({ team1, team2, mode });
    navigate(`/zzz/draft?${query.toString()}`);
  };

  // Ko-fi widget
  useEffect(() => {
    if (document.getElementById("kofi-widget-script")) {
      const w = (window as any).kofiWidgetOverlay;
      if (w) {
        w.draw("haya28", {
          type: "floating-chat",
          "floating-chat.donateButton.text": "Support Us",
          "floating-chat.donateButton.background-color": "#8b5cf6",
          "floating-chat.donateButton.text-color": "#ffffff",
        });
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "kofi-widget-script";
    script.src = "https://storage.ko-fi.com/cdn/scripts/overlay-widget.js";
    script.async = true;
    script.onload = () => {
      const w = (window as any).kofiWidgetOverlay;
      if (w) {
        w.draw("haya28", {
          type: "floating-chat",
          "floating-chat.donateButton.text": "Support Us",
          "floating-chat.donateButton.background-color": "#8b5cf6",
          "floating-chat.donateButton.text-color": "#ffffff",
        });
      }
    };
    document.body.appendChild(script);
  }, []);

  // Crossfade background
  useEffect(() => {
    if (!bgFading) return;
    const t = setTimeout(() => {
      setCurrentBg(fadeBg);
      setBgFading(false);
    }, 600);
    return () => clearTimeout(t);
  }, [bgFading, fadeBg]);

  // Change game background
  const changeGame = (i: number) => {
    if (games[i].bg === currentBg) return;
    setFadeBg(games[i].bg);
    setBgFading(true);
    setSelected(i);
  };

  const gotoLivePage = (url: string) => {
    setLeaving(true);
    setTimeout(() => navigate(url), 500);
  };

  const game = games[selected];
  const team =
    game.id === "hsr"
      ? hsrTeamProfiles
      : game.id === "hsr2"
      ? genshinTeamProfiles
      : [];

  // Cached fetch
  const fetchProfiles = async (
    teamList: { id: string; role: string }[],
    cacheKey: "hsr" | "genshin",
    setter: (profiles: any[]) => void
  ) => {
    if (teamCache[cacheKey]) {
      setter(teamCache[cacheKey]!);
      return;
    }

    const results = await Promise.all(
      teamList.map((member) =>
        fetch(
          `${import.meta.env.VITE_API_BASE}/api/player/${member.id}/summary`,
          {
            credentials: "include",
          }
        )
          .then((res) => (res.ok ? res.json() : null))
          .then((data) =>
            data
              ? {
                  id: member.id,
                  avatar: data.avatar,
                  username: data.username,
                  global_name: data.global_name,
                  role: member.role,
                }
              : null
          )
          .catch(() => null)
      )
    );

    const filtered = results.filter(Boolean) as any[];
    teamCache[cacheKey] = filtered;
    setter(filtered);
  };

  useEffect(() => {
    fetchProfiles(hsrTeamIds, "hsr", setHsrTeamProfiles);
    fetchProfiles(genshinTeamIds, "genshin", setGenshinTeamProfiles);
  }, []);

  return (
    <div className={`landing-wrapper ${leaving ? "fade-out" : ""}`}>
      <div
        className="bg-layer"
        style={{ backgroundImage: `url(${currentBg})` }}
      />
      {bgFading && (
        <div
          className="bg-layer fading-in"
          style={{ backgroundImage: `url(${fadeBg})` }}
        />
      )}
      <div className="overlay" />

      <div
        className="position-relative z-2 text-white d-flex flex-column px-4"
        style={{ minHeight: "100vh" }}
      >
        <Navbar />

        <Modal
          show={showDraftModal}
          onHide={() => setShowDraftModal(false)}
          centered
          contentClassName="custom-dark-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>Start Draft</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Team 1 Name</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter Team 1 name"
                  value={team1Name}
                  onChange={(e) => setTeam1Name(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Team 2 Name</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter Team 2 name"
                  value={team2Name}
                  onChange={(e) => setTeam2Name(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Mode</Form.Label>
                <div className="d-flex gap-3">
                  <Form.Check
                    inline
                    label="2v2"
                    name="mode"
                    type="radio"
                    checked={mode === "2v2"}
                    onChange={() => setMode("2v2")}
                  />
                  <Form.Check
                    inline
                    label="3v3"
                    name="mode"
                    type="radio"
                    checked={mode === "3v3"}
                    onChange={() => setMode("3v3")}
                  />
                </div>
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setShowDraftModal(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleStart}>
              Start
            </Button>
          </Modal.Footer>
        </Modal>

        {/* ───── Hero Section ───── */}
        <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center text-center">
          <div className="hero animate__animated animate__fadeInDown text-white">
            <h2 className="game-title mb-4">{game.name}</h2>

            {team.length > 0 && (
              <div
                className="team-button-wrapper position-relative"
                onMouseEnter={() => setShowTeam(true)}
                onMouseLeave={() => setShowTeam(false)}
              >
                <button className="btn btn-team">Our Team</button>
                <div className={`team-popup ${showTeam ? "show" : ""}`}>
                  {team.map((m, idx) => (
                    <div key={idx} className="member-row">
                      <img
                        src={
                          m.avatar
                            ? `https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.png?size=64`
                            : "/avatars/default.png"
                        }
                        alt={m.username}
                        className="member-avatar"
                      />
                      <div className="member-info">
                        <div className="member-name">
                          {m.global_name || m.username}
                        </div>
                        <div className="member-role">{m.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div
              className="animate__animated animate__fadeInUp mt-4 px-3"
              style={{ maxWidth: 700, margin: "0 auto" }}
            >
              <p className="lead text-white mb-4">
                {game.id === "zzz" ? (
                  <>
                    Vivian PvP is a custom Zenless Zone Zero PvP mode for 2v2
                    and 3v3 on Deadly Assault...
                  </>
                ) : game.id === "hsr" ? (
                  <>
                    Cipher PvP is a custom Honkai: Star Rail PvP mode featuring
                    strategic drafts and preban mechanics...
                  </>
                ) : (
                  <>
                    Cerydra PvP is a custom Honkai: Star Rail PvP mode with unit
                    and Eidolon costs...
                  </>
                )}
              </p>
            </div>

            <div className="mt-3">
              {game.id === "zzz" ? (
                <button
                  className="btn angled-btn"
                  onClick={() => setShowDraftModal(true)}
                >
                  Start Now
                </button>
              ) : game.live ? (
                <button
                  className="btn angled-btn"
                  onClick={() => gotoLivePage(game.link!)}
                >
                  Start Now
                </button>
              ) : (
                <button className="btn angled-btn disabled" disabled>
                  Coming Soon
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ───── Game Selector ───── */}
        <div className="game-nav d-flex justify-content-center gap-4 pb-5">
          {games.map((g, i) => (
            <img
              key={g.id}
              src={g.icon}
              height={72}
              onClick={() => changeGame(i)}
              className={`game-thumb ${i === selected ? "active" : ""}`}
              style={{ cursor: "pointer" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
