import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { tokenStore } from "@/lib/api";

const AuthContext = createContext({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  register: async () => {},
});

export function AuthProvider({ children }) {
  // user states: undefined → checking, null → anonymous, {…} → authenticated
  const [user, setUser] = useState(undefined);

  // Initial hydration: if we have a token, call /me; otherwise mark anonymous immediately.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = tokenStore.get();
      if (!t) {
        if (!cancelled) setUser(null);
        return;
      }
      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        tokenStore.clear();
        if (!cancelled) setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { access_token, user: u } = await api.login(email, password);
    tokenStore.set(access_token);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (email, password, name) => {
    const { access_token, user: u } = await api.register(email, password, name);
    tokenStore.set(access_token);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = {
    user: user || null,
    loading: user === undefined,
    isAuthenticated: !!user,
    login,
    logout,
    register,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
