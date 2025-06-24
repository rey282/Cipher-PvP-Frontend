import { createContext, useContext, useEffect, useState } from "react";

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
  login(redirectTo?: string): void;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);
export const useAuth = () => useContext(AuthContext)!;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/auth/me`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setUser(data.user ?? null))
      .finally(() => setLoading(false));
  }, []);

  const login = () => {
    const currentUrl = window.location.pathname + window.location.search;
    window.location.href = `${import.meta.env.VITE_API_BASE}/auth/discord?redirect=${encodeURIComponent(currentUrl)}`;
  };



  const logout = async () => {
    await fetch(`${import.meta.env.VITE_API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
