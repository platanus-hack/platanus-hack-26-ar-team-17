import Link from 'next/link';
import { HeroSection } from '@/components/ui/hero-section-with-smooth-bg-shader';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

export default function Home() {
  return (
    <HeroSection>
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 48px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(5,5,5,0.35)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif',
            fontWeight: 600,
            fontSize: 20,
            letterSpacing: '-0.05em',
            color: '#f0f0f0',
          }}
        >
          zero<span style={{ color: '#c8f542' }}>.</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/docs"
            style={{
              ...mono,
              fontSize: 12,
              color: '#d8d8d8',
              textDecoration: 'none',
              padding: '8px 14px',
              borderRadius: 6,
            }}
          >
            Docs
          </Link>
          <Link
            href="/login"
            style={{
              ...mono,
              fontSize: 12,
              color: '#f0f0f0',
              textDecoration: 'none',
              padding: '8px 14px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.14)',
            }}
          >
            Iniciar sesión -&gt;
          </Link>
        </div>
      </nav>

      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 24px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif',
            fontSize: 'clamp(120px, 22vw, 320px)',
            fontWeight: 700,
            letterSpacing: '-0.06em',
            lineHeight: 0.9,
            color: '#f5f5f5',
            margin: 0,
            textShadow: '0 8px 60px rgba(0,0,0,0.45)',
          }}
        >
          zero<span style={{ color: '#c8f542' }}>.</span>
        </h1>

        <p
          style={{
            marginTop: 28,
            fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif',
            fontSize: 'clamp(16px, 2vw, 22px)',
            color: 'rgba(245,245,245,0.85)',
            letterSpacing: '-0.01em',
            maxWidth: 720,
            lineHeight: 1.4,
            textShadow: '0 2px 20px rgba(0,0,0,0.5)',
          }}
        >
          la capa de identidad para la internet agéntica
        </p>

        <div style={{ display: 'flex', gap: 12, marginTop: 44 }}>
          <Link
            href="/onboard"
            style={{
              ...mono,
              fontSize: 13,
              fontWeight: 600,
              padding: '14px 26px',
              borderRadius: 999,
              background: '#c8f542',
              color: '#050505',
              textDecoration: 'none',
              boxShadow: '0 0 40px rgba(200,245,66,0.35)',
            }}
          >
            Empezar
          </Link>
          <Link
            href="/docs"
            style={{
              ...mono,
              fontSize: 13,
              padding: '14px 26px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#f0f0f0',
              textDecoration: 'none',
              backdropFilter: 'blur(8px)',
            }}
          >
            Ver docs del SDK
          </Link>
        </div>
      </div>
    </HeroSection>
  );
}
