import { useAuth } from "../context/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../components/Landing.css";

export default function Navbar() {
  const { user, loading, login, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Manual login lock (due to Cloudflare rate limit)
  const LOGIN_LOCKED = false;

  const isCerydra = location.pathname.startsWith("/cerydra");
  const isCipher = location.pathname.startsWith("/cipher");
  const isLanding = location.pathname === "/";

  const isProfile = location.pathname.startsWith("/profile");
  const isPresets = /\/presets(\/|$)/.test(location.pathname);
  const isLandingLike = isLanding || isProfile || isPresets;

  const goToTeamPresets = () => {
    if (!user?.id) return;
    navigate(`/profile/${user.id}/presets`);
  };

  const cipherNav = [
    { label: "Home", path: "/" },
    { label: "Balance Cost", path: "/cipher/balance-cost" },
    { label: "Player Stats", path: "/cipher/players" },
    { label: "Season Stats", path: "/cipher/insights" },
    { label: "Character Stats", path: "/cipher/characters" },
  ];

  const homeNav = [{ label: "Cost Test", path: "/cerydra/cost-test" }];

  const navLinks =
    isLandingLike || isCerydra ? homeNav : isCipher ? cipherNav : [];

  const showTeamPresetsLink = !!user;

  const handleCloseOffcanvas = () => {
    const offcanvasEl = document.getElementById("mobileNav");
    if (!offcanvasEl) return;
    try {
      const anyWin = window as any;
      const inst = anyWin?.bootstrap?.Offcanvas?.getInstance?.(offcanvasEl);
      inst?.hide?.();
    } catch {}
  };

  return (
    <nav className="w-100 px-2 py-3 d-flex justify-content-between align-items-center">
      {/* Left: Logo */}
      <div className="d-flex align-items-center gap-4 flex-wrap">
        <a href="/" className="navbar-logo d-inline-block">
          <img
            src="/cipher.png"
            alt="Cipher Logo"
            className="navbar-logo-img"
            style={{
              width: "160px",
              height: "auto",
              objectFit: "contain",
              verticalAlign: "middle",
            }}
          />
        </a>
      </div>

      {/* Desktop Nav + Right side */}
      <div className="d-none d-md-flex align-items-center gap-4">
        {/* Nav Links */}
        <div className="d-flex align-items-center gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="admin-link fw-semibold text-decoration-none"
            >
              {link.label}
            </Link>
          ))}

          {showTeamPresetsLink && (
            <button
              type="button"
              className="admin-link fw-semibold text-decoration-none btn btn-link p-0"
              style={{ textDecoration: "none" }}
              onClick={goToTeamPresets}
            >
              Team Presets
            </button>
          )}
        </div>

        {/* Admin Link */}
        {user?.isAdmin && (
          <Link
            to="/admin"
            className="admin-link fw-semibold text-decoration-none"
          >
            Admin
          </Link>
        )}

        {/* Login / Avatar */}
        {loading ? (
          <span className="text-white-50">…</span>
        ) : user ? (
          <div className="dropdown">
            <button
              className="btn p-0 border-0 bg-transparent"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              style={{ outline: "none" }}
            >
              <img
                src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`}
                alt="avatar"
                className="rounded-circle"
                width={36}
                height={36}
              />
            </button>

            <ul
              className="dropdown-menu dropdown-menu-end glass-dropdown p-2 text-center"
              style={{ minWidth: "180px" }}
            >
              <li
                className="mb-1 text-white fw-bold"
                style={{ fontSize: "0.9rem" }}
              >
                {user.global_name || user.username}
              </li>
              {user.global_name && (
                <li
                  className="mb-2 text-white-50"
                  style={{ fontSize: "0.8rem" }}
                >
                  @{user.username}
                </li>
              )}
              <li>
                <hr className="dropdown-divider" />
              </li>
              <li>
                <Link to="/profile" className="dropdown-item text-white">
                  Profile
                </Link>
              </li>
              <li>
                <button className="dropdown-item text-danger" onClick={logout}>
                  Logout
                </button>
              </li>
            </ul>
          </div>
        ) : (
          <button
            className="btn back-button-glass"
            disabled={LOGIN_LOCKED}
            onClick={() => {
              if (!LOGIN_LOCKED) login(window.location.href);
            }}
          >
            {LOGIN_LOCKED ? (
              <>⛔ Login Disabled (Rate Limited)</>
            ) : (
              <>
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
                &nbsp; Login with Discord
              </>
            )}
          </button>
        )}
      </div>

      {/* Mobile Hamburger */}
      <div className="d-md-none">
        <button
          className="btn btn-outline-light"
          type="button"
          data-bs-toggle="offcanvas"
          data-bs-target="#mobileNav"
          aria-controls="mobileNav"
          aria-label="Toggle navigation"
        >
          &#9776;
        </button>

        <div
          className="offcanvas offcanvas-end text-bg-dark"
          tabIndex={-1}
          id="mobileNav"
          aria-labelledby="mobileNavLabel"
          style={{ width: "250px" }}
        >
          <div className="offcanvas-header">
            <h5 className="offcanvas-title" id="mobileNavLabel">
              Menu
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              data-bs-dismiss="offcanvas"
              aria-label="Close"
            />
          </div>

          <div className="offcanvas-body d-flex flex-column gap-3">
            {/* Nav Links */}
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="admin-link fw-semibold text-decoration-none"
                onClick={handleCloseOffcanvas}
              >
                {link.label}
              </Link>
            ))}

            {/* Team Presets (mobile) */}
            {showTeamPresetsLink && (
              <Link
                to={`/profile/${user?.id}/presets`}
                className="admin-link fw-semibold text-decoration-none"
                onClick={handleCloseOffcanvas}
              >
                Team Presets
              </Link>
            )}

            {/* Admin Link */}
            {user?.isAdmin && (
              <Link
                to="/admin"
                className="admin-link fw-semibold text-decoration-none"
                onClick={handleCloseOffcanvas}
              >
                Admin
              </Link>
            )}

            {/* Login / Avatar */}
            {loading ? (
              <span className="text-white-50">…</span>
            ) : user ? (
              <>
                <div className="d-flex align-items-center gap-2">
                  <img
                    src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`}
                    alt="avatar"
                    className="rounded-circle"
                    width={36}
                  />
                  <div>
                    <div
                      className="text-white fw-bold"
                      style={{ fontSize: "0.9rem" }}
                    >
                      {user.global_name || user.username}
                    </div>
                    {user.global_name && (
                      <div
                        className="text-white-50"
                        style={{ fontSize: "0.8rem" }}
                      >
                        @{user.username}
                      </div>
                    )}
                  </div>
                </div>

                <Link
                  to="/profile"
                  className="admin-link fw-semibold text-decoration-none mt-3"
                  onClick={handleCloseOffcanvas}
                >
                  Profile
                </Link>

                <button
                  className="btn btn-link text-danger p-0 mt-1 text-start"
                  onClick={() => {
                    logout();
                    const offcanvasEl = document.getElementById("mobileNav");
                    if (offcanvasEl) {
                      const bsOffcanvas = (
                        window as any
                      ).bootstrap.Offcanvas.getInstance(offcanvasEl);
                      if (bsOffcanvas) bsOffcanvas.hide();
                    }
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                className="btn back-button-glass"
                disabled={LOGIN_LOCKED}
                onClick={() => {
                  if (!LOGIN_LOCKED) {
                    login(window.location.href);
                    handleCloseOffcanvas();
                  }
                }}
              >
                {LOGIN_LOCKED ? (
                  <>⛔ Login Disabled (Rate Limited)</>
                ) : (
                  <>
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
                    &nbsp; Login with Discord
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
