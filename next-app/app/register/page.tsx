'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/client/supabaseBrowser';

export default function RegisterPage() {
  const supabase = getSupabaseBrowser();
  const [status, setStatus] = useState<'idle' | 'authenticating' | 'starting' | 'redirecting'>('idle');
  const [error, setError] = useState<string | null>(null);
  const triggered = useRef(false);

  const startKyc = async (accessToken: string) => {
    if (triggered.current) return;
    triggered.current = true;
    setStatus('starting');
    setError(null);
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabase_access_token: accessToken }),
      });
      const body = await r.json();
      if (r.status === 409) { setError('You are already registered. Try logging in.'); setStatus('idle'); triggered.current = false; return; }
      if (!r.ok || !body.verification_url) { setError('Registration failed.'); setStatus('idle'); triggered.current = false; return; }
      setStatus('redirecting');
      window.location.href = body.verification_url;
    } catch {
      setError('Network error.'); setStatus('idle'); triggered.current = false;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) startKyc(data.session.access_token);
    });
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.access_token) {
        startKyc(session.access_token);
      }
    });
    return () => sub.data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const signUpWithGoogle = async () => {
    setStatus('authenticating');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/register`,
        queryParams: { prompt: 'select_account' },
      },
    });
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Register</h1>
      {status === 'idle' && (
        <button onClick={signUpWithGoogle} className="rounded bg-black px-4 py-2 text-white">
          Sign up with Google
        </button>
      )}
      {status === 'authenticating' && <p className="text-zinc-600">Opening Google…</p>}
      {status === 'starting' && <p className="text-zinc-600">Starting identity verification…</p>}
      {status === 'redirecting' && <p className="text-zinc-600">Redirecting to verification…</p>}
      {error && <p className="text-red-600">{error}</p>}
    </main>
  );
}
