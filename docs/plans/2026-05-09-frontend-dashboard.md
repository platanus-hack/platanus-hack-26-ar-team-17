# Frontend Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el dashboard web donde los usuarios se registran, gestionan sus API Keys, visualizan el audit log y ven alertas de acciones bloqueadas. Incluye los endpoints faltantes de la Platform API que el frontend necesita.

**Architecture:** Antes del frontend se completan los endpoints faltantes de la Platform API (auth register/login, GET keys, GET audit-log, GET alerts). El dashboard es una SPA en React con rutas protegidas — el JWT `type: user_session` se guarda en localStorage y se envía en cada request. Los tokens SDK no pueden autenticar rutas del dashboard (fix VULN-001 ya aplicado).

**Tech Stack:** Platform API (Node.js/Express/Prisma — Plan 1), React 18, TypeScript, Vite, React Router v6, Tailwind CSS, Vitest, @testing-library/react

**Prerequisito:** Platform API del Plan 1 corriendo con `DATABASE_URL`, `REDIS_URL` y `JWT_SECRET` configurados.

---

## File Structure

### Adiciones a Platform API (`platform-api/`)

```
platform-api/src/
  routes/
    auth.ts        # POST /v1/auth/register, POST /v1/auth/login  ← NUEVO
    auditLog.ts    # GET /v1/audit-log                            ← NUEVO
    alerts.ts      # GET /v1/alerts                               ← NUEVO
  (routes/keys.ts ya existente — agregar GET /v1/keys)
  app.ts           # Registrar nuevas rutas
tests/routes/
  auth.test.ts
  auditLog.test.ts
```

### Frontend (`dashboard/`)

```
dashboard/
  src/
    api/
      client.ts          # fetch wrapper con base URL + Authorization header
      auth.ts            # register(), login()
      keys.ts            # listKeys(), createKey(), revokeKey()
      auditLog.ts        # listAuditLog(filters)
      alerts.ts          # listAlerts()
    contexts/
      AuthContext.tsx    # JWT + userId en localStorage, setAuth/logout
    components/
      PlainKeyAlert.tsx  # Muestra plainKey una sola vez post-creación
      KeyCard.tsx        # Prefix, nombre, scope, botón Revoke
      CreateKeyModal.tsx # Form: nombre + checkboxes de scope
      AuditLogTable.tsx  # Tabla de entradas del audit log
      AlertList.tsx      # Lista de acciones bloqueadas por regla global
      Layout.tsx         # Nav + Outlet
    pages/
      LoginPage.tsx
      RegisterPage.tsx
      KeysPage.tsx
      AuditLogPage.tsx
      AlertsPage.tsx
    App.tsx              # BrowserRouter + rutas protegidas
    main.tsx
    index.css
    test-setup.ts
  tests/
    components/
      PlainKeyAlert.test.tsx
      KeyCard.test.tsx
      CreateKeyModal.test.tsx
  vite.config.ts
  tsconfig.json
  package.json
  tailwind.config.js
  postcss.config.js
  index.html
  .env.example
```

---

## Task 1: Auth endpoints — Platform API

**Files:**
- Create: `platform-api/src/routes/auth.ts`
- Create: `platform-api/tests/routes/auth.test.ts`
- Modify: `platform-api/src/app.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// tests/routes/auth.test.ts
import request from 'supertest';
import app from '../../src/app';

jest.mock('../../src/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const { prisma } = require('../../src/db/prisma');

describe('Auth routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('POST /v1/auth/register', () => {
    it('creates a user and returns a user_session token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user_1', email: 'a@b.com' });

      const res = await request(app)
        .post('/v1/auth/register')
        .send({ email: 'a@b.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.userId).toBe('user_1');
    });

    it('returns 409 if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user_1' });

      const res = await request(app)
        .post('/v1/auth/register')
        .send({ email: 'a@b.com', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('email_taken');
    });

    it('returns 400 for invalid email', async () => {
      const res = await request(app)
        .post('/v1/auth/register')
        .send({ email: 'notanemail', password: 'password123' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /v1/auth/login', () => {
    it('returns a token for valid credentials', async () => {
      const bcrypt = require('bcryptjs');
      const hashed = await bcrypt.hash('password123', 1);
      prisma.user.findUnique.mockResolvedValue({ id: 'user_1', email: 'a@b.com', password: hashed });

      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'a@b.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('returns 401 for wrong password', async () => {
      const bcrypt = require('bcryptjs');
      const hashed = await bcrypt.hash('correct', 1);
      prisma.user.findUnique.mockResolvedValue({ id: 'user_1', password: hashed });

      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'a@b.com', password: 'wrong' });

      expect(res.status).toBe(401);
    });

    it('returns 401 for unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'unknown@b.com', password: 'password123' });

      expect(res.status).toBe(401);
    });
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/routes/auth.test.ts
```

Expected: FAIL — Cannot find module

- [ ] **Step 3: Crear src/routes/auth.ts**

```typescript
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';
import { issueUserToken } from '../services/token.service';

const router = Router();

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', async (req: Request, res: Response) => {
  const parsed = registerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  const { email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'email_taken' });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, password: hashed } });
  const token = await issueUserToken(user.id);
  res.status(201).json({ token, userId: user.id });
});

router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  const token = await issueUserToken(user.id);
  res.status(200).json({ token, userId: user.id });
});

export default router;
```

- [ ] **Step 4: Actualizar src/app.ts**

```typescript
import express from 'express';
import validateRouter from './routes/validate';
import keysRouter from './routes/keys';
import authRouter from './routes/auth';
import auditLogRouter from './routes/auditLog';
import alertsRouter from './routes/alerts';

const app = express();
app.use(express.json());

app.use('/v1/auth', authRouter);
app.use('/v1/validate', validateRouter);
app.use('/v1/keys', keysRouter);
app.use('/v1/audit-log', auditLogRouter);
app.use('/v1/alerts', alertsRouter);

export default app;
```

- [ ] **Step 5: Verificar que pasa**

```bash
npx jest tests/routes/auth.test.ts
```

Expected: PASS — 5 tests

- [ ] **Step 6: Commit**

```bash
git add src/routes/auth.ts src/app.ts tests/routes/auth.test.ts
git commit -m "feat: add auth register and login endpoints"
```

---

## Task 2: GET /v1/keys + /v1/audit-log + /v1/alerts — Platform API

**Files:**
- Modify: `platform-api/src/routes/keys.ts`
- Create: `platform-api/src/routes/auditLog.ts`
- Create: `platform-api/src/routes/alerts.ts`
- Create: `platform-api/tests/routes/auditLog.test.ts`

- [ ] **Step 1: Escribir los tests**

```typescript
// tests/routes/auditLog.test.ts
import request from 'supertest';
import app from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('../../src/db/prisma', () => ({
  prisma: { auditLog: { findMany: jest.fn() } },
}));

const { prisma } = require('../../src/db/prisma');

const validUserToken = jwt.sign(
  { userId: 'user_1', type: 'user_session' },
  process.env.JWT_SECRET ?? 'test-secret-at-least-32-characters-long',
  { expiresIn: '1h' }
);

describe('GET /v1/audit-log', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns audit logs for the authenticated user', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      { id: 'log_1', action: 'send_message', result: 'SUCCESS', createdAt: new Date().toISOString() },
    ]);

    const res = await request(app)
      .get('/v1/audit-log')
      .set('Authorization', `Bearer ${validUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/v1/audit-log');
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/alerts', () => {
  it('returns only BLOCKED_RULE logs', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      { id: 'log_2', action: 'mass_send', result: 'BLOCKED_RULE', ruleViolated: 'mass_send' },
    ]);

    const res = await request(app)
      .get('/v1/alerts')
      .set('Authorization', `Bearer ${validUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body[0].result).toBe('BLOCKED_RULE');
  });
});
```

- [ ] **Step 2: Verificar que fallan**

```bash
npx jest tests/routes/auditLog.test.ts
```

Expected: FAIL

- [ ] **Step 3: Crear src/routes/auditLog.ts**

```typescript
import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

const logQuerySchema = z.object({
  keyId: z.string().optional(),
  platform: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  result: z
    .enum(['SUCCESS', 'BLOCKED_INVALID_KEY', 'BLOCKED_SCOPE', 'BLOCKED_RULE', 'BLOCKED_REVOKED'])
    .optional(),
  page: z.coerce.number().min(1).default(1),
});

const PAGE_SIZE = 50;

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = logQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  const { keyId, platform, from, to, result, page } = parsed.data;

  const logs = await prisma.auditLog.findMany({
    where: {
      userId: req.userId!,
      ...(keyId && { apiKeyId: keyId }),
      ...(platform && { platform }),
      ...(result && { result }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });

  res.status(200).json(logs);
});

export default router;
```

- [ ] **Step 4: Crear src/routes/alerts.ts**

```typescript
import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const alerts = await prisma.auditLog.findMany({
    where: { userId: req.userId!, result: 'BLOCKED_RULE' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.status(200).json(alerts);
});

export default router;
```

- [ ] **Step 5: Agregar GET / a src/routes/keys.ts**

Agregar antes del `router.post('/', ...)` existente:

```typescript
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const keys = await prisma.apiKey.findMany({
    where: { userId: req.userId! },
    select: {
      id: true,
      name: true,
      prefix: true,
      scope: true,
      status: true,
      createdAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json(keys);
});
```

También agregar el import de `prisma` al principio del archivo si no está:

```typescript
import { prisma } from '../db/prisma';
```

- [ ] **Step 6: Verificar que pasan**

```bash
npx jest tests/routes/auditLog.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 7: Commit**

```bash
git add src/routes/auditLog.ts src/routes/alerts.ts src/routes/keys.ts src/app.ts tests/routes/auditLog.test.ts
git commit -m "feat: add GET /v1/keys, /v1/audit-log, /v1/alerts endpoints"
```

---

## Task 3: Inicializar proyecto dashboard

**Files:**
- Create: `dashboard/package.json`, `dashboard/vite.config.ts`, `dashboard/tsconfig.json`
- Create: `dashboard/index.html`, `dashboard/tailwind.config.js`, `dashboard/postcss.config.js`
- Create: `dashboard/src/index.css`, `dashboard/src/test-setup.ts`, `dashboard/.env.example`

- [ ] **Step 1: Crear proyecto con Vite**

```bash
npm create vite@latest dashboard -- --template react-ts
cd dashboard
```

- [ ] **Step 2: Instalar dependencias**

```bash
npm install react-router-dom
npm install -D tailwindcss postcss autoprefixer @testing-library/react @testing-library/jest-dom @testing-library/user-event vitest jsdom @vitejs/plugin-react
npx tailwindcss init -p
```

- [ ] **Step 3: Configurar tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 4: Crear src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Reemplazar vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
});
```

- [ ] **Step 6: Crear src/test-setup.ts**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 7: Crear .env.example**

```env
VITE_API_URL=http://localhost:3000
```

- [ ] **Step 8: Agregar scripts a package.json**

Reemplazar la sección `"scripts"` generada por Vite con:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: initialize dashboard project with Vite + React + TypeScript + Tailwind"
```

---

## Task 4: API client + AuthContext

**Files:**
- Create: `dashboard/src/api/client.ts`
- Create: `dashboard/src/api/auth.ts`
- Create: `dashboard/src/api/keys.ts`
- Create: `dashboard/src/api/auditLog.ts`
- Create: `dashboard/src/api/alerts.ts`
- Create: `dashboard/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Crear src/api/client.ts**

```typescript
const API_URL = import.meta.env.VITE_API_URL as string;

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'request_failed');
  return data as T;
}
```

- [ ] **Step 2: Crear src/api/auth.ts**

```typescript
import { apiFetch } from './client';

export interface AuthResponse {
  token: string;
  userId: string;
}

export function register(email: string, password: string): Promise<AuthResponse> {
  return apiFetch('/v1/auth/register', { method: 'POST', body: { email, password } });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiFetch('/v1/auth/login', { method: 'POST', body: { email, password } });
}
```

- [ ] **Step 3: Crear src/api/keys.ts**

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
  return apiFetch('/v1/keys', { token });
}

export function createKey(
  token: string,
  params: { name: string; scope: string[] }
): Promise<CreateKeyResponse> {
  return apiFetch('/v1/keys', { method: 'POST', body: params, token });
}

export function revokeKey(token: string, keyId: string): Promise<{ success: boolean }> {
  return apiFetch(`/v1/keys/${keyId}`, { method: 'DELETE', token });
}
```

- [ ] **Step 4: Crear src/api/auditLog.ts**

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
  return apiFetch(`/v1/audit-log${qs ? `?${qs}` : ''}`, { token });
}
```

- [ ] **Step 5: Crear src/api/alerts.ts**

```typescript
import { apiFetch } from './client';
import type { AuditLogEntry } from './auditLog';

export function listAlerts(token: string): Promise<AuditLogEntry[]> {
  return apiFetch('/v1/alerts', { token });
}
```

- [ ] **Step 6: Crear src/contexts/AuthContext.tsx**

```typescript
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

- [ ] **Step 7: Commit**

```bash
git add src/api/ src/contexts/
git commit -m "feat: add api client layer and auth context"
```

---

## Task 5: Login + Register + routing

**Files:**
- Create: `dashboard/src/pages/LoginPage.tsx`
- Create: `dashboard/src/pages/RegisterPage.tsx`
- Create: `dashboard/src/components/Layout.tsx`
- Create: `dashboard/src/App.tsx`
- Create: `dashboard/src/main.tsx`
- Create: `dashboard/tests/components/LoginPage.test.tsx`

- [ ] **Step 1: Escribir el test**

```typescript
// tests/components/LoginPage.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/contexts/AuthContext';
import LoginPage from '../../src/pages/LoginPage';
import * as authApi from '../../src/api/auth';

vi.mock('../../src/api/auth');

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  it('renders email and password inputs', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('calls login API on submit', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ token: 'tok', userId: 'u1' });
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith('a@b.com', 'pass123');
    });
  });

  it('shows error on failed login', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error('invalid_credentials'));
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
npx vitest run tests/components/LoginPage.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Crear src/pages/LoginPage.tsx**

```typescript
import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { login } from '../api/auth';

export default function LoginPage() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { token, userId } = await login(email, password);
      setAuth(token, userId);
      navigate('/keys');
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
          No account? <Link to="/register" className="text-blue-600 underline">Register</Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Crear src/pages/RegisterPage.tsx**

```typescript
import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { register } from '../api/auth';

export default function RegisterPage() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { token, userId } = await register(email, password);
      setAuth(token, userId);
      navigate('/keys');
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
          <label htmlFor="password" className="block text-sm font-medium">Password (min 8 chars)</label>
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
          Already have an account? <Link to="/login" className="text-blue-600 underline">Login</Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Crear src/components/Layout.tsx**

```typescript
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex gap-6">
          <Link to="/keys" className="font-medium hover:text-blue-600">API Keys</Link>
          <Link to="/audit-log" className="font-medium hover:text-blue-600">Audit Log</Link>
          <Link to="/alerts" className="font-medium hover:text-blue-600">Alerts</Link>
        </div>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-600">
          Logout
        </button>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Crear src/App.tsx**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import KeysPage from './pages/KeysPage';
import AuditLogPage from './pages/AuditLogPage';
import AlertsPage from './pages/AlertsPage';
import Layout from './components/Layout';
import { ReactNode } from 'react';

function PrivateRoute({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route path="/keys" element={<KeysPage />} />
            <Route path="/audit-log" element={<AuditLogPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/keys" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 7: Crear src/main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 8: Verificar tests**

```bash
npx vitest run tests/components/LoginPage.test.tsx
```

Expected: PASS — 3 tests

- [ ] **Step 9: Commit**

```bash
git add src/pages/ src/components/Layout.tsx src/App.tsx src/main.tsx tests/components/LoginPage.test.tsx
git commit -m "feat: add login, register pages and app routing"
```

---

## Task 6: API Keys page

**Files:**
- Create: `dashboard/src/components/PlainKeyAlert.tsx`
- Create: `dashboard/src/components/KeyCard.tsx`
- Create: `dashboard/src/components/CreateKeyModal.tsx`
- Create: `dashboard/src/pages/KeysPage.tsx`
- Create: `dashboard/tests/components/PlainKeyAlert.test.tsx`
- Create: `dashboard/tests/components/KeyCard.test.tsx`
- Create: `dashboard/tests/components/CreateKeyModal.test.tsx`

- [ ] **Step 1: Escribir los tests**

```typescript
// tests/components/PlainKeyAlert.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import PlainKeyAlert from '../../src/components/PlainKeyAlert';

describe('PlainKeyAlert', () => {
  it('displays the plain key', () => {
    render(<PlainKeyAlert plainKey="ak_abc123xyz" onDismiss={() => {}} />);
    expect(screen.getByText('ak_abc123xyz')).toBeInTheDocument();
  });

  it('calls onDismiss when button clicked', () => {
    const onDismiss = vi.fn();
    render(<PlainKeyAlert plainKey="ak_abc123xyz" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /i saved it/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
```

```typescript
// tests/components/KeyCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import KeyCard from '../../src/components/KeyCard';
import type { ApiKeyRecord } from '../../src/api/keys';

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
    const onRevoke = vi.fn();
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
// tests/components/CreateKeyModal.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateKeyModal from '../../src/components/CreateKeyModal';

describe('CreateKeyModal', () => {
  it('calls onCreate with name and selected scopes', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<CreateKeyModal onClose={() => {}} onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test Agent' } });
    fireEvent.click(screen.getByLabelText('send_message'));
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({ name: 'Test Agent', scope: ['send_message'] });
    });
  });

  it('shows error when no scope selected', async () => {
    render(<CreateKeyModal onClose={() => {}} onCreate={vi.fn()} />);
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
npx vitest run tests/components/
```

Expected: FAIL — cannot find modules

- [ ] **Step 3: Crear src/components/PlainKeyAlert.tsx**

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

- [ ] **Step 4: Crear src/components/KeyCard.tsx**

```typescript
import type { ApiKeyRecord } from '../api/keys';

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

- [ ] **Step 5: Crear src/components/CreateKeyModal.tsx**

```typescript
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
            <label htmlFor="key-name" className="block text-sm font-medium">Name</label>
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

- [ ] **Step 6: Crear src/pages/KeysPage.tsx**

```typescript
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { listKeys, createKey, revokeKey, ApiKeyRecord, CreateKeyResponse } from '../api/keys';
import KeyCard from '../components/KeyCard';
import CreateKeyModal from '../components/CreateKeyModal';
import PlainKeyAlert from '../components/PlainKeyAlert';

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
        <CreateKeyModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Verificar tests**

```bash
npx vitest run tests/components/
```

Expected: PASS — todos los tests de components

- [ ] **Step 8: Commit**

```bash
git add src/components/PlainKeyAlert.tsx src/components/KeyCard.tsx src/components/CreateKeyModal.tsx src/pages/KeysPage.tsx tests/components/
git commit -m "feat: add api keys page with create, list, revoke and plain key reveal"
```

---

## Task 7: Audit Log + Alerts pages

**Files:**
- Create: `dashboard/src/components/AuditLogTable.tsx`
- Create: `dashboard/src/components/AlertList.tsx`
- Create: `dashboard/src/pages/AuditLogPage.tsx`
- Create: `dashboard/src/pages/AlertsPage.tsx`

- [ ] **Step 1: Crear src/components/AuditLogTable.tsx**

```typescript
import type { AuditLogEntry } from '../api/auditLog';

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

- [ ] **Step 2: Crear src/pages/AuditLogPage.tsx**

```typescript
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { listAuditLog, AuditLogEntry, AuditLogFilters } from '../api/auditLog';
import AuditLogTable from '../components/AuditLogTable';

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

- [ ] **Step 3: Crear src/components/AlertList.tsx**

```typescript
import type { AuditLogEntry } from '../api/auditLog';

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

- [ ] **Step 4: Crear src/pages/AlertsPage.tsx**

```typescript
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { listAlerts } from '../api/alerts';
import type { AuditLogEntry } from '../api/auditLog';
import AlertList from '../components/AlertList';

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

- [ ] **Step 5: Correr todos los tests**

```bash
npx vitest run
```

Expected: PASS — todos los tests

- [ ] **Step 6: Verificar que el build compila sin errores**

```bash
npm run build
```

Expected: build exitoso en `dist/`

- [ ] **Step 7: Verificar flujo completo en dev**

```bash
VITE_API_URL=http://localhost:3000 npm run dev
```

Verificar manualmente:
- `/register` → crea usuario, redirige a `/keys`
- `/keys` → crea una key → muestra `PlainKeyAlert` amarillo → dismiss → desaparece
- Revocar una key → el card pasa a estado REVOKED sin botón Revoke
- `/audit-log` → tabla con filtros de plataforma, fecha, resultado funcionando
- `/alerts` → lista de acciones bloqueadas por reglas globales
- Logout → redirige a `/login`
- Acceder a `/keys` sin token → redirige a `/login`

- [ ] **Step 8: Commit final**

```bash
git add src/components/AuditLogTable.tsx src/components/AlertList.tsx src/pages/AuditLogPage.tsx src/pages/AlertsPage.tsx
git commit -m "feat: add audit log and alerts pages"
```

---

## Self-Review

**Spec coverage:**
- ✅ Registro y login de usuarios → `auth.ts` (Platform API) + `LoginPage`, `RegisterPage`
- ✅ Crear API Key con nombre + scope → `CreateKeyModal` + `POST /v1/keys`
- ✅ Scope validado contra `ALLOWED_ACTIONS` en el form (solo muestra acciones válidas)
- ✅ Ver keys activas (solo prefix visible) → `KeyCard` muestra `prefix••••••••`
- ✅ Plain key mostrado una sola vez post-creación → `PlainKeyAlert` con dismiss
- ✅ Revocar key → botón Revoke desaparece al revocar, card pasa a REVOKED
- ✅ Historial de acciones → `AuditLogPage` + `GET /v1/audit-log`
- ✅ Filtrar por plataforma, fecha, resultado → filtros inline en `AuditLogPage`
- ✅ Paginación de 50 entradas → botones Prev/Next en `AuditLogPage`
- ✅ Alertas de acciones bloqueadas por regla global → `AlertsPage` + `GET /v1/alerts`
- ✅ Rutas protegidas → `PrivateRoute` redirige a `/login` si no hay token
- ✅ Logout limpia localStorage y redirige a `/login`
- ✅ Tokens SDK no pueden usarse en el dashboard → `type: user_session` requerido por `requireAuth`

**Placeholder scan:** Ninguno.

**Type consistency:**
- `ApiKeyRecord` definido en `api/keys.ts` → usado en `KeyCard`, `KeysPage`
- `AuditLogEntry` definido en `api/auditLog.ts` → usado en `AuditLogTable`, `AlertList`, `AuditLogPage`, `AlertsPage`, `api/alerts.ts`
- `AuditLogFilters` definido en `api/auditLog.ts` → usado en `AuditLogPage`
- `CreateKeyResponse` definido en `api/keys.ts` → usado en `KeysPage`
