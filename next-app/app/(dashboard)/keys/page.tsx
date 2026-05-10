'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { keysApi, ApiKey } from '@/lib/api';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

const PLATFORMS = [
  { value: 'mcp', label: 'MCP', icon: '⬡' },
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

export default function KeysPage() {
  const { token } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!token) return;
    try { setKeys(await keysApi.list(token)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token]);

  async function handleRevoke(keyId: string) {
    if (!token || !confirm('Revoke this key? This cannot be undone.')) return;
    await keysApi.revoke(token, keyId);
    setKeys(prev => prev.map(k => k.id === keyId ? { ...k, status: 'REVOKED' as const } : k));
  }

  const activeKeys = keys.filter(k => k.status === 'ACTIVE');

  return (
    <div style={{ padding: '40px 48px', maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', margin: '0 0 8px', fontFamily: 'var(--font-grotesk-var), sans-serif' }}>
            API Keys
          </h1>
          <p style={{ ...mono, fontSize: 15, color: 'var(--text-muted)', margin: 0 }}>
            {activeKeys.length} active — manage individual keys from each agent&apos;s page
          </p>
        </div>
        <Link
          href="/agents"
          className="btn btn-secondary"
          style={{ ...mono, textDecoration: 'none' }}
        >
          Manage agents
        </Link>
      </div>

      {loading ? (
        <p style={{ ...mono, fontSize: 15, color: 'var(--text-faint)', textAlign: 'center', paddingTop: 60 }}>loading keys…</p>
      ) : keys.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 50, marginBottom: 20, opacity: 0.15 }}>⬡</div>
          <p style={{ fontSize: 21, fontWeight: 500, marginBottom: 12 }}>No keys yet</p>
          <p style={{ ...mono, fontSize: 15, color: 'var(--text-muted)' }}>
            Create an agent first — its key will appear here
          </p>
          <Link href="/agents" className="btn btn-primary" style={{ ...mono, marginTop: 24, display: 'inline-flex', textDecoration: 'none' }}>
            Go to Agents
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 110px 110px 100px 80px', padding: '8px 20px' }}>
            {['Key', 'Agent', 'Platform', 'Status', 'Created', ''].map(h => (
              <span key={h} style={{ ...mono, fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</span>
            ))}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--z-border)', borderRadius: 10, overflow: 'hidden' }}>
            {keys.map((key, i) => (
              <div
                key={key.id}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 160px 110px 110px 100px 80px',
                  padding: '14px 20px', alignItems: 'center',
                  borderBottom: i < keys.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <code style={{ ...mono, fontSize: 14.5, color: 'var(--text)' }}>{key.prefix}…</code>
                  <span style={{ ...mono, fontSize: 12, color: 'var(--text-faint)', marginLeft: 12 }}>{key.name}</span>
                </div>

                {key.agent_id ? (
                  <Link
                    href={`/agents/${key.agent_id}`}
                    style={{ ...mono, fontSize: 13.5, color: 'var(--text-dim)', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                  >
                    {key.agent_name ?? '—'}
                  </Link>
                ) : (
                  <span style={{ ...mono, fontSize: 13.5, color: 'var(--text-faint)' }}>—</span>
                )}

                <PlatformIcon platform={key.platform ?? 'custom'} />
                <StatusPill status={key.status} />

                <span style={{ ...mono, fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {new Date(key.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {key.status === 'ACTIVE' && (
                    <button onClick={() => handleRevoke(key.id)} className="btn btn-danger" style={{ ...mono, fontSize: 12, padding: '7px 14px' }}>
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
