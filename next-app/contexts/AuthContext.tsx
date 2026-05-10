'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type KycStatus = 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED';

interface AuthState {
  token: string | null;
  userId: string | null;
  kycStatus: KycStatus | null;
  /** Nombre para mostrar (`users.full_name` o email). */
  displayName: string | null;
}

interface AuthContextValue extends AuthState {
  login: (
    token: string,
    userId: string,
    kycStatus: KycStatus | null,
    displayName?: string | null,
  ) => void;
  setKycStatus: (status: KycStatus) => void;
  logout: () => void;
}

function parseStoredAuth(raw: string): AuthState {
  try {
    const p = JSON.parse(raw) as Partial<AuthState>;
    return {
      token: p.token ?? null,
      userId: p.userId ?? null,
      kycStatus: p.kycStatus ?? null,
      displayName: p.displayName ?? null,
    };
  } catch {
    return { token: null, userId: null, kycStatus: null, displayName: null };
  }
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  userId: null,
  kycStatus: null,
  displayName: null,
  login: () => {},
  setKycStatus: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    token: null,
    userId: null,
    kycStatus: null,
    displayName: null,
  });

  useEffect(() => {
    const stored = localStorage.getItem('zero_auth');
    if (stored) setAuth(parseStoredAuth(stored));
  }, []);

  function login(
    token: string,
    userId: string,
    kycStatus: KycStatus | null,
    displayName: string | null = null,
  ) {
    const state: AuthState = { token, userId, kycStatus, displayName: displayName ?? null };
    localStorage.setItem('zero_auth', JSON.stringify(state));
    setAuth(state);
  }

  function setKycStatus(status: KycStatus) {
    setAuth(prev => {
      const next = { ...prev, kycStatus: status };
      localStorage.setItem('zero_auth', JSON.stringify(next));
      return next;
    });
  }

  function logout() {
    localStorage.removeItem('zero_auth');
    setAuth({ token: null, userId: null, kycStatus: null, displayName: null });
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, setKycStatus, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
