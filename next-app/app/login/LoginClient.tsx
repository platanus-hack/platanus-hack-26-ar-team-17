'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { getSupabaseBrowser } from '@/lib/client/supabaseBrowser';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

export default function LoginClient() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleGoogleSignIn() {
    setError('');
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/google-callback`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div className="form-error">
                <span>⚠</span> {error}
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {loading ? 'Signing in…' : ''}
              {!loading && (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
                  </svg>
                  Sign in with Google →
                </>
              )}
            </button>

            <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(245, 245, 245, 0.6)' }}>
              Don't have an account?{' '}
              <Link href="/onboard" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                Create one
              </Link>
            </div>
          </div>

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

      </div>
    </main>
  );
}
