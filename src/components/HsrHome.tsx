import { useState, useEffect } from "react";
import "./Landing.css";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

export default function HsrHome() {
  const [leaving] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    // ✨ Hard-reset any leftover modal/body scroll locks (Bootstrap)
    const body = document.body;
    body.classList.remove("modal-open");
    body.style.overflow = "";
    body.style.paddingRight = "";
    document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove());

    // iOS smooth scrolling in overflow containers
    (document.scrollingElement as HTMLElement | null)?.style.setProperty(
      "-webkit-overflow-scrolling",
      "touch"
    );
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/api/announcement`)
      .then((res) => res.json())
      .then((data) => setAnnouncement(data.message))
      .catch(() => setAnnouncement(null));
  }, []);

  const cards = [
    {
      title: "Play Now",
      desc: "Draft and Play Matches",
      btnText: "Play now",
      url: "https://draft.cipher.uno/draft?mode=cipher",
    },
    {
      title: "Roster Setup",
      desc: "Build your own character roster",
      btnText: "View Roster",
      url: "https://draft.cipher.uno/player",
    },
    {
      title: "Balance Cost",
      desc: "View current character account costs",
      btnText: "View Balance Cost",
      url: "/cipher/balance-cost",
    },
    {
      title: "Player Statistics",
      desc: "View statistics for any player",
      btnText: "View player stats",
      url: "/cipher/players",
    },
    {
      title: "Season statistics",
      desc: "View overall statistics for each season",
      btnText: "View Insights",
      url: "/cipher/insights",
    },
    {
      title: "Character Statistics",
      desc: "All time Character statistics from all moc cycles",
      btnText: "View MOC Stats",
      url: "/cipher/characters",
    },
  ];

  return (
    <div
      className={`page-fade-in ${leaving ? "fade-out" : ""}`}
      style={{
        backgroundImage: "url('/background.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        // Use 100svh and make THIS the scroll container
        minHeight: "100svh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
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
          // Important: do not intercept touch/scroll
          pointerEvents: "none",
        }}
      />

      {/* content */}
      <div
        className="position-relative z-2 text-white d-flex flex-column px-4"
        // Avoid nested 100vh containers (can cause iOS lockups)
        style={{ minHeight: "auto" }}
      >
        <Navbar />

        <div className="text-center py-5 animate__animated animate__fadeInDown">
          <h1 className="display-4 fw-bold mb-3">Cipher PvP!</h1>
          {user && (
            <p className="lead text-white-50">
              Welcome, {user.global_name || user.username}!
            </p>
          )}
        </div>

        {announcement && (
          <div className="announcement-banner d-flex align-items-center justify-content-center gap-2">
            <span role="img" aria-label="alert" style={{ fontSize: "1.3rem" }}>
              📢
            </span>
            <span>{announcement}</span>
          </div>
        )}

        <div className="container mb-5">
          <div className="row g-4 animate__animated animate__fadeInUp animate__delay-1s">
            {cards.map(({ title, desc, url }, i) => (
              <div className="col-sm-6 col-lg-4" key={i}>
                {url ? (
                  url.startsWith("http") ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="feature-card text-decoration-none d-flex flex-column align-items-center justify-content-center text-white"
                    >
                      <div className="feature-title">{title}</div>
                      <div className="feature-desc text-center">{desc}</div>
                    </a>
                  ) : (
                    <Link
                      to={url}
                      className="feature-card text-decoration-none d-flex flex-column align-items-center justify-content-center text-white"
                    >
                      <div className="feature-title">{title}</div>
                      <div className="feature-desc text-center">{desc}</div>
                    </Link>
                  )
                ) : (
                  <div className="feature-card text-white text-center disabled-feature d-flex flex-column align-items-center justify-content-center">
                    <div className="feature-title">{title}</div>
                    <div className="feature-desc">{desc}</div>
                    <small className="text-muted">Coming Soon</small>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mb-4 animate__animated animate__fadeInUp animate__delay-2s">
          <p className="mb-3">Join our Discord to play!</p>
          <a
            href="https://discord.gg/MHzc5GRDQW"
            target="_blank"
            rel="noopener noreferrer"
            className="btn discord-glass-button"
          >
            <img
              src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f47e.svg"
              alt="Discord"
              width={20}
              height={20}
              style={{
                filter: "brightness(0) saturate(100%) invert(100%)",
                marginBottom: 4,
              }}
            />{" "}
            &nbsp; Join Discord
          </a>
        </div>
      </div>
    </div>
  );
}
