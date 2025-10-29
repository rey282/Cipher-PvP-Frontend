import "./Footer.css";
import { Link } from "react-router-dom";

export default function Footer() {
  // Smooth scroll to top on internal navigation
  const handleInternalClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="footer-glass px-3 py-5 text-white position-relative overflow-hidden">
      <div className="container">
        <div className="row gy-4 align-items-start">
          {/* Brand / Description */}
          <div className="col-12 col-md-4">
            <a href="/" className="d-inline-block mb-2">
              <img
                src="/cipher.png"
                alt="Cipher Logo"
                style={{
                  width: "200px",
                  height: "auto",
                  objectFit: "contain",
                  verticalAlign: "middle",
                }}
              />
            </a>
            <p className="text-white-50 small mb-3">
              Cipher is a community-built PvP platform for Honkai Star Rail and Zenless Zone Zero.
            </p>
            <p className="text-white-50 small mb-0">
              <em>
                This is a fan-made project and is not affiliated with HoYoverse.
                All game assets belong to HoYoverse.
              </em>
            </p>
          </div>

          {/* Site Navigation */}
          <div className="col-6 col-md-3">
            <h6 className="fw-bold mb-3">Cipher Format</h6>
            <ul className="list-unstyled small">
              <li>
                <Link
                  to="/"
                  className="footer-link"
                  onClick={handleInternalClick}
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/cipher/characters"
                  className="footer-link"
                  onClick={handleInternalClick}
                >
                  Character Stats
                </Link>
              </li>
              <li>
                <Link
                  to="/cipher/players"
                  className="footer-link"
                  onClick={handleInternalClick}
                >
                  Player Rankings
                </Link>
              </li>
              <li>
                <Link
                  to="/cipher/insights"
                  className="footer-link"
                  onClick={() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }
                >
                  Season Statistics
                </Link>
              </li>
            </ul>

            <h6 className="fw-bold mb-3 mt-4">Cerydra Format</h6>
            <ul className="list-unstyled small">
              <li>
                <Link
                  to="/cerydra"
                  className="footer-link"
                  onClick={handleInternalClick}
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/cerydra/balance-cost"
                  className="footer-link"
                  onClick={handleInternalClick}
                >
                  Balance Cost
                </Link>
              </li>
              <li>
                <Link
                  to="/cerydra/cost-test"
                  className="footer-link"
                  onClick={handleInternalClick}
                >
                  Cost Test
                </Link>
              </li>
            </ul>
          </div>

          {/* Dev / Support */}
          <div className="col-6 col-md-3">
            <h6 className="fw-bold mb-3">Project</h6>
            <ul className="list-unstyled small">
              <li>
                <a
                  href="https://ko-fi.com/haya28"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-link"
                >
                  Support on Ko-fi ☕
                </a>
              </li>
              <li>
                <a
                  href="https://discord.com/users/371513247641370625"
                  className="footer-link"
                >
                  Report a Bug
                </a>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="footer-link"
                  onClick={handleInternalClick}
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href="https://discord.gg/MHzc5GRDQW"
                  className="footer-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Discord
                </a>
              </li>
            </ul>
          </div>

          {/* Creator Signature */}
          <div className="col-12 col-md-2 text-md-end text-center mt-4 mt-md-0">
            <p className="mb-2 text-white-50 small">
              Made by <strong>Cipher Dev Team</strong>
            </p>
            <div className="d-flex justify-content-center justify-content-md-end align-items-center gap-3 mb-3">
              <div className="text-center">
                <img
                  src="/avatars/yanyan.png"
                  alt="YanYan"
                  className="footer-avatar"
                />
                <p className="text-white-50 small mb-0 mt-1">YanYan</p>
              </div>
              <div className="text-center">
                <img
                  src="/avatars/haya.png"
                  alt="Haya"
                  className="footer-avatar"
                />
                <p className="text-white-50 small mb-0 mt-1">Haya</p>
              </div>
            </div>

            <div className="tech-stack-wrapper pt-4">
              <p className="text-white-50 text-center text-md-end mb-2 fw-semibold">
                Built With
              </p>
              <div className="tech-stack d-flex justify-content-center justify-content-md-end gap-4 mb-3">
                <img
                  src="/icons/react.svg"
                  alt="React"
                  height="32"
                  title="React"
                />
                <img
                  src="/icons/typescript.svg"
                  alt="TypeScript"
                  height="32"
                  title="TypeScript"
                />
                <img
                  src="/icons/nodejs.svg"
                  alt="Node.js"
                  height="32"
                  title="Node.js"
                />
              </div>
              <div className="tech-stack d-flex justify-content-center justify-content-md-end gap-4">
                <img
                  src="/icons/express.svg"
                  alt="Express"
                  height="32"
                  title="Express"
                />
                <img
                  src="/icons/postgresql.svg"
                  alt="PostgreSQL"
                  height="32"
                  title="PostgreSQL"
                />
                <img
                  src="/icons/vercel.svg"
                  alt="Vercel"
                  height="28"
                  title="Vercel"
                />
              </div>
            </div>
          </div>

          <hr className="footer-divider my-4" />
          <p className="text-center text-white-50 small mb-0">
            © {new Date().getFullYear()} Cipher. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
