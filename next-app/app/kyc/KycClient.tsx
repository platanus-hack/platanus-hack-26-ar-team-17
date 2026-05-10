'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { kycApi, KycStatus } from '@/lib/api';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

const STATUS_CONFIG: Record<KycStatus, { label: string; pillClass: string; dot: string; heading: string; body: string }> = {
  PENDING: {
    label: 'Not started',
    pillClass: 'pill-pending',
    dot: '○',
    heading: 'Verify your identity',
    body: 'Before issuing API keys to your agents, we need to verify who you are. This takes under 2 minutes.',
  },
  IN_REVIEW: {
    label: 'In review',
    pillClass: 'pill-review',
    dot: '◌',
    heading: 'Verification in progress',
    body: "We're reviewing your submission. This usually takes a few minutes. You'll be able to create keys once approved.",
  },
  VERIFIED: {
    label: 'Verified',
    pillClass: 'pill-verified',
    dot: '●',
    heading: 'Identity verified',
    body: "You're all set. You can now issue API keys to your AI agents.",
  },
  REJECTED: {
    label: 'Rejected',
    pillClass: 'pill-rejected',
    dot: '✕',
    heading: 'Verification failed',
    body: 'Your verification was not approved. You can try again — please ensure your documents are valid and readable.',
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
      setError(err instanceof Error ? err.message : 'Failed to start verification');
    } finally {
      setStarting(false);
    }
  }

  const cfg = STATUS_CONFIG[status];

  return (
    <main className="auth-page">
      <div className="auth-box fade-in" style={{ maxWidth: 440 }}>
        {/* Logo */}
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
          {/* Status pill */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <span className={`pill-base ${cfg.pillClass}`}>
              <span style={{ animation: status === 'IN_REVIEW' ? 'pulse 2s ease-in-out infinite' : 'none' }}>
                {cfg.dot}
              </span>
              {cfg.label}
            </span>
          </div>

          {/* Icon */}
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
              {status === 'VERIFIED' ? '✓' : status === 'REJECTED' ? '✕' : status === 'IN_REVIEW' ? '⟳' : '◈'}
            </div>
          </div>

          <h1 className="auth-card-title">{cfg.heading}</h1>
          <p className="auth-card-sub">{cfg.body}</p>

          {error && (
            <div className="form-error" style={{ marginBottom: 16 }}>
              <span>⚠</span> {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {status === 'VERIFIED' && (
              <button className="btn btn-primary" onClick={() => router.push('/agents')}>
                Go to dashboard →
              </button>
            )}

            {(status === 'PENDING' || status === 'REJECTED') && (
              <button className="btn btn-primary" onClick={startVerification} disabled={starting}>
                {starting ? 'Starting…' : status === 'REJECTED' ? 'Try again →' : 'Start verification →'}
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
                Continue verification ↗
              </a>
            )}

            {status !== 'VERIFIED' && (
              <button
                className="btn btn-secondary"
                onClick={checkStatus}
                disabled={checking}
              >
                {checking ? 'Checking…' : 'Refresh status'}
              </button>
            )}
          </div>

          {/* Steps indicator — only for PENDING */}
          {status === 'PENDING' && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--z-border)' }}>
              {[
                { n: '1', text: 'Create your account' },
                { n: '2', text: 'Verify your identity', active: true },
                { n: '3', text: 'Issue API keys to agents' },
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
            ← Sign out
          </button>
        </p>
      </div>
    </main>
  );
}
