import { useState, useEffect } from "react";
import "./Landing.css";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

export default function HsrHome() {
  /* ───────── page fade logic ───────── */
  const [leaving] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const { user } = useAuth();

  /* ───────── Ko-fi floating widget ───────── */
  useEffect(() => {
    const script = document.createElement("script");
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
    fetch(`${import.meta.env.VITE_API_BASE}/api/announcement`)
      .then((res) => res.json())
      .then((data) => setAnnouncement(data.message))
      .catch(() => setAnnouncement(null));
  }, []);

  /* ───────── data for cards ───────── */
  const cards = [
    {
      title: "Play Now",
      desc: "Draft and Play Matches",
      btnText: "Play now",
      url: "https://draft.cipher.uno/draft",
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
      url: "/balance-cost",
    },
    {
      title: "Player Statistics",
      desc: "View statistics for any player",
      btnText: "View player stats",
      url: "/players",
    },
    {
      title: "Season statistics",
      desc: "View overall statistics for each season",
      btnText: "View Insights",
      url: "/hsr-insights",
    },
    {
      title: "Character Statistics",
      desc: "All time Character statistics from all moc cycles",
      btnText: "View MOC Stats",
      url: "/characters",
    },
  ];
  /* ───────── markup ───────── */
  return (
    <div
      className={`page-fade-in ${leaving ? "fade-out" : ""}`}
      style={{
        backgroundImage: "url('/background.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
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

      {/* content */}
      <div
        className="position-relative z-2 text-white d-flex flex-column px-4"
        style={{ minHeight: "100vh" }}
      >
        {/* navbar */}
        <Navbar />

        {/* hero */}
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

        {/* grid */}
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
                      onClick={() => window.scrollTo(0, 0)}
                    >
                      <div className="feature-title">{title}</div>
                      <div className="feature-desc text-center">{desc}</div>
                    </a>
                  ) : (
                    <Link
                      to={url}
                      className="feature-card text-decoration-none d-flex flex-column align-items-center justify-content-center text-white"
                      onClick={() => window.scrollTo(0, 0)}
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

        {/* footer with Discord button */}
        <div className="text-center mb-4 animate__animated animate__fadeInUp animate__delay-2s">
          <p className="mb-3">Join our Discord to play!</p>
          <a
            href="https://discord.gg/MHzc5GRDQW"
            target="_blank"
            rel="noopener noreferrer"
            className="btn discord-glass-button"
          >
            {
              <img
                src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f47e.svg"
                alt="Discord"
                width={20}
                height={20}
                style={{
                  filter: "brightness(0) saturate(100%) invert(100%)",
                  marginBottom: 4,
                }}
              />
            }{" "}
            &nbsp; Join Discord
          </a>
        </div>
      </div>
    </div>
  );
}
