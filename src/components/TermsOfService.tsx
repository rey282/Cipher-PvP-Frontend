import { useEffect } from "react";
import "./Landing.css";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function TermsOfService() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div
      className="page-fade-in"
      style={{
        background: "#000",
        minHeight: "100vh",
      }}
    >
      <div className="position-relative z-2 text-white px-4 py-4">
        {/* --- top nav (identical to PlayerProfile) --- */}
        <Navbar />

        <div className="d-flex justify-content-end px-4 mt-2">
          <button
            className="btn btn-outline-light btn-sm back-button-glass"
            onClick={() => {
              navigate("/");
              window.scrollTo(0, 0);
            }}
          >
            ← Back
          </button>
        </div>

        <div className="container">
          {/* -------- page heading -------- */}
          <h1 className="display-5 fw-bold text-center mb-4">
            Terms&nbsp;of&nbsp;Service
          </h1>

          {/* -------- agreement of use -------- */}
          <section className="mb-4">
            <h5>Agreement of Use</h5>
            <p>
              By accessing or using Cipher you agree to abide by these terms,
              our community guidelines, and our privacy policy. Any behaviour
              that disrupts, exploits, or otherwise harms the platform or other
              players may result in warnings, temporary suspensions, or
              permanent bans.
            </p>
          </section>

          {/* -------- affiliation -------- */}
          <section className="mb-4">
            <h5>Affiliation</h5>
            <p>
              Cipher is a community driven fan project and is&nbsp;
              <strong>not</strong>&nbsp;affiliated with, sponsored by, or
              endorsed by HoYoverse. All Honkai: Star&nbsp;Rail and
              Zenless&nbsp;Zone&nbsp;Zero names, images, and other assets remain
              the property of HoYoverse.
            </p>
          </section>

          {/* -------- minimum age -------- */}
          <section className="mb-4">
            <h5>Minimum Age</h5>
            <p>
              You must be at least&nbsp;<strong>13&nbsp;years old</strong> to
              use this website, in accordance with general internet
              standards.&nbsp; However, please note that our&nbsp;
              <strong>Discord server</strong> is restricted to users aged&nbsp;
              <strong>18 and above</strong>.
            </p>
          </section>

          {/* -------- privacy & data -------- */}
          <section className="mb-4">
            <h5>Privacy &amp; Data Usage</h5>
            <p>
              We collect the data you provide such as match results and roster
              choices to generate statistics, leaderboards, and tournament
              tools. These data are&nbsp;never sold or shared outside of
              Cipher&nbsp;PvP and are used solely to enhance your competitive
              experience.
            </p>
          </section>

          {/* -------- updates -------- */}
          <section className="mb-4">
            <h5>Terms Updates</h5>
            <p>
              We may update these terms at any time. Major changes will be
              announced in our&nbsp;
              <a
                href="https://discord.gg/MHzc5GRDQW"
                className="footer-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Discord&nbsp;server
              </a>
              .
            </p>
          </section>

          {/* -------- contact -------- */}
          <section className="mb-4">
            <h5>Contact</h5>
            <p>
              Questions or concerns? Join our&nbsp;
              <a
                href="https://discord.gg/MHzc5GRDQW"
                className="footer-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Discord&nbsp;community
              </a>{" "}
              or DM&nbsp;
              <a
                href="https://discord.com/users/371513247641370625"
                className="footer-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                @haya_28
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
