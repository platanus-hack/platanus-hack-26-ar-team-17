'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { agentsApi, keysApi, Agent, ApiKey } from '@/lib/api';

const PLATFORMS = ['whatsapp', 'telegram', 'facebook', 'instagram', 'slack', 'custom'];
const ALL_ACTIONS = ['send_message', 'read_messages', 'create_post', 'delete_post', 'read_profile', 'update_profile'];

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

function StatusPill({ status }: { status: string }) {
  const active = status === 'ACTIVE';
  return (
    <span style={{
      ...mono, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '3px 8px', borderRadius: 999,
      background: active ? 'rgba(200,245,66,0.08)' : 'rgba(255,255,255,0.04)',
      color: active ? '#c8f542' : '#5a5a5a',
      border: `1px solid ${active ? 'rgba(200,245,66,0.3)' : '#2a2a2a'}`,
    }}>
      {active ? '● active' : '○ disabled'}
    </span>
  );
}

function KeyCopyBox({ plainKey, onDismiss }: { plainKey: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(plainKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      background: 'rgba(200,245,66,0.04)',
      border: '1px solid rgba(200,245,66,0.25)',
      borderRadius: 10, padding: 20, marginBottom: 24,
    }} className="fade-enter">
      <p style={{ ...mono, fontSize: 11, color: '#c8f542', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        ⚠ Save this key — it will never be shown again
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <code style={{
          ...mono, fontSize: 13, color: '#fafafa',
          background: 'rgba(0,0,0,0.4)', border: '1px solid #2a2a2a',
          padding: '10px 14px', borderRadius: 6, flex: 1,
          wordBreak: 'break-all', lineHeight: 1.5,
        }}>
          {plainKey}
        </code>
        <button onClick={copy} style={{
          ...mono, fontSize: 11, padding: '10px 14px', borderRadius: 6, cursor: 'pointer',
          background: copied ? 'rgba(200,245,66,0.15)' : 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)', color: copied ? '#c8f542' : '#8a8a8a',
          transition: 'all 120ms ease', whiteSpace: 'nowrap',
        }}>
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <button onClick={onDismiss} style={{
        ...mono, fontSize: 11, color: '#5a5a5a', marginTop: 10, background: 'none',
        border: 'none', cursor: 'pointer', padding: 0,
      }}>
        I saved it — dismiss
      </button>
    </div>
  );
}

function AgentCard({
  agent, token, onDisable,
}: {
  agent: Agent;
  token: string;
  onDisable: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  async function loadKeys() {
    if (keys.length > 0) { setExpanded(e => !e); return; }
    setExpanded(true);
    setKeysLoading(true);
    try {
      setKeys(await keysApi.list(token, agent.id));
    } finally {
      setKeysLoading(false);
    }
  }

  async function rotate() {
    setRotating(true);
    try {
      const result = await keysApi.rotate(token, agent.id);
      setNewKey(result.plainKey);
      setKeys(await keysApi.list(token, agent.id));
    } finally {
      setRotating(false);
    }
  }

  async function revokeKey(keyId: string) {
    await keysApi.revoke(token, keyId);
    setKeys(await keysApi.list(token, agent.id));
  }

  const activeKeys = keys.filter(k => k.status === 'ACTIVE');

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid #1c1c1c',
      borderRadius: 12, padding: 24, transition: 'border-color 200ms ease',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1c1c1c')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.02em', margin: '0 0 6px' }}>{agent.name}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...mono, fontSize: 11, color: '#8a8a8a', background: '#0a0a0a', border: '1px solid #1c1c1c', padding: '2px 8px', borderRadius: 4 }}>
              {agent.platform}
            </span>
            <StatusPill status={agent.status} />
          </div>
        </div>
        {agent.status === 'ACTIVE' && (
          <button
            onClick={onDisable}
            style={{
              ...mono, fontSize: 11, padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
              background: 'rgba(255,92,92,0.06)', border: '1px solid rgba(255,92,92,0.2)',
              color: 'rgba(255,92,92,0.7)', transition: 'all 120ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,92,92,0.12)'; e.currentTarget.style.color = '#ff5c5c'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,92,92,0.06)'; e.currentTarget.style.color = 'rgba(255,92,92,0.7)'; }}
          >
            disable
          </button>
        )}
      </div>

      {agent.scope.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
          {agent.scope.map(s => (
            <span key={s} style={{ ...mono, fontSize: 10, color: '#5a5a5a', background: '#0a0a0a', border: '1px solid #1c1c1c', padding: '2px 8px', borderRadius: 4 }}>
              {s}
            </span>
          ))}
        </div>
      )}

      <div style={{ borderTop: '1px solid #1c1c1c', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...mono, fontSize: 10, color: '#3a3a3a' }}>
          created {new Date(agent.created_at).toLocaleDateString()}
        </span>
        <button
          onClick={loadKeys}
          style={{
            ...mono, fontSize: 11, padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#8a8a8a', transition: 'all 120ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fafafa'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#8a8a8a'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
        >
          {expanded ? 'hide keys ▲' : 'show keys ▼'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 16 }} className="fade-enter">
          {newKey && <KeyCopyBox plainKey={newKey} onDismiss={() => setNewKey(null)} />}

          {keysLoading ? (
            <p style={{ ...mono, fontSize: 11, color: '#3a3a3a', textAlign: 'center', padding: '20px 0' }}>loading keys…</p>
          ) : (
            <>
              {keys.length === 0 ? (
                <p style={{ ...mono, fontSize: 12, color: '#5a5a5a', textAlign: 'center', padding: '16px 0' }}>no keys yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {keys.map(k => (
                    <div key={k.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: '#0a0a0a', border: '1px solid #1c1c1c', borderRadius: 6, padding: '10px 14px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <code style={{ ...mono, fontSize: 12, color: '#fafafa' }}>{k.prefix}…</code>
                        <StatusPill status={k.status} />
                        <span style={{ ...mono, fontSize: 10, color: '#3a3a3a' }}>{k.name}</span>
                      </div>
                      {k.status === 'ACTIVE' && (
                        <button
                          onClick={() => revokeKey(k.id)}
                          style={{
                            ...mono, fontSize: 10, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                            background: 'none', border: '1px solid #2a2a2a', color: '#5a5a5a',
                            transition: 'all 120ms ease',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,92,92,0.3)'; e.currentTarget.style.color = '#ff5c5c'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#5a5a5a'; }}
                        >
                          revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {agent.status === 'ACTIVE' && (
                <button
                  onClick={rotate}
                  disabled={rotating || activeKeys.length >= 3}
                  style={{
                    ...mono, fontSize: 11, padding: '8px 14px', borderRadius: 6, cursor: rotating ? 'not-allowed' : 'pointer',
                    background: 'rgba(200,245,66,0.06)', border: '1px solid rgba(200,245,66,0.2)',
                    color: '#c8f542', transition: 'all 120ms ease', opacity: rotating ? 0.5 : 1,
                  }}
                >
                  {rotating ? 'rotating…' : '+ rotate key'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const { token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', platform: 'whatsapp', scope: [...ALL_ACTIONS] });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  async function load() {
    if (!token) return;
    try { setAgents(await agentsApi.list(token)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token]);

  function toggleScope(action: string) {
    setForm(f => ({
      ...f,
      scope: f.scope.includes(action)
        ? f.scope.filter(s => s !== action)
        : [...f.scope, action],
    }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (form.scope.length === 0) { setCreateError('Select at least one permission'); return; }
    setCreating(true);
    setCreateError('');
    try {
      const { agent, key } = await agentsApi.create(token, form);
      setAgents(prev => [agent, ...prev]);
      setNewKey(key.plainKey);
      setShowCreate(false);
      setForm({ name: '', platform: 'whatsapp', scope: [...ALL_ACTIONS] });
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setCreating(false);
    }
  }

  async function handleDisable(id: string) {
    if (!token || !confirm('Disable this agent? All its keys will be revoked.')) return;
    await agentsApi.disable(token, id);
    setAgents(prev => prev.map(a => a.id === id ? { ...a, status: 'DISABLED' } : a));
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Agents</h1>
          <p style={{ ...mono, fontSize: 12, color: '#5a5a5a', margin: 0 }}>
            {agents.length} agent{agents.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateError(''); }}
          style={{
            ...mono, fontSize: 12, padding: '10px 18px', borderRadius: 6, cursor: 'pointer',
            background: 'rgba(163,230,53,0.85)', border: '1px solid rgba(163,230,53,0.6)',
            color: '#050505', fontWeight: 500, transition: 'all 120ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(190,242,100,0.95)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(163,230,53,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(163,230,53,0.85)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          + New Agent
        </button>
      </div>

      {newKey && <KeyCopyBox plainKey={newKey} onDismiss={() => setNewKey(null)} />}

      {/* Create modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div className="fade-enter" style={{
            width: '100%', maxWidth: 480,
            background: 'rgba(10,10,10,0.95)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 14, padding: 36,
            backdropFilter: 'blur(24px)',
            boxShadow: '0 30px 80px -20px rgba(0,0,0,0.8)',
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 6 }}>New Agent</h2>
            <p style={{ ...mono, fontSize: 12, color: '#5a5a5a', marginBottom: 24 }}>
              Create a new agent and issue its first API key.
            </p>

            <form onSubmit={handleCreate}>
              <div className="field">
                <label className="field-label">AGENT NAME</label>
                <input
                  className="z-input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sales Bot"
                  required autoFocus
                />
              </div>

              <div className="field">
                <label className="field-label">PLATFORM</label>
                <select
                  className="z-input"
                  value={form.platform}
                  onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#fafafa' }}
                >
                  {PLATFORMS.map(p => <option key={p} value={p} style={{ background: '#0a0a0a' }}>{p}</option>)}
                </select>
              </div>

              <div className="field">
                <label className="field-label" style={{ marginBottom: 10 }}>PERMISSIONS</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ALL_ACTIONS.map(action => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => toggleScope(action)}
                      className={`chip ${form.scope.includes(action) ? 'active' : ''}`}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>

              {createError && (
                <p style={{ ...mono, fontSize: 11, color: 'var(--danger)', marginBottom: 12 }}>{createError}</p>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{
                    flex: 1, ...mono, fontSize: 13, padding: '12px 0', borderRadius: 6, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#8a8a8a', transition: 'all 120ms ease',
                  }}
                >
                  cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    flex: 2, ...mono, fontSize: 13, fontWeight: 500, padding: '12px 0', borderRadius: 6, cursor: 'pointer',
                    background: 'rgba(163,230,53,0.85)', border: '1px solid rgba(163,230,53,0.6)',
                    color: '#050505', transition: 'all 120ms ease', opacity: creating ? 0.6 : 1,
                  }}
                >
                  {creating ? 'Creating…' : 'Create Agent →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ ...mono, fontSize: 12, color: '#3a3a3a', textAlign: 'center', paddingTop: 60 }}>loading agents…</p>
      ) : agents.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <p style={{ fontSize: 40, marginBottom: 16, opacity: 0.2 }}>◈</p>
          <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No agents yet</p>
          <p style={{ ...mono, fontSize: 12, color: '#5a5a5a' }}>Create your first agent to get started</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              token={token!}
              onDisable={() => handleDisable(agent.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
