'use client';

import { useEffect, useState } from 'react';
import { Check, X, Slash } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { auditApi, AuditLog } from '@/lib/api';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };
const grotesk: React.CSSProperties = { fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif' };

const cellEllipsis: React.CSSProperties = {
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
};

function ResultIcon({ result }: { result: string }) {
  if (result === 'SUCCESS') {
    return (
      <span aria-label="ok" title="ok" style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 18, height: 18, borderRadius: '50%',
        background: 'rgba(200,245,66,0.14)',
        color: 'var(--accent)',
        boxShadow: '0 0 8px rgba(200,245,66,0.25)',
      }}>
        <Check size={11} strokeWidth={3} />
      </span>
    );
  }
  if (result === 'BLOCKED_REVOKED') {
    return (
      <span aria-label="revoked" title="revoked" style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 18, height: 18, borderRadius: '50%',
        background: 'rgba(255,255,255,0.04)',
        color: 'var(--text-faint)',
      }}>
        <Slash size={10} strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span aria-label="blocked" title={result.replace('BLOCKED_', '').toLowerCase()} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 18, height: 18, borderRadius: '50%',
      background: 'rgba(255,92,92,0.12)',
      color: '#ff8a8a',
    }}>
      <X size={11} strokeWidth={3} />
    </span>
  );
}

const FILTERS = [
  { v: '', label: 'All' },
  { v: 'SUCCESS', label: 'Success' },
  { v: 'BLOCKED_INVALID_KEY', label: 'Invalid key' },
  { v: 'BLOCKED_RULE', label: 'Rule blocked' },
  { v: 'BLOCKED_REVOKED', label: 'Revoked' },
];

const COLS = 'minmax(160px, 180px) minmax(0, 1.5fr) minmax(110px, 130px) 32px minmax(0, 2fr)';

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
    <div style={{
      padding: '28px 56px 40px', maxWidth: 1180, margin: '0 auto',
      display: 'flex', flexDirection: 'column', gap: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ ...grotesk, fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, lineHeight: 1.1 }}>
            Audit log<span style={{ color: 'var(--accent)' }}>.</span>
          </h1>
          <p style={{ ...mono, fontSize: 11.5, color: 'var(--text-muted)', margin: '4px 0 0', letterSpacing: '0.02em' }}>
            All agent actions · {logs.length} entr{logs.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(opt => {
            const active = filter === opt.v;
            return (
              <button
                key={opt.v || 'all'}
                onClick={() => applyFilter(opt.v)}
                style={{
                  ...mono, fontSize: 11.5, padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
                  background: active ? 'rgba(200,245,66,0.1)' : 'rgba(255,255,255,0.03)',
                  color: active ? 'var(--accent)' : 'var(--text-dim)',
                  border: `1px solid ${active ? 'rgba(200,245,66,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  transition: 'all 120ms ease',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  letterSpacing: '0.02em',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <hr style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: 0, border: 0 }} />

      {/* Table */}
      {loading ? (
        <p style={{ ...mono, fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', paddingTop: 40 }}>loading…</p>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <p style={{ fontSize: 36, marginBottom: 12, opacity: 0.18 }}>≡</p>
          <p style={{ ...grotesk, fontSize: 16, fontWeight: 500, marginBottom: 6, color: 'var(--text-dim)' }}>No logs yet</p>
          <p style={{ ...mono, fontSize: 12, color: 'var(--text-faint)' }}>Agent activity will appear here</p>
        </div>
      ) : (
        <div>
          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: COLS, gap: 16,
            padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ ...mono, fontSize: 9.5, color: 'var(--text-faint)', letterSpacing: '0.14em' }}>TIME</span>
            <span style={{ ...mono, fontSize: 9.5, color: 'var(--text-faint)', letterSpacing: '0.14em' }}>ACTION</span>
            <span style={{ ...mono, fontSize: 9.5, color: 'var(--text-faint)', letterSpacing: '0.14em' }}>PLATFORM</span>
            <span style={{ ...mono, fontSize: 9.5, color: 'var(--text-faint)', letterSpacing: '0.14em', textAlign: 'center' }}> </span>
            <span style={{ ...mono, fontSize: 9.5, color: 'var(--text-faint)', letterSpacing: '0.14em' }}>INPUT</span>
          </div>

          {logs.map((log, i) => (
            <div
              key={log.id}
              style={{
                display: 'grid', gridTemplateColumns: COLS, gap: 16,
                padding: '11px 0', alignItems: 'center',
                borderBottom: i < logs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <span style={{ ...mono, fontSize: 11.5, color: '#fff', letterSpacing: '0.02em' }}>
                {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ ...mono, fontSize: 12, color: 'var(--text)', ...cellEllipsis }}>
                {log.action}
              </span>
              <span style={{ ...mono, fontSize: 11.5, color: 'var(--text-dim)', ...cellEllipsis }}>
                {log.platform}
              </span>
              <span style={{ display: 'flex', justifyContent: 'center' }}>
                <ResultIcon result={log.result} />
              </span>
              <span style={{ ...mono, fontSize: 11.5, color: 'var(--text-muted)', ...cellEllipsis }}>
                {log.user_input ? `"${log.user_input}"` : log.rule_violated ? `rule: ${log.rule_violated}` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
