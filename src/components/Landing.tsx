import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

const games = [
  {
    id: 'hsr',
    name: 'Cipher PvP',
    bg: '/HsrBackground.webp',
    icon: '/hsr-icon.png',
    live: true,
    link: '/hsr',
  },
  {
    id: 'genshin',
    name: 'Coming Soon',
    bg: '/GiBackground.webp',
    icon: '/genshin-icon.png',
    live: false,
  },
];

const team = [
  { name: 'Markistador', role: 'Server Owner / Balancer', avatar: '/avatars/mark.png' },
  { name: 'YanYan',      role: 'Developer',               avatar: '/avatars/yanyan.png' },
  { name: 'Haya',        role: 'Developer',               avatar: '/avatars/haya.png' },
  { name: 'bonk',        role: 'Balancer',                avatar: '/avatars/bonk.png' },
  { name: 'Scaphism',    role: 'Balancer',                avatar: '/avatars/scappy.png' },
  { name: 'Toscap',      role: 'Moderator',                avatar: '/avatars/toscap.png' },
  { name: 'frog detective',role: 'Moderator',                avatar: '/avatars/frog.png' },
];

export default function Landing() {
  const [selected, setSelected] = useState(0);
  const [currentBg, setCurrentBg] = useState(games[0].bg);
  const [fadeBg, setFadeBg] = useState('');
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

  return (
    <div className={`landing-wrapper ${leaving ? 'fade-out' : ''}`}>
      <div className="bg-layer" style={{ backgroundImage: `url(${currentBg})` }} />
      {bgFading && <div className="bg-layer fading-in" style={{ backgroundImage: `url(${fadeBg})` }} />}
      <div className="overlay" />

      <div className="content d-flex flex-column min-vh-100">
        {/* ───────── top nav ───────── */}
        <nav className="w-100 px-4 py-3 d-flex justify-content-end">
          <span className="logo-title">
            <img src="/logo192.png" alt="" height={36} /> Haya
          </span>
        </nav>

        {/* ───────── hero section ───────── */}
        <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center text-center">
          <div className="hero animate__animated animate__fadeInDown text-white">
            <h2 className="game-title mb-4">{game.name}</h2>

            {/* Our Team hover button */}
            {game.id === 'hsr' && (
              <div
                className="team-button-wrapper position-relative"
                onMouseEnter={() => setShowTeam(true)}
                onMouseLeave={() => setShowTeam(false)}
              >
                <button className="btn btn-team">Our Team</button>

                {/* pop-up */}
                <div className={`team-popup ${showTeam ? 'show' : ''}`}>
                  {team.map((m, idx) => (
                    <div key={idx} className="member-row">
                      <img src={m.avatar} alt={m.name} className="member-avatar" />
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
            {game.id === 'hsr' && (
              <div
                className="animate__animated animate__fadeInUp mt-4 px-3"
                style={{ maxWidth: 700, margin: '0 auto' }}
              >
                <p className="lead text-white mb-4">
                  Cipher PvP is a custom Honkai: Star Rail PvP mode featuring strategic drafts and preban
                  mechanics. Players are given bans based on their account's cost, ensuring fairness and balance.
                </p>
              </div>
            )}

            <div className="mt-3">
              {game.live ? (
                <button className="btn angled-btn" onClick={() => gotoLivePage(game.link!)}>
                  Learn More
                </button>
              ) : (
                <button className="btn btn-secondary px-4 py-2" disabled>
                  Coming soon…
                </button>
              )}
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
              className={`game-thumb ${i === selected ? 'active' : ''}`}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
