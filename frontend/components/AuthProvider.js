"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch, TOKEN_KEY } from "@/lib/api";

const AuthContext = createContext(null);

// logged-in user info and login/logout functions are provided to the whole app through this provider
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // When the page is opened or refreshed, if a saved token exists, it checks with the server to restore the login state
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        if (localStorage.getItem(TOKEN_KEY)) {
          const data = await apiFetch("/api/auth/me");
          if (!cancelled) setUser(data.user);
        }
      } catch (err) {
        // if the token is expired/invalid, only then remove it (if the server is temporarily down, we keep it)
        if (err.status === 401) localStorage.removeItem(TOKEN_KEY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email, password) {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
