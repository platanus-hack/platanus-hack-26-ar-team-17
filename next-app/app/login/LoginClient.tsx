'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/client/supabaseBrowser';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };
const grotesk: React.CSSProperties = { fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif' };

type Status = 'idle' | 'authenticating' | 'forwarding';

function GoogleGlyph() {
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

export default function LoginClient() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      setStatus('forwarding');
      window.location.replace(`/auth/callback${hash}`);
    }
  }, []);

  async function handleGoogleSignIn() {
    setError(null);
    setStatus('authenticating');
    try {
      const supabase = getSupabaseBrowser();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
      setStatus('idle');
    }
  }

  const busy = status !== 'idle';

  return (
    <main className="auth-page">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="auth-box fade-in">
        <div className="auth-logo">
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'baseline', gap: 1 }}>
            <span style={{ ...grotesk, fontWeight: 600, fontSize: 32, letterSpacing: '-0.05em', color: 'var(--text)' }}>zero</span>
            <span style={{ color: 'var(--accent)', fontSize: 36, lineHeight: 1, fontWeight: 600 }}>.</span>
          </Link>
        </div>

        <div className="auth-card" style={{ padding: '72px 36px 76px' }}>
          <h1 className="auth-card-title" style={{ fontSize: 24 }}>Te damos la bienvenida</h1>
          <p className="auth-card-sub" style={{ fontSize: 15, marginTop: 18, marginBottom: 76 }}>
            Inicia sesión con Google. Luego haremos la verificación biométrica.
          </p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
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
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
              transition: 'all 200ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            onMouseEnter={e => { if (!busy) {
              e.currentTarget.style.background = 'rgba(200,245,66,0.14)';
              e.currentTarget.style.borderColor = 'rgba(200,245,66,0.4)';
            }}}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(200,245,66,0.1)';
              e.currentTarget.style.borderColor = 'rgba(200,245,66,0.32)';
            }}
          >
            <GoogleGlyph />
            Continuar con Google
          </button>

          {status !== 'idle' && (
            <div className="fade-in" style={{
              ...mono, fontSize: 13, color: 'var(--text-dim)',
              marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <Spinner />
              {status === 'authenticating' && 'abriendo Google...'}
              {status === 'forwarding' && 'completando inicio de sesión...'}
            </div>
          )}

          {error && (
            <div className="form-error fade-in" style={{ marginTop: 16 }}>
              <span>!</span> {error}
            </div>
          )}
        </div>

        <p className="auth-footer" style={{ fontSize: 14 }}>
          ¿Nuevo por aquí?{' '}
          <Link href="/onboard" className="z-link">
            Crear una cuenta
          </Link>
        </p>
      </div>
    </main>
  );
}
