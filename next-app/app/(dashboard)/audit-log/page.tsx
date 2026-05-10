'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { auditApi, AuditLog } from '@/lib/api';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

const RESULT_COLORS: Record<string, string> = {
  SUCCESS: '#c8f542',
  BLOCKED_INVALID_KEY: '#ff5c5c',
  BLOCKED_RULE: '#ff5c5c',
  BLOCKED_REVOKED: '#8a8a8a',
};

function ResultBadge({ result }: { result: string }) {
  const color = RESULT_COLORS[result] ?? '#8a8a8a';
  return (
    <span style={{
      ...mono, fontSize: 10, letterSpacing: '0.05em',
      padding: '3px 8px', borderRadius: 999,
      background: `${color}11`, color,
      border: `1px solid ${color}33`,
    }}>
      {result === 'SUCCESS' ? '✓ success' : result.replace('BLOCKED_', '').toLowerCase()}
    </span>
  );
}

export default function AuditLogPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  async function load(result?: string) {
    if (!token) return;
    setLoading(true);
    try {
      const params = result ? { result } : undefined;
      setLogs(await auditApi.list(token, params));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  function applyFilter(val: string) {
    setFilter(val);
    load(val || undefined);
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', margin: '0 0 8px', fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif' }}>Audit Log</h1>
          <p style={{ ...mono, fontSize: 15, color: 'var(--text-muted)', margin: 0 }}>
            All agent actions — {logs.length} entries
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { v: '', label: 'All' },
            { v: 'SUCCESS', label: 'Success' },
            { v: 'BLOCKED_INVALID_KEY', label: 'Invalid key' },
            { v: 'BLOCKED_RULE', label: 'Rule blocked' },
            { v: 'BLOCKED_REVOKED', label: 'Revoked' },
          ].map(opt => {
            const active = filter === opt.v;
            return (
              <button
                key={opt.v || 'all'}
                onClick={() => applyFilter(opt.v)}
                style={{
                  ...mono, fontSize: 12, padding: '7px 13px', borderRadius: 999, cursor: 'pointer',
                  background: active ? 'rgba(200,245,66,0.1)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-dim)',
                  border: `1px solid ${active ? 'rgba(200,245,66,0.28)' : 'var(--border-strong)'}`,
                  transition: 'all 120ms ease',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p style={{ ...mono, fontSize: 12, color: '#3a3a3a', textAlign: 'center', paddingTop: 60 }}>loading…</p>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <p style={{ fontSize: 40, marginBottom: 16, opacity: 0.2 }}>≡</p>
          <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No logs yet</p>
          <p style={{ ...mono, fontSize: 12, color: '#5a5a5a' }}>Agent activity will appear here</p>
        </div>
      ) : (
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid #1c1c1c', borderRadius: 10, overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '160px 140px 110px 130px 1fr',
            padding: '10px 20px', borderBottom: '1px solid #1c1c1c',
            background: '#0a0a0a',
          }}>
            {['TIME', 'ACTION', 'PLATFORM', 'RESULT', 'INPUT'].map(h => (
              <span key={h} style={{ ...mono, fontSize: 10, color: '#3a3a3a', letterSpacing: '0.08em' }}>{h}</span>
            ))}
          </div>

          {logs.map((log, i) => (
            <div
              key={log.id}
              style={{
                display: 'grid', gridTemplateColumns: '160px 140px 110px 130px 1fr',
                padding: '12px 20px',
                borderBottom: i < logs.length - 1 ? '1px solid #111' : 'none',
                transition: 'background 120ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ ...mono, fontSize: 11, color: '#5a5a5a' }}>
                {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ ...mono, fontSize: 12, color: '#fafafa' }}>{log.action}</span>
              <span style={{ ...mono, fontSize: 11, color: '#8a8a8a' }}>{log.platform}</span>
              <ResultBadge result={log.result} />
              <span style={{ ...mono, fontSize: 11, color: '#5a5a5a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.user_input ? `"${log.user_input}"` : log.rule_violated ? `rule: ${log.rule_violated}` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
