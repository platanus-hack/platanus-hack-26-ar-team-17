'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/client/supabaseBrowser';

export default function RegisterPage() {
  const supabase = getSupabaseBrowser();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
    const sub = supabase.auth.onAuthStateChange((_e, session) => setToken(session?.access_token ?? null));
    return () => sub.data.subscription.unsubscribe();
  }, [supabase]);

  const signUpWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/register` },
    });
  };

  const startKyc = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabase_access_token: token }),
      });
      const body = await r.json();
      if (r.status === 409) return setError('You are already registered. Try logging in.');
      if (!r.ok || !body.verification_url) return setError('Registration failed.');
      window.location.href = body.verification_url;
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Register</h1>
      {!token ? (
        <button onClick={signUpWithGoogle} className="rounded bg-black px-4 py-2 text-white">Sign up with Google</button>
      ) : (
        <button onClick={startKyc} disabled={busy} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
          {busy ? 'Starting verification…' : 'Verify identity (DNI + selfie)'}
        </button>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </main>
  );
}
