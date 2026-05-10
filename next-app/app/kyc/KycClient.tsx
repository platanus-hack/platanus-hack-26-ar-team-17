'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { kycApi, KycStatus } from '@/lib/api';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

const STATUS_CONFIG: Record<KycStatus, { label: string; pillClass: string; dot: string; heading: string; body: string }> = {
  PENDING: {
    label: 'No iniciada',
    pillClass: 'pill-pending',
    dot: '○',
    heading: 'Verifica tu identidad',
    body: 'Antes de emitir claves API para tus agentes, necesitamos verificar quién eres. Toma menos de 2 minutos.',
  },
  IN_REVIEW: {
    label: 'En revisión',
    pillClass: 'pill-review',
    dot: '◌',
    heading: 'Verificación en curso',
    body: 'Estamos revisando tu verificación. Suele tomar unos minutos. Podrás crear claves cuando sea aprobada.',
  },
  VERIFIED: {
    label: 'Verificada',
    pillClass: 'pill-verified',
    dot: '●',
    heading: 'Identidad verificada',
    body: 'Todo listo. Ya puedes emitir claves API para tus agentes de IA.',
  },
  REJECTED: {
    label: 'Rechazada',
    pillClass: 'pill-rejected',
    dot: '×',
    heading: 'La verificación falló',
    body: 'Tu verificación no fue aprobada. Puedes intentarlo de nuevo; asegúrate de que tus documentos sean válidos y legibles.',
  },
};

export default function KycClient() {
  const { token, kycStatus: storedStatus, setKycStatus } = useAuth();
  const [status, setStatus] = useState<KycStatus>(storedStatus ?? 'PENDING');
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    checkStatus();
  }, [token]);

  useEffect(() => {
    if (status === 'VERIFIED') {
      setTimeout(() => router.push('/agents'), 1800);
    }
  }, [status]);

  async function checkStatus() {
    if (!token) return;
    setChecking(true);
    try {
      const data = await kycApi.status(token);
      setStatus(data.status);
      setKycStatus(data.status);
      if (data.session_url) setSessionUrl(data.session_url);
    } catch {}
    finally { setChecking(false); }
  }

  async function startVerification() {
    if (!token) return;
    setStarting(true);
    setError('');
    try {
      const data = await kycApi.start(token);
      setSessionUrl(data.url);
      setStatus('IN_REVIEW');
      setKycStatus('IN_REVIEW');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la verificación');
    } finally {
      setStarting(false);
    }
  }

  const cfg = STATUS_CONFIG[status];

  return (
    <main className="auth-page">
      <div className="auth-box fade-in" style={{ maxWidth: 440 }}>
        <div className="auth-logo">
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'baseline', gap: 1 }}>
            <span style={{
              fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif',
              fontWeight: 600,
              fontSize: 28,
              letterSpacing: '-0.05em',
              color: 'var(--text)',
            }}>zero</span>
            <span style={{ color: 'var(--accent)', fontSize: 32, lineHeight: 1, fontWeight: 600 }}>.</span>
          </Link>
        </div>

        <div className="auth-card">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <span className={`pill-base ${cfg.pillClass}`}>
              <span style={{ animation: status === 'IN_REVIEW' ? 'pulse 2s ease-in-out infinite' : 'none' }}>
                {cfg.dot}
              </span>
              {cfg.label}
            </span>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 64, height: 64, borderRadius: 16,
              background: status === 'VERIFIED'
                ? 'rgba(200,245,66,0.08)'
                : status === 'REJECTED'
                ? 'rgba(255,92,92,0.08)'
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${
                status === 'VERIFIED' ? 'rgba(200,245,66,0.2)' :
                status === 'REJECTED' ? 'rgba(255,92,92,0.2)' :
                'rgba(255,255,255,0.08)'
              }`,
              fontSize: 28,
              marginBottom: 4,
            }}>
              {status === 'VERIFIED' ? '✓' : status === 'REJECTED' ? '×' : status === 'IN_REVIEW' ? '⟳' : '◈'}
            </div>
          </div>

          <h1 className="auth-card-title">{cfg.heading}</h1>
          <p className="auth-card-sub">{cfg.body}</p>

          {error && (
            <div className="form-error" style={{ marginBottom: 16 }}>
              <span>!</span> {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {status === 'VERIFIED' && (
              <button className="btn btn-primary" onClick={() => router.push('/agents')}>
                Ir al panel -&gt;
              </button>
            )}

            {(status === 'PENDING' || status === 'REJECTED') && (
              <button className="btn btn-primary" onClick={startVerification} disabled={starting}>
                {starting ? 'Iniciando...' : status === 'REJECTED' ? 'Intentar de nuevo -&gt;' : 'Iniciar verificación -&gt;'}
              </button>
            )}

            {status === 'IN_REVIEW' && sessionUrl && (
              <a
                href={sessionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ textAlign: 'center' }}
              >
                Continuar verificación
              </a>
            )}

            {status !== 'VERIFIED' && (
              <button
                className="btn btn-secondary"
                onClick={checkStatus}
                disabled={checking}
              >
                {checking ? 'Revisando...' : 'Actualizar estado'}
              </button>
            )}
          </div>

          {status === 'PENDING' && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--z-border)' }}>
              {[
                { n: '1', text: 'Crea tu cuenta' },
                { n: '2', text: 'Verifica tu identidad', active: true },
                { n: '3', text: 'Emite claves API para agentes' },
              ].map(step => (
                <div key={step.n} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '6px 0',
                  opacity: step.active ? 1 : 0.4,
                }}>
                  <div style={{
                    ...mono, width: 22, height: 22, borderRadius: 999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, flexShrink: 0,
                    background: step.active ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                    color: step.active ? '#050505' : 'var(--text-muted)',
                    border: step.active ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    fontWeight: step.active ? 600 : 400,
                  }}>
                    {step.n}
                  </div>
                  <span style={{ fontSize: 13, color: step.active ? 'var(--text)' : 'var(--text-muted)' }}>
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="auth-footer" style={{ marginTop: 16 }}>
          <button
            onClick={() => { localStorage.removeItem('zero_auth'); router.push('/login'); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}
          >
            Cerrar sesión
          </button>
        </p>
      </div>
    </main>
  );
}
