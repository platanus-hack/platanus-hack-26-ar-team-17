'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/client/supabaseBrowser';

export default function LoginPage() {
  const supabase = getSupabaseBrowser();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
    const sub = supabase.auth.onAuthStateChange((_e, session) => setToken(session?.access_token ?? null));
    return () => sub.data.subscription.unsubscribe();
  }, [supabase]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    });
  };

  const startBiometricAuth = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabase_access_token: token }),
      });
      const body = await r.json();
      if (r.status === 404) return setError('No account yet. Please register first.');
      if (r.status === 409) return setError('Your verification is still being processed.');
      if (r.status === 429) return setError('Too many attempts. Please wait.');
      if (!r.ok || !body.verification_url) return setError('Login failed.');
      window.location.href = body.verification_url;
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {!token ? (
        <button onClick={signInWithGoogle} className="rounded bg-black px-4 py-2 text-white">Sign in with Google</button>
      ) : (
        <button onClick={startBiometricAuth} disabled={busy} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
          {busy ? 'Starting verification…' : 'Verify with face'}
        </button>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </main>
  );
}
