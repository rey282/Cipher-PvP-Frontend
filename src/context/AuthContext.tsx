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
  login(): void;
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
    window.location.href = `${import.meta.env.VITE_API_BASE}/auth/discord`;
  };

  const logout = async () => {
    await fetch(`${import.meta.env.VITE_API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
