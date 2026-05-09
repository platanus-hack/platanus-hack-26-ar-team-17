'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { keysApi, kycApi, ApiKey } from '@/lib/api';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

const PLATFORMS = [
  { value: 'mcp', label: 'MCP Server', icon: '⬡' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '◎' },
  { value: 'telegram', label: 'Telegram', icon: '◈' },
  { value: 'slack', label: 'Slack', icon: '◆' },
  { value: 'api', label: 'Direct API', icon: '⟨⟩' },
  { value: 'custom', label: 'Custom', icon: '◇' },
];

function PlatformIcon({ platform }: { platform: string }) {
  const p = PLATFORMS.find(x => x.value === platform) ?? PLATFORMS[PLATFORMS.length - 1];
  return (
    <span style={{ ...mono, fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ opacity: 0.6 }}>{p.icon}</span>
      {p.label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === 'ACTIVE';
  return (
    <span className={`pill-base ${active ? 'pill-active' : 'pill-disabled'}`}>
      <span style={{ fontSize: 7, animation: active ? 'pulse 2s ease-in-out infinite' : 'none' }}>
        {active ? '●' : '○'}
      </span>
      {active ? 'active' : 'revoked'}
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
    <div className="key-reveal fade-in">
      <p style={{ ...mono, fontSize: 11, color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>⚠</span> Save this key — shown only once
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <code style={{
          ...mono, fontSize: 13, color: 'var(--text)',
          background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-strong)',
          padding: '10px 14px', borderRadius: 7, flex: 1,
          wordBreak: 'break-all', lineHeight: 1.6,
        }}>
          {plainKey}
        </code>
        <button
          onClick={copy}
          style={{
            ...mono, fontSize: 11, padding: '10px 14px', borderRadius: 7, cursor: 'pointer',
            background: copied ? 'rgba(200,245,66,0.12)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${copied ? 'rgba(200,245,66,0.3)' : 'rgba(255,255,255,0.1)'}`,
            color: copied ? 'var(--accent)' : 'var(--text-dim)',
            transition: 'all 120ms ease', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <button onClick={onDismiss} style={{
        ...mono, fontSize: 11, color: 'var(--text-faint)', marginTop: 10,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      }}>
        I saved it — dismiss ↑
      </button>
    </div>
  );
}

export default function KeysPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', platform: 'mcp' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [kycBlocked, setKycBlocked] = useState(false);
  const [kycUrl, setKycUrl] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    try { setKeys(await keysApi.list(token)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    setCreateError('');
    try {
      const result = await keysApi.create(token, form);
      setNewKey(result.plainKey);
      setShowCreate(false);
      setForm({ name: '', platform: 'mcp' });
      await load();
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.message === 'kyc_required' || e.status === 403) {
        setShowCreate(false);
        setKycBlocked(true);
        try {
          const s = await kycApi.status(token!);
          if (s.session_url) setKycUrl(s.session_url);
        } catch {}
      } else {
        setCreateError(e.message ?? 'Failed to create key');
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    if (!token || !confirm('Revoke this key? This cannot be undone.')) return;
    await keysApi.revoke(token, keyId);
    setKeys(prev => prev.map(k => k.id === keyId ? { ...k, status: 'REVOKED' as const } : k));
  }

  const activeKeys = keys.filter(k => k.status === 'ACTIVE');

  return (
    <div style={{ padding: '40px 48px', maxWidth: 920 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: '0 0 4px', fontFamily: 'var(--font-grotesk-var), sans-serif' }}>
            API Keys
          </h1>
          <p style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            {activeKeys.length} active key{activeKeys.length !== 1 ? 's' : ''} — one per agent or MCP server
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
          + New Key
        </button>
      </div>

      {/* New key reveal */}
      {newKey && <KeyCopyBox plainKey={newKey} onDismiss={() => setNewKey(null)} />}

      {/* KYC blocked banner */}
      {kycBlocked && (
        <div className="kyc-banner fade-in">
          <div>
            <p style={{ ...mono, fontSize: 12, color: '#ffb84d', marginBottom: 4 }}>Identity verification required</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              You need to verify your identity before creating API keys.
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
            <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 6, fontFamily: 'var(--font-grotesk-var), sans-serif' }}>
              New API Key
            </h2>
            <p style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
              One key per agent or MCP server — revoke individually if compromised.
            </p>

            <form onSubmit={handleCreate}>
              <div className="field">
                <label className="field-label">Key name</label>
                <input
                  className="z-input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sales Bot, Filesystem MCP"
                  required
                  autoFocus
                />
              </div>

              <div className="field" style={{ marginBottom: 20 }}>
                <label className="field-label" style={{ marginBottom: 10 }}>Platform / type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {PLATFORMS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, platform: p.value }))}
                      style={{
                        ...mono, fontSize: 11,
                        padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
                        background: form.platform === p.value ? 'rgba(200,245,66,0.08)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${form.platform === p.value ? 'rgba(200,245,66,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        color: form.platform === p.value ? 'var(--accent)' : 'var(--text-muted)',
                        transition: 'all 120ms ease',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <span style={{ opacity: 0.7 }}>{p.icon}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

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
                  {creating ? 'Creating…' : 'Create key →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Keys list */}
      {loading ? (
        <p style={{ ...mono, fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', paddingTop: 60 }}>loading keys…</p>
      ) : keys.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.15 }}>⬡</div>
          <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No keys yet</p>
          <p style={{ ...mono, fontSize: 12, color: 'var(--text-muted)' }}>
            Create your first key — one per agent or MCP server
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 110px 80px', padding: '8px 20px' }}>
            {['Key', 'Platform', 'Status', 'Created', ''].map(h => (
              <span key={h} style={{ ...mono, fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</span>
            ))}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--z-border)', borderRadius: 10, overflow: 'hidden' }}>
            {keys.map((key, i) => (
              <div
                key={key.id}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 130px 120px 110px 80px',
                  padding: '14px 20px', alignItems: 'center',
                  borderBottom: i < keys.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <code style={{ ...mono, fontSize: 13, color: 'var(--text)' }}>{key.prefix}…</code>
                  <span style={{ ...mono, fontSize: 10, color: 'var(--text-faint)', marginLeft: 10 }}>{key.name}</span>
                </div>

                <PlatformIcon platform={key.platform ?? 'custom'} />
                <StatusPill status={key.status} />

                <span style={{ ...mono, fontSize: 11, color: 'var(--text-muted)' }}>
                  {new Date(key.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {key.status === 'ACTIVE' && (
                    <button onClick={() => handleRevoke(key.id)} className="btn btn-danger" style={{ ...mono, fontSize: 10, padding: '4px 10px' }}>
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
