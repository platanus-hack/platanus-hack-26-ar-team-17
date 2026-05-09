'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

export default function LoginClient() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, userId, kycStatus } = await authApi.login(email, password);
      login(token, userId, kycStatus);
      router.push(kycStatus === 'VERIFIED' ? '/keys' : '/kyc');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-box fade-in">
        {/* Logo */}
        <div className="auth-logo">
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'baseline', gap: 1 }}>
            <span style={{
              fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif',
              fontWeight: 600,
              fontSize: 28,
              letterSpacing: '-0.05em',
              color: 'var(--text)',
            }}>zero</span>
            <span style={{ color: 'var(--accent)', fontSize: 32, lineHeight: 1, fontWeight: 600 }}>.</span>
          </Link>
        </div>

        {/* Card */}
        <div className="auth-card">
          <h1 className="auth-card-title">Welcome back</h1>
          <p className="auth-card-sub">Sign in to manage your agent identities</p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label">Email</label>
              <input
                className="z-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
              />
            </div>

            <div className="field" style={{ marginBottom: 20 }}>
              <label className="field-label">Password</label>
              <input
                className="z-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="form-error" style={{ marginBottom: 16 }}>
                <span>⚠</span> {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Signing in…' : 'Continue →'}
            </button>
          </form>

          {/* Security badge */}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 16 }}>
            {['End-to-end encrypted', 'SOC2 ready'].map(t => (
              <span key={t} style={{ ...mono, fontSize: 10, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--accent)', fontSize: 9 }}>✓</span>
                {t}
              </span>
            ))}
          </div>
        </div>

        <p className="auth-footer">
          Don't have an account?{' '}
          <Link href="/register" className="z-link">Create one</Link>
        </p>
      </div>
    </main>
  );
}
