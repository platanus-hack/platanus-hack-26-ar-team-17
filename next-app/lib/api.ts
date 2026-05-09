export type KycStatus = 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED';

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  prefix: string;
  status: 'ACTIVE' | 'REVOKED';
  created_at: string;
  revoked_at?: string | null;
}

export interface AuditLog {
  id: string;
  api_key_id?: string | null;
  user_id?: string | null;
  action: string;
  platform: string;
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
  login: (email: string, password: string) =>
    req<{ token: string; userId: string; kycStatus: KycStatus }>('/api/auth/login', null, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, full_name?: string, company?: string) =>
    req<{ token: string; userId: string; kycStatus: KycStatus }>('/api/auth/register', null, {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name, company }),
    }),
};

export const keysApi = {
  list: (token: string) => req<ApiKey[]>('/api/keys', token),
  create: (token: string, data: { name: string }) =>
    req<{ id: string; plainKey: string; prefix: string }>('/api/keys', token, {
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
