'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Check, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { agentsApi, kycApi, Agent, AgentType } from '@/lib/api';

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

function platformOf(value: string) {
  return PLATFORMS.find(x => x.value === value) ?? { value, label: value, icon: '◇' };
}

function StatusPill({ status }: { status: 'ACTIVE' | 'DISABLED' }) {
  const active = status === 'ACTIVE';
  return (
    <span className={`pill-base ${active ? 'pill-active' : 'pill-disabled'}`}>
      <span style={{ fontSize: 7, animation: active ? 'pulse 2s ease-in-out infinite' : 'none' }}>
        {active ? '●' : '○'}
      </span>
      {active ? 'active' : 'disabled'}
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
      transition: 'all 200ms ease',
    }}>
      {isMcp ? '⬡' : '◎'}
    </div>
  );
}

function CopyBox({ label, value, hint, onDismiss, mask }: {
  label: string; value: string; hint?: string; onDismiss: () => void; mask?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [hidden, setHidden] = useState(!!mask);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  const display = mask && hidden ? '•'.repeat(Math.min(Math.max(value.length, 12), 36)) : value;
  return (
    <div className="key-reveal fade-in">
      <p style={{ ...mono, fontSize: 13, color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 9 }}>
        <span>⬡</span> {label}
        {hint && <span style={{ ...mono, fontSize: 12, color: 'var(--text-faint)', textTransform: 'none', letterSpacing: 0 }}>· {hint}</span>}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <code style={{
          ...mono, fontSize: 14.5, color: 'var(--text)',
          background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-strong)',
          padding: '12px 16px', borderRadius: 999, flex: 1,
          wordBreak: 'break-all', lineHeight: 1.6,
        }}>{display}</code>
        {mask && (
          <button
            onClick={() => setHidden(h => !h)}
            aria-label={hidden ? 'Show key' : 'Hide key'}
            style={{
              padding: 12, borderRadius: 999, cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-dim)',
              transition: 'all 120ms ease', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        )}
        <button
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy'}
          style={{
            padding: 12, borderRadius: 999, cursor: 'pointer',
            background: copied ? 'rgba(200,245,66,0.12)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${copied ? 'rgba(200,245,66,0.3)' : 'rgba(255,255,255,0.1)'}`,
            color: copied ? 'var(--accent)' : 'var(--text-dim)',
            transition: 'all 120ms ease', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      <button onClick={onDismiss} style={{
        ...mono, fontSize: 13, color: 'var(--text-faint)', marginTop: 12,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      }}>Dismiss</button>
    </div>
  );
}

/* ─────────────────── Conversational create wizard ─────────────────── */

type WizardStep = 'name' | 'type' | 'platform' | 'ready';

function SystemBubble({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div
      className="fade-in"
      style={{
        animationDelay: `${delay}ms`, animationFillMode: 'both',
        display: 'flex', alignItems: 'flex-start', gap: 10, maxWidth: '85%',
      }}
    >
      <span style={{
        ...mono, fontSize: 13, color: 'var(--accent)', letterSpacing: '0.04em',
        paddingTop: 5, flexShrink: 0,
      }}>
        zero<span style={{ opacity: 0.7 }}>·</span>
      </span>
      <div style={{
        ...grotesk, fontSize: 18, color: 'var(--text)', letterSpacing: '-0.01em',
        lineHeight: 1.45,
      }}>
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children, onEdit }: { children: React.ReactNode; onEdit?: () => void }) {
  return (
    <div
      className="fade-in"
      style={{ display: 'flex', justifyContent: 'flex-end' }}
    >
      <button
        type="button"
        onClick={onEdit}
        disabled={!onEdit}
        style={{
          ...mono, fontSize: 15, color: 'var(--accent)',
          background: 'rgba(200,245,66,0.08)',
          border: '1px solid rgba(200,245,66,0.25)',
          borderRadius: 999, padding: '9px 18px',
          cursor: onEdit ? 'pointer' : 'default',
          display: 'inline-flex', alignItems: 'center', gap: 10,
          transition: 'all 120ms ease',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
        onMouseEnter={e => onEdit && (e.currentTarget.style.background = 'rgba(200,245,66,0.14)')}
        onMouseLeave={e => onEdit && (e.currentTarget.style.background = 'rgba(200,245,66,0.08)')}
      >
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
  const [type, setTypeVal] = useState<AgentType | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the conversation as new bubbles appear.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
  }, [step]);

  function commitName(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setStep('type');
  }

  function pickType(t: AgentType) {
    setTypeVal(t);
    if (t === 'mcp') {
      setPlatform('mcp');
      setStep('ready');
    } else {
      setPlatform(null);
      setStep('platform');
    }
  }

  function pickPlatform(p: string) {
    setPlatform(p);
    setStep('ready');
  }

  async function submit() {
    if (!name || !type || !platform) return;
    setCreating(true);
    setError('');
    try {
      await onSubmit({ name: name.trim(), type, platform });
      // success — parent closes the modal.
    } catch (err) {
      setError((err as Error).message ?? 'Something went wrong');
      setCreating(false);
    }
  }

  const typeMeta = type ? TYPES.find(t => t.value === type)! : null;
  const platformMeta = platform && type === 'agent'
    ? (PLATFORMS.find(p => p.value === platform) ?? null)
    : null;

  return (
    <div
      className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal-box fade-in"
        style={{ maxWidth: 520, padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '82vh' }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 10px rgba(200,245,66,0.5)', animation: 'pulse 2s ease-in-out infinite' }} />
            <h2 style={{ ...grotesk, fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
              new agent
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, padding: '4px 6px',
              transition: 'color 120ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Conversation */}
        <div
          ref={scrollRef}
          style={{
            flex: 1, overflowY: 'auto', padding: '24px 22px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}
        >
          {/* Q1: name */}
          <SystemBubble>What should we call your new agent?</SystemBubble>

          {step === 'name' ? (
            <form onSubmit={commitName} className="fade-in" style={{ display: 'flex', gap: 8, alignItems: 'stretch', paddingLeft: 36 }}>
              <input
                className="z-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Sales Bot, Filesystem MCP…"
                autoFocus
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                disabled={!name.trim()}
                className="btn btn-primary"
                style={mono}
              >
                Continue
              </button>
            </form>
          ) : (
            <UserBubble onEdit={() => { setStep('name'); setTypeVal(null); setPlatform(null); }}>
              {name}
            </UserBubble>
          )}

          {/* Q2: type */}
          {step !== 'name' && (
            <>
              <SystemBubble>Is it an agent or an MCP server?</SystemBubble>
              {step === 'type' ? (
                <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingLeft: 36 }}>
                  {TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => pickType(t.value)}
                      style={{
                        textAlign: 'left',
                        padding: '14px 14px', borderRadius: 9, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        transition: 'all 120ms ease',
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(200,245,66,0.07)';
                        e.currentTarget.style.borderColor = 'rgba(200,245,66,0.3)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      }}
                    >
                      <span style={{ ...mono, fontSize: 15, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ opacity: 0.85 }}>{t.icon}</span>
                        {t.label}
                      </span>
                      <span style={{ ...mono, fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.4 }}>
                        {t.hint}
                      </span>
                    </button>
                  ))}
                </div>
              ) : typeMeta ? (
                <UserBubble onEdit={() => { setStep('type'); setPlatform(null); }}>
                  <span>{typeMeta.icon}</span> {typeMeta.label}
                </UserBubble>
              ) : null}
            </>
          )}

          {/* Q3: platform (only if type === agent) */}
          {type === 'agent' && (step === 'platform' || step === 'ready') && (
            <>
              <SystemBubble>Where will it live?</SystemBubble>
              {step === 'platform' ? (
                <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, paddingLeft: 36 }}>
                  {PLATFORMS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => pickPlatform(p.value)}
                      style={{
                        ...mono, fontSize: 14,
                        padding: '13px 14px', borderRadius: 999, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'var(--text-muted)',
                        transition: 'all 120ms ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(200,245,66,0.07)';
                        e.currentTarget.style.borderColor = 'rgba(200,245,66,0.3)';
                        e.currentTarget.style.color = 'var(--accent)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.color = 'var(--text-muted)';
                      }}
                    >
                      <span style={{ opacity: 0.7 }}>{p.icon}</span>
                      {p.label}
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

          {/* Final: ready */}
          {step === 'ready' && (
            <>
              <SystemBubble delay={150}>
                Ready when you are.
              </SystemBubble>
              <div className="fade-in" style={{ paddingLeft: 36, animationDelay: '300ms', animationFillMode: 'both' }}>
                {error && (
                  <div className="form-error" style={{ marginBottom: 12 }}>
                    <span>⚠</span> {error}
                  </div>
                )}
                <button
                  type="button"
                  onClick={submit}
                  disabled={creating}
                  className="btn btn-primary"
                  style={mono}
                >
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

export default function AgentsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [reveal, setReveal] = useState<
    | { kind: 'key'; plainKey: string }
    | { kind: 'url'; url: string }
    | null
  >(null);
  const [kycBlocked, setKycBlocked] = useState(false);
  const [kycUrl, setKycUrl] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    try { setAgents(await agentsApi.list(token)); }
    catch { /* layout's auth gate will redirect on 401 */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token]);

  async function handleCreate(values: { name: string; type: AgentType; platform: string }): Promise<void> {
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
        return; // handled — don't bubble to wizard
      }
      throw err; // wizard will display this
    }
  }

  const activeAgents = agents.filter(a => a.status === 'ACTIVE');

  return (
    <div style={{ padding: '40px 48px', maxWidth: 920, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ ...grotesk, fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', margin: '0 0 8px' }}>
            Agents
          </h1>
          <p style={{ ...mono, fontSize: 15, color: 'var(--text-muted)', margin: 0 }}>
            {activeAgents.length} active — agents and MCP servers you own
          </p>
        </div>
        {agents.length > 0 && (
          <button
            onClick={() => { setShowCreate(true); setKycBlocked(false); }}
            className="btn btn-primary"
            style={mono}
          >
            New agent
          </button>
        )}
      </div>

      {/* Reveal */}
      {reveal?.kind === 'key' && (
        <CopyBox label="API key" value={reveal.plainKey} mask onDismiss={() => setReveal(null)} />
      )}
      {reveal?.kind === 'url' && (
        <CopyBox label="MCP endpoint" hint="point your MCP client at this URL" value={reveal.url} onDismiss={() => setReveal(null)} />
      )}

      {/* KYC blocked banner */}
      {kycBlocked && (
        <div className="kyc-banner fade-in">
          <div>
            <p style={{ ...mono, fontSize: 14, color: '#ffb84d', marginBottom: 6 }}>Identity verification required</p>
            <p style={{ fontSize: 15, color: 'var(--text-dim)' }}>
              You need to verify your identity before creating agents.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {kycUrl && (
              <a href={kycUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={mono}>
                Continue
              </a>
            )}
            <button className="btn btn-primary" style={mono} onClick={() => router.push('/kyc')}>
              Verify now
            </button>
          </div>
        </div>
      )}

      {/* Conversational create wizard */}
      {showCreate && (
        <CreateAgentWizard
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}

      {/* List */}
      {loading ? (
        <p style={{ ...mono, fontSize: 15, color: 'var(--text-faint)', textAlign: 'center', paddingTop: 60 }}>loading agents…</p>
      ) : agents.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 50, marginBottom: 20, opacity: 0.18 }}>◉</div>
          <p style={{ fontSize: 21, fontWeight: 500, marginBottom: 12 }}>No agents yet</p>
          <p style={{ ...mono, fontSize: 15, color: 'var(--text-muted)', marginBottom: 28 }}>
            Create your first agent — an MCP server or platform bot
          </p>
          <button
            onClick={() => { setShowCreate(true); setKycBlocked(false); }}
            className="btn btn-primary"
            style={mono}
          >
            New agent
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {agents.map(a => {
            const p = platformOf(a.platform);
            const isMcp = a.type === 'mcp';
            return (
              <Link
                key={a.id}
                href={`/agents/${a.id}`}
                className="agent-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr auto auto',
                  gap: 16,
                  alignItems: 'center',
                  padding: '18px 22px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--z-border)',
                  borderRadius: 11,
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.035)';
                  e.currentTarget.style.borderColor = 'var(--border-strong)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  e.currentTarget.style.borderColor = 'var(--z-border)';
                }}
              >
                <AgentGlyph type={a.type} />

                <div style={{ minWidth: 0 }}>
                  <div style={{ ...grotesk, fontSize: 18, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name}
                  </div>
                  <div style={{ ...mono, fontSize: 13, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ color: 'var(--text-faint)' }}>{isMcp ? 'mcp' : 'agent'}</span>
                    {!isMcp && (
                      <>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ opacity: 0.7 }}>{p.icon}</span>
                          {p.label}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <StatusPill status={a.status} />

                <span style={{ ...mono, fontSize: 13, color: 'var(--text-muted)', minWidth: 86, textAlign: 'right' }}>
                  {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
