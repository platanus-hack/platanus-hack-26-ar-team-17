'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { alertsApi, AuditLog } from '@/lib/api';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

export default function AlertsPage() {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    alertsApi.list(token).then(setAlerts).finally(() => setLoading(false));
  }, [token]);

  return (
    <div style={{ padding: '40px 48px', maxWidth: 980, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', margin: '0 0 8px', fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif' }}>Alerts</h1>
        <p style={{ ...mono, fontSize: 15, color: 'var(--text-muted)', margin: 0 }}>
          Actions blocked by global rules — {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {loading ? (
        <p style={{ ...mono, fontSize: 12, color: '#3a3a3a', textAlign: 'center', paddingTop: 60 }}>loading…</p>
      ) : alerts.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <p style={{ fontSize: 40, marginBottom: 16, opacity: 0.2 }}>✓</p>
          <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No alerts</p>
          <p style={{ ...mono, fontSize: 12, color: '#5a5a5a' }}>No rule violations detected</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alerts.map(alert => (
            <div
              key={alert.id}
              className="fade-enter"
              style={{
                background: 'rgba(255,92,92,0.04)',
                border: '1px solid rgba(255,92,92,0.15)',
                borderRadius: 10, padding: '16px 20px',
                display: 'grid', gridTemplateColumns: '160px 1fr 160px',
                alignItems: 'center', gap: 16,
              }}
            >
              <span style={{ ...mono, fontSize: 11, color: '#5a5a5a' }}>
                {new Date(alert.created_at).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ ...mono, fontSize: 12, color: '#fafafa' }}>{alert.action}</span>
                  <span style={{ ...mono, fontSize: 11, color: '#8a8a8a' }}>on {alert.platform}</span>
                </div>
                {alert.user_input && (
                  <p style={{ ...mono, fontSize: 11, color: '#5a5a5a', margin: 0 }}>
                    input: &ldquo;{alert.user_input.slice(0, 80)}{alert.user_input.length > 80 ? '…' : ''}&rdquo;
                  </p>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                {alert.rule_violated && (
                  <span style={{
                    ...mono, fontSize: 10, padding: '4px 10px', borderRadius: 999,
                    background: 'rgba(255,92,92,0.08)', color: '#ff5c5c',
                    border: '1px solid rgba(255,92,92,0.2)',
                  }}>
                    rule: {alert.rule_violated}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
