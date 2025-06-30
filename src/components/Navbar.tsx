// src/components/Navbar.tsx
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export default function Navbar() {
  const { user, loading, login, logout } = useAuth();

  return (
    <nav className="w-100 px-2 py-3 d-flex justify-content-between align-items-center">
      <a href="/" className="logo-title d-inline-block">
        <img
          src="/cipher.png"
          alt="Cipher Logo"
          style={{
            width: "160px",
            height: "auto",
            objectFit: "contain",
            verticalAlign: "middle",
          }}
        />
      </a>

      <div className="d-flex align-items-center gap-3">
        {/* Admin link (only if user is admin) */}
        {user?.isAdmin && (
          <Link
            to="/admin"
            className="admin-link fw-semibold text-decoration-none"
          >
            Admin
          </Link>
        )}

        {/* Avatar / Login button */}
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
            onClick={() => login(window.location.href)}
          >
            {
              <img
                src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f47e.svg"
                alt="Discord"
                width={20}
                height={20}
                style={{ filter: "brightness(0) saturate(100%) invert(100%)" }}
              />
            }{" "}
            &nbsp; Login with Discord
          </button>
        )}
      </div>
    </nav>
  );
}
