'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/client/supabaseBrowser';

export default function LoginPage() {
  const supabase = getSupabaseBrowser();
  const [status, setStatus] = useState<'idle' | 'authenticating' | 'starting' | 'redirecting'>('idle');
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
      if (r.status === 404) { setError('No account yet. Please register first.'); setStatus('idle'); triggered.current = false; return; }
      if (r.status === 409) { setError('Your verification is still being processed.'); setStatus('idle'); triggered.current = false; return; }
      if (r.status === 429) { setError('Too many attempts. Please wait.'); setStatus('idle'); triggered.current = false; return; }
      if (!r.ok || !body.verification_url) { setError('Login failed.'); setStatus('idle'); triggered.current = false; return; }
      setStatus('redirecting');
      window.location.href = body.verification_url;
    } catch {
      setError('Network error.'); setStatus('idle'); triggered.current = false;
    }
  };

  useEffect(() => {
    // Only auto-trigger after a fresh Google sign-in (button click → OAuth round-trip).
    // We intentionally do NOT auto-trigger from getSession(); a stale Supabase session
    // alone shouldn't bypass the button — the user has to actively choose to sign in.
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.access_token) {
        startBiometricAuth(session.access_token);
      }
    });
    return () => sub.data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const signInWithGoogle = async () => {
    setStatus('authenticating');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
        queryParams: { prompt: 'select_account' },
      },
    });
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {status === 'idle' && (
        <button onClick={signInWithGoogle} className="rounded bg-black px-4 py-2 text-white">
          Sign in with Google
        </button>
      )}
      {status === 'authenticating' && <p className="text-zinc-600">Opening Google…</p>}
      {status === 'starting' && <p className="text-zinc-600">Starting face verification…</p>}
      {status === 'redirecting' && <p className="text-zinc-600">Redirecting to verification…</p>}
      {error && <p className="text-red-600">{error}</p>}
    </main>
  );
}
