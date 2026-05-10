'use client';

import { useEffect, useMemo, useRef, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Check, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  agentsApi, kycApi, auditApi, keysApi,
  Agent, AgentType, AuditLog, ApiKey,
} from '@/lib/api';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };
const grotesk: React.CSSProperties = { fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif' };

const PLATFORMS = [
  { value: 'all', label: 'All platforms', icon: '∞' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '◎' },
  { value: 'telegram', label: 'Telegram', icon: '◈' },
  { value: 'slack', label: 'Slack', icon: '◆' },
  { value: 'api', label: 'Direct API', icon: '⟨⟩' },
  { value: 'custom', label: 'Custom', icon: '◇' },
];

const TYPES: { value: AgentType; label: string; icon: string; hint: string }[] = [
  { value: 'agent', label: 'Agent', icon: '◎', hint: 'Platform-bound, gets an API key' },
  { value: 'mcp', label: 'MCP server', icon: '⬡', hint: 'URL endpoint for tool calls' },
];

const RESULT_COLORS: Record<string, string> = {
  SUCCESS: '#c8f542',
  BLOCKED_INVALID_KEY: '#ff5c5c',
  BLOCKED_RULE: '#ff5c5c',
  BLOCKED_SCOPE: '#ff5c5c',
  BLOCKED_REVOKED: '#8a8a8a',
};

function platformOf(value: string) {
  return PLATFORMS.find(x => x.value === value) ?? { value, label: value, icon: '◇' };
}

function StatusPill({ status }: { status: 'ACTIVE' | 'DISABLED' | 'REVOKED' | string }) {
  const active = status === 'ACTIVE';
  return (
    <span className={`pill-base ${active ? 'pill-active' : 'pill-disabled'}`}>
      <span style={{ fontSize: 7, animation: active ? 'pulse 2s ease-in-out infinite' : 'none' }}>
        {active ? '●' : '○'}
      </span>
      {active ? 'active' : status.toLowerCase()}
    </span>
  );
}

function AgentGlyph({ type }: { type: AgentType }) {
  const isMcp = type === 'mcp';
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 9,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isMcp ? 'rgba(200,245,66,0.06)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${isMcp ? 'rgba(200,245,66,0.18)' : 'rgba(255,255,255,0.08)'}`,
      color: isMcp ? 'var(--accent)' : 'var(--text-dim)',
      fontSize: 16, flexShrink: 0,
    }}>
      {isMcp ? '⬡' : '◎'}
    </div>
  );
}

function ResultBadge({ result }: { result: string }) {
  const color = RESULT_COLORS[result] ?? '#8a8a8a';
  return (
    <span style={{
      ...mono, fontSize: 10, letterSpacing: '0.05em',
      padding: '3px 8px', borderRadius: 999,
      background: `${color}11`, color, border: `1px solid ${color}33`,
    }}>
      {result === 'SUCCESS' ? '✓ success' : result.replace('BLOCKED_', '').toLowerCase()}
    </span>
  );
}

/* ─── Inline copy field ─── */

function InlineCopy({ value, mask }: { value: string; mask?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!mask);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }
  const display = revealed
    ? value
    : value.length > 14
      ? `${value.slice(0, 8)}${'•'.repeat(8)}${value.slice(-4)}`
      : '•'.repeat(value.length);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
      <code style={{
        ...mono, fontSize: 13.5, color: 'var(--text)',
        background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-strong)',
        padding: '10px 14px', borderRadius: 999, flex: 1,
        wordBreak: 'break-all', lineHeight: 1.5,
      }}>{display}</code>
      {mask && (
        <button
          onClick={() => setRevealed(r => !r)}
          aria-label={revealed ? 'Hide' : 'Reveal'}
          style={{
            padding: 10, borderRadius: 999, cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-dim)',
            transition: 'all 120ms ease', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}
      <button
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy'}
        style={{
          padding: 10, borderRadius: 999, cursor: 'pointer',
          background: copied ? 'rgba(200,245,66,0.12)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${copied ? 'rgba(200,245,66,0.3)' : 'rgba(255,255,255,0.1)'}`,
          color: copied ? 'var(--accent)' : 'var(--text-dim)',
          transition: 'all 120ms ease', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  );
}

function CopyReveal({ label, value, hint, onDismiss, mask }: {
  label: string; value: string; hint?: string; onDismiss: () => void; mask?: boolean;
}) {
  return (
    <div className="key-reveal fade-in" style={{ marginBottom: 28 }}>
      <p style={{ ...mono, fontSize: 13, color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 9 }}>
        <span>⬡</span> {label}
        {hint && <span style={{ ...mono, fontSize: 12, color: 'var(--text-faint)', textTransform: 'none', letterSpacing: 0 }}>· {hint}</span>}
      </p>
      <InlineCopy value={value} mask={mask} />
      <button onClick={onDismiss} style={{
        ...mono, fontSize: 13, color: 'var(--text-faint)', marginTop: 12,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      }}>Dismiss</button>
    </div>
  );
}

/* ─── Sparkline (hero) ─── */

function Sparkline({ logs, height = 48 }: { logs: AuditLog[]; height?: number }) {
  const days = 14;
  const data = useMemo(() => {
    const buckets: number[] = new Array(days).fill(0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const startMs = today.getTime() - (days - 1) * 86400000;
    for (const log of logs) {
      const t = new Date(log.created_at).getTime();
      const i = Math.floor((t - startMs) / 86400000);
      if (i >= 0 && i < days) buckets[i] += 1;
    }
    return buckets;
  }, [logs]);

  const max = Math.max(1, ...data);
  const W = 100, H = height;
  const stepX = W / (data.length - 1);
  const points = data.map((v, i) => `${(i * stepX).toFixed(2)},${(H - (v / max) * H).toFixed(2)}`).join(' ');
  const area = `0,${H} ${points} ${W},${H}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(200,245,66,0.28)" />
          <stop offset="100%" stopColor="rgba(200,245,66,0)" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sparkfill)" />
      <polyline points={points} fill="none" stroke="rgba(200,245,66,0.85)" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ─── Activity chart (legacy, kept for /agents/[id]) ─── */

function ActivityChart({ logs }: { logs: AuditLog[] }) {
  const days = 14;
  const data = useMemo(() => {
    const buckets: { key: string; label: string; success: number; blocked: number }[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.push({
        key,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        success: 0, blocked: 0,
      });
    }
    const idx = Object.fromEntries(buckets.map((b, i) => [b.key, i]));
    for (const log of logs) {
      const k = log.created_at.slice(0, 10);
      const i = idx[k];
      if (i === undefined) continue;
      if (log.result === 'SUCCESS') buckets[i].success += 1;
      else buckets[i].blocked += 1;
    }
    return buckets;
  }, [logs]);

  const max = Math.max(1, ...data.map(d => d.success + d.blocked));
  const total = data.reduce((s, d) => s + d.success + d.blocked, 0);
  const successTotal = data.reduce((s, d) => s + d.success, 0);
  const blockedTotal = total - successTotal;

  const W = 720, H = 110, padX = 14, padY = 12;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const barW = innerW / data.length - 6;

  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', gap: 22, marginBottom: 10, flexWrap: 'wrap' }}>
        <Stat label="14-day total" value={total.toLocaleString()} />
        <Stat label="Success" value={successTotal.toLocaleString()} />
        <Stat label="Blocked" value={blockedTotal.toLocaleString()} />
        <Stat label="Success rate" value={total ? `${Math.round((successTotal / total) * 100)}%` : '—'} />
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" style={{ display: 'block', minWidth: 480 }}>
          {/* gridlines */}
          {[0.25, 0.5, 0.75, 1].map(t => (
            <line
              key={t}
              x1={padX} x2={W - padX}
              y1={padY + innerH * (1 - t)} y2={padY + innerH * (1 - t)}
              stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4"
            />
          ))}
          {data.map((d, i) => {
            const x = padX + i * (innerW / data.length) + 3;
            const totalH = ((d.success + d.blocked) / max) * innerH;
            const successH = (d.success / max) * innerH;
            const blockedH = (d.blocked / max) * innerH;
            const yTop = padY + innerH - totalH;
            return (
              <g key={d.key}>
                {/* blocked stack (top) */}
                {d.blocked > 0 && (
                  <rect
                    x={x} y={yTop} width={barW} height={blockedH}
                    fill="rgba(255,92,92,0.55)" rx={2}
                  >
                    <title>{`${d.label}: ${d.blocked} blocked`}</title>
                  </rect>
                )}
                {/* success stack (bottom) */}
                {d.success > 0 && (
                  <rect
                    x={x} y={yTop + blockedH} width={barW} height={successH}
                    fill="rgba(200,245,66,0.7)" rx={2}
                  >
                    <title>{`${d.label}: ${d.success} success`}</title>
                  </rect>
                )}
                {/* empty placeholder */}
                {d.success + d.blocked === 0 && (
                  <rect
                    x={x} y={padY + innerH - 2} width={barW} height={2}
                    fill="rgba(255,255,255,0.05)" rx={1}
                  />
                )}
                {(i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) && (
                  <text
                    x={x + barW / 2} y={H + 14}
                    textAnchor="middle"
                    style={{ ...mono, fontSize: 10 } as React.CSSProperties}
                    fill="var(--text-faint)"
                  >
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ ...mono, fontSize: 9.5, color: 'var(--text-faint)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ ...grotesk, fontSize: 17, fontWeight: 500, letterSpacing: '-0.02em', color: color ?? 'var(--text)' }}>
        {value}
      </div>
    </div>
  );
}

/* ─── Create agent wizard (kept from prior version) ─── */

type WizardStep = 'name' | 'ready';

function SystemBubble({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div className="fade-in" style={{
      animationDelay: `${delay}ms`, animationFillMode: 'both',
      display: 'flex', alignItems: 'flex-start', gap: 10, maxWidth: '85%',
    }}>
      <span style={{ ...mono, fontSize: 13, color: 'var(--accent)', letterSpacing: '0.04em', paddingTop: 5, flexShrink: 0 }}>
        zero<span style={{ opacity: 0.7 }}>·</span>
      </span>
      <div style={{ ...grotesk, fontSize: 18, color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1.45 }}>
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children, onEdit }: { children: React.ReactNode; onEdit?: () => void }) {
  return (
    <div className="fade-in" style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <button type="button" onClick={onEdit} disabled={!onEdit} style={{
        ...mono, fontSize: 15, color: 'var(--accent)',
        background: 'rgba(200,245,66,0.08)',
        border: '1px solid rgba(200,245,66,0.25)',
        borderRadius: 999, padding: '9px 18px', cursor: onEdit ? 'pointer' : 'default',
        display: 'inline-flex', alignItems: 'center', gap: 10,
      }}>
        {children}
        {onEdit && <span style={{ fontSize: 12, opacity: 0.55 }}>edit</span>}
      </button>
    </div>
  );
}

function CreateAgentWizard({
  onClose, onSubmit,
}: {
  onClose: () => void;
  onSubmit: (values: { name: string; type: AgentType; platform: string }) => Promise<void>;
}) {
  const [step, setStep] = useState<WizardStep>('name');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
  }, [step]);

  function commitName(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setStep('ready');
  }

  async function submit() {
    if (!name) return;
    setCreating(true); setError('');
    try { await onSubmit({ name: name.trim(), type: 'agent', platform: 'all' }); }
    catch (err) { setError((err as Error).message ?? 'Something went wrong'); setCreating(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box fade-in" style={{ maxWidth: 520, padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '82vh' }}>
        <div style={{
          padding: '18px 22px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 10px rgba(200,245,66,0.5)', animation: 'pulse 2s ease-in-out infinite' }} />
            <h2 style={{ ...grotesk, fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>new agent</h2>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, padding: '4px 6px',
          }}>✕</button>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SystemBubble>What should we call your new agent?</SystemBubble>

          {step === 'name' ? (
            <form onSubmit={commitName} className="fade-in" style={{ display: 'flex', gap: 8, alignItems: 'stretch', paddingLeft: 36 }}>
              <input className="z-input" value={name} onChange={e => setName(e.target.value)}
                placeholder="Sales Bot, Support Agent…" autoFocus style={{ flex: 1 }} />
              <button type="submit" disabled={!name.trim()} className="btn btn-primary" style={mono}>Continue</button>
            </form>
          ) : (
            <UserBubble onEdit={() => setStep('name')}>{name}</UserBubble>
          )}

          {step === 'ready' && (
            <>
              <SystemBubble delay={150}>Ready when you are.</SystemBubble>
              <div className="fade-in" style={{ paddingLeft: 36, animationDelay: '300ms', animationFillMode: 'both' }}>
                {error && (
                  <div className="form-error" style={{ marginBottom: 12 }}>
                    <span>⚠</span> {error}
                  </div>
                )}
                <button type="button" onClick={submit} disabled={creating} className="btn btn-primary" style={mono}>
                  {creating ? 'Creating…' : 'Create agent'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─── */

export default function DashboardPage() {
  const { token, userId, displayName } = useAuth();
  const router = useRouter();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [reveal, setReveal] = useState<
    | { kind: 'credentials'; agentId: string; apiSecret: string; plainKey?: string }
    | { kind: 'url'; url: string }
    | null
  >(null);
  const [kycBlocked, setKycBlocked] = useState(false);
  const [kycUrl, setKycUrl] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<Agent | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [keysOpen, setKeysOpen] = useState<Record<string, boolean>>({});

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [a, k, l] = await Promise.all([
        agentsApi.list(token),
        keysApi.list(token).catch(() => [] as ApiKey[]),
        auditApi.list(token, { limit: '100' }).catch(() => [] as AuditLog[]),
      ]);
      setAgents(a); setKeys(k); setLogs(l);
    } catch { /* layout auth gate handles 401 */ }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [token]);

  async function handleCreate(values: { name: string; type: AgentType; platform: string }) {
    if (!token) return;
    try {
      const result = await agentsApi.create(token, values);
      if (values.type === 'mcp' && result.agent.mcp_url) {
        setReveal({ kind: 'url', url: result.agent.mcp_url });
      } else {
        setReveal({
          kind: 'credentials',
          agentId: result.agent.id,
          apiSecret: result.apiSecret,
          plainKey: result.key?.plainKey,
        });
      }
      setShowCreate(false);
      await load();
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.message === 'kyc_required' || e.status === 403) {
        setShowCreate(false);
        setKycBlocked(true);
        try {
          const s = await kycApi.status(token);
          if (s.session_url) setKycUrl(s.session_url);
        } catch {}
        return;
      }
      throw err;
    }
  }

  async function handleDelete(agent: Agent) {
    if (!token || deleteConfirm !== agent.name) return;
    setDeleting(agent.id);
    try {
      await agentsApi.disable(token, agent.id);
      setShowDelete(null); setDeleteConfirm('');
      await load();
    } finally {
      setDeleting(null);
    }
  }

  function keysFor(agentId: string) {
    return keys.filter(k => k.agent_id === agentId);
  }

  const activeAgents = agents.filter(a => a.status === 'ACTIVE');
  const userHash = userId ?? '';

  const totalCalls = logs.length;
  const blockedCalls = logs.filter(l => l.result !== 'SUCCESS').length;
  const successCalls = totalCalls - blockedCalls;
  const successRate = totalCalls === 0 ? null : (successCalls / totalCalls) * 100;
  const heroPct = successRate === null ? '—' : successRate.toFixed(1);

  const callsByAgent = useMemo(() => {
    const m = new Map<string, number>();
    for (const log of logs) {
      const key = (log as unknown as { agent_id?: string }).agent_id ?? '';
      if (key) m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [logs]);

  const sectionLabel: React.CSSProperties = {
    ...mono, fontSize: 10, color: 'var(--text-faint)',
    letterSpacing: '0.16em', textTransform: 'uppercase' as const,
    margin: 0,
  };
  const hairline: React.CSSProperties = {
    height: 1, background: 'rgba(255,255,255,0.06)',
    margin: 0, border: 0,
  };

  return (
    <div style={{
      height: '100dvh', overflow: 'hidden',
      padding: '28px 56px 24px', maxWidth: 1280, margin: '0 auto',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Thin top header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, paddingBottom: 16,
      }}>
        <span style={{ ...grotesk, fontSize: 19, fontWeight: 600, letterSpacing: '-0.05em' }}>
          zero<span style={{ color: 'var(--accent)' }}>.</span>
        </span>
        <span style={{ ...mono, fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          {displayName ? displayName.split(' ')[0].toLowerCase() : ''}
        </span>
      </div>

      {/* Reveal banners */}
      {reveal?.kind === 'credentials' && (
        <div className="key-reveal fade-in" style={{ marginBottom: 28 }}>
          <p style={{ ...mono, fontSize: 13, color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 9 }}>
            <span>⬡</span> Agent created — credentials
            <span style={{ ...mono, fontSize: 12, color: 'var(--text-faint)', textTransform: 'none', letterSpacing: 0 }}>
              · use these in <code style={{ color: 'var(--text-dim)' }}>X-Zero-Agent-Id</code> + <code style={{ color: 'var(--text-dim)' }}>X-Zero-Api-Secret</code>
            </span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <p style={{ ...mono, fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>agent id</p>
              <InlineCopy value={reveal.agentId} />
            </div>
            <div>
              <p style={{ ...mono, fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>api secret (HMAC)</p>
              <InlineCopy value={reveal.apiSecret} mask />
            </div>
          </div>
          <button onClick={() => setReveal(null)} style={{
            ...mono, fontSize: 13, color: 'var(--text-faint)', marginTop: 14,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}>Dismiss</button>
        </div>
      )}
      {reveal?.kind === 'url' && (
        <CopyReveal label="MCP endpoint" hint="point your MCP client at this URL" value={reveal.url} onDismiss={() => setReveal(null)} />
      )}

      {/* KYC banner */}
      {kycBlocked && (
        <div className="kyc-banner fade-in">
          <div>
            <p style={{ ...mono, fontSize: 13, color: '#ffb84d', marginBottom: 4 }}>Identity verification required</p>
            <p style={{ fontSize: 13.5, color: 'var(--text-dim)' }}>
              You need to verify your identity before creating agents.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {kycUrl && (
              <a href={kycUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={mono}>Continue</a>
            )}
            <button className="btn btn-primary" style={mono} onClick={() => router.push('/kyc')}>Verify now</button>
          </div>
        </div>
      )}

      {/* HERO */}
      <section style={{ flexShrink: 0, padding: '8px 0 28px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={sectionLabel}>success rate · last 14 days</p>
          <button
            onClick={() => { setShowCreate(true); setKycBlocked(false); }}
            className="btn btn-primary"
            style={mono}
          >
            New agent
          </button>
        </div>

        <div style={{
          ...grotesk, fontSize: 92, fontWeight: 500, letterSpacing: '-0.05em',
          lineHeight: 1, marginTop: 6,
          fontVariantNumeric: 'tabular-nums' as const,
        }}>
          {heroPct}<span style={{ color: 'var(--accent)', marginLeft: 4 }}>%</span>
        </div>

        <div style={{ marginTop: 14, height: 48 }}>
          <Sparkline logs={logs} height={48} />
        </div>

        <p style={{
          ...mono, fontSize: 12.5, color: 'var(--text-muted)',
          marginTop: 14, letterSpacing: '0.02em',
          display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span>{totalCalls.toLocaleString()} calls</span>
          <span style={{ color: 'var(--text-faint)' }}>·</span>
          <span>{blockedCalls} blocked</span>
          <span style={{ color: 'var(--text-faint)' }}>·</span>
          <span>{activeAgents.length} active agent{activeAgents.length === 1 ? '' : 's'}</span>
        </p>
      </section>

      <hr style={hairline} />

      {/* Body: agents | live feed */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
      }}>
        {/* Agents */}
        <section style={{
          paddingRight: 36, borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '20px 0 8px' }}>
            <p style={sectionLabel}>agents</p>
            <span style={{ ...mono, fontSize: 10.5, color: 'var(--text-faint)', letterSpacing: '0.06em' }}>
              {activeAgents.length} of {agents.length}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginRight: -8, paddingRight: 8 }}>
            {loading ? (
              <p style={{ ...mono, fontSize: 12, color: 'var(--text-faint)', padding: '24px 0' }}>loading agents…</p>
            ) : agents.length === 0 ? (
              <div style={{ padding: '32px 0' }}>
                <p style={{ ...grotesk, fontSize: 18, fontWeight: 500, marginBottom: 6, color: 'var(--text-dim)' }}>No agents yet</p>
                <p style={{ ...mono, fontSize: 12.5, color: 'var(--text-faint)', marginBottom: 16 }}>
                  Create your first agent — an MCP server or platform bot.
                </p>
                <button onClick={() => { setShowCreate(true); setKycBlocked(false); }} className="btn btn-primary" style={mono}>
                  New agent
                </button>
              </div>
            ) : (
              agents.map(a => {
                const isMcp = a.type === 'mcp';
                const isActive = a.status === 'ACTIVE';
                const callsForAgent = callsByAgent.get(a.id) ?? 0;
                return (
                  <Link
                    key={a.id}
                    href={`/agents/${a.id}`}
                    style={{
                      display: 'grid', gridTemplateColumns: '40px 1fr auto',
                      alignItems: 'center', gap: 16,
                      padding: '18px 4px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      textDecoration: 'none', color: 'inherit',
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <AgentGlyph type={a.type} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...grotesk, fontSize: 16, fontWeight: 500, letterSpacing: '-0.015em', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.name}
                      </div>
                      <div style={{ ...mono, fontSize: 11.5, color: 'var(--text-faint)', marginTop: 4, letterSpacing: '0.01em' }}>
                        {isMcp ? 'mcp' : `${a.platform} agent`}
                        <span style={{ opacity: 0.4, margin: '0 6px' }}>·</span>
                        {callsForAgent} call{callsForAgent === 1 ? '' : 's'}
                      </div>
                    </div>
                    <span style={{
                      ...mono, fontSize: 11,
                      color: isActive ? 'var(--accent)' : 'var(--text-faint)',
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      letterSpacing: '0.04em',
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.18)',
                        boxShadow: isActive ? '0 0 8px rgba(200,245,66,0.5)' : 'none',
                      }} />
                      {isActive ? 'ok' : a.status.toLowerCase()}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        {/* Live feed */}
        <section style={{
          paddingLeft: 36,
          display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '20px 0 8px' }}>
            <p style={sectionLabel}>live</p>
            <span style={{ ...mono, fontSize: 10.5, color: 'var(--text-faint)', display: 'inline-flex', alignItems: 'center', gap: 6, letterSpacing: '0.06em' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px rgba(200,245,66,0.5)', animation: 'pulse 2s ease-in-out infinite' }} />
              streaming
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginRight: -8, paddingRight: 8 }}>
            {logs.length === 0 ? (
              <p style={{ ...mono, fontSize: 12, color: 'var(--text-faint)', padding: '24px 0' }}>
                nothing yet — actions will appear as agents run.
              </p>
            ) : (
              logs.slice(0, 60).map((log, i) => {
                const isBlocked = log.result !== 'SUCCESS';
                const fade = 1 - Math.min(i / 25, 0.55);
                return (
                  <div
                    key={log.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '12px 1fr auto',
                      alignItems: 'center', gap: 14,
                      padding: '11px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      opacity: fade,
                    }}
                  >
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: isBlocked ? '#ff5c5c' : 'var(--accent)',
                      justifySelf: 'center',
                      boxShadow: isBlocked ? '0 0 6px rgba(255,92,92,0.45)' : '0 0 6px rgba(200,245,66,0.4)',
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        ...mono, fontSize: 12.5, color: 'var(--text)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {log.action}
                        {isBlocked && <span style={{ color: '#ff8a8a', marginLeft: 8, fontSize: 10.5, letterSpacing: '0.04em' }}>blocked</span>}
                      </div>
                      <div style={{ ...mono, fontSize: 10.5, color: 'var(--text-faint)', marginTop: 2, letterSpacing: '0.02em' }}>
                        {log.platform}
                      </div>
                    </div>
                    <span style={{ ...mono, fontSize: 10.5, color: 'var(--text-faint)', letterSpacing: '0.02em' }}>
                      {new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <hr style={hairline} />

      {/* Footer: user hash + audit log */}
      <div style={{
        flexShrink: 0, padding: '14px 0 0',
        display: 'flex', alignItems: 'center', gap: 18,
      }}>
        <span style={sectionLabel}>user hash</span>
        <span style={{ ...mono, fontSize: 12.5, color: 'var(--text-dim)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
          {userHash || 'loading…'}
        </span>
        {userHash && (
          <button
            onClick={() => navigator.clipboard.writeText(userHash)}
            aria-label="Copy user hash"
            style={{
              padding: 8, borderRadius: 999, cursor: 'pointer',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text-faint)',
              transition: 'all 120ms ease',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-dim)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
          >
            <Copy size={13} />
          </button>
        )}
        <Link
          href="/audit-log"
          style={{ ...mono, fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none', letterSpacing: '0.06em' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-dim)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          view audit log →
        </Link>
      </div>

      {/* Wizard */}
      {showCreate && (
        <CreateAgentWizard onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
      )}

      {/* Delete agent modal */}
      {showDelete && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDelete(null)}>
          <div className="modal-box fade-in">
            <h2 style={{ ...grotesk, fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 6, color: 'var(--danger)' }}>
              Delete agent
            </h2>
            <p style={{ ...mono, fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
              This revokes <span style={{ color: 'var(--text-dim)' }}>all keys</span> for this agent and stops it from validating.
              Audit history is preserved.
            </p>
            <p style={{ ...mono, fontSize: 13, color: 'var(--text-faint)', marginBottom: 10 }}>
              Type <span style={{ color: 'var(--text-dim)' }}>{showDelete.name}</span> to confirm:
            </p>
            <div className="field">
              <input
                className="z-input"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={showDelete.name}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button type="button" onClick={() => setShowDelete(null)} className="btn btn-secondary" style={{ flex: 1, ...mono }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(showDelete)}
                disabled={deleting === showDelete.id || deleteConfirm !== showDelete.name}
                className="btn btn-danger"
                style={{ flex: 2, ...mono }}
              >
                {deleting === showDelete.id ? 'Deleting…' : 'Delete agent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
