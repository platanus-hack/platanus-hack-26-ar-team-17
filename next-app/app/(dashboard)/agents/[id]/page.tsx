'use client';

import { useEffect, useState, FormEvent, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

function CopyBox({ label, value, hint, onDismiss, accent }: {
  label: string; value: string; hint?: string; onDismiss?: () => void; accent?: 'lime' | 'plain';
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  const bg = accent === 'plain'
    ? { background: 'rgba(255,255,255,0.02)', border: '1px solid var(--z-border)', borderRadius: 11, padding: '18px 20px', marginBottom: 0 }
    : undefined;
  const labelColor = accent === 'plain' ? 'var(--text-dim)' : 'var(--accent)';
  return (
    <div className={accent === 'plain' ? '' : 'key-reveal fade-in'} style={bg}>
      <p style={{ ...mono, fontSize: 11, color: labelColor, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
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
      {onDismiss && (
        <button onClick={onDismiss} style={{
          ...mono, fontSize: 11, color: 'var(--text-faint)', marginTop: 10,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}>Dismiss ↑</button>
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
      <h2 style={{ ...mono, fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.14em', textTransform: 'uppercase', margin: 0 }}>
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
      <div style={{ padding: '40px 48px' }}>
        <p style={{ ...mono, fontSize: 12, color: 'var(--text-faint)' }}>loading agent…</p>
      </div>
    );
  }

  if (notFound || !agent) {
    return (
      <div style={{ padding: '40px 48px' }}>
        <Link href="/agents" style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>← Agents</Link>
        <p style={{ marginTop: 40, fontSize: 16 }}>Agent not found.</p>
      </div>
    );
  }

  const activeKeys = keys.filter(k => k.status === 'ACTIVE');
  const isMcp = agent.type === 'mcp';
  const isActive = agent.status === 'ACTIVE';

  return (
    <div style={{ padding: '40px 48px', maxWidth: 920 }}>
      {/* Breadcrumb */}
      <Link href="/agents" style={{
        ...mono, fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 22,
        transition: 'color 120ms ease',
      }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-dim)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        ← Agents
      </Link>

      {/* Header card */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isMcp ? 'rgba(200,245,66,0.07)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isMcp ? 'rgba(200,245,66,0.2)' : 'rgba(255,255,255,0.08)'}`,
              color: isMcp ? 'var(--accent)' : 'var(--text-dim)',
              fontSize: 20, flexShrink: 0,
            }}>
              {isMcp ? '⬡' : '◎'}
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ ...grotesk, fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.15 }}>
                {agent.name}
              </h1>
              <div style={{ ...mono, fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>{isMcp ? 'mcp' : 'agent'}</span>
                <span style={{ opacity: 0.3 }}>·</span>
                <span>{agent.platform}</span>
                <span style={{ opacity: 0.3 }}>·</span>
                <span>created {new Date(agent.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <StatusPill status={agent.status} />
            {isActive && (
              <button
                onClick={() => { setShowDisable(true); setDisableConfirm(''); }}
                className="btn btn-danger"
                style={{ ...mono, fontSize: 11, padding: '7px 14px' }}
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
          <CopyBox label="Save this key — shown only once" value={revealedKey} onDismiss={() => setRevealedKey(null)} />
        </div>
      )}

      {/* Credentials / Endpoint */}
      <section style={{ marginBottom: 36 }}>
        <SectionHeader
          title={isMcp ? 'Endpoint' : 'Credentials'}
          action={!isMcp && isActive ? (
            <button
              onClick={() => { setShowRotate(true); setRotateError(''); setRotateName(''); }}
              style={{
                ...mono, fontSize: 11, padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-dim)', transition: 'all 120ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
            >
              + Rotate key
            </button>
          ) : null}
        />

        {isMcp ? (
          agent.mcp_url ? (
            <CopyBox label="MCP endpoint" hint="point your MCP client at this URL" value={agent.mcp_url} accent="plain" />
          ) : (
            <div style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--z-border)', borderRadius: 11 }}>
              MCP URL unavailable — verify your identity to receive your user hash.
            </div>
          )
        ) : keys.length === 0 ? (
          <div style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', padding: '24px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--z-border)', borderRadius: 11, textAlign: 'center' }}>
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
                  <code style={{ ...mono, fontSize: 13, color: 'var(--text)' }}>{key.prefix}…</code>
                  <span style={{ ...mono, fontSize: 11, color: 'var(--text-faint)', marginLeft: 10 }}>{key.name}</span>
                </div>
                <StatusPill status={key.status} />
                <span style={{ ...mono, fontSize: 11, color: 'var(--text-muted)', minWidth: 70, textAlign: 'right' }}>
                  {new Date(key.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <div style={{ width: 76, display: 'flex', justifyContent: 'flex-end' }}>
                  {key.status === 'ACTIVE' && (
                    <button onClick={() => handleRevoke(key.id)} className="btn btn-danger" style={{ ...mono, fontSize: 10, padding: '4px 10px' }}>
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
            <Link href={`/audit-log?agentId=${agent.id}`} style={{ ...mono, fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none' }}>
              view all →
            </Link>
          ) : null}
        />

        {logs.length === 0 ? (
          <div style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', padding: '24px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--z-border)', borderRadius: 11, textAlign: 'center' }}>
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
                <span style={{ ...mono, fontSize: 11, color: 'var(--text-muted)' }}>
                  {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ ...mono, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            <h2 style={{ ...grotesk, fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 6 }}>
              Rotate key
            </h2>
            <p style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
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
                <button type="button" onClick={() => setShowRotate(false)} className="btn btn-secondary" style={{ flex: 1, ...mono, fontSize: 13 }}>
                  Cancel
                </button>
                <button type="submit" disabled={rotating} className="btn btn-primary" style={{ flex: 2, ...mono, fontSize: 13 }}>
                  {rotating ? 'Rotating…' : 'Rotate →'}
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
            <p style={{ ...mono, fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>
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
              <button type="button" onClick={() => setShowDisable(false)} className="btn btn-secondary" style={{ flex: 1, ...mono, fontSize: 13 }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisable}
                disabled={disabling || disableConfirm !== agent.name}
                className="btn btn-danger"
                style={{ flex: 2, ...mono, fontSize: 13 }}
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
