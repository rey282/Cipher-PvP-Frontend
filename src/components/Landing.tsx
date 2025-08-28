import { useState, useEffect, useRef } from "react";
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
  { id: "zzz", name: "Vivian PvP", bg: "/zzz-bg.webp", icon: "/zzz-icon.jpeg", live: true, link: "/zzz" },
  { id: "hsr", name: "Cipher PvP", bg: "/HsrBackground.webp", icon: "/cipher-icon.webp", live: true, link: "/cipher" },
  { id: "hsr2", name: "Cerydra PvP", bg: "/cerydra-bg.webp", icon: "/cerydra-icon.jpg", live: true, link: "/cerydra" },
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
const teamCache: { hsr: any[] | null; genshin: any[] | null; zzz: any[] | null } = {
  hsr: null, genshin: null, zzz: null,
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ───────────── Helpers ───────────── */
const ensureLen = (arr: (string | undefined)[], len: number) => {
  const next = [...arr];
  next.length = len;
  for (let i = 0; i < len; i++) {
    if (typeof next[i] !== "string") next[i] = "";
  }
  return next as string[];
};

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
  const modeRef = useRef<"2v2" | "3v3">("2v2"); // mirror to avoid stale mode on click
  const is3v3 = mode === "3v3";
  const nPlayers = is3v3 ? 3 : 2;

  // ORIGINAL: per-player inputs
  const [team1Names, setTeam1Names] = useState<string[]>(Array(nPlayers).fill(""));
  const [team2Names, setTeam2Names] = useState<string[]>(Array(nPlayers).fill(""));

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
    if (showDraftModal) setRandomizeLocked(false);
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

  // Match History modal state
  const [showMatchesModal, setShowMatchesModal] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [liveDrafts, setLiveDrafts] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);

  const fetchMatches = async () => {
    setLoadingMatches(true);
    try {
      const [liveRes, recentRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/matches/live?limit=8&minutes=2`, { credentials: "include" }),
        fetch(`${import.meta.env.VITE_API_BASE}/api/zzz/matches/recent?limit=20`, { credentials: "include" }),
      ]);
      const liveJson = liveRes.ok ? await liveRes.json() : { data: [] };
      const recentJson = recentRes.ok ? await recentRes.json() : { data: [] };
      setLiveDrafts(Array.isArray(liveJson.data) ? liveJson.data : []);
      setRecentMatches(Array.isArray(recentJson.data) ? recentJson.data : []);
    } catch {
      setLiveDrafts([]);
      setRecentMatches([]);
    } finally {
      setLoadingMatches(false);
    }
  };

  const openMatches = () => {
    setShowMatchesModal(true);
    fetchMatches();
  };

  // optional: quick helper
  const goSpectator = (key: string) => {
    setLeaving(true);
    setTimeout(() => navigate(`/zzz/s/${key}`), 250);
  };

  const fmtWhen = (ts?: string) => {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return "";
    }
  };

  useEffect(() => {
    if (!showMatchesModal) return;
    const id = setInterval(fetchMatches, 25000);
    return () => clearInterval(id);
  }, [showMatchesModal]);

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
        fetch(`${import.meta.env.VITE_API_BASE}/api/player/${member.id}/summary`, { credentials: "include" })
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

  /* Keep player arrays in sync when mode changes (pad/truncate safely) */
  useEffect(() => {
    const len = is3v3 ? 3 : 2;
    setTeam1Names((prev) => ensureLen(prev, len));
    setTeam2Names((prev) => ensureLen(prev, len));
  }, [is3v3]);

  /* Randomize using only what’s typed in the two team boxes */
  const handleRandomizeFromFields = () => {
    if (randomizeLocked) return; // already used once this open

    const m = modeRef.current;
    const len = m === "3v3" ? 3 : 2;

    // 💪 Guard undefined -> ""
    const pool = [...ensureLen(team1Names, len), ...ensureLen(team2Names, len)]
      .map((s) => (s ?? "").trim())
      .filter(Boolean);

    if (pool.length === 0) {
      toast.info("Enter some names first, then hit Randomize.");
      return;
    }

    const shuf = shuffle(pool);
    const next1 = Array(len)
      .fill("")
      .map((_, i) => shuf[i] ?? "");
    const next2 = Array(len)
      .fill("")
      .map((_, i) => shuf[i + len] ?? "");

    setTeam1Names(next1);
    setTeam2Names(next2);

    // 🔒 lock until modal is reopened
    setRandomizeLocked(true);
  };

  const handleStart = () => {
    const m = modeRef.current;
    const len = m === "3v3" ? 3 : 2;

    const safe1 = ensureLen(team1Names, len).map((s) => (s ?? "").trim());
    const safe2 = ensureLen(team2Names, len).map((s) => (s ?? "").trim());

    const anyName = [...safe1, ...safe2].some((n) => n !== "");
    if (!anyName) {
      toast.warn("Please enter at least one player name.");
      return;
    }

    const t1 = safe1.filter(Boolean).join("|");
    const t2 = safe2.filter(Boolean).join("|");

    // randomize sides
    const [team1, team2] = Math.random() < 0.5 ? [t1, t2] : [t2, t1];
    const payload = { team1, team2, mode: m };

    // 🔑 forget any old spectator session when starting a new draft
    sessionStorage.removeItem("zzzSpectatorKey");

    // unique id for this new draft
    const draftId =
      (crypto as any).randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem("zzzDraftId", draftId);
    sessionStorage.setItem("zzzDraftInit", JSON.stringify(payload));

    navigate("/zzz/draft", { state: { ...payload, draftId } });
  };

  // Pre-fill from URL: ?game=zzz&draft=1&mode=3v3&team1=a|b|c&team2=x|y|z
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("game") === "zzz" && params.get("draft") === "1") {
      setShowDraftModal(true);

      const m = (params.get("mode") as "2v2" | "3v3") || "2v2";
      setMode(m);
      modeRef.current = m;

      const len = m === "3v3" ? 3 : 2;
      const t1 = (params.get("team1") || "").split("|").filter(Boolean);
      const t2 = (params.get("team2") || "").split("|").filter(Boolean);

      setTeam1Names(ensureLen(t1, len));
      setTeam2Names(ensureLen(t2, len));
    }
  }, [location.search]);

  return (
    <div className={`landing-wrapper ${leaving ? "fade-out" : ""}`}>
      <div className="bg-layer" style={{ backgroundImage: `url(${currentBg})` }} />
      {bgFading && <div className="bg-layer fading-in" style={{ backgroundImage: `url(${fadeBg})` }} />}
      <div className="overlay" />

      <div className="position-relative z-2 text-white d-flex flex-column px-4" style={{ minHeight: "100vh" }}>
        <Navbar />

        {/* ───────────────── Start Draft Modal (ORIGINAL PER-PLAYER INPUTS) ───────────────── */}
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
              Enter player names in the team boxes below. You can either <strong>Start</strong> with teams exactly as
              written, or click <strong>Randomize Teams</strong> to shuffle names into teams. Sides are randomized on
              start too.
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
                  onChange={() => {
                    setMode("2v2");
                    modeRef.current = "2v2";
                  }}
                />
                <Form.Check
                  inline
                  label="3v3"
                  name="mode"
                  type="radio"
                  checked={mode === "3v3"}
                  onChange={() => {
                    setMode("3v3");
                    modeRef.current = "3v3";
                  }}
                />
              </div>
              <small className="text-white-50">
                Tip: for a 1v1, just fill one name and leave the rest empty.
              </small>
            </Form.Group>

            {/* Player inputs (unchanged layout) */}
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
                        value={team1Names[i] ?? ""} // guard undefined
                        maxLength={40}
                        onChange={(e) => {
                          const next = ensureLen(team1Names, nPlayers);
                          next[i] = e.target.value ?? "";
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
                        value={team2Names[i] ?? ""} // guard undefined
                        maxLength={40}
                        onChange={(e) => {
                          const next = ensureLen(team2Names, nPlayers);
                          next[i] = e.target.value ?? "";
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
              <Button variant="secondary" onClick={() => setShowDraftModal(false)}>
                Cancel
              </Button>
            </div>
            <div className="d-flex gap-2">
              <Button
                variant="outline-light"
                onClick={handleRandomizeFromFields}
                disabled={randomizeLocked}
                title={randomizeLocked ? "Locked: close and reopen this dialog to randomize again" : ""}
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
            <Button variant="secondary" onClick={() => setShowRulesModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        {/* ───────────────── Match History Modal ───────────────── */}
        <Modal
          show={showMatchesModal}
          onHide={() => setShowMatchesModal(false)}
          centered
          contentClassName="custom-dark-modal"
          size="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>Match History</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            {loadingMatches ? (
              <div className="text-center py-4 text-white-50">Loading…</div>
            ) : (
              <>
                {/* Live section */}
                {liveDrafts.length > 0 && (
                  <>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="fw-semibold">Live Now</div>
                      <span className="badge bg-danger">LIVE</span>
                    </div>
                    <div className="list-group mb-3">
                      {liveDrafts.map((m) => (
                        <button
                          key={`live-${m.key}`}
                          className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                          onClick={() => goSpectator(m.key)}
                          style={{ cursor: "pointer" }}
                        >
                          <div>
                            <div className="fw-semibold">
                              {m.team1} <span className="text-white-50">vs</span> {m.team2}
                            </div>
                            <div className="small text-white-50">
                              Mode: {m.mode?.toUpperCase?.() || m.mode} • Last activity: {fmtWhen(m.lastActivityAt)}
                            </div>
                          </div>
                          <span className="badge bg-danger">LIVE</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Completed section */}
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="fw-semibold">Completed</div>
                </div>
                {recentMatches.length === 0 ? (
                  <div className="text-white-50">No completed matches yet.</div>
                ) : (
                  <div className="list-group">
                    {recentMatches.map((m) => (
                      <button
                        key={`done-${m.key}`}
                        className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                        onClick={() => goSpectator(m.key)}
                        style={{ cursor: "pointer" }}
                      >
                        <div>
                          <div className="fw-semibold">
                            {m.team1} <span className="text-white-50">vs</span> {m.team2}
                          </div>
                          <div className="small text-white-50">
                            Mode: {m.mode?.toUpperCase?.() || m.mode} • Completed: {fmtWhen(m.completedAt)}
                          </div>
                        </div>
                        <span className="badge bg-success">Done</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowMatchesModal(false)}>
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
                        <div className="member-name">{m.global_name || m.username}</div>
                        <div className="member-role">{m.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="animate__animated animate__fadeInUp mt-4 px-3" style={{ maxWidth: 700, margin: "0 auto" }}>
              <p className="lead text-white mb-4">
                {gamesel.id === "zzz" ? (
                  <>Vivian PvP is a custom Zenless Zone Zero PvP mode for 2v2 and 3v3 on Deadly Assault...</>
                ) : gamesel.id === "hsr" ? (
                  <>Cipher PvP is a custom Honkai: Star Rail PvP mode featuring strategic drafts and preban mechanics...</>
                ) : (
                  <>Cerydra PvP is a custom Honkai: Star Rail PvP mode with unit and Eidolon costs...</>
                )}
              </p>
            </div>

            <div className="mt-3">
              {gamesel.id === "zzz" ? (
                <div className="d-flex justify-content-center align-items-center gap-2">
                  <button className="btn angled-btn" onClick={() => setShowDraftModal(true)}>
                    Start Now
                  </button>
                  <button
                    className="btn btn-info-circle"
                    title="Match History"
                    onClick={openMatches}
                    style={{ fontSize: "1.2rem", zIndex: 5 }}
                  >
                    📖
                  </button>
                  <button className="btn btn-info-circle" onClick={() => setShowRulesModal(true)} title="View Rules">
                    !
                  </button>
                </div>
              ) : gamesel.live ? (
                <button className="btn angled-btn" onClick={() => gotoLivePage(gamesel.link!)}>
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
