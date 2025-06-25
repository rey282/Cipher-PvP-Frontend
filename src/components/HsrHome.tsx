import { useState, useEffect } from "react";
import "./Landing.css";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function HsrHome() {
  /* ───────── page fade logic ───────── */
  const [leaving] = useState(false);

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

  /* ───────── data for cards ───────── */
  const cards = [
    {
      title: "MOC Statistics",
      desc: "Track character win rates each MOC cycle",
      btnText: "View MOC Stats",
      url: "/characters",
    },
    {
      title: "Matches",
      desc: "Play and track your match history",
      btnText: "Play now",
      url: "https://draft.cipher.uno/draft",
    },
    {
      title: "Player Statistics",
      desc: "View your own win rate, ELO, and history",
      btnText: "View player stats",
      url: "/players",
    },
    {
      title: "Roster Setup",
      desc: "Build your own character roster",
      btnText: "View Roster",
      url: "https://draft.cipher.uno/player",
    },
    {
      title: "Balance Cost",
      desc: "View current character costs",
      btnText: "View Balance Cost",
      url: "/balance-cost",
    },
    {
      title: "Tournament Archive",
      desc: "Past tournaments and results",
      btnText: "Coming soon...",
      url: null, // disabled
    },
  ]
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
          <h1 className="display-2 fw-bold mb-4">Welcome to Cipher PvP!</h1>
        </div>

        {/* grid */}
        <div className="container mb-5">
          <div className="row g-4 animate__animated animate__fadeInUp animate__delay-1s">
            {cards.map(({ title, desc, btnText, url }, i) => (
              <div className="col-sm-6 col-lg-4" key={i}>
                <div className="card bg-dark bg-opacity-75 text-white h-100 shadow">
                  <div className="card-body d-flex flex-column justify-content-between">
                    <div>
                      <h5 className="card-title">{title}</h5>
                      <p className="card-text">{desc}</p>
                    </div>

                    {url ? (
                      url.startsWith("http") ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline-light btn-sm mt-3"
                          onClick={() => window.scrollTo(0, 0)}
                        >
                          {btnText}
                        </a>
                      ) : (
                        <Link
                          to={url}
                          className="btn btn-outline-light btn-sm mt-3"
                          onClick={() => window.scrollTo(0, 0)}
                        >
                          {btnText}
                        </Link>
                      )
                    ) : (
                      <button
                        className="btn btn-outline-light btn-sm mt-3"
                        disabled
                      >
                        {btnText}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* footer with Discord button */}
        <div className="text-center mb-4 animate__animated animate__fadeInUp animate__delay-2s">
          <p className="mb-3">
            Join our Discord for updates, feedback, and support!
          </p>
          <a
            href="https://discord.gg/MHzc5GRDQW"
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{
              backgroundColor: "#5865F2",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            Join Discord
          </a>
        </div>
      </div>
    </div>
  );
}
