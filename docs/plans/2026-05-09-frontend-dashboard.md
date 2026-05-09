# Frontend Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el dashboard web dentro del mismo proyecto Next.js — los usuarios gestionan sus API Keys, visualizan el audit log y ven alertas de acciones bloqueadas.

**Architecture:** El dashboard comparte `next-app/` con la Platform API (Plan 1). Las páginas van en `app/(protected)/` para rutas protegidas y `app/login/`, `app/register/` para auth pública. El JWT `type: user_session` se guarda en localStorage y se envía en cada request. Los tokens SDK no pueden autenticar el dashboard (fix VULN-001 ya en Plan 1). Todas las páginas interactivas son Client Components (`'use client'`). Los paths de la API son relativos (`/api/...`) porque el frontend y la API corren en el mismo proceso Next.js.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Jest + @testing-library/react (misma configuración del Plan 1)

**Prerequisito:** Plan 1 completado — `next-app/` inicializado con Prisma, Redis, JWT, Tailwind y API routes en `app/api/`. La config de Jest con `nextJest` ya está en `jest.config.ts`.

---

## File Structure

```
next-app/
  app/
    layout.tsx                          # Root layout — envuelve AuthProvider (Server Component)
    globals.css                         # @tailwind directives (ya existe del Plan 1)
    login/
      page.tsx                          # Login form (Client Component)
    register/
      page.tsx                          # Register form (Client Component)
    (protected)/
      layout.tsx                        # Nav + auth guard → redirige a /login si no hay token
      keys/
        page.tsx                        # Gestión de API Keys
      audit-log/
        page.tsx                        # Historial de acciones con filtros y paginación
      alerts/
        page.tsx                        # Acciones bloqueadas por regla global
  components/
    PlainKeyAlert.tsx                   # Muestra plainKey una sola vez post-creación
    KeyCard.tsx                         # Prefix, nombre, scope, botón Revoke
    CreateKeyModal.tsx                  # Form: nombre + checkboxes de scope
    AuditLogTable.tsx                   # Tabla de entradas del audit log
    AlertList.tsx                       # Lista de acciones bloqueadas
  contexts/
    AuthContext.tsx                     # JWT + userId en localStorage, setAuth/logout
  lib/
    api/
      client.ts                         # fetch wrapper con Authorization header
      auth.ts                           # register(), login()
      keys.ts                           # listKeys(), createKey(), revokeKey()
      auditLog.ts                       # listAuditLog(filters)
      alerts.ts                         # listAlerts()
  __tests__/
    components/
      PlainKeyAlert.test.tsx
      KeyCard.test.tsx
      CreateKeyModal.test.tsx
      LoginPage.test.tsx
```

---

## Task 1: API client layer

**Files:**
- Create: `next-app/lib/api/client.ts`
- Create: `next-app/lib/api/auth.ts`
- Create: `next-app/lib/api/keys.ts`
- Create: `next-app/lib/api/auditLog.ts`
- Create: `next-app/lib/api/alerts.ts`

- [ ] **Step 1: Crear lib/api/client.ts**

```typescript
type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

  const res = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'request_failed');
  return data as T;
}
```

- [ ] **Step 2: Crear lib/api/auth.ts**

```typescript
import { apiFetch } from './client';

export interface AuthResponse {
  token: string;
  userId: string;
}

export function register(email: string, password: string): Promise<AuthResponse> {
  return apiFetch('/api/auth/register', { method: 'POST', body: { email, password } });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiFetch('/api/auth/login', { method: 'POST', body: { email, password } });
}
```

- [ ] **Step 3: Crear lib/api/keys.ts**

```typescript
import { apiFetch } from './client';

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  scope: string[];
  status: 'ACTIVE' | 'REVOKED';
  createdAt: string;
  revokedAt: string | null;
}

export interface CreateKeyResponse {
  id: string;
  plainKey: string;
  prefix: string;
}

export function listKeys(token: string): Promise<ApiKeyRecord[]> {
  return apiFetch('/api/keys', { token });
}

export function createKey(
  token: string,
  params: { name: string; scope: string[] }
): Promise<CreateKeyResponse> {
  return apiFetch('/api/keys', { method: 'POST', body: params, token });
}

export function revokeKey(token: string, keyId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/keys/${keyId}`, { method: 'DELETE', token });
}
```

- [ ] **Step 4: Crear lib/api/auditLog.ts**

```typescript
import { apiFetch } from './client';

export interface AuditLogEntry {
  id: string;
  apiKeyId: string;
  action: string;
  platform: string;
  result: string;
  ruleViolated: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  keyId?: string;
  platform?: string;
  from?: string;
  to?: string;
  result?: string;
  page?: number;
}

export function listAuditLog(token: string, filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return apiFetch(`/api/audit-log${qs ? `?${qs}` : ''}`, { token });
}
```

- [ ] **Step 5: Crear lib/api/alerts.ts**

```typescript
import { apiFetch } from './client';
import type { AuditLogEntry } from './auditLog';

export function listAlerts(token: string): Promise<AuditLogEntry[]> {
  return apiFetch('/api/alerts', { token });
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/api/
git commit -m "feat: add frontend api client layer"
```

---

## Task 2: AuthContext

**Files:**
- Create: `next-app/contexts/AuthContext.tsx`

- [ ] **Step 1: Crear contexts/AuthContext.tsx**

```typescript
'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface AuthState {
  token: string | null;
  userId: string | null;
}

interface AuthContextValue extends AuthState {
  setAuth: (token: string, userId: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'auth';

function loadFromStorage(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, userId: null };
    return JSON.parse(raw) as AuthState;
  } catch {
    return { token: null, userId: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState>(loadFromStorage);

  const setAuth = useCallback((token: string, userId: string) => {
    const state = { token, userId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setAuthState(state);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuthState({ token: null, userId: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...auth, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add contexts/AuthContext.tsx
git commit -m "feat: add auth context with localStorage persistence"
```

---

## Task 3: Root layout + Login + Register pages

**Files:**
- Modify: `next-app/app/layout.tsx`
- Create: `next-app/app/login/page.tsx`
- Create: `next-app/app/register/page.tsx`
- Create: `next-app/__tests__/components/LoginPage.test.tsx`

- [ ] **Step 1: Escribir el test**

```typescript
// __tests__/components/LoginPage.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '@/app/login/page';
import * as authApi from '@/lib/api/auth';
import { AuthProvider } from '@/contexts/AuthContext';

jest.mock('@/lib/api/auth');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

function renderLogin() {
  return render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  );
}

describe('LoginPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders email and password inputs', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('calls login API on submit', async () => {
    jest.mocked(authApi.login).mockResolvedValue({ token: 'tok', userId: 'u1' });
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith('a@b.com', 'pass1234');
    });
  });

  it('shows error on failed login', async () => {
    jest.mocked(authApi.login).mockRejectedValue(new Error('invalid_credentials'));
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    await waitFor(() => {
      expect(screen.getByText(/invalid_credentials/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
cd next-app
npx jest __tests__/components/LoginPage.test.tsx
```

Expected: FAIL — Cannot find module `@/app/login/page`

- [ ] **Step 3: Actualizar app/layout.tsx**

```typescript
import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

export const metadata: Metadata = { title: 'Agent Auth Dashboard' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Crear app/login/page.tsx**

```typescript
'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { login } from '@/lib/api/auth';

export default function LoginPage() {
  const { setAuth } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { token, userId } = await login(email, password);
      setAuth(token, userId);
      router.replace('/keys');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Login</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2"
            required
          />
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
          Login
        </button>
        <p className="text-sm text-center">
          No account? <Link href="/register" className="text-blue-600 underline">Register</Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Crear app/register/page.tsx**

```typescript
'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { register } from '@/lib/api/auth';

export default function RegisterPage() {
  const { setAuth } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { token, userId } = await register(email, password);
      setAuth(token, userId);
      router.replace('/keys');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Create Account</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password (min 8 chars)
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2"
            required
            minLength={8}
          />
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
          Register
        </button>
        <p className="text-sm text-center">
          Already have an account? <Link href="/login" className="text-blue-600 underline">Login</Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Verificar que el test pasa**

```bash
npx jest __tests__/components/LoginPage.test.tsx
```

Expected: PASS — 3 tests

- [ ] **Step 7: Commit**

```bash
git add app/layout.tsx app/login/ app/register/ contexts/ __tests__/components/LoginPage.test.tsx
git commit -m "feat: add root layout, login and register pages"
```

---

## Task 4: Protected layout

**Files:**
- Create: `next-app/app/(protected)/layout.tsx`

- [ ] **Step 1: Crear app/(protected)/layout.tsx**

```typescript
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { token, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (token === null) router.replace('/login');
  }, [token, router]);

  if (!token) return null;

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex gap-6">
          <Link href="/keys" className="font-medium hover:text-blue-600">
            API Keys
          </Link>
          <Link href="/audit-log" className="font-medium hover:text-blue-600">
            Audit Log
          </Link>
          <Link href="/alerts" className="font-medium hover:text-blue-600">
            Alerts
          </Link>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-red-600"
        >
          Logout
        </button>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que el archivo existe**

```bash
ls app/\(protected\)/layout.tsx
```

Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/layout.tsx"
git commit -m "feat: add protected layout with nav and auth guard"
```

---

## Task 5: Keys page + components

**Files:**
- Create: `next-app/components/PlainKeyAlert.tsx`
- Create: `next-app/components/KeyCard.tsx`
- Create: `next-app/components/CreateKeyModal.tsx`
- Create: `next-app/app/(protected)/keys/page.tsx`
- Create: `next-app/__tests__/components/PlainKeyAlert.test.tsx`
- Create: `next-app/__tests__/components/KeyCard.test.tsx`
- Create: `next-app/__tests__/components/CreateKeyModal.test.tsx`

- [ ] **Step 1: Escribir los tests**

```typescript
// __tests__/components/PlainKeyAlert.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import PlainKeyAlert from '@/components/PlainKeyAlert';

describe('PlainKeyAlert', () => {
  it('displays the plain key', () => {
    render(<PlainKeyAlert plainKey="ak_abc123xyz" onDismiss={() => {}} />);
    expect(screen.getByText('ak_abc123xyz')).toBeInTheDocument();
  });

  it('calls onDismiss when button clicked', () => {
    const onDismiss = jest.fn();
    render(<PlainKeyAlert plainKey="ak_abc123xyz" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /i saved it/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
```

```typescript
// __tests__/components/KeyCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import KeyCard from '@/components/KeyCard';
import type { ApiKeyRecord } from '@/lib/api/keys';

const mockKey: ApiKeyRecord = {
  id: 'key_1',
  name: 'My Agent',
  prefix: 'ak_testke',
  scope: ['send_message', 'read_messages'],
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
  revokedAt: null,
};

describe('KeyCard', () => {
  it('shows key prefix and name', () => {
    render(<KeyCard apiKey={mockKey} onRevoke={() => {}} />);
    expect(screen.getByText('My Agent')).toBeInTheDocument();
    expect(screen.getByText(/ak_testke/)).toBeInTheDocument();
  });

  it('shows scope badges', () => {
    render(<KeyCard apiKey={mockKey} onRevoke={() => {}} />);
    expect(screen.getByText('send_message')).toBeInTheDocument();
    expect(screen.getByText('read_messages')).toBeInTheDocument();
  });

  it('calls onRevoke when revoke button clicked', () => {
    const onRevoke = jest.fn();
    render(<KeyCard apiKey={mockKey} onRevoke={onRevoke} />);
    fireEvent.click(screen.getByRole('button', { name: /revoke/i }));
    expect(onRevoke).toHaveBeenCalledWith('key_1');
  });

  it('does not show revoke button for revoked keys', () => {
    render(<KeyCard apiKey={{ ...mockKey, status: 'REVOKED' }} onRevoke={() => {}} />);
    expect(screen.queryByRole('button', { name: /revoke/i })).not.toBeInTheDocument();
  });
});
```

```typescript
// __tests__/components/CreateKeyModal.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateKeyModal from '@/components/CreateKeyModal';

describe('CreateKeyModal', () => {
  it('calls onCreate with name and selected scopes', async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    render(<CreateKeyModal onClose={() => {}} onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test Agent' } });
    fireEvent.click(screen.getByLabelText('send_message'));
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({ name: 'Test Agent', scope: ['send_message'] });
    });
  });

  it('shows error when no scope selected', async () => {
    render(<CreateKeyModal onClose={() => {}} onCreate={jest.fn()} />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText(/select at least one scope/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Verificar que fallan**

```bash
npx jest __tests__/components/PlainKeyAlert.test.tsx __tests__/components/KeyCard.test.tsx __tests__/components/CreateKeyModal.test.tsx
```

Expected: FAIL — cannot find modules

- [ ] **Step 3: Crear components/PlainKeyAlert.tsx**

```typescript
interface PlainKeyAlertProps {
  plainKey: string;
  onDismiss: () => void;
}

export default function PlainKeyAlert({ plainKey, onDismiss }: PlainKeyAlertProps) {
  return (
    <div className="bg-yellow-50 border border-yellow-300 rounded p-4 mb-6">
      <p className="font-semibold text-yellow-800 mb-2">
        Save this key — it will never be shown again
      </p>
      <code className="block bg-white border rounded px-3 py-2 text-sm font-mono break-all mb-3">
        {plainKey}
      </code>
      <button
        onClick={onDismiss}
        className="text-sm bg-yellow-200 hover:bg-yellow-300 px-3 py-1 rounded"
      >
        I saved it
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Crear components/KeyCard.tsx**

```typescript
import type { ApiKeyRecord } from '@/lib/api/keys';

interface KeyCardProps {
  apiKey: ApiKeyRecord;
  onRevoke: (id: string) => void;
}

export default function KeyCard({ apiKey, onRevoke }: KeyCardProps) {
  const isActive = apiKey.status === 'ACTIVE';

  return (
    <div className={`border rounded p-4 ${isActive ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">{apiKey.name}</p>
          <p className="text-sm text-gray-500 font-mono">{apiKey.prefix}••••••••</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
            }`}
          >
            {apiKey.status}
          </span>
          {isActive && (
            <button
              onClick={() => onRevoke(apiKey.id)}
              className="text-sm text-red-600 hover:underline"
            >
              Revoke
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {apiKey.scope.map((s) => (
          <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Crear components/CreateKeyModal.tsx**

```typescript
'use client';
import { useState, FormEvent } from 'react';

const AVAILABLE_SCOPES = [
  'send_message',
  'read_messages',
  'create_post',
  'delete_post',
  'read_profile',
  'update_profile',
];

interface CreateKeyModalProps {
  onClose: () => void;
  onCreate: (params: { name: string; scope: string[] }) => Promise<void>;
}

export default function CreateKeyModal({ onClose, onCreate }: CreateKeyModalProps) {
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (selectedScopes.length === 0) {
      setError('Select at least one scope');
      return;
    }
    setLoading(true);
    try {
      await onCreate({ name, scope: selectedScopes });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">Create API Key</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="key-name" className="block text-sm font-medium">
              Name
            </label>
            <input
              id="key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Scope</p>
            <div className="space-y-1">
              {AVAILABLE_SCOPES.map((scope) => (
                <label key={scope} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    aria-label={scope}
                    checked={selectedScopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                  />
                  {scope}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Crear app/(protected)/keys/page.tsx**

```typescript
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { listKeys, createKey, revokeKey } from '@/lib/api/keys';
import type { ApiKeyRecord, CreateKeyResponse } from '@/lib/api/keys';
import KeyCard from '@/components/KeyCard';
import CreateKeyModal from '@/components/CreateKeyModal';
import PlainKeyAlert from '@/components/PlainKeyAlert';

export default function KeysPage() {
  const { token } = useAuth();
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newPlainKey, setNewPlainKey] = useState<string | null>(null);

  useEffect(() => {
    if (token) listKeys(token).then(setKeys);
  }, [token]);

  async function handleCreate(params: { name: string; scope: string[] }) {
    const result: CreateKeyResponse = await createKey(token!, params);
    setNewPlainKey(result.plainKey);
    listKeys(token!).then(setKeys);
  }

  async function handleRevoke(keyId: string) {
    await revokeKey(token!, keyId);
    setKeys((prev) =>
      prev.map((k) => (k.id === keyId ? { ...k, status: 'REVOKED' as const } : k))
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My API Keys</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          New Key
        </button>
      </div>

      {newPlainKey && (
        <PlainKeyAlert plainKey={newPlainKey} onDismiss={() => setNewPlainKey(null)} />
      )}

      <div className="space-y-3">
        {keys.length === 0 && <p className="text-gray-500">No keys yet.</p>}
        {keys.map((key) => (
          <KeyCard key={key.id} apiKey={key} onRevoke={handleRevoke} />
        ))}
      </div>

      {showModal && (
        <CreateKeyModal onClose={() => setShowModal(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Verificar que los tests pasan**

```bash
npx jest __tests__/components/PlainKeyAlert.test.tsx __tests__/components/KeyCard.test.tsx __tests__/components/CreateKeyModal.test.tsx
```

Expected: PASS — 7 tests

- [ ] **Step 8: Commit**

```bash
git add components/PlainKeyAlert.tsx components/KeyCard.tsx components/CreateKeyModal.tsx "app/(protected)/keys/" __tests__/components/PlainKeyAlert.test.tsx __tests__/components/KeyCard.test.tsx __tests__/components/CreateKeyModal.test.tsx
git commit -m "feat: add keys page with create, list, revoke and plain key reveal"
```

---

## Task 6: Audit Log page + AuditLogTable component

**Files:**
- Create: `next-app/components/AuditLogTable.tsx`
- Create: `next-app/app/(protected)/audit-log/page.tsx`

- [ ] **Step 1: Crear components/AuditLogTable.tsx**

```typescript
import type { AuditLogEntry } from '@/lib/api/auditLog';

interface AuditLogTableProps {
  entries: AuditLogEntry[];
}

const RESULT_COLORS: Record<string, string> = {
  SUCCESS: 'text-green-700 bg-green-50',
  BLOCKED_SCOPE: 'text-yellow-700 bg-yellow-50',
  BLOCKED_RULE: 'text-red-700 bg-red-50',
  BLOCKED_INVALID_KEY: 'text-gray-700 bg-gray-100',
  BLOCKED_REVOKED: 'text-gray-700 bg-gray-100',
};

export default function AuditLogTable({ entries }: AuditLogTableProps) {
  if (entries.length === 0) return <p className="text-gray-500">No log entries.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-3 py-2 border-b">Action</th>
            <th className="px-3 py-2 border-b">Platform</th>
            <th className="px-3 py-2 border-b">Result</th>
            <th className="px-3 py-2 border-b">Rule</th>
            <th className="px-3 py-2 border-b">Date</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 border-b font-mono">{entry.action}</td>
              <td className="px-3 py-2 border-b">{entry.platform}</td>
              <td className="px-3 py-2 border-b">
                <span className={`text-xs px-2 py-0.5 rounded ${RESULT_COLORS[entry.result] ?? ''}`}>
                  {entry.result}
                </span>
              </td>
              <td className="px-3 py-2 border-b text-gray-500">{entry.ruleViolated ?? '—'}</td>
              <td className="px-3 py-2 border-b text-gray-500">
                {new Date(entry.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Crear app/(protected)/audit-log/page.tsx**

```typescript
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { listAuditLog } from '@/lib/api/auditLog';
import type { AuditLogEntry, AuditLogFilters } from '@/lib/api/auditLog';
import AuditLogTable from '@/components/AuditLogTable';

const RESULTS = ['', 'SUCCESS', 'BLOCKED_SCOPE', 'BLOCKED_RULE', 'BLOCKED_INVALID_KEY', 'BLOCKED_REVOKED'];

export default function AuditLogPage() {
  const { token } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1 });

  useEffect(() => {
    if (token) listAuditLog(token, filters).then(setEntries);
  }, [token, filters]);

  function handleFilter(field: keyof AuditLogFilters, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value || undefined, page: 1 }));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Audit Log</h1>
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Platform"
          onChange={(e) => handleFilter('platform', e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        />
        <input
          type="date"
          onChange={(e) =>
            handleFilter('from', e.target.value ? new Date(e.target.value).toISOString() : '')
          }
          className="border rounded px-3 py-1.5 text-sm"
        />
        <input
          type="date"
          onChange={(e) =>
            handleFilter('to', e.target.value ? new Date(e.target.value).toISOString() : '')
          }
          className="border rounded px-3 py-1.5 text-sm"
        />
        <select
          onChange={(e) => handleFilter('result', e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          {RESULTS.map((r) => (
            <option key={r} value={r}>
              {r || 'All results'}
            </option>
          ))}
        </select>
      </div>
      <AuditLogTable entries={entries} />
      <div className="mt-4 flex gap-2 items-center">
        <button
          disabled={(filters.page ?? 1) <= 1}
          onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
          className="px-3 py-1 border rounded text-sm disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-sm">Page {filters.page ?? 1}</span>
        <button
          disabled={entries.length < 50}
          onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
          className="px-3 py-1 border rounded text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar que todos los tests siguen pasando**

```bash
npx jest __tests__/
```

Expected: PASS — todos los tests anteriores

- [ ] **Step 4: Commit**

```bash
git add components/AuditLogTable.tsx "app/(protected)/audit-log/"
git commit -m "feat: add audit log page with filters and pagination"
```

---

## Task 7: Alerts page + AlertList component

**Files:**
- Create: `next-app/components/AlertList.tsx`
- Create: `next-app/app/(protected)/alerts/page.tsx`

- [ ] **Step 1: Crear components/AlertList.tsx**

```typescript
import type { AuditLogEntry } from '@/lib/api/auditLog';

interface AlertListProps {
  alerts: AuditLogEntry[];
}

export default function AlertList({ alerts }: AlertListProps) {
  if (alerts.length === 0) return <p className="text-gray-500">No alerts.</p>;

  return (
    <ul className="space-y-3">
      {alerts.map((alert) => (
        <li key={alert.id} className="border border-red-200 bg-red-50 rounded p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-red-800">
                Action blocked: <span className="font-mono">{alert.action}</span>
              </p>
              <p className="text-sm text-red-600 mt-0.5">
                Rule violated: <strong>{alert.ruleViolated}</strong> — Platform: {alert.platform}
              </p>
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
              {new Date(alert.createdAt).toLocaleString()}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Crear app/(protected)/alerts/page.tsx**

```typescript
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { listAlerts } from '@/lib/api/alerts';
import type { AuditLogEntry } from '@/lib/api/auditLog';
import AlertList from '@/components/AlertList';

export default function AlertsPage() {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    if (token) listAlerts(token).then(setAlerts);
  }, [token]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Alerts</h1>
      <p className="text-sm text-gray-500 mb-4">
        Actions blocked by global rules across all your API Keys.
      </p>
      <AlertList alerts={alerts} />
    </div>
  );
}
```

- [ ] **Step 3: Correr todos los tests**

```bash
npx jest
```

Expected: PASS — todos los tests

- [ ] **Step 4: Verificar que TypeScript compila sin errores**

```bash
npx tsc --noEmit
```

Expected: sin errores

- [ ] **Step 5: Commit**

```bash
git add components/AlertList.tsx "app/(protected)/alerts/"
git commit -m "feat: add alerts page"
```

---

## Task 8: Dev server verification

**Files:** ninguno — solo verificación manual

- [ ] **Step 1: Levantar el dev server**

```bash
npm run dev
```

Expected: servidor corriendo en `http://localhost:3000`

- [ ] **Step 2: Verificar flujo completo**

Abrir `http://localhost:3000` en el browser y verificar:

1. Redirige a `/login` si no hay token en localStorage
2. `/register` → completar form → redirige a `/keys` → aparece la nav
3. `/keys` → click "New Key" → seleccionar nombre + scope → click Create → aparece `PlainKeyAlert` amarillo → click "I saved it" → desaparece
4. La key creada aparece en la lista con prefix visible y badges de scope
5. Click "Revoke" en una key → card pasa a REVOKED, desaparece el botón Revoke
6. `/audit-log` → tabla con las acciones registradas
7. Filtrar por plataforma → tabla se actualiza
8. Cambiar página con Prev/Next
9. `/alerts` → lista de acciones bloqueadas por regla global (puede estar vacía)
10. Click "Logout" → redirige a `/login`, intentar volver a `/keys` → redirige a `/login`

- [ ] **Step 3: Verificar que tokens SDK no pasan el auth guard**

```bash
# Generar un token SDK (sin type: user_session)
node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({ userId: 'u1', type: 'sdk_token' }, 'test-secret-at-least-32-characters-long'))"
```

Meter ese token manualmente en localStorage (`auth.token`) y navegar a `/keys`.

Expected: el layout protegido detecta que el token no tiene `type: user_session` (la API devuelve 401 en todos los endpoints), y el fetch falla. La página muestra lista vacía — no accede a datos de otro usuario.

- [ ] **Step 4: Commit final si hay cambios pendientes**

```bash
git status
git add -A
git commit -m "feat: dashboard complete — keys, audit log, alerts pages"
```

---

## Self-Review

**Spec coverage:**
- ✅ Registro y login → `app/login/page.tsx`, `app/register/page.tsx`, `lib/api/auth.ts`
- ✅ Crear API Key con nombre + scope → `CreateKeyModal` + `POST /api/keys`
- ✅ Solo acciones válidas en el form → `AVAILABLE_SCOPES` en `CreateKeyModal` refleja `ALLOWED_ACTIONS` del backend
- ✅ Ver keys activas (solo prefix visible) → `KeyCard` muestra `prefix••••••••`
- ✅ Plain key mostrado una sola vez post-creación → `PlainKeyAlert` con dismiss
- ✅ Revocar key → card pasa a REVOKED sin botón Revoke
- ✅ Historial de acciones → `AuditLogPage` + `GET /api/audit-log`
- ✅ Filtrar por plataforma, fecha, resultado → filtros inline
- ✅ Paginación de 50 entradas → botones Prev/Next
- ✅ Alertas de acciones bloqueadas por regla global → `AlertsPage` + `GET /api/alerts`
- ✅ Rutas protegidas → `app/(protected)/layout.tsx` redirige a `/login` si no hay token
- ✅ Logout limpia localStorage y redirige a `/login`
- ✅ Tokens SDK no autentican el dashboard → `getAuthUserId` en el backend exige `type: user_session` (Plan 1, VULN-001)

**Placeholder scan:** Ninguno.

**Type consistency:**
- `ApiKeyRecord`, `CreateKeyResponse` definidos en `lib/api/keys.ts` → usados en `KeyCard`, `KeysPage`
- `AuditLogEntry`, `AuditLogFilters` definidos en `lib/api/auditLog.ts` → usados en `AuditLogTable`, `AlertList`, `AuditLogPage`, `AlertsPage`, `lib/api/alerts.ts`
- `AuthContextValue` definido en `contexts/AuthContext.tsx` → retornado por `useAuth()` y usado en todas las páginas protegidas
