export interface Agent {
  id: string;
  user_id: string;
  name: string;
  platform: string;
  scope: string[];
  status: 'ACTIVE' | 'DISABLED';
  created_at: string;
}

export interface ApiKey {
  id: string;
  agent_id: string;
  name: string;
  prefix: string;
  status: 'ACTIVE' | 'REVOKED';
  created_at: string;
  revoked_at?: string | null;
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
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const authApi = {
  login: (email: string, password: string) =>
    req<{ token: string; userId: string }>('/api/auth/login', null, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string) =>
    req<{ token: string; userId: string }>('/api/auth/register', null, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
};

export const agentsApi = {
  list: (token: string) => req<Agent[]>('/api/agents', token),
  create: (token: string, data: { name: string; platform: string; scope: string[] }) =>
    req<{ agent: Agent; key: { id: string; plainKey: string; prefix: string } }>('/api/agents', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  disable: (token: string, id: string) =>
    req<void>(`/api/agents/${id}`, token, { method: 'DELETE' }),
};

export const keysApi = {
  list: (token: string, agentId: string) =>
    req<ApiKey[]>(`/api/keys?agent_id=${agentId}`, token),
  rotate: (token: string, agentId: string) =>
    req<{ id: string; plainKey: string; prefix: string }>('/api/keys', token, {
      method: 'POST',
      body: JSON.stringify({ agent_id: agentId }),
    }),
  revoke: (token: string, keyId: string) =>
    req<void>(`/api/keys/${keyId}`, token, { method: 'DELETE' }),
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
