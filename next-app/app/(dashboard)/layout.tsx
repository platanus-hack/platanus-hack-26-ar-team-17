'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const nav = [
  { href: '/keys', label: 'API Keys', icon: '⬡' },
  { href: '/audit-log', label: 'Audit Log', icon: '≡' },
  { href: '/alerts', label: 'Alerts', icon: '⚠' },
];

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, kycStatus, displayName, logout, login } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [cookieSyncDone, setCookieSyncDone] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (token) {
      setCookieSyncDone(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/auth/session', { credentials: 'include' });
        if (cancelled) return;
        if (r.ok) {
          const body = (await r.json()) as {
            token: string;
            userId: string;
            kycStatus: 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED';
            displayName?: string | null;
          };
          login(body.token, body.userId, body.kycStatus, body.displayName ?? null);
        }
      } finally {
        if (!cancelled) setCookieSyncDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, token, login]);

  useEffect(() => {
    if (!mounted || !cookieSyncDone) return;
    if (!token) { router.push('/login'); return; }
    if (kycStatus && kycStatus !== 'VERIFIED') router.push('/kyc');
  }, [mounted, cookieSyncDone, token, kycStatus, router]);

  if (!mounted || !cookieSyncDone || !token) return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ ...mono, fontSize: 12, color: '#3a3a3a' }}>loading…</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#050505', position: 'relative' }}>
      {/* Dot grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        maskImage: 'radial-gradient(ellipse 60% 80% at 20% 50%, black 30%, transparent 80%)',
      }} />
      {/* Glow */}
      <div style={{
        position: 'fixed', bottom: '-15%', right: '-5%', width: '50vw', height: '50vw',
        background: 'radial-gradient(circle, rgba(200,245,66,0.09) 0%, transparent 60%)',
        filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0,
        animation: 'breathe 8s ease-in-out infinite',
      }} />

      {/* Sidebar */}
      <aside style={{
        width: 224, flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        zIndex: 10, background: 'rgba(5,5,5,0.92)',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Logo */}
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/keys" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'baseline', gap: 0 }}>
            <span style={{
              fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif',
              fontWeight: 600, fontSize: 20, letterSpacing: '-0.05em', color: 'var(--text)',
            }}>zero</span>
            <span style={{ color: 'var(--accent)', fontSize: 22, fontWeight: 600 }}>.</span>
          </Link>
          <p style={{ ...mono, fontSize: 10, color: 'var(--text-faint)', marginTop: 5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            dashboard
          </p>
          {displayName && (
            <p style={{ ...mono, fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.35 }}>
              {displayName}
            </p>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px' }}>
          {nav.map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 7, marginBottom: 2,
                  ...mono, fontSize: 12,
                  textDecoration: 'none',
                  transition: 'all 120ms ease',
                  background: active ? 'rgba(200,245,66,0.07)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-dim)',
                  border: active ? '1px solid rgba(200,245,66,0.18)' : '1px solid transparent',
                }}
              >
                <span style={{ fontSize: 13, lineHeight: 1, opacity: active ? 1 : 0.7 }}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* KYC badge if verified */}
        {kycStatus === 'VERIFIED' && (
          <div style={{ padding: '8px 10px' }}>
            <div style={{
              ...mono, fontSize: 10, color: 'var(--accent)',
              background: 'rgba(200,245,66,0.06)',
              border: '1px solid rgba(200,245,66,0.15)',
              borderRadius: 6, padding: '6px 10px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ animation: 'pulse 2s ease-in-out infinite', fontSize: 8 }}>●</span>
              Identity verified
            </div>
          </div>
        )}

        {/* Sign out */}
        <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 7, width: '100%',
              ...mono, fontSize: 12,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', transition: 'color 120ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <span style={{ fontSize: 13 }}>↩</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main style={{ flex: 1, marginLeft: 224, position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
