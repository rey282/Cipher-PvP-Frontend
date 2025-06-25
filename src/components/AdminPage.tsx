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

  const cards: {
    title: string;
    desc: string;
    btnText: string;
    url: string | null;
  }[] = [
    {
      title: "Balance Cost Changes",
      desc: "Adjust cost values for each character and Eidolon",
      btnText: "Cost update",
      url: "/admin/balance",
    },
    {
      title: "Coming Soon",
      desc: "Coming Soon",
      btnText: "Coming soon...",
      url: null,
    },
    {
      title: "Coming Soon",
      desc: "Coming Soon",
      btnText: "Coming soon...",
      url: null,
    },
    {
      title: "Coming Soon",
      desc: "Coming Soon",
      btnText: "Coming soon...",
      url: null,
    },
    {
      title: "Coming Soon",
      desc: "Coming Soon",
      btnText: "Coming soon...",
      url: null,
    },
    {
      title: "Coming Soon",
      desc: "Coming Soon",
      btnText: "Coming soon...",
      url: null,
    },
  ];

  if (loading || !user) {
    return (
      <div className="text-white text-center py-5">
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
        {/* navbar */}
        <Navbar />

        {/* back button */}
        <div className="w-100 d-flex justify-content-end mb-3 pe-4">
          <Link to="/hsr" className="btn back-button-glass">
            ← Back
          </Link>
        </div>

        {/* hero */}
        <div className="text-center py-5 animate__animated animate__fadeInDown">
          <h1 className="display-4 fw-bold mb-3">Admin Dashboard</h1>
          <p className="lead text-white-50">Welcome, {user.username}!</p>
        </div>

        {/* card grid */}
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

        {/* footer */}
        <div
          className="text-center mb-4 animate__animated animate__fadeInUp animate__delay-2s"
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            backgroundColor: "rgba(0,0,0,0.5)",
            padding: "1rem 2rem",
            borderRadius: "12px",
            color: "#fff",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <h5 className="fw-bold mb-2">Admin Notes</h5>
          <p className="mb-0">Haya is the goat</p>
        </div>
      </div>
    </div>
  );
}
