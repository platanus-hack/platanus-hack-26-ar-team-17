'use client';

import { useEffect, useState } from 'react';

type KycStatus = 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED';

export default function SyncSessionPage() {
  const [message, setMessage] = useState('Sincronizando sesión…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch('/api/auth/session', { credentials: 'include' });
      if (cancelled) return;
      if (!r.ok) {
        setMessage('No hay sesión activa. Redirigiendo al inicio de sesión…');
        window.location.assign('/login');
        return;
      }
      const body = (await r.json()) as {
        token: string;
        userId: string;
        kycStatus: KycStatus;
        displayName?: string;
      };
      localStorage.setItem(
        'zero_auth',
        JSON.stringify({
          token: body.token,
          userId: body.userId,
          kycStatus: body.kycStatus,
          displayName: body.displayName ?? null,
        }),
      );
      // Recarga completa para que AuthProvider lea `zero_auth`.
      window.location.assign(body.kycStatus === 'VERIFIED' ? '/agents' : '/kyc');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <p className="text-zinc-600">{message}</p>
    </main>
  );
}
