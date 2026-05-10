export type KycStatus = 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED';

export type AgentType = 'agent' | 'mcp';

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  type: AgentType;
  platform: string;
  status: 'ACTIVE' | 'DISABLED';
  created_at: string;
  mcp_url?: string | null;
}

export interface ApiKey {
  id: string;
  agent_id: string;
  agent_name?: string;
  agent_type?: AgentType;
  name: string;
  platform: string;
  prefix: string;
  scope?: string[];
  status: 'ACTIVE' | 'REVOKED';
  created_at: string;
  revoked_at?: string | null;
}

export interface AgentKeySummary {
  id: string;
  name: string;
  prefix: string;
  status: 'ACTIVE' | 'REVOKED';
  created_at: string;
  revoked_at: string | null;
}

export interface AuditLog {
  id: string;
  agent_id?: string | null;
  api_key_id?: string | null;
  user_id?: string | null;
  action: string;
  platform: string;
  user_input?: string | null;
  result: 'SUCCESS' | 'BLOCKED_INVALID_KEY' | 'BLOCKED_SCOPE' | 'BLOCKED_RULE' | 'BLOCKED_REVOKED';
  rule_violated?: string | null;
  created_at: string;
}

async function req<T>(path: string, token: string | null, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export const authApi = {
  loginWithOAuth: (supabase_access_token: string) =>
    req<{ token: string; userId: string; kycStatus: KycStatus }>('/api/auth/login', null, {
      method: 'POST',
      body: JSON.stringify({ supabase_access_token }),
    }),
};

export const agentsApi = {
  list: (token: string) => req<Agent[]>('/api/agents', token),
  get: (token: string, agentId: string) =>
    req<{ agent: Agent; keys: AgentKeySummary[] }>(`/api/agents/${agentId}`, token),
  create: (
    token: string,
    data: { name: string; platform: string; type: AgentType },
  ) =>
    req<{
      agent: Agent;
      key: { id: string; plainKey: string; prefix: string } | null;
    }>('/api/agents', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  disable: (token: string, agentId: string) =>
    req<{ success: true }>(`/api/agents/${agentId}`, token, { method: 'DELETE' }),
};

export const keysApi = {
  list: (token: string, agentId?: string) =>
    req<ApiKey[]>(`/api/keys${agentId ? `?agent_id=${agentId}` : ''}`, token),
  rotate: (token: string, data: { agent_id: string; name: string }) =>
    req<{ id: string; plainKey: string; prefix: string; agent_id: string }>('/api/keys', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  revoke: (token: string, keyId: string) =>
    req<void>(`/api/keys/${keyId}`, token, { method: 'DELETE' }),
};

export const kycApi = {
  start: (token: string) =>
    req<{ url: string; session_id: string; resumed?: boolean }>('/api/kyc/start', token, {
      method: 'POST',
    }),
  status: (token: string) =>
    req<{ status: KycStatus; verified_at: string | null; session_url: string | null }>('/api/kyc/status', token),
};

export const auditApi = {
  list: (token: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return req<AuditLog[]>(`/api/audit-log${qs}`, token);
  },
};

export const alertsApi = {
  list: (token: string) => req<AuditLog[]>('/api/alerts', token),
};
