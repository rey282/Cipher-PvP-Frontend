import { useState, useEffect } from "react";
import "../components/Landing.css";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

export default function HsrHome() {
  /* ───────── page fade logic ───────── */
  const [leaving] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const { user } = useAuth();


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
      url: "https://draft.cipher.uno/draft?mode=cerydra",
    },
    {
      title: "Balance Cost",
      desc: "View current character account costs",
      btnText: "View Balance Cost",
      url: "/cerydra/balance-cost",
    },
    {
      title: "Cost Test",
      desc: "Test your team's cost",
      btnText: "Cost Test",
      url: "/cerydra/cost-test",
    },
    {
      title: "Player Statistics",
      desc: "View statistics for any player",
      btnText: "View player stats",
    },
    {
      title: "Season statistics",
      desc: "View overall statistics for each season",
      btnText: "View Insights",
    },
    {
      title: "Character Statistics",
      desc: "All time Character statistics from all moc cycles",
      btnText: "View MOC Stats",
    },
  ];
  
  /* ───────── markup ───────── */
  return (
    <div
      className={`page-fade-in ${leaving ? "fade-out" : ""}`}
      style={{
        backgroundImage: "url('/background2.webp')",
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
          <h1 className="display-4 fw-bold mb-3">Cerydra PvP!</h1>
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
