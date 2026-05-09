'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type KycStatus = 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED';

interface AuthState {
  token: string | null;
  userId: string | null;
  kycStatus: KycStatus | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string, userId: string, kycStatus: KycStatus | null) => void;
  setKycStatus: (status: KycStatus) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  userId: null,
  kycStatus: null,
  login: () => {},
  setKycStatus: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ token: null, userId: null, kycStatus: null });

  useEffect(() => {
    const stored = localStorage.getItem('zero_auth');
    if (stored) {
      try { setAuth(JSON.parse(stored) as AuthState); } catch {}
    }
  }, []);

  function login(token: string, userId: string, kycStatus: KycStatus | null) {
    const state = { token, userId, kycStatus };
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
    setAuth({ token: null, userId: null, kycStatus: null });
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
