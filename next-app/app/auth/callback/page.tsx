'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { getSupabaseBrowser } from '@/lib/client/supabaseBrowser';

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function handleCallback() {
      try {
        const supabase = getSupabaseBrowser();

        // Get the current session (Supabase stores it after OAuth redirect)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData?.session?.access_token) {
          throw new Error('Failed to get OAuth session');
        }

        const { token, userId, kycStatus } = await authApi.loginWithOAuth(sessionData.session.access_token);
        login(token, userId, kycStatus);

        // Redirect based on KYC status
        const redirectPath = kycStatus === 'VERIFIED' ? '/keys' : '/onboard?step=2';
        router.push(redirectPath);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'OAuth callback failed';
        setError(msg);
        setLoading(false);
        setTimeout(() => router.push('/login'), 3000);
      }
    }

    handleCallback();
  }, []);

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
