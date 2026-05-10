'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

function CopyBox({ label, value, hint, onDismiss }: {
  label: string; value: string; hint?: string; onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="key-reveal fade-in">
      <p style={{ ...mono, fontSize: 11, color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>⬡</span> {label}
        {hint && <span style={{ ...mono, fontSize: 10, color: 'var(--text-faint)', textTransform: 'none', letterSpacing: 0 }}>· {hint}</span>}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <code style={{
          ...mono, fontSize: 13, color: 'var(--text)',
          background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-strong)',
          padding: '10px 14px', borderRadius: 7, flex: 1,
          wordBreak: 'break-all', lineHeight: 1.6,
        }}>{value}</code>
        <button
          onClick={copy}
          style={{
            ...mono, fontSize: 11, padding: '10px 14px', borderRadius: 7, cursor: 'pointer',
            background: copied ? 'rgba(200,245,66,0.12)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${copied ? 'rgba(200,245,66,0.3)' : 'rgba(255,255,255,0.1)'}`,
            color: copied ? 'var(--accent)' : 'var(--text-dim)',
            transition: 'all 120ms ease', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >{copied ? '✓ copied' : 'copy'}</button>
      </div>
      <button onClick={onDismiss} style={{
        ...mono, fontSize: 11, color: 'var(--text-faint)', marginTop: 10,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      }}>Dismiss ↑</button>
    </div>
  );
}

export default function AgentsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<{ name: string; type: AgentType; platform: string }>(
    { name: '', type: 'agent', platform: 'whatsapp' },
  );
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
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
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token]);

  function setType(type: AgentType) {
    setForm(f => ({ ...f, type, platform: type === 'mcp' ? 'mcp' : (f.platform === 'mcp' ? 'whatsapp' : f.platform) }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    setCreateError('');
    try {
      const result = await agentsApi.create(token, form);
      if (form.type === 'mcp' && result.agent.mcp_url) {
        setReveal({ kind: 'url', url: result.agent.mcp_url });
      } else if (result.key) {
        setReveal({ kind: 'key', plainKey: result.key.plainKey });
      }
      setShowCreate(false);
      setForm({ name: '', type: 'agent', platform: 'whatsapp' });
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
      } else {
        setCreateError(e.message ?? 'Failed to create agent');
      }
    } finally {
      setCreating(false);
    }
  }

  const activeAgents = agents.filter(a => a.status === 'ACTIVE');

  return (
    <div style={{ padding: '40px 48px', maxWidth: 920 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ ...grotesk, fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: '0 0 4px' }}>
            Agents
          </h1>
          <p style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            {activeAgents.length} active — agents and MCP servers you own
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateError(''); setKycBlocked(false); }}
          style={{
            ...mono, fontSize: 12, padding: '9px 16px', borderRadius: 7, cursor: 'pointer',
            background: 'var(--accent)', border: 'none',
            color: '#050505', fontWeight: 600, transition: 'all 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#d4f75e'; e.currentTarget.style.boxShadow = '0 0 20px rgba(200,245,66,0.25)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          + New Agent
        </button>
      </div>

      {/* Reveal */}
      {reveal?.kind === 'key' && (
        <CopyBox label="Save this key — shown only once" value={reveal.plainKey} onDismiss={() => setReveal(null)} />
      )}
      {reveal?.kind === 'url' && (
        <CopyBox label="MCP endpoint" hint="point your MCP client at this URL" value={reveal.url} onDismiss={() => setReveal(null)} />
      )}

      {/* KYC blocked banner */}
      {kycBlocked && (
        <div className="kyc-banner fade-in">
          <div>
            <p style={{ ...mono, fontSize: 12, color: '#ffb84d', marginBottom: 4 }}>Identity verification required</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              You need to verify your identity before creating agents.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {kycUrl && (
              <a href={kycUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ ...mono, fontSize: 11 }}>
                Continue ↗
              </a>
            )}
            <button className="btn btn-primary" style={{ ...mono, fontSize: 11 }} onClick={() => router.push('/kyc')}>
              Verify now →
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-box fade-in">
            <h2 style={{ ...grotesk, fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 6 }}>
              New Agent
            </h2>
            <p style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
              An agent is a logical identity. Keys are rotatable credentials for it.
            </p>

            <form onSubmit={handleCreate}>
              <div className="field">
                <label className="field-label">Agent name</label>
                <input
                  className="z-input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sales Bot, Filesystem MCP"
                  required
                  autoFocus
                />
              </div>

              <div className="field">
                <label className="field-label" style={{ marginBottom: 10 }}>Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {TYPES.map(t => {
                    const selected = form.type === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setType(t.value)}
                        style={{
                          textAlign: 'left',
                          padding: '14px 14px', borderRadius: 9, cursor: 'pointer',
                          background: selected ? 'rgba(200,245,66,0.07)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${selected ? 'rgba(200,245,66,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          transition: 'all 120ms ease',
                          display: 'flex', flexDirection: 'column', gap: 6,
                        }}
                      >
                        <span style={{ ...mono, fontSize: 12, color: selected ? 'var(--accent)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ opacity: 0.85 }}>{t.icon}</span>
                          {t.label}
                        </span>
                        <span style={{ ...mono, fontSize: 10, color: 'var(--text-faint)', lineHeight: 1.4 }}>
                          {t.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.type === 'agent' && (
                <div className="field" style={{ marginBottom: 20 }}>
                  <label className="field-label" style={{ marginBottom: 10 }}>Platform</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {PLATFORMS.map(p => {
                      const selected = form.platform === p.value;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, platform: p.value }))}
                          style={{
                            ...mono, fontSize: 11,
                            padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
                            background: selected ? 'rgba(200,245,66,0.08)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${selected ? 'rgba(200,245,66,0.4)' : 'rgba(255,255,255,0.08)'}`,
                            color: selected ? 'var(--accent)' : 'var(--text-muted)',
                            transition: 'all 120ms ease',
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}
                        >
                          <span style={{ opacity: 0.7 }}>{p.icon}</span>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {createError && (
                <div className="form-error" style={{ marginBottom: 14 }}>
                  <span>⚠</span> {createError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary" style={{ flex: 1, ...mono, fontSize: 13 }}>
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn btn-primary" style={{ flex: 2, ...mono, fontSize: 13 }}>
                  {creating ? 'Creating…' : 'Create agent →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p style={{ ...mono, fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', paddingTop: 60 }}>loading agents…</p>
      ) : agents.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.18 }}>◉</div>
          <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No agents yet</p>
          <p style={{ ...mono, fontSize: 12, color: 'var(--text-muted)' }}>
            Create your first agent — an MCP server or platform bot
          </p>
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
                  gridTemplateColumns: '36px 1fr auto auto auto',
                  gap: 14,
                  alignItems: 'center',
                  padding: '14px 18px',
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
                  <div style={{ ...grotesk, fontSize: 14.5, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name}
                  </div>
                  <div style={{ ...mono, fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--text-faint)' }}>{isMcp ? 'mcp' : 'agent'}</span>
                    {!isMcp && (
                      <>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ opacity: 0.7 }}>{p.icon}</span>
                          {p.label}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <StatusPill status={a.status} />

                <span style={{ ...mono, fontSize: 11, color: 'var(--text-muted)', minWidth: 70, textAlign: 'right' }}>
                  {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>

                <span style={{ ...mono, fontSize: 14, color: 'var(--text-faint)', width: 14, textAlign: 'right' }}>›</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
