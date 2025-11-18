import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Landing.css";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar";

import VivianSections, { type VivianSectionHandle } from "./VivianSections";
import CerydraSections, { type CerydraSectionHandle } from "./CerydraSections";

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
    icon: "/cerydra-icon.webp",
    live: true,
    link: "/cerydra",
  },
];

/** Cipher actions */
const CIPHER_PLAY_URL = "https://draft.cipher.uno/draft?mode=cipher";
const cipherMenu = [
  { label: "Roster Setup", url: "https://draft.cipher.uno/player" },
  { label: "Balance Cost", url: "/cipher/balance-cost" },
  { label: "Draft Cost", url: "https://draft.cipher.uno/draft-cost" },
  { label: "Player Statistics", url: "/cipher/players" },
  { label: "Season Insights", url: "/cipher/insights" },
  { label: "Character Statistics", url: "/cipher/characters" },
];

/** Vivian actions */
const vivianMenu = [
  { label: "Rules", type: "rules" as const },
  { label: "Match History", type: "matches" as const },
];

/** Cerydra actions */
const cerydraMenu = [
  { label: "Rules", type: "rules" as const },
  { label: "Match History", type: "matches" as const },
  { label: "Cerydra Cost Table", url: "/cerydra/balance-cost" },
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
} = { hsr: null, genshin: null, zzz: null };

export default function Landing() {
  const [selected, setSelected] = useState(1);
  const [currentBg, setCurrentBg] = useState(games[1].bg);
  const [fadeBg, setFadeBg] = useState("");
  const [bgFading, setBgFading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showTeam, setShowTeam] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const blocked = (location.state as any)?.blocked as
      | "hsr-draft-mobile"
      | "hsr-spectator-mobile"
      | "hsr-draft-no-team"
      | undefined;

    if (!blocked) return;

    switch (blocked) {
      case "hsr-draft-mobile":
        toast.warning("Draft is desktop-only. Please use a laptop/desktop.");
        break;
      case "hsr-spectator-mobile":
        toast.warning("Spectator is desktop-only. Please switch to desktop.");
        break;
      case "hsr-draft-no-team":
        toast.info("Please fill in team names before starting a draft.");
        break;
      default:
        toast.info("That page isn’t available right now.");
        break;
    }

    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const vivianRef = useRef<VivianSectionHandle | null>(null);
  const cerydraRef = useRef<CerydraSectionHandle>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer:coarse), (max-width: 820px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.("change", update) ?? mq.addListener(update);
    return () =>
      mq.removeEventListener?.("change", update) ?? mq.removeListener(update);
  }, []);

  // Team popup data
  const [hsrTeamProfiles, setHsrTeamProfiles] = useState<any[]>([]);
  const [genshinTeamProfiles, setGenshinTeamProfiles] = useState<any[]>([]);
  const [zzzTeamProfiles, setZzzTeamProfiles] = useState<any[]>([]);

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
          { credentials: "include" }
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

  const gamesel = games[selected];
  const team =
    gamesel.id === "hsr"
      ? hsrTeamProfiles
      : gamesel.id === "hsr2"
      ? genshinTeamProfiles
      : gamesel.id === "zzz"
      ? zzzTeamProfiles
      : [];

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

        {/* ZZZ (Vivian) section */}
        <VivianSections
          ref={vivianRef}
          active={gamesel.id === "zzz"}
          isMobile={isMobile}
        />

        {/* Cerydra section */}
        <CerydraSections
          ref={cerydraRef}
          active={gamesel.id === "hsr2"}
          isMobile={isMobile}
        />

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
                /* ─────────── VIVIAN (ZZZ) — Start + More dropdown ─────────── */
                <div className="d-flex flex-column justify-content-center align-items-center gap-2">
                  <div className="d-flex justify-content-center align-items-center gap-2">
                    {/* Start -> open draft modal (fallback to /zzz) */}
                    <button
                      className="btn angled-btn"
                      onClick={() => {
                        if (vivianRef.current?.openDraftModal)
                          vivianRef.current.openDraftModal();
                        else navigate("/zzz");
                      }}
                      title="Start draft"
                    >
                      Start Now
                    </button>

                    {/* More dropdown */}
                    <div className="btn-group">
                      <button
                        type="button"
                        className="btn angled-btn dropdown-toggle"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                        title="More Vivian actions"
                      >
                        More
                      </button>
                      <ul className="dropdown-menu dropdown-menu-dark">
                        {vivianMenu.map((item) => (
                          <li key={item.label}>
                            {item.type === "rules" ? (
                              <button
                                className="dropdown-item"
                                onClick={() => {
                                  if (vivianRef.current?.openRulesModal)
                                    vivianRef.current.openRulesModal();
                                  else navigate("/zzz");
                                }}
                              >
                                Rules
                              </button>
                            ) : (
                              <button
                                className="dropdown-item"
                                onClick={() => {
                                  if (vivianRef.current?.openMatchesModal)
                                    vivianRef.current.openMatchesModal();
                                  else navigate("/zzz");
                                }}
                              >
                                Match History
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : gamesel.id === "hsr2" ? (
                /* ─────────── CERYDRA — Start + More dropdown ─────────── */
                <div className="d-flex flex-column justify-content-center align-items-center gap-2">
                  <div className="d-flex justify-content-center align-items-center gap-2">
                    {/* Start -> open draft modal (fallback to /cerydra) */}
                    <button
                      className="btn angled-btn"
                      onClick={() => {
                        if (cerydraRef.current?.openDraftModal)
                          cerydraRef.current.openDraftModal();
                        else navigate("/cerydra");
                      }}
                      title="Start draft"
                    >
                      Start Now
                    </button>

                    {/* More dropdown */}
                    <div className="btn-group">
                      <button
                        type="button"
                        className="btn angled-btn dropdown-toggle"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                        title="More Cerydra actions"
                      >
                        More
                      </button>
                      <ul className="dropdown-menu dropdown-menu-dark">
                        {cerydraMenu.map((item) => (
                          <li key={item.label}>
                            {"url" in item ? (
                              <button
                                className="dropdown-item"
                                onClick={() => navigate(item.url!)}
                              >
                                {item.label}
                              </button>
                            ) : item.type === "rules" ? (
                              <button
                                className="dropdown-item"
                                onClick={() => {
                                  if (cerydraRef.current?.openRulesModal)
                                    cerydraRef.current.openRulesModal();
                                  else navigate("/cerydra");
                                }}
                              >
                                Rules
                              </button>
                            ) : (
                              <button
                                className="dropdown-item"
                                onClick={() => {
                                  if (cerydraRef.current?.openMatchesModal)
                                    cerydraRef.current.openMatchesModal();
                                  else navigate("/cerydra");
                                }}
                              >
                                Match History
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : gamesel.id === "hsr" ? (
                /* ─────────── CIPHER (HSR) — Start -> Play link + More dropdown ─────────── */
                <div className="d-flex flex-column justify-content-center align-items-center gap-2">
                  <div className="d-flex justify-content-center align-items-center gap-2">
                    <button
                      className="btn angled-btn"
                      onClick={() =>
                        window.open(
                          CIPHER_PLAY_URL,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                      title="Start draft"
                    >
                      Start Now
                    </button>

                    <div className="btn-group">
                      <button
                        type="button"
                        className="btn angled-btn dropdown-toggle"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                        title="More Cipher actions"
                      >
                        More
                      </button>
                      <ul className="dropdown-menu dropdown-menu-dark">
                        {cipherMenu.map((item) => (
                          <li key={item.label}>
                            {item.url.startsWith("http") ? (
                              <a
                                className="dropdown-item"
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {item.label}
                              </a>
                            ) : (
                              <button
                                className="dropdown-item"
                                onClick={() => navigate(item.url)}
                              >
                                {item.label}
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
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
