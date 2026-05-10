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
  { id: 2, title: 'Identity',  sub: 'Verify itÔÇÖs you',      Icon: ShieldCheck },
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
  const { token, kycStatus, setKycStatus } = useAuth();

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
        <Link href="/" style={{ ...grotesk, textDecoration: 'none', color: 'var(--text)', fontWeight: 600, fontSize: 20, letterSpacing: '-0.05em' }}>
          zero<span style={{ color: 'var(--accent)' }}>.</span>
        </Link>
        <Link href="/login" style={{ ...mono, fontSize: 12, color: 'rgba(245,245,245,0.7)', textDecoration: 'none' }}>
          Already have an account?
        </Link>
      </header>

      {/* Shell ÔÇö single column, centered */}
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
              {step === 1 && <Step1Google />}
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
                  onDone={() => router.push('/agents')}
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
        /* Override the boxy default input look ÔÇö fluid/glass */
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

/* ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ BACKGROUND ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */

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

/* ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ STEPPER (horizontal, fluid) ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */

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

/* ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ STEP 1: GOOGLE SIGN-UP ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */

function GoogleGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" fill="currentColor">
      <path d="M43.6 20.5H42V20H24v8h11.3c-1.7 4.7-6.2 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function Step1Google() {
  const supabase = getSupabaseBrowser();
  const [status, setStatus] = useState<'idle' | 'authenticating' | 'starting' | 'redirecting'>('idle');
  const [error, setError] = useState<string | null>(null);
  const triggered = useRef(false);

  const startKyc = async (accessToken: string) => {
    if (triggered.current) return;
    triggered.current = true;
    setStatus('starting');
    setError(null);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabase_access_token: accessToken }),
      });
      const body = await r.json();
      if (r.status === 429) { setError('Too many attempts. Please wait a moment.'); setStatus('idle'); triggered.current = false; return; }
      if (!r.ok) { setError('Sign-up failed.'); setStatus('idle'); triggered.current = false; return; }

      // Already verified — skip KYC and Didit, go straight to the dashboard.
      if (body.mode === 'direct' && body.token && body.userId) {
        localStorage.setItem('zero_auth', JSON.stringify({
          token: body.token,
          userId: body.userId,
          kycStatus: body.kycStatus ?? null,
          displayName: body.displayName ?? null,
        }));
        setStatus('redirecting');
        window.location.href = body.kycStatus === 'VERIFIED' ? '/agents' : '/kyc';
        return;
      }

      if (!body.verification_url) { setError('Sign-up failed.'); setStatus('idle'); triggered.current = false; return; }
      setStatus('redirecting');
      window.location.href = body.verification_url;
    } catch {
      setError('Network error.'); setStatus('idle'); triggered.current = false;
    }
  };

  // If supabase already has a session (e.g. after Google redirect), continue automatically.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) startKyc(data.session.access_token);
    });
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.access_token) startKyc(session.access_token);
    });
    return () => sub.data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const signInWithGoogle = async () => {
    setError(null);
    setStatus('authenticating');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/onboard`,
        queryParams: { prompt: 'select_account' },
      },
    });
  };

  const busy = status !== 'idle';

  return (
    <Card padding="72px 36px 76px">
      <CardHeader
        title="Create your account"
        sub="One click with Google. We'll verify your identity right after."
        marginBottom={76}
      />

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          width: '100%', padding: '15px 24px', borderRadius: 999,
          background: 'rgba(200,245,66,0.1)',
          border: '1px solid rgba(200,245,66,0.32)',
          color: 'var(--accent)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
          cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.6 : 1,
          backdropFilter: 'blur(14px) saturate(140%)',
          WebkitBackdropFilter: 'blur(14px) saturate(140%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
          transition: 'all 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        onMouseEnter={e => { if (!busy) {
          e.currentTarget.style.background = 'rgba(200,245,66,0.14)';
          e.currentTarget.style.borderColor = 'rgba(200,245,66,0.4)';
        }}}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(200,245,66,0.1)';
          e.currentTarget.style.borderColor = 'rgba(200,245,66,0.32)';
        }}
      >
        <GoogleGlyph />
        Continue with Google
      </button>

      {status !== 'idle' && (
        <div className="fade-in" style={{
          ...mono, fontSize: 13, color: 'var(--text-dim)',
          marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <Loader2 size={14} className="spin" />
          {status === 'authenticating' && 'opening googleÔÇª'}
          {status === 'starting' && 'preparing identity verificationÔÇª'}
          {status === 'redirecting' && 'redirectingÔÇª'}
        </div>
      )}

      {error && (
        <div className="form-error fade-in" style={{ marginTop: 16, alignItems: 'center' }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}
    </Card>
  );
}

/* ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ STEP 2: IDENTITY ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */

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
            {isVerified ? 'YouÔÇÖre verified' : isReview ? 'VerifyingÔÇª' : isRejected ? 'Verification failed' : 'Verify your identity'}
          </h2>
          <p style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {isVerified ? 'Moving you to the next stepÔÇª'
              : isReview ? 'Waiting for verification ÔÇö usually under a minute.'
              : isRejected ? 'Documents werenÔÇÖt accepted. You can try again.'
              : 'We need to know whoÔÇÖs behind the agents you issue keys to.'}
          </p>
        </div>
      </div>

      {/* Why this matters ÔÇö only when not in progress/done */}
      {(status === 'PENDING' || status === 'REJECTED') && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            'Cryptographic keys are tied to a verified identity',
            'Required to issue production-grade API keys',
            'One-time check ÔÇö under 2 minutes',
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
            {starting ? 'StartingÔÇª' : isRejected ? 'Try again' : 'Start verification'}
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

/* ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ STEP 3: FIRST KEY ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */

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
              <AlertCircle size={12} /> Copy it now ÔÇö itÔÇÖs shown only once.
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

        <PrimaryButton loading={creating} loadingText="Generating keyÔÇª">
          <KeyRound size={14} strokeWidth={2.5} /> Create key
        </PrimaryButton>

        <button type="button" onClick={onDone} className="btn btn-ghost" style={{ width: '100%', marginTop: 8, ...mono, fontSize: 12 }}>
          Skip for now
        </button>
      </form>
    </Card>
  );
}

/* ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ PRIMITIVES ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */

function Card({ children, padding = '44px 36px 40px' }: { children: React.ReactNode; padding?: string }) {
  return (
    <div
      className="onboard-glass"
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(8,10,6,0.78) 0%, rgba(5,5,5,0.72) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 28,
        padding,
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

function CardHeader({ title, sub, marginBottom = 24 }: { title: string; sub: string; marginBottom?: number }) {
  return (
    <div style={{ marginBottom }}>
      <h2 style={{ ...grotesk, fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: 0, color: 'var(--text)' }}>{title}</h2>
      <p style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', margin: '18px 0 0' }}>{sub}</p>
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
