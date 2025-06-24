import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type User = {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string | null;
  name?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (redirectTo?: string) => void;
  logout(): Promise<void>;
};

/* ---------- context ---------- */
const AuthContext = createContext<AuthContextType | null>(null);
export const useAuth = () => useContext(AuthContext)!;

/* ---------- provider ---------- */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]     = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate            = useNavigate();          // ⬅️

  /* ─── Check session on load ─── */
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/auth/me`, {
      credentials: "include",
    })
      .then(res => res.json())
      .then(data => setUser(data.user ?? null))
      .finally(() => setLoading(false));
  }, []);

  /* ─── Start Discord OAuth ─── */
  const login = (redirectTo = window.location.pathname + window.location.search) => {
    // Persist the page we want to return to
    localStorage.setItem("redirectAfterLogin", redirectTo);

    // Hit backend route that starts Passport’s Discord strategy
    window.location.href = `${import.meta.env.VITE_API_BASE}/auth/discord`;
  };

  /* ─── Logout ─── */
  const logout = async () => {
    await fetch(`${import.meta.env.VITE_API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    window.location.reload();
  };

  /* ─── One-time redirect AFTER login ─── */
  useEffect(() => {
    if (!loading && user) {
      const dest = localStorage.getItem("redirectAfterLogin");
      if (dest) {
        localStorage.removeItem("redirectAfterLogin");
        navigate(dest, { replace: true });
      }
    }
  }, [loading, user, navigate]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
