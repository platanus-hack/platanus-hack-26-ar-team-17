'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { auditApi, AuditLog } from '@/lib/api';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

const RESULT_COLORS: Record<string, string> = {
  SUCCESS: '#c8f542',
  BLOCKED_INVALID_KEY: '#ff5c5c',
  BLOCKED_SCOPE: '#ffb84d',
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
    <div style={{ padding: '40px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Audit Log</h1>
          <p style={{ ...mono, fontSize: 12, color: '#5a5a5a', margin: 0 }}>
            All agent actions — {logs.length} entries
          </p>
        </div>
        <select
          value={filter}
          onChange={e => applyFilter(e.target.value)}
          style={{
            ...mono, fontSize: 11, padding: '8px 12px', borderRadius: 6,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#8a8a8a', outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="" style={{ background: '#0a0a0a' }}>All results</option>
          <option value="SUCCESS" style={{ background: '#0a0a0a' }}>Success</option>
          <option value="BLOCKED_INVALID_KEY" style={{ background: '#0a0a0a' }}>Invalid key</option>
          <option value="BLOCKED_SCOPE" style={{ background: '#0a0a0a' }}>Scope blocked</option>
          <option value="BLOCKED_RULE" style={{ background: '#0a0a0a' }}>Rule blocked</option>
          <option value="BLOCKED_REVOKED" style={{ background: '#0a0a0a' }}>Revoked</option>
        </select>
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
