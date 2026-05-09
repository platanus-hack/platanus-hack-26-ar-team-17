'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const nav = [
  { href: '/agents', label: 'Agents', icon: '◈' },
  { href: '/audit-log', label: 'Audit Log', icon: '≡' },
  { href: '/alerts', label: 'Alerts', icon: '⚠' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !token) router.push('/login');
  }, [mounted, token, router]);

  if (!mounted || !token) return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#3a3a3a' }}>loading…</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#050505', position: 'relative' }}>
      {/* Grid bg */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(ellipse at 20% 50%, black 20%, transparent 70%)',
      }} />
      {/* Glow */}
      <div style={{
        position: 'fixed', bottom: '-200px', right: '-100px', width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(200,245,66,0.12) 0%, transparent 60%)',
        filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0,
        animation: 'breathe 7s ease-in-out infinite',
      }} />

      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        borderRight: '1px solid #1c1c1c',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        zIndex: 10, background: 'rgba(5,5,5,0.9)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid #1c1c1c' }}>
          <Link href="/agents" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'baseline', gap: 0 }}>
            <span style={{ fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif', fontWeight: 300, fontSize: 22, letterSpacing: '-0.04em', color: '#fafafa' }}>zero</span>
            <span style={{ color: '#c8f542', fontSize: 22, fontWeight: 300 }}>.</span>
          </Link>
          <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 10, color: '#3a3a3a', marginTop: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>dashboard</p>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {nav.map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 6, marginBottom: 2,
                  fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12,
                  textDecoration: 'none',
                  transition: 'all 120ms ease',
                  background: active ? 'rgba(200,245,66,0.07)' : 'transparent',
                  color: active ? '#c8f542' : '#8a8a8a',
                  border: active ? '1px solid rgba(200,245,66,0.2)' : '1px solid transparent',
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '12px 8px', borderTop: '1px solid #1c1c1c' }}>
          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 6, width: '100%',
              fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#5a5a5a', transition: 'color 120ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fafafa')}
            onMouseLeave={e => (e.currentTarget.style.color = '#5a5a5a')}
          >
            <span style={{ fontSize: 14 }}>↩</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 220, position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
