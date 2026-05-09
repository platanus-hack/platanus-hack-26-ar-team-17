'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AuthState {
  token: string | null;
  userId: string | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string, userId: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  userId: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ token: null, userId: null });

  useEffect(() => {
    const stored = localStorage.getItem('zero_auth');
    if (stored) {
      try { setAuth(JSON.parse(stored) as AuthState); } catch {}
    }
  }, []);

  function login(token: string, userId: string) {
    const state = { token, userId };
    localStorage.setItem('zero_auth', JSON.stringify(state));
    setAuth(state);
  }

  function logout() {
    localStorage.removeItem('zero_auth');
    setAuth({ token: null, userId: null });
    window.location.href = '/login';
  }

  return <AuthContext.Provider value={{ ...auth, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
