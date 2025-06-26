import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import "./Landing.css";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [leaving] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const cards = [
    {
      title: "Balance Cost Changes",
      desc: "Adjust cost values for each character and Eidolon",
      url: "/admin/balance",
    },
    {
      title: "Match History",
      desc: "View and rollback submitted matches",
      url: "/admin/match-history",
    },
    {
      title: "Coming Soon",
      desc: "Coming Soon",
      url: null,
    },
    {
      title: "Coming Soon",
      desc: "Coming Soon",
      url: null,
    },
    {
      title: "Coming Soon",
      desc: "Coming Soon",
      url: null,
    },
    {
      title: "Coming Soon",
      desc: "Coming Soon",
      url: null,
    },
  ];

  if (loading || !user) {
    return (
      <div
        className="d-flex justify-content-center align-items-center text-white"
        style={{ minHeight: "100vh", background: "#000" }}
      >
        <p>Checking admin access…</p>
      </div>
    );
  }

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
        <Navbar />

        {/* back button */}
        <div className="w-100 d-flex justify-content-end mb-3 pe-4">
          <Link to="/hsr" className="btn back-button-glass">
            ← Back
          </Link>
        </div>

        {/* hero */}
        <div className="text-center py-5 animate__animated animate__fadeInDown">
          <h1 className="display-4 fw-bold mb-3">Cipher PvP Admin</h1>
          <p className="lead text-white-50">
            Welcome, {user.global_name || user.username}!
          </p>
        </div>

        {/* card grid */}
        <div className="container mb-5">
          <div className="row g-4 animate__animated animate__fadeInUp animate__delay-1s">
            {cards.map(({ title, desc, url }, i) => (
              <div className="col-sm-6 col-lg-4" key={i}>
                {url ? (
                  url.startsWith("http") ? (
                    <a
                      href={url}
                      target="_self"
                      rel="noopener noreferrer"
                      className="feature-card text-decoration-none d-flex flex-column align-items-center justify-content-center text-white link-hover"
                      onClick={() => window.scrollTo(0, 0)}
                    >
                      <div className="feature-title">{title}</div>
                      <div className="feature-desc text-center">{desc}</div>
                    </a>
                  ) : (
                    <Link
                      to={url}
                      className="feature-card text-decoration-none d-flex flex-column align-items-center justify-content-center text-white link-hover"
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
          {/* admin notes footer */}
          <div
            className="text-center mb-4 mt-5 animate__animated animate__fadeInUp animate__delay-2s px-3"
            style={{
              maxWidth: "600px",
              marginLeft: "auto",
              marginRight: "auto",
              backgroundColor: "rgba(0,0,0,0.5)",
              padding: "1rem 1.5rem",
              borderRadius: "12px",
              color: "#fff",
              backdropFilter: "blur(6px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <h5 className="fw-bold mb-3">Admin Notes</h5>
            <p className="mb-2"></p>
            <p className="mb-2"></p>
            <p className="mb-2"></p>
            <p className="mb-0"> Haya is the goat.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
