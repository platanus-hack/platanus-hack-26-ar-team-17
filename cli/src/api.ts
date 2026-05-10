import { loadConfig } from './config';

export class APIError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string;
  apiUrl?: string;
}

export async function apiRequest<T = unknown>(
  pathname: string,
  opts: RequestOptions = {},
): Promise<T> {
  const cfg = loadConfig();
  const apiUrl = (opts.apiUrl ?? cfg.apiUrl).replace(/\/$/, '');
  const token = opts.token ?? cfg.token;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${apiUrl}${pathname}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    throw new APIError(0, `Could not reach ${apiUrl} — is it running?`);
  }

  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const msg =
      (parsed && typeof parsed === 'object' && 'error' in parsed && typeof (parsed as any).error === 'string'
        ? (parsed as any).error
        : null) ??
      (parsed && typeof parsed === 'object' && 'message' in parsed && typeof (parsed as any).message === 'string'
        ? (parsed as any).message
        : null) ??
      `HTTP ${res.status}`;
    throw new APIError(res.status, msg, parsed);
  }

  return parsed as T;
}
