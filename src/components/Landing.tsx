import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Landing.css";
import Navbar from "../components/Navbar";
import { Modal, Button, Form } from "react-bootstrap";
import { toast } from "react-toastify";

/* ───────────────── Rules ───────────────── */
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

/* ───────────────── Game data ───────────────── */
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Landing() {
  const [selected, setSelected] = useState(1);
  const [currentBg, setCurrentBg] = useState(games[1].bg);
  const [fadeBg, setFadeBg] = useState("");
  const [bgFading, setBgFading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showTeam, setShowTeam] = useState(false);

  // Start Draft modal
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [mode, setMode] = useState<"2v2" | "3v3">("2v2");
  const is3v3 = mode === "3v3";
  const nPlayers = is3v3 ? 3 : 2;

  // Player names (entered here, encoded in URL as "name1|name2" etc.)
  const [team1Names, setTeam1Names] = useState<string[]>(
    Array(nPlayers).fill("")
  );
  const [team2Names, setTeam2Names] = useState<string[]>(
    Array(nPlayers).fill("")
  );

  // Rules modal
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Team popup data
  const [hsrTeamProfiles, setHsrTeamProfiles] = useState<any[]>([]);
  const [genshinTeamProfiles, setGenshinTeamProfiles] = useState<any[]>([]);
  const [zzzTeamProfiles, setZzzTeamProfiles] = useState<any[]>([]);

  const navigate = useNavigate();
  const location = useLocation();

  const [randomizeLocked, setRandomizeLocked] = useState(false);

  const gamesel = games[selected];
  const team =
    gamesel.id === "hsr"
      ? hsrTeamProfiles
      : gamesel.id === "hsr2"
      ? genshinTeamProfiles
      : gamesel.id === "zzz"
      ? zzzTeamProfiles
      : [];

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

  useEffect(() => {
    if (showDraftModal) {
      setRandomizeLocked(false);
    }
  }, [showDraftModal]);


  // Background crossfade
  useEffect(() => {
    if (!bgFading) return;
    const t = setTimeout(() => {
      setCurrentBg(fadeBg);
      setBgFading(false);
    }, 600);
    return () => clearTimeout(t);
  }, [bgFading, fadeBg]);

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

  // Cached fetch of team avatars
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

  // keep player arrays in sync when mode changes
  useEffect(() => {
    const len = is3v3 ? 3 : 2;
    setTeam1Names((prev) => {
      const arr = [...prev];
      arr.length = len;
      return arr.map((x) => x ?? "");
    });
    setTeam2Names((prev) => {
      const arr = [...prev];
      arr.length = len;
      return arr.map((x) => x ?? "");
    });
  }, [is3v3]);

  // Randomize using only what’s typed in the two team boxes
  const handleRandomizeFromFields = () => {
    if (randomizeLocked) return; // already used once this open

    const pool = [...team1Names, ...team2Names]
      .map((s) => s.trim())
      .filter(Boolean);

    if (pool.length === 0) {
      toast.info("Enter some names first, then hit Randomize.");
      return;
    }

    const shuf = shuffle(pool);
    const next1 = Array(nPlayers)
      .fill("")
      .map((_, i) => shuf[i] ?? "");
    const next2 = Array(nPlayers)
      .fill("")
      .map((_, i) => shuf[i + nPlayers] ?? "");

    setTeam1Names(next1);
    setTeam2Names(next2);

    // 🔒 lock until modal is reopened
    setRandomizeLocked(true);
  };


  const handleStart = () => {
    const anyName = [...team1Names, ...team2Names].some((n) => n.trim() !== "");
    if (!anyName) {
      toast.warn("Please enter at least one player name.");
      return;
    }

    const t1 = team1Names
      .map((s) => s.trim())
      .filter(Boolean)
      .join("|");
    const t2 = team2Names
      .map((s) => s.trim())
      .filter(Boolean)
      .join("|");

    // randomize sides
    const [team1, team2] = Math.random() < 0.5 ? [t1, t2] : [t2, t1];
    const payload = { team1, team2, mode };

    // 🔑 forget any old spectator session when starting a new draft
    sessionStorage.removeItem("zzzSpectatorKey");

    // (optional but nice) give this draft a unique id to detect true “newness”
    const draftId =
      (crypto as any).randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem("zzzDraftId", draftId);

    // keep a refresh-safe copy without exposing URL params
    sessionStorage.setItem("zzzDraftInit", JSON.stringify(payload));

    // navigate with state so the URL stays /zzz/draft
    navigate("/zzz/draft", { state: { ...payload, draftId } });
  };


  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("game") === "zzz" && params.get("draft") === "1") {
      setShowDraftModal(true);
      const m = (params.get("mode") as "2v2" | "3v3") || "2v2";
      setMode(m);
      const len = m === "3v3" ? 3 : 2;
      const t1 = (params.get("team1") || "").split("|").filter(Boolean);
      const t2 = (params.get("team2") || "").split("|").filter(Boolean);
      if (t1.length) setTeam1Names([...Array(len)].map((_, i) => t1[i] ?? ""));
      if (t2.length) setTeam2Names([...Array(len)].map((_, i) => t2[i] ?? ""));
    }
  }, [location.search]);

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

        {/* ───────────────── Start Draft Modal (UPDATED) ───────────────── */}
        <Modal
          show={showDraftModal}
          onHide={() => setShowDraftModal(false)}
          centered
          contentClassName="custom-dark-modal"
          size="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>Start Draft</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            <div className="text-white-50 mb-3" style={{ fontSize: ".95rem" }}>
              Enter player names in the team boxes below. You can either{" "}
              <strong>Start</strong> with teams exactly as written, or click{" "}
              <strong>Randomize Teams</strong> to shuffle all entered names into
              randomized teams for you and when you hit <strong>Start</strong>,
              the sides will be <strong>randomly assigned</strong> to Blue/Red
            </div>

            {/* Mode */}
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
              <small className="text-white-50">
                Tip: for a 1v1, just fill one name and leave the rest empty.
              </small>
            </Form.Group>

            {/* Player inputs */}
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <div
                  className="p-2 rounded-3"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div className="fw-semibold mb-2">Team 1 Players</div>
                  {Array(nPlayers)
                    .fill(0)
                    .map((_, i) => (
                      <input
                        key={i}
                        type="text"
                        className="form-control mb-2"
                        placeholder={`Player ${i + 1} name`}
                        value={team1Names[i] || ""}
                        maxLength={40}
                        onChange={(e) => {
                          const next = [...team1Names];
                          next[i] = e.target.value;
                          setTeam1Names(next);
                        }}
                        style={{
                          background: "rgba(0,0,0,0.35)",
                          color: "white",
                          border: "1px solid rgba(255,255,255,0.15)",
                        }}
                      />
                    ))}
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div
                  className="p-2 rounded-3"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div className="fw-semibold mb-2">Team 2 Players</div>
                  {Array(nPlayers)
                    .fill(0)
                    .map((_, i) => (
                      <input
                        key={i}
                        type="text"
                        className="form-control mb-2"
                        placeholder={`Player ${i + 1} name`}
                        value={team2Names[i] || ""}
                        maxLength={40}
                        onChange={(e) => {
                          const next = [...team2Names];
                          next[i] = e.target.value;
                          setTeam2Names(next);
                        }}
                        style={{
                          background: "rgba(0,0,0,0.35)",
                          color: "white",
                          border: "1px solid rgba(255,255,255,0.15)",
                        }}
                      />
                    ))}
                </div>
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer className="d-flex justify-content-between">
            <div className="d-flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowDraftModal(false)}
              >
                Cancel
              </Button>
            </div>
            <div className="d-flex gap-2">
              <Button
                variant="outline-light"
                onClick={handleRandomizeFromFields}
                disabled={randomizeLocked}
                title={
                  randomizeLocked
                    ? "Locked: close and reopen this dialog to randomize again"
                    : ""
                }
              >
                🎲 {randomizeLocked ? "Randomize (Locked)" : "Randomize Teams"}
              </Button>

              <Button variant="primary" onClick={handleStart}>
                Start
              </Button>
            </div>
          </Modal.Footer>
        </Modal>

        {/* ───────────────── Rules Modal ───────────────── */}
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
            <h2 className="game-title mb-4">{gamesel.name}</h2>

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
                {gamesel.id === "zzz" ? (
                  <>
                    Vivian PvP is a custom Zenless Zone Zero PvP mode for 2v2
                    and 3v3 on Deadly Assault...
                  </>
                ) : gamesel.id === "hsr" ? (
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
              {gamesel.id === "zzz" ? (
                <div className="d-flex justify-content-center align-items-center gap-2">
                  <button
                    className="btn angled-btn"
                    onClick={() => setShowDraftModal(true)}
                  >
                    Start Now
                  </button>
                  <button
                    className="btn btn-info-circle"
                    onClick={() => setShowRulesModal(true)}
                    title="View Rules"
                  >
                    !
                  </button>
                </div>
              ) : gamesel.live ? (
                <button
                  className="btn angled-btn"
                  onClick={() => gotoLivePage(gamesel.link!)}
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
