'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MeshGradient } from '@paper-design/shaders-react';
import { Check, Loader2, ShieldCheck, KeyRound, UserRound, ArrowRight, Copy, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { kycApi, agentsApi } from '@/lib/api';
import { getSupabaseBrowser } from '@/lib/client/supabaseBrowser';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };
const grotesk: React.CSSProperties = { fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif' };

type StepId = 1 | 2 | 3;

const STEPS: { id: StepId; title: string; sub: string; Icon: typeof UserRound }[] = [
  { id: 1, title: 'Account',   sub: 'Your details',         Icon: UserRound },
  { id: 2, title: 'Identity',  sub: 'Verify it’s you',      Icon: ShieldCheck },
  { id: 3, title: 'First key', sub: 'Issue to an agent',    Icon: KeyRound },
];

const PLATFORMS = [
  { value: 'mcp', label: 'MCP Server' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'slack', label: 'Slack' },
  { value: 'api', label: 'Direct API' },
  { value: 'custom', label: 'Custom' },
];

export default function OnboardClient() {
  const router = useRouter();
  const search = useSearchParams();
  const { token, kycStatus, login, setKycStatus } = useAuth();

  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<StepId>(1);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Initial step from auth state
  useEffect(() => {
    setHydrated(true);
    const forced = Number(search.get('step')) as StepId | 0;
    if (forced && [1, 2, 3].includes(forced)) {
      setStep(forced);
      return;
    }
    if (!token) setStep(1);
    else if (kycStatus !== 'VERIFIED') setStep(2);
    else setStep(3);
  }, []); // run once

  function go(next: StepId) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', background: '#050505' }}>
      <FluidBackground />

      {/* Top bar */}
      <header style={{
        position: 'relative', zIndex: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 36px',
      }}>
        <Link href="/" style={{ ...grotesk, textDecoration: 'none', color: 'var(--text)', fontWeight: 600, fontSize: 20, letterSpacing: '-0.05em', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
          zero<span style={{ color: 'var(--accent)' }}>.</span>
        </Link>
        <Link href="/login" style={{ ...mono, fontSize: 12, color: 'rgba(245,245,245,0.7)', textDecoration: 'none', textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>
          Already have an account?
        </Link>
      </header>

      {/* Shell — single column, centered */}
      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 540, margin: '0 auto',
        padding: '32px 24px 96px',
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 28,
      }}>
        <FluidStepper step={step} onJump={(id) => id < step && go(id)} />

        <section style={{ position: 'relative', minHeight: 420 }}>
          {hydrated && (
            <div
              key={step}
              style={{
                animation: `fluid-in 520ms cubic-bezier(0.16, 1, 0.3, 1) both`,
              }}
            >
              {step === 1 && (
                <Step1Account
                  onDone={(t, _u, k) => { login(t, _u, k); go(k === 'VERIFIED' ? 3 : 2); }}
                />
              )}
              {step === 2 && (
                <Step2Identity
                  token={token}
                  initialStatus={kycStatus ?? 'PENDING'}
                  onStatusChange={setKycStatus}
                  onDone={() => go(3)}
                />
              )}
              {step === 3 && (
                <Step3FirstKey
                  token={token}
                  onDone={() => router.push('/keys')}
                />
              )}
            </div>
          )}
        </section>
      </div>

      <style jsx global>{`
        @keyframes fluid-in {
          from { opacity: 0; transform: translateY(12px) scale(0.985); filter: blur(8px); }
          to   { opacity: 1; transform: translateY(0)    scale(1);     filter: blur(0); }
        }
        /* Override the boxy default input look — fluid/glass */
        .onboard-glass .z-input {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 12px;
          padding: 13px 16px;
        }
        .onboard-glass .z-input:focus {
          background: rgba(255,255,255,0.07);
          border-color: rgba(200,245,66,0.45);
          box-shadow: 0 0 0 4px rgba(200,245,66,0.08);
        }
        .onboard-glass .field-label {
          font-size: 10.5px;
          color: rgba(245,245,245,0.55);
        }
      `}</style>
    </main>
  );
}

/* ────────────────────────── BACKGROUND ────────────────────────── */

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
      {/* Heavy dark veil so content is readable */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,5,0.55)' }} />
      {/* Soft vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% 40%, transparent 0%, rgba(5,5,5,0.55) 100%)',
      }} />
    </div>
  );
}

/* ────────────────────────── STEPPER (horizontal, fluid) ────────────────────────── */

function FluidStepper({ step, onJump }: { step: StepId; onJump: (id: StepId) => void }) {
  const pct = ((step - 1) / (STEPS.length - 1)) * 100;
  return (
    <div style={{ width: '100%', padding: '4px 8px 0' }}>
      {/* Track + labels */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Background track */}
        <div style={{
          position: 'absolute', left: 18, right: 18, top: '50%',
          height: 2, transform: 'translateY(-50%)',
          background: 'rgba(255,255,255,0.08)', borderRadius: 999,
        }} />
        {/* Progress fill */}
        <div style={{
          position: 'absolute', left: 18, top: '50%',
          height: 2, transform: 'translateY(-50%)',
          width: `calc(${pct}% - ${pct === 0 ? 0 : 36 * (pct / 100)}px)`,
          background: 'linear-gradient(90deg, rgba(200,245,66,0.3), var(--accent))',
          borderRadius: 999,
          boxShadow: '0 0 16px var(--accent-glow)',
          transition: 'width 520ms cubic-bezier(0.16, 1, 0.3, 1)',
        }} />

        {STEPS.map(({ id, title, Icon }) => {
          const done = id < step;
          const active = id === step;
          const interactive = done;
          return (
            <button
              key={id}
              onClick={() => interactive && onJump(id)}
              disabled={!interactive}
              style={{
                position: 'relative', zIndex: 1,
                background: 'none', border: 'none', padding: 0, cursor: interactive ? 'pointer' : 'default',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}
            >
              <span style={{
                width: 36, height: 36, borderRadius: 999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: active
                  ? 'var(--accent)'
                  : done
                    ? 'rgba(200,245,66,0.18)'
                    : 'rgba(20,20,20,0.6)',
                border: active
                  ? '1px solid rgba(200,245,66,0.6)'
                  : `1px solid ${done ? 'rgba(200,245,66,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: active ? '#050505' : done ? 'var(--accent)' : 'rgba(255,255,255,0.5)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: active
                  ? '0 0 24px var(--accent-glow), 0 0 0 6px rgba(200,245,66,0.08)'
                  : 'none',
                transition: 'all 360ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}>
                {done ? <Check size={15} strokeWidth={2.6} /> : <Icon size={15} strokeWidth={2} />}
              </span>
              <span style={{
                ...mono, fontSize: 10.5,
                color: active ? 'rgba(245,245,245,0.95)' : done ? 'rgba(245,245,245,0.7)' : 'rgba(245,245,245,0.4)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                textShadow: '0 1px 8px rgba(0,0,0,0.5)',
                transition: 'color 250ms ease',
              }}>
                {title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────── STEP 1: ACCOUNT ────────────────────────── */

function Step1Account({ onDone }: { onDone: (token: string, userId: string, kyc: 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED') => void }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignUp() {
    setError('');
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Create your account" sub="Takes about 30 seconds. No credit card." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <ErrorRow message={error} />}

        <button
          onClick={handleGoogleSignUp}
          disabled={loading}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {loading ? 'Signing up…' : ''}
          {!loading && (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
              </svg>
              Sign up with Google →
            </>
          )}
        </button>

        <p style={{ ...mono, fontSize: 11, color: 'rgba(245,245,245,0.5)', textAlign: 'center', margin: '8px 0 0 0' }}>
          Already have an account? <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </Card>
  );
}

/* ────────────────────────── STEP 2: IDENTITY ────────────────────────── */

function Step2Identity({
  token,
  initialStatus,
  onStatusChange,
  onDone,
}: {
  token: string | null;
  initialStatus: 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED';
  onStatusChange: (s: 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED') => void;
  onDone: () => void;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function check() {
    if (!token) return;
    try {
      const data = await kycApi.status(token);
      setStatus(data.status);
      onStatusChange(data.status);
      if (data.session_url) setSessionUrl(data.session_url);
    } catch {}
  }

  // Initial check + poll while in review
  useEffect(() => { check(); }, []);
  useEffect(() => {
    if (status === 'IN_REVIEW') {
      pollRef.current = setInterval(check, 3000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
    if (status === 'VERIFIED') {
      const t = setTimeout(onDone, 1400);
      return () => clearTimeout(t);
    }
  }, [status]);

  async function start() {
    if (!token) return;
    setStarting(true); setError('');
    try {
      const data = await kycApi.start(token);
      setSessionUrl(data.url);
      setStatus('IN_REVIEW');
      onStatusChange('IN_REVIEW');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start verification');
    } finally {
      setStarting(false);
    }
  }

  const isReview = status === 'IN_REVIEW';
  const isVerified = status === 'VERIFIED';
  const isRejected = status === 'REJECTED';

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isVerified ? 'rgba(200,245,66,0.1)' : isRejected ? 'rgba(255,92,92,0.1)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isVerified ? 'rgba(200,245,66,0.3)' : isRejected ? 'rgba(255,92,92,0.3)' : 'var(--z-border)'}`,
          color: isVerified ? 'var(--accent)' : isRejected ? '#ff5c5c' : 'var(--text-dim)',
        }}>
          {isReview
            ? <Loader2 size={22} className="spin" />
            : <ShieldCheck size={22} strokeWidth={2} />}
        </div>
        <div>
          <h2 style={{ ...grotesk, fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: 0 }}>
            {isVerified ? 'You’re verified' : isReview ? 'Verifying…' : isRejected ? 'Verification failed' : 'Verify your identity'}
          </h2>
          <p style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {isVerified ? 'Moving you to the next step…'
              : isReview ? 'Waiting for verification — usually under a minute.'
              : isRejected ? 'Documents weren’t accepted. You can try again.'
              : 'We need to know who’s behind the agents you issue keys to.'}
          </p>
        </div>
      </div>

      {/* Why this matters — only when not in progress/done */}
      {(status === 'PENDING' || status === 'REJECTED') && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            'Cryptographic keys are tied to a verified identity',
            'Required to issue production-grade API keys',
            'One-time check — under 2 minutes',
          ].map(t => (
            <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-dim)' }}>
              <Check size={14} strokeWidth={2.5} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              {t}
            </li>
          ))}
        </ul>
      )}

      {/* Live progress for IN_REVIEW */}
      {isReview && (
        <div style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, padding: 16, margin: '8px 0 20px',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#ffb84d', animation: 'pulse 1.6s ease-in-out infinite' }} />
            <span style={{ ...mono, fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
              auto-checking every 3s
            </span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '40%', background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', animation: 'shimmer 1.6s linear infinite' }} />
          </div>
        </div>
      )}

      {error && <ErrorRow message={error} />}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(status === 'PENDING' || status === 'REJECTED') && (
          <button onClick={start} disabled={starting} className="btn btn-primary" style={{ flex: 1, minWidth: 200 }}>
            {starting ? <Loader2 size={14} className="spin" /> : <ShieldCheck size={14} strokeWidth={2.5} />}
            {starting ? 'Starting…' : isRejected ? 'Try again' : 'Start verification'}
          </button>
        )}

        {isReview && sessionUrl && (
          <a href={sessionUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ flex: 1, minWidth: 200 }}>
            <ExternalLink size={14} strokeWidth={2.5} /> Reopen verification window
          </a>
        )}

        {isVerified && (
          <button onClick={onDone} className="btn btn-primary" style={{ flex: 1 }}>
            <ArrowRight size={14} strokeWidth={2.5} /> Continue
          </button>
        )}

        {!isVerified && (
          <button onClick={check} className="btn btn-secondary">
            <RefreshCw size={13} strokeWidth={2.5} /> Refresh
          </button>
        )}
      </div>

      <style jsx>{`
        :global(.spin) { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </Card>
  );
}

/* ────────────────────────── STEP 3: FIRST KEY ────────────────────────── */

function Step3FirstKey({ token, onDone }: { token: string | null; onDone: () => void }) {
  const [name, setName] = useState('My first agent');
  const [platform, setPlatform] = useState('mcp');
  const [creating, setCreating] = useState(false);
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCreating(true); setError('');
    try {
      const result = await agentsApi.create(token, { name, platform, type: 'agent' });
      if (!result.key) throw new Error('No key returned');
      setPlainKey(result.key.plainKey);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  }

  function copy() {
    if (!plainKey) return;
    navigator.clipboard.writeText(plainKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (plainKey) {
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(200,245,66,0.1)',
            border: '1px solid rgba(200,245,66,0.3)',
            color: 'var(--accent)',
          }}>
            <KeyRound size={22} strokeWidth={2} />
          </div>
          <div>
            <h2 style={{ ...grotesk, fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: 0 }}>
              Your key is ready
            </h2>
            <p style={{ ...mono, fontSize: 12, color: '#ffb84d', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={12} /> Copy it now — it’s shown only once.
            </p>
          </div>
        </div>

        <div style={{
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(200,245,66,0.22)',
          borderRadius: 16, padding: 14, display: 'flex', gap: 10, marginBottom: 20,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 0 40px -8px rgba(200,245,66,0.15)',
        }}>
          <code style={{
            ...mono, fontSize: 13, color: 'var(--text)', flex: 1,
            wordBreak: 'break-all', lineHeight: 1.6, alignSelf: 'center',
          }}>{plainKey}</code>
          <button
            onClick={copy}
            className="btn"
            style={{
              ...mono, fontSize: 11, padding: '8px 12px', flexShrink: 0,
              background: copied ? 'rgba(200,245,66,0.12)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${copied ? 'rgba(200,245,66,0.3)' : 'rgba(255,255,255,0.1)'}`,
              color: copied ? 'var(--accent)' : 'var(--text-dim)',
            }}
          >
            {copied ? <><Check size={12} strokeWidth={2.5} /> copied</> : <><Copy size={12} strokeWidth={2} /> copy</>}
          </button>
        </div>

        <button onClick={onDone} className="btn btn-primary">
          Go to dashboard <ArrowRight size={14} strokeWidth={2.5} />
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Issue your first key"
        sub="One key per agent. You can revoke it anytime."
      />
      <form onSubmit={create}>
        <Field label="Key name">
          <input className="z-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sales Bot" required autoFocus />
        </Field>

        <Field label="Where will it run?">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {PLATFORMS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPlatform(p.value)}
                style={{
                  ...mono, fontSize: 11,
                  padding: '11px 12px', borderRadius: 999, cursor: 'pointer',
                  background: platform === p.value ? 'rgba(200,245,66,0.1)' : 'rgba(255,255,255,0.035)',
                  border: `1px solid ${platform === p.value ? 'rgba(200,245,66,0.45)' : 'rgba(255,255,255,0.07)'}`,
                  color: platform === p.value ? 'var(--accent)' : 'rgba(245,245,245,0.6)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: platform === p.value ? '0 0 16px -4px rgba(200,245,66,0.25)' : 'none',
                  transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)', textAlign: 'center',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>

        {error && <ErrorRow message={error} />}

        <PrimaryButton loading={creating} loadingText="Generating key…">
          <KeyRound size={14} strokeWidth={2.5} /> Create key
        </PrimaryButton>

        <button type="button" onClick={onDone} className="btn btn-ghost" style={{ width: '100%', marginTop: 8, ...mono, fontSize: 12 }}>
          Skip for now
        </button>
      </form>
    </Card>
  );
}

/* ────────────────────────── PRIMITIVES ────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="onboard-glass"
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(8,10,6,0.78) 0%, rgba(5,5,5,0.72) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 28,
        padding: 36,
        backdropFilter: 'blur(40px) saturate(160%)',
        WebkitBackdropFilter: 'blur(40px) saturate(160%)',
        boxShadow: [
          'inset 0 1px 0 rgba(255,255,255,0.08)',
          'inset 0 0 0 1px rgba(255,255,255,0.02)',
          '0 32px 80px -20px rgba(0,0,0,0.6)',
          '0 8px 24px -8px rgba(0,0,0,0.4)',
          '0 0 80px -20px rgba(200,245,66,0.08)',
        ].join(', '),
        overflow: 'hidden',
      }}
    >
      {/* Top sheen */}
      <div style={{
        position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
        pointerEvents: 'none',
      }} />
      {/* Lime ambient highlight */}
      <div style={{
        position: 'absolute', top: -120, right: -80, width: 260, height: 260,
        background: 'radial-gradient(circle, rgba(200,245,66,0.12) 0%, transparent 65%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
}

function CardHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ ...grotesk, fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: 0, color: 'var(--text)' }}>{title}</h2>
      <p style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>{sub}</p>
    </div>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="field" style={{ marginBottom: 14 }}>
      <label className="field-label">
        {label}
        {optional && <span style={{ color: 'var(--text-faint)', fontWeight: 400, marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>}
      </label>
      {children}
    </div>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="form-error" style={{ marginBottom: 14, alignItems: 'center' }}>
      <AlertCircle size={13} /> {message}
    </div>
  );
}

function PrimaryButton({ loading, loadingText, children }: { loading?: boolean; loadingText?: string; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: 6 }}>
      {loading ? <><Loader2 size={14} className="spin" /> {loadingText}</> : children}
    </button>
  );
}
