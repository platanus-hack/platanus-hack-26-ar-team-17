import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Zero — The license plate for AI agents';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

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
          padding: '72px 80px',
          background:
            'radial-gradient(ellipse at 30% 20%, #0a1f2c 0%, #050505 55%, #000 100%)',
          color: '#e8f6ff',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Subtle grid overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(0,229,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.05) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            display: 'flex',
          }}
        />

        {/* Top row: brand + tagline */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontSize: 28,
              letterSpacing: 2,
              color: '#7dd3fc',
              textTransform: 'uppercase',
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                background: '#22d3ee',
                borderRadius: 999,
                boxShadow: '0 0 24px 6px #22d3ee',
                display: 'flex',
              }}
            />
            Zero
          </div>
          <div
            style={{
              fontSize: 22,
              color: '#9ca3af',
              letterSpacing: 1,
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            Built at Platanus Hack
          </div>
        </div>

        {/* Center: license plate card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '36px 72px',
              borderRadius: 28,
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
              border: '2px solid rgba(34,211,238,0.45)',
              boxShadow:
                '0 0 0 1px rgba(34,211,238,0.15) inset, 0 30px 80px rgba(34,211,238,0.18)',
            }}
          >
            <div
              style={{
                fontSize: 28,
                color: '#67e8f9',
                letterSpacing: 8,
                textTransform: 'uppercase',
                marginBottom: 6,
                display: 'flex',
              }}
            >
              Verified Agent
            </div>
            <div
              style={{
                fontSize: 168,
                fontWeight: 800,
                letterSpacing: -4,
                lineHeight: 1,
                color: '#ffffff',
                textShadow:
                  '0 0 40px rgba(34,211,238,0.55), 0 0 12px rgba(255,255,255,0.4)',
                display: 'flex',
              }}
            >
              ZERO
            </div>
            <div
              style={{
                fontSize: 30,
                marginTop: 10,
                color: '#a5f3fc',
                letterSpacing: 6,
                fontFamily: 'monospace',
                display: 'flex',
              }}
            >
              AGENT · A1B2 · C3D4
            </div>
          </div>
        </div>

        {/* Bottom: tagline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.1,
              letterSpacing: -1,
              display: 'flex',
            }}
          >
            The license plate for AI agents.
          </div>
          <div
            style={{
              fontSize: 28,
              marginTop: 14,
              color: '#94a3b8',
              display: 'flex',
            }}
          >
            Identity, permissions and accountability for the Internet of Agents.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
