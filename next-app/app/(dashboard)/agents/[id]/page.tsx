'use client';

import { useEffect, useState, FormEvent, use, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Check, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { agentsApi, keysApi, auditApi, Agent, AgentKeySummary, AuditLog } from '@/lib/api';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };
const grotesk: React.CSSProperties = { fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif' };

const RESULT_COLORS: Record<string, string> = {
  SUCCESS: '#c8f542',
  BLOCKED_INVALID_KEY: '#ff5c5c',
  BLOCKED_RULE: '#ff5c5c',
  BLOCKED_REVOKED: '#8a8a8a',
};

const ICON_OPTIONS = ['◎', '⬡', '◈', '◆', '◇', '◉', '⬢', '⬣', '◐', '◯', '▲', '◊'];

const sectionLabel: React.CSSProperties = {
  ...mono, fontSize: 10, color: 'var(--text-faint)',
  letterSpacing: '0.16em', textTransform: 'uppercase' as const,
  margin: 0,
};
const hairline: React.CSSProperties = {
  height: 1, background: 'rgba(255,255,255,0.06)',
  margin: 0, border: 0,
};

function loadIcon(agentId: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try { return localStorage.getItem(`agent-icon-${agentId}`) ?? fallback; }
  catch { return fallback; }
}
function saveIcon(agentId: string, icon: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(`agent-icon-${agentId}`, icon); } catch {}
}

function IconPicker({ icon, onChange, accent }: { icon: string; onChange: (next: string) => void; accent: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Change icon"
        style={{
          width: 56, height: 56, borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: accent ? 'rgba(200,245,66,0.07)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${accent ? 'rgba(200,245,66,0.22)' : 'rgba(255,255,255,0.1)'}`,
          color: accent ? 'var(--accent)' : 'var(--text-dim)',
          fontSize: 26, cursor: 'pointer',
          transition: 'all 150ms ease',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          padding: 0,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = accent ? 'rgba(200,245,66,0.4)' : 'rgba(255,255,255,0.2)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = accent ? 'rgba(200,245,66,0.22)' : 'rgba(255,255,255,0.1)';
        }}
      >
        {icon}
      </button>

      {open && (
        <div
          className="fade-in"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0,
            zIndex: 20,
            display: 'grid', gridTemplateColumns: 'repeat(6, 36px)', gap: 4,
            padding: 8, borderRadius: 12,
            background: 'rgba(15,17,12,0.78)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 12px 40px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          }}
        >
          {ICON_OPTIONS.map(opt => {
            const selected = opt === icon;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                style={{
                  width: 36, height: 36, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: selected ? 'rgba(200,245,66,0.12)' : 'transparent',
                  border: `1px solid ${selected ? 'rgba(200,245,66,0.3)' : 'transparent'}`,
                  color: selected ? 'var(--accent)' : 'var(--text-dim)',
                  fontSize: 18, cursor: 'pointer',
                  transition: 'all 100ms ease', padding: 0,
                }}
                onMouseEnter={e => {
                  if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={e => {
                  if (!selected) e.currentTarget.style.background = 'transparent';
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CopyBox({ label, value, hint, onDismiss, mask }: {
  label: string; value: string; hint?: string; onDismiss?: () => void; mask?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [hidden, setHidden] = useState(!!mask);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }
  const display = mask && hidden
    ? value.length > 14
      ? `${value.slice(0, 8)}${'•'.repeat(8)}${value.slice(-4)}`
      : '•'.repeat(value.length)
    : value;

  return (
    <div>
      <p style={{ ...mono, fontSize: 10.5, color: 'var(--text-faint)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}{hint && <span style={{ ...mono, fontSize: 11, color: 'var(--text-faint)', textTransform: 'none', letterSpacing: 0, marginLeft: 8, opacity: 0.7 }}>· {hint}</span>}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <code style={{
          ...mono, fontSize: 13.5, color: 'var(--text)',
          background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
          padding: '10px 14px', borderRadius: 999, flex: 1,
          wordBreak: 'break-all', lineHeight: 1.5,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}>{display}</code>
        {mask && (
          <button
            onClick={() => setHidden(h => !h)}
            aria-label={hidden ? 'Show' : 'Hide'}
            style={{
              padding: 10, borderRadius: 999, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-dim)',
              transition: 'all 120ms ease', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
          >
            {hidden ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
        )}
        <button
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy'}
          style={{
            padding: 10, borderRadius: 999, cursor: 'pointer',
            background: copied ? 'rgba(200,245,66,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${copied ? 'rgba(200,245,66,0.3)' : 'rgba(255,255,255,0.1)'}`,
            color: copied ? 'var(--accent)' : 'var(--text-dim)',
            transition: 'all 120ms ease', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} style={{
          ...mono, fontSize: 12, color: 'var(--text-faint)', marginTop: 10,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}>Dismiss</button>
      )}
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

function StatusDot({ status, withLabel = false }: { status: string; withLabel?: boolean }) {
  const s = status.toUpperCase();
  const active = s === 'ACTIVE';
  return (
    <span style={{
      ...mono, fontSize: 11,
      color: active ? 'var(--accent)' : 'var(--text-faint)',
      display: 'inline-flex', alignItems: 'center', gap: 7,
      letterSpacing: '0.04em',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: active ? 'var(--accent)' : 'rgba(255,255,255,0.2)',
        boxShadow: active ? '0 0 8px rgba(200,245,66,0.5)' : 'none',
        animation: active ? 'pulse 2s ease-in-out infinite' : 'none',
      }} />
      {withLabel && <span>{active ? 'active' : s.toLowerCase()}</span>}
    </span>
  );
}

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuth();
  const router = useRouter();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [keys, setKeys] = useState<AgentKeySummary[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [icon, setIcon] = useState<string>('◎');

  const [showRotate, setShowRotate] = useState(false);
  const [rotateName, setRotateName] = useState('');
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const [showDisable, setShowDisable] = useState(false);
  const [disableConfirm, setDisableConfirm] = useState('');
  const [disabling, setDisabling] = useState(false);

  async function load() {
    if (!token) return;
    try {
      const result = await agentsApi.get(token, id);
      setAgent(result.agent);
      setKeys(result.keys);
      setIcon(loadIcon(result.agent.id, result.agent.type === 'mcp' ? '⬡' : '◎'));
      const auditLogs = await auditApi.list(token, { agentId: id, limit: '20' });
      setLogs(auditLogs);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status === 404) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token, id]);

  function handleIconChange(next: string) {
    setIcon(next);
    if (agent) saveIcon(agent.id, next);
  }

  async function handleRotate(e: FormEvent) {
    e.preventDefault();
    if (!token || !agent) return;
    setRotating(true);
    setRotateError('');
    try {
      const result = await keysApi.rotate(token, { agent_id: agent.id, name: rotateName });
      setRevealedKey(result.plainKey);
      setShowRotate(false);
      setRotateName('');
      await load();
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      setRotateError(e.message ?? 'Failed to rotate key');
    } finally {
      setRotating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    if (!token || !confirm('Revoke this key? This cannot be undone.')) return;
    await keysApi.revoke(token, keyId);
    setKeys(prev => prev.map(k => k.id === keyId ? { ...k, status: 'REVOKED' as const, revoked_at: new Date().toISOString() } : k));
  }

  async function handleDisable() {
    if (!token || !agent || disableConfirm !== agent.name) return;
    setDisabling(true);
    try {
      await agentsApi.disable(token, agent.id);
      router.push('/agents');
    } catch {
      setDisabling(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 56px', maxWidth: 1080, margin: '0 auto' }}>
        <p style={{ ...mono, fontSize: 12, color: 'var(--text-faint)' }}>loading agent…</p>
      </div>
    );
  }

  if (notFound || !agent) {
    return (
      <div style={{ padding: '40px 56px', maxWidth: 1080, margin: '0 auto' }}>
        <Link href="/agents" style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>← Agents</Link>
        <p style={{ marginTop: 40, fontSize: 16 }}>Agent not found.</p>
      </div>
    );
  }

  const activeKeys = keys.filter(k => k.status === 'ACTIVE');
  const isMcp = agent.type === 'mcp';
  const isActive = agent.status === 'ACTIVE';

  return (
    <div style={{
      padding: '28px 56px 40px', maxWidth: 1080, margin: '0 auto',
      display: 'flex', flexDirection: 'column', gap: 24,
    }}>
      {/* Breadcrumb */}
      <Link href="/agents" style={{
        ...mono, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none',
        letterSpacing: '0.06em',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        transition: 'color 120ms ease',
      }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-dim)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        ← agents
      </Link>

      {/* Hero */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
          <IconPicker icon={icon} onChange={handleIconChange} accent={isMcp} />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ ...grotesk, fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 }}>
              {agent.name}
            </h1>
            <div style={{ ...mono, fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', letterSpacing: '0.02em' }}>
              <span>{isMcp ? 'mcp' : 'agent'}</span>
              <span style={{ opacity: 0.3 }}>·</span>
              <span>{agent.platform}</span>
              <span style={{ opacity: 0.3 }}>·</span>
              <span>created {new Date(agent.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <StatusDot status={agent.status} withLabel />
          {isActive && (
            <button
              onClick={() => { setShowDisable(true); setDisableConfirm(''); }}
              className="btn btn-danger"
              style={{ ...mono, fontSize: 13, padding: '10px 20px' }}
            >
              Disable
            </button>
          )}
        </div>
      </div>

      <hr style={hairline} />

      {/* Newly rotated key reveal (toast-like, only when present) */}
      {revealedKey && (
        <CopyBox label="New API key" value={revealedKey} mask onDismiss={() => setRevealedKey(null)} />
      )}

      {/* Credentials / Endpoint */}
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={sectionLabel}>{isMcp ? 'endpoint' : 'credentials'}</p>
          {!isMcp && isActive && (
            <button
              onClick={() => { setShowRotate(true); setRotateError(''); setRotateName(''); }}
              className="btn btn-secondary"
              style={{ ...mono, fontSize: 12, padding: '8px 16px' }}
            >
              Rotate key
            </button>
          )}
        </div>

        {isMcp ? (
          agent.mcp_url ? (
            <CopyBox label="MCP endpoint" hint="point your MCP client at this URL" value={agent.mcp_url} />
          ) : (
            <p style={{ ...mono, fontSize: 12.5, color: 'var(--text-muted)', padding: '16px 0' }}>
              MCP URL unavailable — verify your identity to receive your user hash.
            </p>
          )
        ) : keys.length === 0 ? (
          <p style={{ ...mono, fontSize: 12.5, color: 'var(--text-muted)', padding: '16px 0' }}>
            No keys yet — rotate to create one.
          </p>
        ) : (
          <div>
            {keys.map((key, i) => {
              const keyActive = key.status === 'ACTIVE';
              return (
                <div
                  key={key.id}
                  style={{
                    display: 'grid', gridTemplateColumns: 'auto 1fr auto auto',
                    gap: 16, padding: '14px 0', alignItems: 'center',
                    borderBottom: i < keys.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}
                >
                  <StatusDot status={key.status} />
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                    <code style={{ ...mono, fontSize: 13.5, color: keyActive ? 'var(--text)' : 'var(--text-muted)' }}>{key.prefix}…</code>
                    <span style={{ ...mono, fontSize: 11.5, color: 'var(--text-faint)' }}>{key.name}</span>
                  </div>
                  <span style={{ ...mono, fontSize: 11.5, color: 'var(--text-muted)', minWidth: 78, textAlign: 'right', letterSpacing: '0.02em' }}>
                    {new Date(key.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <div style={{ width: 84, display: 'flex', justifyContent: 'flex-end' }}>
                    {keyActive && (
                      <button
                        onClick={() => handleRevoke(key.id)}
                        className="btn btn-danger"
                        style={{ ...mono, fontSize: 11.5, padding: '6px 14px' }}
                      >
                        revoke
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isMcp && activeKeys.length === 0 && keys.length > 0 && isActive && (
          <p style={{ ...mono, fontSize: 11.5, color: '#ffb84d', marginTop: 12, opacity: 0.8 }}>
            no active keys — rotate to keep this agent reachable
          </p>
        )}
      </section>

      <hr style={hairline} />

      {/* Recent activity */}
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={sectionLabel}>recent activity</p>
          {logs.length > 0 && (
            <Link
              href={`/audit-log?agentId=${agent.id}`}
              style={{ ...mono, fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none', letterSpacing: '0.04em' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-dim)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              view all →
            </Link>
          )}
        </div>

        {logs.length === 0 ? (
          <p style={{ ...mono, fontSize: 12.5, color: 'var(--text-muted)', padding: '16px 0' }}>
            No activity yet
          </p>
        ) : (
          <div>
            {logs.map((log, i) => (
              <div
                key={log.id}
                style={{
                  display: 'grid', gridTemplateColumns: '120px 1fr auto',
                  padding: '11px 0', alignItems: 'center', gap: 14,
                  borderBottom: i < logs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <span style={{ ...mono, fontSize: 11.5, color: '#fff', letterSpacing: '0.02em' }}>
                  {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ ...mono, fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.action}
                </span>
                <ResultBadge result={log.result} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rotate modal */}
      {showRotate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRotate(false)}>
          <div className="modal-box fade-in">
            <h2 style={{ ...grotesk, fontSize: 20, fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 8 }}>
              Rotate key
            </h2>
            <p style={{ ...mono, fontSize: 13, color: 'var(--text-muted)', marginBottom: 22, lineHeight: 1.55 }}>
              Adds a new key for <span style={{ color: 'var(--text-dim)' }}>{agent.name}</span>. Revoke old keys when ready.
            </p>
            <form onSubmit={handleRotate}>
              <div className="field">
                <label className="field-label">Key name</label>
                <input
                  className="z-input"
                  value={rotateName}
                  onChange={e => setRotateName(e.target.value)}
                  placeholder="e.g. rotation-2026-05"
                  required
                  autoFocus
                />
              </div>
              {rotateError && (
                <div className="form-error" style={{ marginBottom: 14 }}>
                  <span>⚠</span> {rotateError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowRotate(false)} className="btn btn-secondary" style={{ flex: 1, ...mono }}>
                  Cancel
                </button>
                <button type="submit" disabled={rotating} className="btn btn-primary" style={{ flex: 2, ...mono }}>
                  {rotating ? 'Rotating…' : 'Rotate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disable modal — typed-name confirm */}
      {showDisable && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDisable(false)}>
          <div className="modal-box fade-in">
            <h2 style={{ ...grotesk, fontSize: 19, fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 6 }}>
              Disable agent
            </h2>
            <p style={{ ...mono, fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
              This revokes <span style={{ color: 'var(--text-dim)' }}>all keys</span> for this agent and stops it from validating.
              Audit history is preserved.
            </p>
            <p style={{ ...mono, fontSize: 13, color: 'var(--text-faint)', marginBottom: 10 }}>
              Type <span style={{ color: 'var(--text-dim)' }}>{agent.name}</span> to confirm:
            </p>
            <div className="field">
              <input
                className="z-input"
                value={disableConfirm}
                onChange={e => setDisableConfirm(e.target.value)}
                placeholder={agent.name}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button type="button" onClick={() => setShowDisable(false)} className="btn btn-secondary" style={{ flex: 1, ...mono }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisable}
                disabled={disabling || disableConfirm !== agent.name}
                className="btn btn-danger"
                style={{ flex: 2, ...mono }}
              >
                {disabling ? 'Disabling…' : 'Disable agent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
