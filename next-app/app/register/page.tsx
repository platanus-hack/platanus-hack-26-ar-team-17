'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';

export default function RegisterPage() {
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
      const { token, userId } = await authApi.register(email, password);
      login(token, userId);
      router.push('/agents');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <div className="left-pane">
        <div className="brand-block">
          <div style={{ display: 'inline-flex', alignItems: 'baseline', fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif', fontWeight: 300, letterSpacing: '-0.04em', fontSize: 32 }}>
            <span>zero</span>
            <span style={{ color: 'var(--accent)' }}>.</span>
          </div>
          <p className="tagline">Every agent,<br />a verified identity</p>
          <div className="tagline-rule" />
          <p className="lead">
            Create your account to start issuing cryptographic identities
            to your AI agents. Full audit trail, revocable at any time.
          </p>
        </div>
        <div className="foot">
          <span><span className="foot-dot" />zero v1.0</span>
          <span>secure by default</span>
        </div>
      </div>

      <div className="right-pane">
        <div className="right-top">
          <span className="pill">auth.zero</span>
          <span>create account</span>
        </div>
        <div className="card-wrap">
          <div className="card fade-enter">
            <div className="card-eyebrow">get started</div>
            <h1 className="card-title">Create account</h1>
            <p className="card-sub">Start securing your AI agents in minutes.</p>

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label className="field-label">EMAIL</label>
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
              <div className="field">
                <label className="field-label">PASSWORD</label>
                <input
                  className="z-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="min. 8 characters"
                  required
                />
              </div>

              {error && (
                <p style={{ color: 'var(--danger)', fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12, marginBottom: 12 }}>
                  {error}
                </p>
              )}

              <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 8 }}>
                {loading ? 'Creating account…' : 'Create account →'}
              </button>
            </form>

            <div className="trust-row">
              <span>
                Already have an account?{' '}
                <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                  Sign in
                </Link>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
