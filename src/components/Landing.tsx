import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Landing.css";
import Navbar from "../components/Navbar";

const games = [
  {
    id: "hsr",
    name: "Cipher PvP",
    bg: "/HsrBackground.webp",
    icon: "/cipher-icon.webp",
    live: true,
    link: "/hsr",
  },
  {
    id: "hsr2",
    name: "Cerydra PvP",
    bg: "/cerydra-bg.webp",
    icon: "/cerydra-icon.jpg",
    live: true,
    link: "/hsr2",
  },
];

const hsrTeam = [
  {
    name: "Markistador",
    role: "Server Owner / Balancer",
    avatar: "/avatars/mark.png",
  },
  { name: "YanYan", role: "Developer", avatar: "/avatars/yanyan.png" },
  { name: "Haya", role: "Developer", avatar: "/avatars/haya.png" },
  { name: "bonk", role: "Balancer", avatar: "/avatars/bonk.png" },
  { name: "Scaphism", role: "Balancer", avatar: "/avatars/scappy.png" },
  { name: "Toscap", role: "Moderator", avatar: "/avatars/toscap.png" },
  { name: "frog detective", role: "Moderator", avatar: "/avatars/frog.png" },
];

const genshinTeam = [
  {
    name: "Markistador",
    role: "Server Owner / Balancer",
    avatar: "/avatars/mark.png",
  },
  { name: "YanYan", role: "Developer", avatar: "/avatars/yanyan.png" },
  { name: "Haya", role: "Developer", avatar: "/avatars/haya.png" },
  { name: "risa", role: "Balancer", avatar: "/avatars/risa.png" },
  { name: "Arkeyy", role: "Balancer", avatar: "/avatars/arkeyy.png" },
];


export default function Landing() {
  const [selected, setSelected] = useState(0);
  const [currentBg, setCurrentBg] = useState(games[0].bg);
  const [fadeBg, setFadeBg] = useState("");
  const [bgFading, setBgFading] = useState(false);

  const [leaving, setLeaving] = useState(false);
  const [showTeam, setShowTeam] = useState(false);

  const navigate = useNavigate();

  /* ───────── background cross-fade ───────── */
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

  const game = games[selected];
  const team = game.id === "hsr" ? hsrTeam : genshinTeam;

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
        {/* ───────── top nav ───────── */}
        <Navbar />

        {/* ───────── hero section ───────── */}
        <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center text-center">
          <div className="hero animate__animated animate__fadeInDown text-white">
            <h2 className="game-title mb-4">{game.name}</h2>

            {/* Our Team hover button */}
            {team.length > 0 && (
              <div
                className="team-button-wrapper position-relative"
                onMouseEnter={() => setShowTeam(true)}
                onMouseLeave={() => setShowTeam(false)}
              >
                <button className="btn btn-team">Our Team</button>

                {/* pop-up */}
                <div className={`team-popup ${showTeam ? "show" : ""}`}>
                  {team.map((m, idx) => (
                    <div key={idx} className="member-row">
                      <img
                        src={m.avatar}
                        alt={m.name}
                        className="member-avatar"
                      />
                      {/* changed span/small => div so they stack */}
                      <div className="member-info">
                        <div className="member-name">{m.name}</div>
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
                {game.id === "hsr" ? (
                  <>
                    Cipher PvP is a custom Honkai: Star Rail PvP mode featuring
                    strategic drafts and preban mechanics. Players are given
                    bans based on their account's cost, ensuring fairness and
                    balance.
                  </>
                ) : (
                  <>
                    Another one to come.
                  </>
                )}
              </p>
            </div>

            <div className="mt-3">
              <button
                className="btn angled-btn"
                onClick={() => gotoLivePage(game.link!)}
              >
                Start Now
              </button>
            </div>
          </div>
        </div>

        {/* ───────── game selector ───────── */}
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
