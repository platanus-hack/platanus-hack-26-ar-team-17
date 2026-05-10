'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/client/supabaseBrowser';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };
const grotesk: React.CSSProperties = { fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif' };

type Status = 'idle' | 'authenticating' | 'starting' | 'redirecting';

function GoogleGlyph() {
  // Monochrome lime "G" — colors `currentColor` so it inherits the button's text color.
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" fill="currentColor">
      <path d="M43.6 20.5H42V20H24v8h11.3c-1.7 4.7-6.2 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function Spinner() {
  return (
    <span style={{
      width: 16, height: 16, borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.15)',
      borderTopColor: 'var(--accent)',
      animation: 'spin 800ms linear infinite',
      display: 'inline-block', verticalAlign: 'middle',
    }} />
  );
}

export default function LoginPage() {
  const supabase = getSupabaseBrowser();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const triggered = useRef(false);

  const startBiometricAuth = async (accessToken: string) => {
    if (triggered.current) return;
    triggered.current = true;
    setStatus('starting');
    setError(null);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabase_access_token: accessToken }),
      });
      const body = await r.json();
      if (r.status === 404) { setError('No account yet — head over to onboarding to get started.'); setStatus('idle'); triggered.current = false; return; }
      if (r.status === 409) { setError('Your verification is still being processed.'); setStatus('idle'); triggered.current = false; return; }
      if (r.status === 429) { setError('Too many attempts. Please wait a moment.'); setStatus('idle'); triggered.current = false; return; }
      if (!r.ok || !body.verification_url) { setError('Login failed.'); setStatus('idle'); triggered.current = false; return; }
      setStatus('redirecting');
      window.location.href = body.verification_url;
    } catch {
      setError('Network error.'); setStatus('idle'); triggered.current = false;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) startBiometricAuth(data.session.access_token);
    });
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.access_token) {
        startBiometricAuth(session.access_token);
      }
    });
    return () => sub.data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const signInWithGoogle = async () => {
    setError(null);
    setStatus('authenticating');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
        queryParams: { prompt: 'select_account' },
      },
    });
  };

  const busy = status !== 'idle';

  return (
    <main className="auth-page">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="auth-box fade-in">
        {/* Logo */}
        <div className="auth-logo">
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'baseline', gap: 1 }}>
            <span style={{ ...grotesk, fontWeight: 600, fontSize: 32, letterSpacing: '-0.05em', color: 'var(--text)' }}>zero</span>
            <span style={{ color: 'var(--accent)', fontSize: 36, lineHeight: 1, fontWeight: 600 }}>.</span>
          </Link>
        </div>

        {/* Card */}
        <div className="auth-card" style={{ padding: '72px 36px 76px' }}>
          <h1 className="auth-card-title" style={{ fontSize: 24 }}>Welcome back</h1>
          <p className="auth-card-sub" style={{ fontSize: 15, marginTop: 18, marginBottom: 76 }}>
            Sign in with Google. We'll run the biometric step next.
          </p>

          {/* Google button — lime glass to match the rest of the UI */}
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              width: '100%', padding: '15px 24px', borderRadius: 999,
              background: 'rgba(200,245,66,0.1)',
              border: '1px solid rgba(200,245,66,0.32)',
              color: 'var(--accent)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
              backdropFilter: 'blur(14px) saturate(140%)',
              WebkitBackdropFilter: 'blur(14px) saturate(140%)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.1),' +
                '0 0 0 1px rgba(200,245,66,0.05),' +
                '0 14px 36px -10px rgba(200,245,66,0.22)',
              transition: 'all 200ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            onMouseEnter={e => { if (!busy) {
              e.currentTarget.style.background = 'rgba(200,245,66,0.18)';
              e.currentTarget.style.borderColor = 'rgba(200,245,66,0.5)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow =
                'inset 0 1px 0 rgba(255,255,255,0.14),' +
                '0 0 0 1px rgba(200,245,66,0.1),' +
                '0 18px 44px -10px rgba(200,245,66,0.36)';
            }}}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(200,245,66,0.1)';
              e.currentTarget.style.borderColor = 'rgba(200,245,66,0.32)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow =
                'inset 0 1px 0 rgba(255,255,255,0.1),' +
                '0 0 0 1px rgba(200,245,66,0.05),' +
                '0 14px 36px -10px rgba(200,245,66,0.22)';
            }}
          >
            <GoogleGlyph />
            Continue with Google
          </button>

          {/* Status / error */}
          {status !== 'idle' && (
            <div className="fade-in" style={{
              ...mono, fontSize: 13, color: 'var(--text-dim)',
              marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <Spinner />
              {status === 'authenticating' && 'opening google…'}
              {status === 'starting' && 'preparing biometric verification…'}
              {status === 'redirecting' && 'redirecting…'}
            </div>
          )}

          {error && (
            <div className="form-error fade-in" style={{ marginTop: 16 }}>
              <span>⚠</span> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="auth-footer" style={{ fontSize: 14 }}>
          New here?{' '}
          <Link href="/onboard" className="z-link">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
