'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

export default function RegisterClient() {
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const { token, userId, kycStatus } = await authApi.register(email, password, fullName, company);
      login(token, userId, kycStatus);
      router.push(kycStatus === 'VERIFIED' ? '/keys' : '/kyc');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg === 'email_taken' ? 'This email is already registered' : msg);
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
          <h1 className="auth-card-title">Create your account</h1>
          <p className="auth-card-sub">Start securing your AI agents in minutes</p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label">Full name</label>
              <input
                className="z-input"
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jane Doe"
                required
                autoFocus
              />
            </div>

            <div className="field">
              <label className="field-label">Company <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <input
                className="z-input"
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>

            <div className="field">
              <label className="field-label">Email</label>
              <input
                className="z-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>

            <div className="field" style={{ marginBottom: 20 }}>
              <label className="field-label">Password</label>
              <input
                className="z-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>

            {error && (
              <div className="form-error" style={{ marginBottom: 16 }}>
                <span>⚠</span> {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account →'}
            </button>
          </form>

          {/* Trust row */}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 16 }}>
            {['Identity verified', 'No credit card'].map(t => (
              <span key={t} style={{ ...mono, fontSize: 10, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--accent)', fontSize: 9 }}>✓</span>
                {t}
              </span>
            ))}
          </div>
        </div>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link href="/login" className="z-link">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
