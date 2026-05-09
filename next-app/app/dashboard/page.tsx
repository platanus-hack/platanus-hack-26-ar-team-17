'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/client/supabaseBrowser';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    await fetch('/api/auth/login', { method: 'DELETE', credentials: 'include' });
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-zinc-600">You are signed in.</p>
      <button onClick={handleLogout} disabled={busy} className="rounded bg-zinc-200 px-4 py-2 disabled:opacity-50">
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </main>
  );
}
