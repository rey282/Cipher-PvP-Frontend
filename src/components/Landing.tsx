import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Landing.css";
import Navbar from "../components/Navbar";
import { Modal, Button, Form } from "react-bootstrap";
import { toast } from "react-toastify";

const ZzzRules: React.FC = () => (
  <div className="rules-card">
    <strong>Rules:</strong>
    <p>
      For ZZZ PvP you can fight in either of 2 modes, 2v2 or 3v3 in Deadly
      Assault boss stages where you compete for the highest total score.
    </p>
    <strong>Match Procedure:</strong>
    <ul>
      <li>
        2v2: Make teams, draft, then select 2 out of the 3 bosses your team will
        fight.
      </li>
      <li>3v3: Draft, then fight all 3 bosses.</li>
      <li>The bosses picked in 2v2 must be unique for a team.</li>
    </ul>
    <strong>Draft:</strong>
    <p>Three pick types: Bans, Ace(s), Normal Pick.</p>
    <p>
      During draft, select agents and wengines up to 6/9 cost for 2v2/3v3
      respectively. Over cost limit results in score penalty.
    </p>
    <p>Drafting phase will proceed as the number shown in the box.</p>
    <strong>Picks:</strong>
    <ul>
      <li>
        <strong>Normal pick (blank boxes):</strong> pick unpicked/unbanned
        agents.
      </li>
      <li>
        <strong>Ban (red boxes):</strong> elect an agent to ban (cannot ban
        first 4 picks).
      </li>
      <li>
        <strong>Ace pick (orange/yellow boxes):</strong> select any unbanned
        agent, including opponent's picks; only one copy per team allowed.
      </li>
    </ul>
    <strong>Cost:</strong>
    <ul>
      <li>
        Limited S Rank agent: starts at 1 cost, increases by 0.5 per unique
        mindscape (except M3 &amp; M5).
      </li>
      <li>Standard S Rank agent: starts at 1, 1.5 cost at M6.</li>
      <li>All A Rank agents: 0.5 cost all mindscapes.</li>
      <li>
        Limited S Rank wengines: 0.25 starting cost, 0.5 at W3+ refinements.
      </li>
      <li>
        Standard S Rank wengines: 0 starting cost, 0.25 at W3+ refinements.
      </li>
      <li>A &amp; B Rank wengines: 0 cost at all refinements.</li>
      <li>Bangboos do not cost points.</li>
    </ul>
    <strong>Penalty and Resets:</strong>
    <ul>
      <li>
        Every 0.25 points above limit (6 for 2v2, 9 for 3v3) reduces team score
        by 2500.
      </li>
      <li>Each team has 2 resets per match.</li>
      <li>Resets must be used before ending stream.</li>
      <li>Battle starts when boss appears; resets after consume one reset.</li>
      <li>Previous runs voided; only latest run counts.</li>
    </ul>
    <strong>Play:</strong>
    <p>
      After draft, players select bosses and test teams. Runs must be live
      streamed for fairness. If you are unable to stream the run, ask your
      opponents&apos; consent for screenshot submission.
    </p>
    <strong>Discord Server:</strong>{" "}
    <a
      href="https://discord.gg/MHzc5GRDQW"
      target="_blank"
      rel="noreferrer"
      className="rules-link"
    >
      Join Discord Server
    </a>
  </div>
);

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

const zzzTeamIds: { id: string; role: string }[] = [
  { id: "663145925807702029", role: "Server Owner" },
  { id: "371513247641370625", role: "Developer" },
  { id: "313955497604677633", role: "Staff" },
  { id: "478408402700206081", role: "Staff" },
];

// ─── In-memory cache ───
const teamCache: {
  hsr: any[] | null;
  genshin: any[] | null;
  zzz: any[] | null;
} = {
  hsr: null,
  genshin: null,
  zzz: null,
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
  const [zzzTeamProfiles, setZzzTeamProfiles] = useState<any[]>([]);
  const [showRulesModal, setShowRulesModal] = useState(false);

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
      : game.id === "zzz"
      ? zzzTeamProfiles
      : [];

  // Cached fetch
  const fetchProfiles = async (
    teamList: { id: string; role: string }[],
    cacheKey: "hsr" | "genshin" | "zzz",
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
    fetchProfiles(zzzTeamIds, "zzz", setZzzTeamProfiles);
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
        <Modal
          show={showRulesModal}
          onHide={() => setShowRulesModal(false)}
          centered
          contentClassName="custom-dark-modal"
          size="xl"
        >
          <Modal.Header closeButton>
            <Modal.Title>Vivian PvP Rules</Modal.Title>
          </Modal.Header>

          <Modal.Body className="rules-modal-body">
            <ZzzRules />
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setShowRulesModal(false)}
            >
              Close
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
                <div className="d-flex justify-content-center align-items-center gap-2">
                  <button
                    className="btn angled-btn"
                    onClick={() => setShowDraftModal(true)}
                  >
                    Start Now
                  </button>

                  {/* Info button */}
                  <button
                    className="btn btn-info-circle"
                    onClick={() => setShowRulesModal(true)}
                    title="View Rules"
                  >
                    !
                  </button>
                </div>
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
