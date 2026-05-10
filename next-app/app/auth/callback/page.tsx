'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { getSupabaseBrowser } from '@/lib/client/supabaseBrowser';

export default function CallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function handleCallback() {
      try {
        const code = new URLSearchParams(window.location.search).get('code');
        if (!code) throw new Error('Missing OAuth code');

        const supabase = getSupabaseBrowser();
        const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError || !exchangeData.session?.access_token) {
          throw new Error(exchangeError?.message ?? 'Failed to complete OAuth sign-in');
        }

        const { verification_url } = await authApi.loginWithOAuth(exchangeData.session.access_token);
        window.location.href = verification_url;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'OAuth callback failed';
        setError(msg);
        setLoading(false);
        setTimeout(() => router.push('/login'), 3000);
      }
    }

    handleCallback();
  }, [router]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#050505',
        color: '#f5f5f5',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {loading ? (
        <>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Completing sign-in…</div>
          <div
            style={{
              width: 32,
              height: 32,
              border: '2px solid rgba(200,245,66,0.3)',
              borderRadius: '50%',
              borderTopColor: 'rgba(200,245,66,0.8)',
              animation: 'spin 1s linear infinite',
            }}
          />
        </>
      ) : (
        <>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#ff6b6b' }}>Error: {error}</div>
          <div style={{ fontSize: 14, color: 'rgba(245,245,245,0.6)' }}>Redirecting…</div>
        </>
      )}
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
