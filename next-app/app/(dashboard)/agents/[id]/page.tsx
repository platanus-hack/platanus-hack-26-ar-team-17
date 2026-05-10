'use client';

import { useEffect, useState, FormEvent, use } from 'react';
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

function CopyBox({ label, value, hint, onDismiss, accent, mask }: {
  label: string; value: string; hint?: string; onDismiss?: () => void; accent?: 'lime' | 'plain'; mask?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [hidden, setHidden] = useState(!!mask);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  const bg = accent === 'plain'
    ? { background: 'rgba(255,255,255,0.02)', border: '1px solid var(--z-border)', borderRadius: 11, padding: '18px 20px', marginBottom: 0 }
    : undefined;
  const labelColor = accent === 'plain' ? 'var(--text-dim)' : 'var(--accent)';
  const display = mask && hidden ? '•'.repeat(Math.min(Math.max(value.length, 12), 36)) : value;
  return (
    <div className={accent === 'plain' ? '' : 'key-reveal fade-in'} style={bg}>
      <p style={{ ...mono, fontSize: 13, color: labelColor, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 9 }}>
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
      {onDismiss && (
        <button onClick={onDismiss} style={{
          ...mono, fontSize: 13, color: 'var(--text-faint)', marginTop: 12,
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

function StatusPill({ status }: { status: string }) {
  const s = status.toUpperCase();
  const active = s === 'ACTIVE';
  return (
    <span className={`pill-base ${active ? 'pill-active' : 'pill-disabled'}`}>
      <span style={{ fontSize: 7, animation: active ? 'pulse 2s ease-in-out infinite' : 'none' }}>
        {active ? '●' : '○'}
      </span>
      {s.toLowerCase()}
    </span>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <h2 style={{ ...mono, fontSize: 13, color: 'var(--text-faint)', letterSpacing: '0.14em', textTransform: 'uppercase', margin: 0 }}>
        {title}
      </h2>
      {action}
    </div>
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
      <div style={{ padding: '40px 48px', maxWidth: 920, margin: '0 auto' }}>
        <p style={{ ...mono, fontSize: 12, color: 'var(--text-faint)' }}>loading agent…</p>
      </div>
    );
  }

  if (notFound || !agent) {
    return (
      <div style={{ padding: '40px 48px', maxWidth: 920, margin: '0 auto' }}>
        <Link href="/agents" style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>← Agents</Link>
        <p style={{ marginTop: 40, fontSize: 16 }}>Agent not found.</p>
      </div>
    );
  }

  const activeKeys = keys.filter(k => k.status === 'ACTIVE');
  const isMcp = agent.type === 'mcp';
  const isActive = agent.status === 'ACTIVE';

  return (
    <div style={{ padding: '40px 48px', maxWidth: 920, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <Link href="/agents" style={{
        ...mono, fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24,
        transition: 'color 120ms ease',
      }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-dim)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        Back to agents
      </Link>

      {/* Header card */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isMcp ? 'rgba(200,245,66,0.07)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isMcp ? 'rgba(200,245,66,0.2)' : 'rgba(255,255,255,0.08)'}`,
              color: isMcp ? 'var(--accent)' : 'var(--text-dim)',
              fontSize: 24, flexShrink: 0,
            }}>
              {isMcp ? '⬡' : '◎'}
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ ...grotesk, fontSize: 34, fontWeight: 600, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.15 }}>
                {agent.name}
              </h1>
              <div style={{ ...mono, fontSize: 14, color: 'var(--text-muted)', marginTop: 9, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span>{isMcp ? 'mcp' : 'agent'}</span>
                <span style={{ opacity: 0.3 }}>·</span>
                <span>{agent.platform}</span>
                <span style={{ opacity: 0.3 }}>·</span>
                <span>created {new Date(agent.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <StatusPill status={agent.status} />
            {isActive && (
              <button
                onClick={() => { setShowDisable(true); setDisableConfirm(''); }}
                className="btn btn-danger"
                style={mono}
              >
                Disable
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Newly rotated key reveal */}
      {revealedKey && (
        <div style={{ marginBottom: 28 }}>
          <CopyBox label="New API key" value={revealedKey} mask onDismiss={() => setRevealedKey(null)} />
        </div>
      )}

      {/* Credentials / Endpoint */}
      <section style={{ marginBottom: 36 }}>
        <SectionHeader title={isMcp ? 'Endpoint' : 'Credentials'} />

        {isMcp ? (
          agent.mcp_url ? (
            <CopyBox label="MCP endpoint" hint="point your MCP client at this URL" value={agent.mcp_url} accent="plain" />
          ) : (
            <div style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--z-border)', borderRadius: 11 }}>
              MCP URL unavailable — verify your identity to receive your user hash.
            </div>
          )
        ) : keys.length === 0 ? (
          <div style={{ ...mono, fontSize: 13.5, color: 'var(--text-muted)', padding: '26px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--z-border)', borderRadius: 11, textAlign: 'center' }}>
            No keys yet — rotate to create one
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--z-border)', borderRadius: 11, overflow: 'hidden' }}>
            {keys.map((key, i) => (
              <div
                key={key.id}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                  gap: 14, padding: '14px 18px', alignItems: 'center',
                  borderBottom: i < keys.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <code style={{ ...mono, fontSize: 14.5, color: 'var(--text)' }}>{key.prefix}…</code>
                  <span style={{ ...mono, fontSize: 12.5, color: 'var(--text-faint)', marginLeft: 12 }}>{key.name}</span>
                </div>
                <StatusPill status={key.status} />
                <span style={{ ...mono, fontSize: 12.5, color: 'var(--text-muted)', minWidth: 78, textAlign: 'right' }}>
                  {new Date(key.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <div style={{ width: 92, display: 'flex', justifyContent: 'flex-end' }}>
                  {key.status === 'ACTIVE' && (
                    <button onClick={() => handleRevoke(key.id)} className="btn btn-danger" style={{ ...mono, fontSize: 12, padding: '7px 14px' }}>
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isMcp && activeKeys.length === 0 && keys.length > 0 && isActive && (
          <p style={{ ...mono, fontSize: 11, color: '#ffb84d', marginTop: 12 }}>
            ⚠ no active keys — rotate to keep this agent reachable
          </p>
        )}
      </section>

      {/* Recent activity */}
      <section>
        <SectionHeader
          title="Recent activity"
          action={logs.length > 0 ? (
            <Link href={`/audit-log?agentId=${agent.id}`} style={{ ...mono, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>
              view all
            </Link>
          ) : null}
        />

        {logs.length === 0 ? (
          <div style={{ ...mono, fontSize: 13.5, color: 'var(--text-muted)', padding: '26px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--z-border)', borderRadius: 11, textAlign: 'center' }}>
            No activity yet
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--z-border)', borderRadius: 11, overflow: 'hidden' }}>
            {logs.map((log, i) => (
              <div
                key={log.id}
                style={{
                  display: 'grid', gridTemplateColumns: '110px 1fr 130px',
                  padding: '12px 18px', alignItems: 'center', gap: 14,
                  borderBottom: i < logs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <span style={{ ...mono, fontSize: 12.5, color: '#fff' }}>
                  {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ ...mono, fontSize: 13.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.action}
                </span>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <ResultBadge result={log.result} />
                </div>
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
            <p style={{ ...mono, fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 24 }}>
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
            <h2 style={{ ...grotesk, fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 6, color: 'var(--danger)' }}>
              Disable agent
            </h2>
            <p style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
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
