// src/components/Navbar.tsx
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, loading, login, logout } = useAuth();

  return (
    <nav className="w-100 px-4 py-3 d-flex justify-content-between align-items-center">
      <span className="logo-title">Cipher</span>

      {loading ? (
        <span className="text-white-50">…</span>
      ) : user ? (
        <div className="dropdown">
          <button
            className="btn p-0 border-0 bg-transparent"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            style={{ outline: 'none' }}
          >
            <img
              src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`}
              alt="avatar"
              className="rounded-circle"
              width={36}
              height={36}
            />
          </button>

          <ul className="dropdown-menu dropdown-menu-end glass-dropdown p-2 text-center" style={{ minWidth: '180px' }}>
            <li className="mb-1 text-white fw-bold" style={{ fontSize: '0.9rem' }}>
              {user.username}
            </li>
            <li><hr className="dropdown-divider" /></li>
            <li>
              <button className="dropdown-item text-danger" onClick={logout}>
                Logout
              </button>
            </li>
          </ul>
        </div>
      ) : (
        <button className="btn back-button-glass" onClick={login}>
          Login with Discord
        </button>
      )}
    </nav>
  );
}
