import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Zero - La patente de los agentes de IA';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const ACCENT = '#c8f542';
const ACCENT_GLOW = 'rgba(200,245,66,0.18)';
const BG = '#050505';
const BG_CARD = '#0d0d0d';
const BORDER = '#1e1e1e';
const BORDER_STRONG = '#2a2a2a';
const TEXT = '#f0f0f0';
const TEXT_DIM = '#8a8a8a';
const TEXT_MUTED = '#5a5a5a';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: BG,
          color: TEXT,
          fontFamily: 'sans-serif',
          letterSpacing: '-0.005em',
          position: 'relative',
        }}
      >
        {/* Dot-grid background (Zero auth-page vibe) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            display: 'flex',
          }}
        />

        {/* Lime glow bottom-right */}
        <div
          style={{
            position: 'absolute',
            right: -180,
            bottom: -180,
            width: 720,
            height: 720,
            borderRadius: 9999,
            background: `radial-gradient(circle, ${ACCENT_GLOW} 0%, transparent 60%)`,
            display: 'flex',
          }}
        />

        {/* Header: brand mark + label */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: BG,
                border: `1px solid ${BORDER_STRONG}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <path
                  d="M8 9h16l-9.5 14H24"
                  stroke={ACCENT}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="25" cy="25" r="2" fill={ACCENT} />
              </svg>
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 600,
                color: TEXT,
                letterSpacing: '-0.02em',
                display: 'flex',
              }}
            >
              zero
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 18px',
              borderRadius: 999,
              border: `1px solid ${BORDER}`,
              background: BG_CARD,
              fontSize: 18,
              color: TEXT_DIM,
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: ACCENT,
                boxShadow: `0 0 14px 2px ${ACCENT}`,
                display: 'flex',
              }}
            />
            built at platanus hack
          </div>
        </div>

        {/* Center credential card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '32px 36px',
              borderRadius: 16,
              background: BG_CARD,
              border: `1px solid ${BORDER}`,
              boxShadow: `0 0 0 1px ${BORDER} inset, 0 24px 64px rgba(0,0,0,0.6)`,
            }}
          >
            {/* Card top row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  color: TEXT_MUTED,
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  letterSpacing: 3,
                  display: 'flex',
                }}
              >
                agent credential
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 16,
                  color: ACCENT,
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  letterSpacing: 2,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: ACCENT,
                    display: 'flex',
                  }}
                />
                verified
              </div>
            </div>

            {/* Big tagline */}
            <div
              style={{
                fontSize: 76,
                fontWeight: 700,
                color: TEXT,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex' }}>La patente</div>
              <div style={{ display: 'flex' }}>
                for{' '}
                <span style={{ color: ACCENT, marginLeft: 16 }}>agentes de IA.</span>
              </div>
            </div>

            {/* Mono ID strip */}
            <div
              style={{
                marginTop: 28,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                paddingTop: 20,
                borderTop: `1px solid ${BORDER}`,
                fontSize: 22,
                fontFamily: 'monospace',
                color: TEXT_DIM,
                letterSpacing: 2,
              }}
            >
              <span style={{ color: TEXT_MUTED, display: 'flex' }}>
                agent_id
              </span>
              <span style={{ color: TEXT_MUTED, display: 'flex' }}>·</span>
              <span style={{ color: TEXT, display: 'flex' }}>
                agent_a1b2c3d4e5
              </span>
              <span style={{ color: TEXT_MUTED, display: 'flex' }}>·</span>
              <span style={{ color: ACCENT, display: 'flex' }}>
                permissions: 4
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: TEXT_DIM,
              maxWidth: 720,
              lineHeight: 1.4,
              display: 'flex',
            }}
          >
            Identidad, permisos y accountability para la Internet de
            Agentes.
          </div>
          <div
            style={{
              fontSize: 18,
              color: TEXT_MUTED,
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              letterSpacing: 3,
              display: 'flex',
            }}
          >
            zero / v1
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
