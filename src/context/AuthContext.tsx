import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type User = {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string | null;
  name?: string;
  isAdmin?: boolean;
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate(); // ⬅️

  /* ─── Check session on load ─── */
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/auth/me`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setUser(data.user ?? null))
      .finally(() => setLoading(false));
  }, []);

  /* ─── Start Discord OAuth ─── */
  const login = (redirectTo = window.location.href) => {
    localStorage.setItem("redirectAfterLogin", redirectTo);

    // ✅ include ?redirect= in backend call
    const authUrl = `${
      import.meta.env.VITE_API_BASE
    }/auth/discord?redirect=${encodeURIComponent(redirectTo)}`;
    window.location.href = authUrl;
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

        if (dest.startsWith("http")) {
          window.location.href = dest;
        } else {
          navigate(dest, { replace: true });
        }
      }
    }
  }, [loading, user, navigate]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
