'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HeroSection } from '@/components/ui/hero-section-with-smooth-bg-shader';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };
const grotesk: React.CSSProperties = { fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif' };

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
type Phase =
  | 'idle'
  | 'thinking'
  | 'sign'
  | 'send'
  | 'verify_ts'
  | 'verify_nonce'
  | 'verify_hmac'
  | 'issue_token'
  | 'forward'
  | 'exec_tool'
  | 'return'
  | 'finalize'
  | 'done';

const PHASE_DURATION: Record<Phase, number> = {
  idle: 0,
  thinking: 1300,
  sign: 850,
  send: 1100,
  verify_ts: 450,
  verify_nonce: 450,
  verify_hmac: 700,
  issue_token: 500,
  forward: 1000,
  exec_tool: 1300,
  return: 1300,
  finalize: 1500,
  done: 0,
};

const PHASE_ORDER: Phase[] = [
  'thinking',
  'sign',
  'send',
  'verify_ts',
  'verify_nonce',
  'verify_hmac',
  'issue_token',
  'forward',
  'exec_tool',
  'return',
  'finalize',
  'done',
];

type RunResponse = {
  success: boolean;
  agent: { id: string; name: string; apiKeyPrefix: string | null; apiSecretPreview: string };
  validate: { tokenPreview: string | null; expiresAt: string | null };
  mcpResult: unknown;
  trace: { phase: string; ts_ms: number; ok?: boolean; data: Record<string, unknown> }[];
};

type RunState =
  | { kind: 'idle' }
  | { kind: 'requesting' } // server call in flight
  | { kind: 'replaying'; data: RunResponse } // playing back trace
  | { kind: 'finished'; data: RunResponse }
  | { kind: 'error'; message: string };

// Reasoning lines, keyed to phase. Scripted — the network calls below are real.
const REASONING_LINES: { phase: Phase; line: string; kind: 'thought' | 'action' | 'observe' | 'final' }[] = [
  { phase: 'thinking', line: 'user: "pay 0.01 USDC and bring me the premium weather feed"', kind: 'thought' },
  { phase: 'thinking', line: 'merchant accepts USDC on base-sepolia — this is an x402 payment', kind: 'thought' },
  { phase: 'thinking', line: 'before any settlement, my agent identity must be signed by zero', kind: 'thought' },
  { phase: 'sign', line: 'building HMAC-SHA256 over agentId|ts|nonce|action|platform', kind: 'action' },
  { phase: 'send', line: 'POST /api/validate  {agentId, ts, nonce, action, sig}', kind: 'action' },
  { phase: 'issue_token', line: 'zero issued a 60s scoped JWT — payment is authorized', kind: 'observe' },
  { phase: 'forward', line: 'POST /mcp pay_and_fetch  payer 0xPayer…0001, asset USDC', kind: 'action' },
  { phase: 'exec_tool', line: 'mcp: 402 challenge → sign authorization → verify → settle → 200', kind: 'observe' },
  { phase: 'return', line: 'settled on base-sepolia · received resource + tx receipt', kind: 'observe' },
  { phase: 'finalize', line: 'composing reply: amount paid, settlement tx, delivered data', kind: 'thought' },
  { phase: 'done', line: 'payment cleared — see info panel for the receipt', kind: 'final' },
];

// ──────────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────────
export default function DemoPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [runState, setRunState] = useState<RunState>({ kind: 'idle' });
  const [runCount, setRunCount] = useState(0);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRanRef = useRef(false);

  // ── Phase advancement (animation playback) ────────────────────────────────
  useEffect(() => {
    if (phaseTimer.current) clearTimeout(phaseTimer.current);

    if (runState.kind !== 'replaying') return;

    const idx = PHASE_ORDER.indexOf(phase);
    if (idx === -1) {
      // currently 'idle' → kick off
      setPhase(PHASE_ORDER[0]);
      return;
    }
    const isLast = idx === PHASE_ORDER.length - 1;
    if (isLast) {
      setRunState({ kind: 'finished', data: runState.data });
      return;
    }
    const dur = PHASE_DURATION[phase];
    phaseTimer.current = setTimeout(() => {
      setPhase(PHASE_ORDER[idx + 1]);
    }, dur);

    return () => {
      if (phaseTimer.current) clearTimeout(phaseTimer.current);
    };
  }, [phase, runState]);

  // Optional auto-run via ?autorun=1 — handy for live demos and screenshots.
  useEffect(() => {
    if (autoRanRef.current) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autorun') === '1') {
      autoRanRef.current = true;
      // Defer one tick so the page paints idle state first.
      setTimeout(() => void startRun(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRun = async () => {
    setRunCount((c) => c + 1);
    setPhase('idle');
    setRunState({ kind: 'requesting' });
    try {
      const res = await fetch('/api/demo/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setRunState({
          kind: 'error',
          message: body.message ?? body.error ?? `demo run failed (${res.status})`,
        });
        return;
      }
      const data = (await res.json()) as RunResponse;
      setRunState({ kind: 'replaying', data });
      setPhase(PHASE_ORDER[0]);
    } catch (err) {
      setRunState({ kind: 'error', message: (err as Error).message });
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const data = runState.kind === 'replaying' || runState.kind === 'finished' ? runState.data : null;
  const visibleReasoning = REASONING_LINES.filter((l) => phaseAtLeast(phase, l.phase));

  // packet position (-1 hidden ; 0=agent ; 0.5=zero ; 1=mcp)
  const packetState = useMemo(() => {
    switch (phase) {
      case 'send':
        return { x: 0.5, visible: true, color: '#c8f542' as const };
      case 'forward':
        return { x: 1, visible: true, color: '#c8f542' as const };
      case 'return':
        return { x: 0, visible: true, color: '#6ab0ff' as const };
      default:
        return { x: 0, visible: false, color: '#c8f542' as const };
    }
  }, [phase]);

  const verifyStates = {
    ts: stepState(phase, 'verify_ts'),
    nonce: stepState(phase, 'verify_nonce'),
    hmac: stepState(phase, 'verify_hmac'),
    token: stepState(phase, 'issue_token'),
  };

  return (
    <HeroSection veilOpacity="bg-black/55">
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Nav */}
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 48px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(5,5,5,0.45)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
          }}
        >
          <Link href="/" style={{ ...grotesk, fontWeight: 600, fontSize: 20, letterSpacing: '-0.05em', color: '#f0f0f0', textDecoration: 'none' }}>
            zero<span style={{ color: '#c8f542' }}>.</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <RunBadge runState={runState} runCount={runCount} />
            <Link href="/docs" style={{ ...mono, fontSize: 12, color: '#d8d8d8', textDecoration: 'none', padding: '8px 14px' }}>Docs</Link>
            <Link href="/dashboard" style={{ ...mono, fontSize: 12, color: '#f0f0f0', textDecoration: 'none', padding: '8px 14px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}>
              Dashboard →
            </Link>
          </div>
        </nav>

        {/* Hero band */}
        <div style={{ padding: '64px 48px 24px', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
          <div style={{ ...mono, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c8f542', marginBottom: 16 }}>
            live demo · agent payment via zero ↔ x402
          </div>
          <h1 style={{ ...grotesk, fontSize: 'clamp(44px, 6vw, 72px)', fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.02, color: '#f5f5f5', margin: 0, maxWidth: 980 }}>
            every <span style={{ color: '#c8f542' }}>error 402</span>, signed before it settles.
          </h1>
          <p style={{ ...grotesk, marginTop: 18, fontSize: 17, color: 'rgba(245,245,245,0.72)', maxWidth: 760, lineHeight: 1.5 }}>
            click run — we hit a paywalled resource, take the <code style={{ ...mono, color: '#c8f542' }}>402 Payment Required</code>, prove agent identity through zero, and settle in USDC on base-sepolia. the panel below shows the real x402 receipt the MCP returned.
          </p>

          {/* Run control */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
            <button
              onClick={startRun}
              disabled={runState.kind === 'requesting' || runState.kind === 'replaying'}
              style={{
                ...mono,
                fontSize: 13,
                fontWeight: 600,
                padding: '14px 26px',
                borderRadius: 999,
                background: '#c8f542',
                color: '#050505',
                textDecoration: 'none',
                border: 'none',
                cursor: runState.kind === 'requesting' || runState.kind === 'replaying' ? 'not-allowed' : 'pointer',
                opacity: runState.kind === 'requesting' || runState.kind === 'replaying' ? 0.7 : 1,
                boxShadow: '0 0 40px rgba(200,245,66,0.35)',
                transition: 'transform 120ms ease, box-shadow 200ms ease',
              }}
            >
              {runState.kind === 'requesting'
                ? 'minting agent + signing…'
                : runState.kind === 'replaying'
                ? 'running…'
                : runState.kind === 'finished'
                ? '↻ run again'
                : '⚡ generate keys & run'}
            </button>
            {runState.kind === 'error' && (
              <span style={{ ...mono, fontSize: 12, color: '#ff8a8a', letterSpacing: '-0.01em' }}>
                ⚠ {runState.message}
              </span>
            )}
            {(runState.kind === 'replaying' || runState.kind === 'finished') && data && (
              <span style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                agent <span style={{ color: '#c8f542' }}>{data.agent.name}</span> · secret{' '}
                <span style={{ color: '#c8f542' }}>{data.agent.apiSecretPreview}</span>
              </span>
            )}
          </div>
        </div>

        {/* Flow visualization */}
        <div style={{ padding: '12px 48px 0', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
          <FlowDiagram phase={phase} packet={packetState} verify={verifyStates} runActive={runState.kind === 'replaying' || runState.kind === 'finished'} />
        </div>

        {/* Reasoning + info panels */}
        <div
          style={{
            padding: '32px 48px 24px',
            maxWidth: 1280,
            margin: '0 auto',
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
            gap: 24,
          }}
        >
          <ReasoningPanel lines={visibleReasoning} phase={phase} active={runState.kind === 'replaying' || runState.kind === 'finished'} />
          <InfoPanel phase={phase} mcpResult={data?.mcpResult ?? null} />
        </div>

        {/* Signed payload + verification trail */}
        <div style={{ padding: '0 48px 96px', maxWidth: 1280, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 24 }}>
          <PayloadPanel phase={phase} data={data} />
          <TrailPanel phase={phase} data={data} />
        </div>
      </div>

      <style jsx global>{`
        @keyframes packetGlow {
          0%, 100% { filter: drop-shadow(0 0 6px currentColor) drop-shadow(0 0 14px currentColor); }
          50% { filter: drop-shadow(0 0 12px currentColor) drop-shadow(0 0 22px currentColor); }
        }
        @keyframes nodePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(200,245,66,0.6), 0 0 24px rgba(200,245,66,0.25); }
          50%      { box-shadow: 0 0 0 14px rgba(200,245,66,0), 0 0 40px rgba(200,245,66,0.35); }
        }
        @keyframes nodePulseBlue {
          0%, 100% { box-shadow: 0 0 0 0 rgba(106,176,255,0.55), 0 0 24px rgba(106,176,255,0.22); }
          50%      { box-shadow: 0 0 0 14px rgba(106,176,255,0), 0 0 40px rgba(106,176,255,0.32); }
        }
        @keyframes wireFlow {
          0%   { background-position: 0px 0px; }
          100% { background-position: 24px 0px; }
        }
        @keyframes lineEnter {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }
      `}</style>
    </HeroSection>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Phase helpers
// ──────────────────────────────────────────────────────────────────────────────
function phaseIndex(p: Phase): number {
  if (p === 'idle') return -1;
  return PHASE_ORDER.indexOf(p);
}
function phaseAtLeast(current: Phase, target: Phase): boolean {
  if (current === 'idle') return false;
  return phaseIndex(current) >= phaseIndex(target);
}
function stepState(current: Phase, target: Phase): 'idle' | 'active' | 'done' {
  if (current === 'idle') return 'idle';
  const c = phaseIndex(current);
  const t = phaseIndex(target);
  if (c < t) return 'idle';
  if (c === t) return 'active';
  return 'done';
}

// ──────────────────────────────────────────────────────────────────────────────
// Flow diagram
// ──────────────────────────────────────────────────────────────────────────────
function FlowDiagram({
  phase,
  packet,
  verify,
  runActive,
}: {
  phase: Phase;
  packet: { x: number; visible: boolean; color: '#c8f542' | '#6ab0ff' };
  verify: { ts: 'idle' | 'active' | 'done'; nonce: 'idle' | 'active' | 'done'; hmac: 'idle' | 'active' | 'done'; token: 'idle' | 'active' | 'done' };
  runActive: boolean;
}) {
  const agentActive = ['thinking', 'sign', 'finalize', 'done'].includes(phase);
  const zeroActive = ['verify_ts', 'verify_nonce', 'verify_hmac', 'issue_token'].includes(phase);
  const mcpActive = phase === 'exec_tool';

  const wireOutHot = phase === 'send' || phase === 'forward';
  const wireBackHot = phase === 'return';

  return (
    <div
      style={{
        position: 'relative',
        height: 240,
        background: 'linear-gradient(180deg, rgba(13,13,13,0.5), rgba(8,8,8,0.6))',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: '32px 40px',
        backdropFilter: 'blur(18px)',
        opacity: runActive || phase !== 'idle' ? 1 : 0.55,
        transition: 'opacity 280ms ease',
      }}
    >
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 0 }}>
        <Wire side="out" hot={wireOutHot} from="12%" to="50%" label="signed request" />
        <Wire side="out" hot={phase === 'forward'} from="50%" to="88%" label="bearer + tool args" />
        <Wire side="back" hot={wireBackHot} from="50%" to="12%" label="response" reverse />
        <Wire side="back" hot={wireBackHot} from="88%" to="50%" label="payload" reverse />
      </div>

      {/* packet */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: `calc(${12 + packet.x * 76}% )`,
          transform: 'translate(-50%, -50%)',
          opacity: packet.visible ? 1 : 0,
          transition: 'left 1100ms cubic-bezier(0.65, 0, 0.35, 1), opacity 250ms ease',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: packet.color,
            color: packet.color,
            animation: 'packetGlow 1.2s ease-in-out infinite',
          }}
        />
      </div>

      <Node
        x="12%"
        title="agent"
        sub="zero-sdk · demo"
        active={agentActive}
        accent="#c8f542"
        icon={<AgentIcon />}
        status={
          phase === 'thinking'
            ? 'reasoning…'
            : phase === 'sign'
            ? 'signing payload'
            : phase === 'finalize'
            ? 'composing reply'
            : phase === 'done'
            ? 'replied'
            : phase === 'idle'
            ? 'idle — click run'
            : 'awaiting…'
        }
      />
      <Node
        x="50%"
        title="zero"
        sub="security layer"
        active={zeroActive}
        accent="#c8f542"
        icon={<ShieldIcon />}
        bigger
      >
        <VerifyChecklist verify={verify} />
      </Node>
      <Node
        x="88%"
        title="mcp"
        sub="xmcp-x402-sim"
        active={mcpActive}
        accent="#6ab0ff"
        icon={<MCPIcon />}
        status={phase === 'exec_tool' ? 'pay_and_fetch(...)' : phase === 'return' ? '200 OK · settled' : 'waiting'}
      />
    </div>
  );
}

function Wire({
  hot,
  from,
  to,
  label,
  reverse,
  side,
}: {
  hot: boolean;
  from: string;
  to: string;
  label: string;
  reverse?: boolean;
  side: 'out' | 'back';
}) {
  const left = from;
  const width = `calc(${to} - ${from})`;
  const top = side === 'out' ? -1 : 14;
  return (
    <div style={{ position: 'absolute', left, width, top, height: 1 }}>
      <div
        style={{
          height: 1,
          width: '100%',
          background: hot
            ? `repeating-linear-gradient(90deg, ${reverse ? '#6ab0ff' : '#c8f542'} 0 6px, transparent 6px 12px)`
            : 'rgba(255,255,255,0.12)',
          backgroundSize: hot ? '24px 1px' : 'auto',
          animation: hot ? `wireFlow 600ms linear infinite ${reverse ? 'reverse' : ''}` : 'none',
          transition: 'background 200ms ease',
        }}
      />
      <div
        style={{
          ...mono,
          position: 'absolute',
          top: side === 'out' ? -22 : 6,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: hot ? (reverse ? '#6ab0ff' : '#c8f542') : 'rgba(255,255,255,0.28)',
          whiteSpace: 'nowrap',
          transition: 'color 200ms ease',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Node({
  x,
  title,
  sub,
  active,
  accent,
  icon,
  status,
  bigger,
  children,
}: {
  x: string;
  title: string;
  sub: string;
  active: boolean;
  accent: '#c8f542' | '#6ab0ff';
  icon: React.ReactNode;
  status?: string;
  bigger?: boolean;
  children?: React.ReactNode;
}) {
  const w = bigger ? 240 : 180;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: w,
      }}
    >
      <div
        style={{
          background: 'rgba(10,10,10,0.85)',
          border: `1px solid ${active ? (accent === '#c8f542' ? 'rgba(200,245,66,0.6)' : 'rgba(106,176,255,0.6)') : 'rgba(255,255,255,0.12)'}`,
          borderRadius: 12,
          padding: '14px 16px',
          backdropFilter: 'blur(20px)',
          animation: active ? (accent === '#c8f542' ? 'nodePulse 1.4s ease-in-out infinite' : 'nodePulseBlue 1.4s ease-in-out infinite') : 'none',
          transition: 'border-color 250ms ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: children ? 10 : 6 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: active ? `${accent}1f` : 'rgba(255,255,255,0.05)',
              color: active ? accent : 'rgba(255,255,255,0.55)',
              transition: 'all 200ms ease',
            }}
          >
            {icon}
          </div>
          <div>
            <div style={{ ...grotesk, fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', color: '#f0f0f0', textTransform: 'lowercase' }}>{title}</div>
            <div style={{ ...mono, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{sub}</div>
          </div>
        </div>
        {children}
        {status && (
          <div style={{ ...mono, fontSize: 10, color: active ? accent : 'rgba(255,255,255,0.4)', letterSpacing: '0.04em', marginTop: children ? 8 : 0 }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}

function VerifyChecklist({
  verify,
}: {
  verify: { ts: 'idle' | 'active' | 'done'; nonce: 'idle' | 'active' | 'done'; hmac: 'idle' | 'active' | 'done'; token: 'idle' | 'active' | 'done' };
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <CheckRow state={verify.ts} label="timestamp ±5min" />
      <CheckRow state={verify.nonce} label="nonce freshness" />
      <CheckRow state={verify.hmac} label="HMAC-SHA256 verify" />
      <CheckRow state={verify.token} label="mint scoped JWT" />
    </div>
  );
}
function CheckRow({ state, label }: { state: 'idle' | 'active' | 'done'; label: string }) {
  const color = state === 'done' || state === 'active' ? '#c8f542' : 'rgba(255,255,255,0.25)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...mono, fontSize: 11, color, transition: 'color 200ms ease' }}>
      <span style={{ width: 10, display: 'inline-block', textAlign: 'center' }}>
        {state === 'done' ? '✓' : state === 'active' ? <span style={{ animation: 'blink 700ms ease-in-out infinite' }}>▸</span> : '·'}
      </span>
      <span style={{ letterSpacing: '0.02em' }}>{label}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Run badge in the navbar
// ──────────────────────────────────────────────────────────────────────────────
function RunBadge({ runState, runCount }: { runState: RunState; runCount: number }) {
  if (runState.kind === 'idle') {
    return (
      <span style={{ ...mono, fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999 }}>
        ready
      </span>
    );
  }
  if (runState.kind === 'requesting') {
    return (
      <span style={{ ...mono, fontSize: 10, color: '#ffb84d', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 10px', border: '1px solid rgba(255,184,77,0.35)', borderRadius: 999, background: 'rgba(255,184,77,0.06)' }}>
        ⏳ live · run {runCount}
      </span>
    );
  }
  if (runState.kind === 'replaying') {
    return (
      <span style={{ ...mono, fontSize: 10, color: '#c8f542', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 10px', border: '1px solid rgba(200,245,66,0.35)', borderRadius: 999, background: 'rgba(200,245,66,0.06)', animation: 'blink 1.2s ease-in-out infinite' }}>
        live · run {runCount}
      </span>
    );
  }
  if (runState.kind === 'finished') {
    return (
      <span style={{ ...mono, fontSize: 10, color: '#c8f542', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 10px', border: '1px solid rgba(200,245,66,0.35)', borderRadius: 999, background: 'rgba(200,245,66,0.06)' }}>
        ✓ run {runCount} ok
      </span>
    );
  }
  return (
    <span style={{ ...mono, fontSize: 10, color: '#ff8a8a', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 10px', border: '1px solid rgba(255,138,138,0.35)', borderRadius: 999, background: 'rgba(255,138,138,0.06)' }}>
      ⚠ run {runCount} failed
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Reasoning panel
// ──────────────────────────────────────────────────────────────────────────────
function ReasoningPanel({
  lines,
  phase,
  active,
}: {
  lines: typeof REASONING_LINES;
  phase: Phase;
  active: boolean;
}) {
  return (
    <Panel
      label="agent reasoning"
      tag="cot · scripted"
      tagColor="#c8f542"
      icon={<AgentIcon />}
    >
      <div
        style={{
          ...mono,
          fontSize: 12.5,
          lineHeight: 1.7,
          color: '#dcdcdc',
          minHeight: 240,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {!active && (
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>
            click <span style={{ color: '#c8f542' }}>generate keys & run</span> to start a real round-trip.
          </span>
        )}
        {active && lines.length === 0 && (
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>waiting for first thought…</span>
        )}
        {lines.map((l, i) => (
          <div
            key={`${phase}-${i}-${l.line}`}
            style={{
              animation: 'lineEnter 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <span
              style={{
                ...mono,
                fontSize: 10,
                color:
                  l.kind === 'final' ? '#c8f542' : l.kind === 'action' ? '#6ab0ff' : l.kind === 'observe' ? '#ffb84d' : 'rgba(255,255,255,0.35)',
                marginTop: 3,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                flexShrink: 0,
                width: 56,
              }}
            >
              {l.kind === 'final' ? 'reply' : l.kind === 'action' ? 'tool' : l.kind === 'observe' ? 'observe' : 'thought'}
            </span>
            <span
              style={{
                color: l.kind === 'final' ? '#f0f0f0' : '#cfcfcf',
                fontWeight: l.kind === 'final' ? 500 : 400,
              }}
            >
              {l.line}
            </span>
          </div>
        ))}
        {active && phase !== 'done' && (
          <span style={{ display: 'inline-block', width: 7, height: 14, background: '#c8f542', animation: 'blink 800ms steps(2) infinite', marginTop: 4 }} />
        )}
      </div>
    </Panel>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Info panel — shows the REAL MCP response
// ──────────────────────────────────────────────────────────────────────────────
function InfoPanel({ phase, mcpResult }: { phase: Phase; mcpResult: unknown }) {
  const showBody = phaseAtLeast(phase, 'return') && mcpResult !== null && mcpResult !== undefined;
  return (
    <Panel
      label="information retrieved"
      tag="mcp · pay_and_fetch"
      tagColor="#6ab0ff"
      icon={<MCPIcon />}
    >
      <div style={{ minHeight: 240, position: 'relative', overflow: 'auto', maxHeight: 420 }}>
        {!showBody && (
          <div
            style={{
              ...mono,
              fontSize: 12,
              color: 'rgba(255,255,255,0.35)',
              padding: '60px 0',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10, color: 'rgba(255,255,255,0.28)' }}>
              awaiting verified call
            </div>
            <div>
              {phase === 'forward'
                ? 'forwarding to xmcp-x402-sim…'
                : phase === 'exec_tool'
                ? 'mcp running x402 round-trip…'
                : 'no data yet'}
            </div>
          </div>
        )}
        {showBody && (
          <pre
            style={{
              ...mono,
              fontSize: 12,
              lineHeight: 1.65,
              color: '#e8e8e8',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              animation: 'lineEnter 380ms cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          >
{formatJson(mcpResult)}
          </pre>
        )}
      </div>
    </Panel>
  );
}

function formatJson(obj: unknown): React.ReactNode {
  let s: string;
  try {
    s = JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
  if (typeof s !== 'string') return String(obj);
  const parts: React.ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(\b\d+(?:\.\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    if (m[1] && m[2]) {
      parts.push(<span key={key++} style={{ color: '#c8f542' }}>{m[1]}</span>);
      parts.push(<span key={key++}>{m[2]}</span>);
    } else if (m[1]) {
      parts.push(<span key={key++} style={{ color: '#ffb84d' }}>{m[1]}</span>);
    } else if (m[3]) {
      parts.push(<span key={key++} style={{ color: '#6ab0ff' }}>{m[3]}</span>);
    } else if (m[4]) {
      parts.push(<span key={key++} style={{ color: '#d4a3ff' }}>{m[4]}</span>);
    }
    last = re.lastIndex;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}

// ──────────────────────────────────────────────────────────────────────────────
// Payload panel — real signed payload + JWT preview
// ──────────────────────────────────────────────────────────────────────────────
function PayloadPanel({ phase, data }: { phase: Phase; data: RunResponse | null }) {
  const payloadVisible = phaseAtLeast(phase, 'sign');
  const tokenVisible = phaseAtLeast(phase, 'issue_token');

  const signedEvent = data?.trace.find((t) => t.phase === 'signed');
  const validatedEvent = data?.trace.find((t) => t.phase === 'validated');

  const realPayload = (signedEvent?.data?.payload as string | undefined) ?? '—';
  const realSigPreview = (signedEvent?.data?.signaturePreview as string | undefined) ?? '—';
  const realTokenPreview = data?.validate.tokenPreview ?? (validatedEvent?.data?.tokenPreview as string | undefined) ?? '—';
  const realExpires = data?.validate.expiresAt ?? '—';
  const agentName = data?.agent.name ?? 'demo-agent';

  return (
    <Panel
      label="signed payload"
      tag="POST /api/validate"
      tagColor="#c8f542"
      icon={<KeyIcon />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 240 }}>
        <div>
          <FieldLabel>HMAC payload (string-to-sign)</FieldLabel>
          <CodeChip>
            <span style={{ color: '#cfcfcf', wordBreak: 'break-all' }}>{realPayload}</span>
          </CodeChip>
        </div>
        <div style={{ opacity: payloadVisible ? 1 : 0.3, transition: 'opacity 250ms' }}>
          <FieldLabel>signature</FieldLabel>
          <CodeChip mono>
            <span style={{ color: '#ffb84d' }}>sha256</span>{' '}
            <span style={{ color: '#dcdcdc' }}>{realSigPreview}</span>
          </CodeChip>
        </div>
        <div style={{ opacity: tokenVisible ? 1 : 0.25, transition: 'opacity 300ms' }}>
          <FieldLabel>scoped jwt issued by zero</FieldLabel>
          <CodeChip mono accent>
            <span style={{ color: '#c8f542' }}>{realTokenPreview}</span>
          </CodeChip>
          <div style={{ ...mono, fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
            agent: {agentName} · expires: {realExpires}
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Trail panel — synthesizes events from real trace timeline
// ──────────────────────────────────────────────────────────────────────────────
function TrailPanel({ phase, data }: { phase: Phase; data: RunResponse | null }) {
  const ev = (name: string) => data?.trace.find((t) => t.phase === name);
  const validateEv = ev('validated');
  const initEv = ev('mcp_init');
  const responseEv = ev('mcp_response');

  const events: { phase: Phase; label: string; live?: boolean }[] = [
    {
      phase: 'send',
      label: validateEv ? `request received at /api/validate · ${validateEv.ts_ms}ms` : 'request received at /api/validate',
    },
    { phase: 'verify_ts', label: 'timestamp delta within ±5min · ok' },
    { phase: 'verify_nonce', label: 'nonce stored · not seen in last 5min' },
    { phase: 'verify_hmac', label: 'HMAC-SHA256 match (constant-time)' },
    {
      phase: 'issue_token',
      label: data?.validate.tokenPreview
        ? `JWT minted · ${data.validate.tokenPreview}`
        : 'JWT minted · scoped',
    },
    {
      phase: 'forward',
      label: initEv
        ? `mcp initialized · ${(initEv.data?.server as { name?: string } | undefined)?.name ?? 'xmcp'}`
        : 'POST /mcp tools/call pay_and_fetch',
    },
    {
      phase: 'exec_tool',
      label: 'mcp running x402 dance: 402 → payload → verify → settle',
      live: true,
    },
    {
      phase: 'return',
      label: responseEv ? `mcp 200 OK · ${responseEv.ts_ms}ms total` : 'mcp 200 OK',
    },
    { phase: 'finalize', label: 'audit log entry written' },
  ];

  return (
    <Panel
      label="security trail"
      tag={data ? 'audit · live' : 'audit · pending'}
      tagColor="#c8f542"
      icon={<ShieldIcon />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 240 }}>
        {events.map((e) => {
          const reached = phaseAtLeast(phase, e.phase);
          return (
            <div
              key={e.phase}
              style={{
                ...mono,
                fontSize: 11.5,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                opacity: reached ? 1 : 0.25,
                color: reached ? '#dcdcdc' : 'rgba(255,255,255,0.4)',
                transition: 'opacity 220ms ease, color 220ms ease',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  marginTop: 5,
                  background: reached ? (e.live && phase === e.phase ? '#ffb84d' : '#c8f542') : 'rgba(255,255,255,0.18)',
                  boxShadow: reached && phase === e.phase ? '0 0 10px currentColor' : 'none',
                  animation: phase === e.phase ? 'blink 700ms ease-in-out infinite' : 'none',
                  flexShrink: 0,
                }}
              />
              <span>{e.label}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Reusable bits
// ──────────────────────────────────────────────────────────────────────────────
function Panel({
  label,
  tag,
  tagColor,
  icon,
  children,
}: {
  label: string;
  tag: string;
  tagColor: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(13,13,13,0.65), rgba(8,8,8,0.6))',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: '20px 22px',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#cfcfcf',
            }}
          >
            {icon}
          </div>
          <div style={{ ...grotesk, fontSize: 13, fontWeight: 500, color: '#f0f0f0', letterSpacing: '-0.01em', textTransform: 'lowercase' }}>{label}</div>
        </div>
        <span
          style={{
            ...mono,
            fontSize: 9.5,
            color: tagColor,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            padding: '3px 8px',
            border: `1px solid ${tagColor}33`,
            borderRadius: 999,
            background: `${tagColor}0d`,
          }}
        >
          {tag}
        </span>
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.42)', marginBottom: 6 }}>{children}</div>
  );
}

function CodeChip({ children, mono: _monoOnly, accent }: { children: React.ReactNode; mono?: boolean; accent?: boolean }) {
  return (
    <div
      style={{
        ...mono,
        fontSize: 11.5,
        background: accent ? 'rgba(200,245,66,0.05)' : '#080808',
        border: accent ? '1px solid rgba(200,245,66,0.22)' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8,
        padding: '10px 12px',
        color: '#dcdcdc',
        wordBreak: 'break-all',
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Icons
// ──────────────────────────────────────────────────────────────────────────────
function AgentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 3a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 3 4 6v6c0 4.5 3.2 8.5 8 9 4.8-.5 8-4.5 8-9V6l-8-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function MCPIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 10h.01M7 14h.01M11 10h6M11 14h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="14" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="m11 13 9-9m-3 3 2 2m-4 0 2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
