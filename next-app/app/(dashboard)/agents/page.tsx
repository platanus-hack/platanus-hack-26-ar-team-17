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

/* ─── Section header ─── */

function SectionHeader({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, gap: 16 }}>
      <div>
        <h2 style={{ ...grotesk, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--text)' }}>
          {title}
        </h2>
        {hint && (
          <p style={{ ...mono, fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ─── Activity chart (Metabase-style) ─── */

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

  const W = 720, H = 180, padX = 16, padY = 16;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const barW = innerW / data.length - 6;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--z-border)',
      borderRadius: 12, padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', gap: 28, marginBottom: 14, flexWrap: 'wrap' }}>
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
      <div style={{ ...mono, fontSize: 10.5, color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ ...grotesk, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: color ?? 'var(--text)' }}>
        {value}
      </div>
    </div>
  );
}

/* ─── Create agent wizard (kept from prior version) ─── */

type WizardStep = 'name' | 'platform' | 'ready';

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
  const [platform, setPlatform] = useState<string | null>(null);
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
    setStep('platform');
  }
  function pickPlatform(p: string) { setPlatform(p); setStep('ready'); }

  async function submit() {
    if (!name || !platform) return;
    setCreating(true); setError('');
    try { await onSubmit({ name: name.trim(), type: 'agent', platform }); }
    catch (err) { setError((err as Error).message ?? 'Something went wrong'); setCreating(false); }
  }

  const platformMeta = platform
    ? (PLATFORMS.find(p => p.value === platform) ?? null)
    : null;

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
            <UserBubble onEdit={() => { setStep('name'); setPlatform(null); }}>{name}</UserBubble>
          )}

          {(step === 'platform' || step === 'ready') && (
            <>
              <SystemBubble>Where will it live?</SystemBubble>
              {step === 'platform' ? (
                <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, paddingLeft: 36 }}>
                  {PLATFORMS.map(p => (
                    <button key={p.value} type="button" onClick={() => pickPlatform(p.value)} style={{
                      ...mono, fontSize: 14, padding: '13px 14px', borderRadius: 999, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                      color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                      <span style={{ opacity: 0.7 }}>{p.icon}</span>{p.label}
                    </button>
                  ))}
                </div>
              ) : platformMeta ? (
                <UserBubble onEdit={() => setStep('platform')}>
                  <span>{platformMeta.icon}</span> {platformMeta.label}
                </UserBubble>
              ) : null}
            </>
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
    | { kind: 'key'; plainKey: string }
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
      } else if (result.key) {
        setReveal({ kind: 'key', plainKey: result.key.plainKey });
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

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1040, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ ...mono, fontSize: 12, color: 'var(--accent)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
          {displayName ? `welcome back, ${displayName.split(' ')[0]?.toLowerCase()}` : 'control room'}
        </p>
        <h1 style={{ ...grotesk, fontSize: 38, fontWeight: 600, letterSpacing: '-0.035em', margin: '0 0 8px', lineHeight: 1.05 }}>
          Your agent control room<span style={{ color: 'var(--accent)' }}>.</span>
        </h1>
        <p style={{ ...mono, fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
          {activeAgents.length} active agent{activeAgents.length === 1 ? '' : 's'} · {logs.length} recent action{logs.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Reveal banners */}
      {reveal?.kind === 'key' && (
        <CopyReveal label="API key" value={reveal.plainKey} mask onDismiss={() => setReveal(null)} />
      )}
      {reveal?.kind === 'url' && (
        <CopyReveal label="MCP endpoint" hint="point your MCP client at this URL" value={reveal.url} onDismiss={() => setReveal(null)} />
      )}

      {/* KYC banner */}
      {kycBlocked && (
        <div className="kyc-banner fade-in" style={{ marginBottom: 28 }}>
          <div>
            <p style={{ ...mono, fontSize: 14, color: '#ffb84d', marginBottom: 6 }}>Identity verification required</p>
            <p style={{ fontSize: 15, color: 'var(--text-dim)' }}>
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

      {/* User hash card */}
      <section style={{ marginBottom: 36 }}>
        <SectionHeader
          title="Your account"
          hint="Use this hash to identify yourself across the platform."
        />
        <div style={{
          background: 'rgba(15,17,12,0.78)',
          border: '1px solid var(--border-strong)',
          borderRadius: 12, padding: '22px 24px',
          display: 'grid', gridTemplateColumns: '1fr', gap: 16,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 0 rgba(0,0,0,0.4)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}>
          <div>
            <p style={{ ...mono, fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              user hash
            </p>
            {userHash ? (
              <InlineCopy value={userHash} />
            ) : (
              <p style={{ ...mono, fontSize: 13, color: 'var(--text-muted)' }}>loading…</p>
            )}
          </div>
        </div>
      </section>

      {/* Activity chart */}
      <section style={{ marginBottom: 36 }}>
        <SectionHeader
          title="Activity"
          hint="Agent calls over the last 14 days — success vs blocked."
        />
        <ActivityChart logs={logs} />
      </section>

      {/* Agents */}
      <section style={{ marginBottom: 36 }}>
        <SectionHeader
          title="Agents"
          hint="Add or remove agents. Each agent has its own API key."
          action={
            <button
              onClick={() => { setShowCreate(true); setKycBlocked(false); }}
              className="btn btn-primary"
              style={mono}
            >
              New agent
            </button>
          }
        />

        {loading ? (
          <p style={{ ...mono, fontSize: 14, color: 'var(--text-faint)', padding: '40px 0', textAlign: 'center' }}>loading agents…</p>
        ) : agents.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '52px 20px',
            background: 'rgba(15,17,12,0.6)', border: '1px dashed var(--border-strong)', borderRadius: 12,
          }}>
            <div style={{ fontSize: 44, marginBottom: 14, opacity: 0.18 }}>◉</div>
            <p style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>No agents yet</p>
            <p style={{ ...mono, fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 22 }}>
              Create your first agent — an MCP server or platform bot
            </p>
            <button onClick={() => { setShowCreate(true); setKycBlocked(false); }} className="btn btn-primary" style={mono}>
              New agent
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {agents.map(a => {
              const p = platformOf(a.platform);
              const isMcp = a.type === 'mcp';
              const open = !!keysOpen[a.id];
              const aKeys = keysFor(a.id);
              const activeKey = aKeys.find(k => k.status === 'ACTIVE');
              return (
                <div
                  key={a.id}
                  style={{
                    background: 'rgba(15,17,12,0.78)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 12,
                    transition: 'border-color 150ms ease, background 150ms ease',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 1px 0 rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                  }}
                >
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr auto auto auto auto',
                    gap: 14, alignItems: 'center', padding: '16px 20px',
                  }}>
                    <AgentGlyph type={a.type} />

                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...grotesk, fontSize: 17, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.name}
                      </div>
                      <div style={{ ...mono, fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ color: 'var(--text-faint)' }}>{isMcp ? 'mcp' : 'agent'}</span>
                        {!isMcp && (
                          <>
                            <span style={{ opacity: 0.4 }}>·</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ opacity: 0.7 }}>{p.icon}</span>{p.label}
                            </span>
                          </>
                        )}
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span>created {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>

                    <StatusPill status={a.status} />

                    <button
                      type="button"
                      onClick={() => setKeysOpen(s => ({ ...s, [a.id]: !s[a.id] }))}
                      className="btn btn-secondary"
                      style={{ ...mono, fontSize: 12, padding: '8px 14px' }}
                    >
                      {isMcp ? (open ? 'hide endpoint' : 'view endpoint') : (open ? 'hide key' : 'view api key')}
                    </button>

                    <Link
                      href={`/agents/${a.id}`}
                      className="btn btn-secondary"
                      style={{ ...mono, fontSize: 12, padding: '8px 14px', textDecoration: 'none' }}
                    >
                      details
                    </Link>

                    {a.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => { setShowDelete(a); setDeleteConfirm(''); }}
                        className="btn btn-danger"
                        style={{ ...mono, fontSize: 12, padding: '8px 14px' }}
                      >
                        delete
                      </button>
                    )}
                  </div>

                  {open && (
                    <div style={{
                      borderTop: '1px solid var(--border-strong)',
                      padding: '18px 20px',
                      background: 'rgba(0,0,0,0.45)',
                      borderRadius: '0 0 11px 11px',
                    }}>
                      {isMcp ? (
                        a.mcp_url ? (
                          <>
                            <p style={{ ...mono, fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                              mcp endpoint
                            </p>
                            <InlineCopy value={a.mcp_url} />
                          </>
                        ) : (
                          <p style={{ ...mono, fontSize: 13, color: 'var(--text-muted)' }}>
                            MCP URL unavailable — verify your identity to receive your user hash.
                          </p>
                        )
                      ) : activeKey ? (
                        <>
                          <p style={{ ...mono, fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                            api key — {activeKey.name}
                          </p>
                          <InlineCopy
                            value={activeKey.plain_key ?? `${activeKey.prefix}…`}
                            mask={!!activeKey.plain_key}
                          />
                          {!activeKey.plain_key && (
                            <p style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
                              Legacy key — only the prefix is stored. Create a new agent to get a fresh, fully visible key.
                            </p>
                          )}
                        </>
                      ) : (
                        <p style={{ ...mono, fontSize: 13, color: 'var(--text-muted)' }}>
                          No active key for this agent yet.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Logs */}
      <section style={{ marginBottom: 36 }}>
        <SectionHeader
          title="Recent activity"
          hint="Last 50 agent actions across all your agents."
          action={
            <Link href="/audit-log" className="btn btn-secondary" style={{ ...mono, textDecoration: 'none' }}>
              full log
            </Link>
          }
        />

        {logs.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            background: 'rgba(15,17,12,0.6)', border: '1px dashed var(--border-strong)', borderRadius: 12,
            ...mono, fontSize: 13.5, color: 'var(--text-dim)',
          }}>
            No activity yet — actions will appear here as your agents run.
          </div>
        ) : (
          <div style={{
            background: 'rgba(15,17,12,0.78)',
            border: '1px solid var(--border-strong)',
            borderRadius: 12, overflow: 'hidden',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 1px 0 rgba(0,0,0,0.4)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '150px 140px 110px 130px 1fr',
              padding: '11px 20px', borderBottom: '1px solid var(--border-strong)',
              background: 'rgba(0,0,0,0.5)',
            }}>
              {['TIME', 'ACTION', 'PLATFORM', 'RESULT', 'INPUT'].map(h => (
                <span key={h} style={{ ...mono, fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>{h}</span>
              ))}
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {logs.slice(0, 50).map((log, i, arr) => (
                <div
                  key={log.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '150px 140px 110px 130px 1fr',
                    padding: '12px 20px', alignItems: 'center',
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}
                >
                  <span style={{ ...mono, fontSize: 11.5, color: '#fff' }}>
                    {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ ...mono, fontSize: 12.5, color: 'var(--text)' }}>{log.action}</span>
                  <span style={{ ...mono, fontSize: 11.5, color: 'var(--text-dim)' }}>{log.platform}</span>
                  <ResultBadge result={log.result} />
                  <span style={{ ...mono, fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.user_input ? `"${log.user_input}"` : log.rule_violated ? `rule: ${log.rule_violated}` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

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
