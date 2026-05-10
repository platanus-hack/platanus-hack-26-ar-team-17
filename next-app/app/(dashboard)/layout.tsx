'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { MeshGradient } from '@paper-design/shaders-react';
import { useAuth } from '@/contexts/AuthContext';

const nav = [
  { href: '/agents', label: 'Agents', icon: '◉' },
  { href: '/keys', label: 'API Keys', icon: '⬡' },
  { href: '/audit-log', label: 'Audit Log', icon: '≡' },
  { href: '/alerts', label: 'Alerts', icon: '⚠' },
];

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

function FluidBackground() {
  const [size, setSize] = useState({ w: 1920, h: 1080 });
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const u = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    u(); window.addEventListener('resize', u);
    return () => window.removeEventListener('resize', u);
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      {mounted && (
        <MeshGradient
          width={size.w}
          height={size.h}
          colors={['#c8f542', '#5a7a18', '#050505', '#0e1500', '#aed334', '#1f2a04']}
          distortion={1.3}
          swirl={0.85}
          grainMixer={0}
          grainOverlay={0}
          speed={0.22}
          offsetX={0.05}
        />
      )}
      {/* Heavy dark veil so dense dashboard content stays readable */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,5,0.78)' }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 70% 60% at 70% 50%, transparent 0%, rgba(5,5,5,0.55) 100%)',
      }} />
    </div>
  );
}

const RAIL_WIDTH = 14;
const SIDEBAR_WIDTH = 224;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, kycStatus, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!token) { router.push('/login'); return; }
    if (kycStatus && kycStatus !== 'VERIFIED') router.push('/kyc');
  }, [mounted, token, kycStatus, router]);

  useEffect(() => {
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, []);

  // Collapse when route changes — keeps the workspace clean after navigation.
  useEffect(() => { setExpanded(false); }, [pathname]);

  function open() {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setExpanded(true);
  }
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setExpanded(false), 180);
  }

  if (!mounted || !token) return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ ...mono, fontSize: 12, color: '#3a3a3a' }}>loading…</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#050505', position: 'relative' }}>
      <style>{`
        .rail-indicator {
          opacity: 0.55;
          transition: opacity 220ms ease, height 220ms ease;
          animation: rail-breathe 4s ease-in-out infinite;
        }
        div:hover > .rail-indicator { opacity: 1; height: 80px; }
        @keyframes rail-breathe {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.75; }
        }
      `}</style>
      <FluidBackground />

      {/* Edge hover rail — always visible, hints at the hidden sidebar */}
      <div
        onMouseEnter={open}
        style={{
          position: 'fixed', top: 0, bottom: 0, left: 0, width: RAIL_WIDTH,
          zIndex: 11, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: expanded ? 0 : 1,
          transition: 'opacity 200ms ease',
          pointerEvents: expanded ? 'none' : 'auto',
        }}
      >
        {/* Vertical accent line — subtle when idle, brightens with rail proximity */}
        <div className="rail-indicator" style={{
          width: 2, height: 56, borderRadius: 2,
          background: 'linear-gradient(180deg, transparent 0%, rgba(200,245,66,0.35) 50%, transparent 100%)',
        }} />
      </div>

      {/* Sidebar — slides in from the left */}
      <aside
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        style={{
        width: SIDEBAR_WIDTH, flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        zIndex: 10,
        background: 'linear-gradient(180deg, rgba(10,12,8,0.55) 0%, rgba(5,5,5,0.5) 100%)',
        backdropFilter: 'blur(40px) saturate(160%)',
        WebkitBackdropFilter: 'blur(40px) saturate(160%)',
        transform: expanded ? 'translateX(0)' : `translateX(-${SIDEBAR_WIDTH}px)`,
        transition: 'transform 340ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 340ms ease',
        boxShadow: expanded
          ? [
              'inset 0 1px 0 rgba(255,255,255,0.06)',
              'inset -1px 0 0 rgba(255,255,255,0.04)',
              '24px 0 60px -16px rgba(0,0,0,0.55)',
              '0 0 80px -20px rgba(200,245,66,0.08)',
            ].join(', ')
          : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        {/* Logo */}
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/agents" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'baseline', gap: 0 }}>
            <span style={{
              fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif',
              fontWeight: 600, fontSize: 24, letterSpacing: '-0.05em', color: 'var(--text)',
            }}>zero</span>
            <span style={{ color: 'var(--accent)', fontSize: 26, fontWeight: 600 }}>.</span>
          </Link>
          <p style={{ ...mono, fontSize: 12, color: 'var(--text-faint)', marginTop: 7, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            dashboard
          </p>
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
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 999, marginBottom: 4,
                  ...mono, fontSize: 15,
                  textDecoration: 'none',
                  transition: 'all 120ms ease',
                  background: active ? 'rgba(200,245,66,0.08)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-dim)',
                  border: active ? '1px solid rgba(200,245,66,0.22)' : '1px solid transparent',
                  backdropFilter: active ? 'blur(10px)' : 'none',
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1, opacity: active ? 1 : 0.7 }}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* KYC badge if verified */}
        {kycStatus === 'VERIFIED' && (
          <div style={{ padding: '8px 10px' }}>
            <div style={{
              ...mono, fontSize: 13, color: 'var(--accent)',
              background: 'rgba(200,245,66,0.07)',
              border: '1px solid rgba(200,245,66,0.18)',
              borderRadius: 999, padding: '8px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}>
              <span style={{ animation: 'pulse 2s ease-in-out infinite', fontSize: 10 }}>●</span>
              Identity verified
            </div>
          </div>
        )}

        {/* Sign out */}
        <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center',
              padding: '12px 16px', borderRadius: 999, width: '100%',
              ...mono, fontSize: 15,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', transition: 'color 120ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Content — full viewport width so pages can center themselves; sidebar overlays on hover */}
      <main style={{ flex: 1, position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
