import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

type User = {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string | null;
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

const AuthContext = createContext<AuthContextType | null>(null);
export const useAuth = () => useContext(AuthContext)!;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  /* ─── Check session on load ─── */
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/auth/me`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        const newUser = data.user ?? null;
        setUser(newUser);

        if (newUser && !sessionStorage.getItem("welcomed")) {
          sessionStorage.setItem("welcomed", "true");
          const name = newUser.global_name || newUser.username;
          toast.success(`Welcome, ${name}!`);
        }
      })
      .catch((e) => {
        console.error("Auth /me failed:", e);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  /* ─── Start Discord OAuth ─── */
  const login = (redirectTo = window.location.href) => {
    if (sessionStorage.getItem("oauth_in_progress") === "1") return;
    sessionStorage.setItem("oauth_in_progress", "1");

    localStorage.setItem("redirectAfterLogin", redirectTo);

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
      sessionStorage.removeItem("oauth_in_progress");

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
  useEffect(() => {
    if (!loading && !user) {
      sessionStorage.removeItem("oauth_in_progress");
    }
  }, [loading, user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
