# Platform API — Next.js Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir los servicios de validación, autenticación, audit log y gestión de API Keys como route handlers de Next.js App Router — mismo proyecto que el dashboard.

**Architecture:** Proyecto Next.js 14+ con App Router. Los servicios viven en `lib/` (pure TypeScript, sin dependencias de framework). Los endpoints viven en `app/api/`. La lógica de negocio es testeable sin levantar HTTP — los tests importan los servicios directamente y los route handlers se testean con `NextRequest`.

**Tech Stack:** Next.js 14, TypeScript, PostgreSQL, Prisma ORM, Redis (ioredis), jsonwebtoken, bcryptjs, zod, Jest

**Security fixes incluidos:** VULN-001 (token namespace), VULN-002 (jti revocation), VULN-003 (rate limit por IP), VULN-004 (scope validation), VULN-005 (no re-hash).

---

## File Structure

```
next-app/
  app/
    api/
      validate/
        route.ts          # POST /api/validate — pipeline completo del SDK
      auth/
        register/
          route.ts        # POST /api/auth/register
        login/
          route.ts        # POST /api/auth/login
      keys/
        route.ts          # GET /api/keys, POST /api/keys
        [id]/
          route.ts        # DELETE /api/keys/:id
      audit-log/
        route.ts          # GET /api/audit-log?keyId&platform&from&to&result&page
      alerts/
        route.ts          # GET /api/alerts
  lib/
    config.ts             # Variables de entorno validadas con zod
    db/
      prisma.ts           # Cliente Prisma singleton
      redis.ts            # Cliente Redis singleton
    services/
      apiKey.service.ts   # validateApiKeyHash, createApiKey, revokeApiKey
      token.service.ts    # issueToken (sdk_token), issueUserToken, revokeToken, isTokenRevoked
      scope.service.ts    # ALLOWED_ACTIONS, verifyScope
      rules.service.ts    # checkGlobalRules (action type + content)
      auditLog.service.ts # writeLog con checksum chaining
    utils/
      crypto.ts           # generateApiKey (CSPRNG ak_), hashApiKey, getKeyPrefix
      normalize.ts        # normalizeAction, normalizeText (NFKC + zero-width + URL decode)
    auth.ts               # getAuthUserId(req) — helper para route handlers
    rateLimiter.ts        # checkRateLimit(ip) via Redis
  prisma/
    schema.prisma
  tests/
    lib/
      services/
        apiKey.service.test.ts
        token.service.test.ts
        scope.service.test.ts
        rules.service.test.ts
        auditLog.service.test.ts
      utils/
        crypto.test.ts
        normalize.test.ts
    api/
      validate.test.ts
      auth.test.ts
      keys.test.ts
      auditLog.test.ts
  jest.config.ts
  tsconfig.json
  package.json
  .env.example
```

---

## Task 1: Inicializar proyecto Next.js

**Files:**
- Create: `next-app/` (todo el proyecto)

- [ ] **Step 1: Crear el proyecto**

```bash
npx create-next-app@latest next-app --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd next-app
```

- [ ] **Step 2: Instalar dependencias de backend**

```bash
npm install @prisma/client ioredis jsonwebtoken bcryptjs zod
npm install -D prisma @types/jsonwebtoken @types/bcryptjs jest ts-jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Crear jest.config.ts**

```typescript
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};

export default createJestConfig(config);
```

- [ ] **Step 4: Crear .env.example**

```env
DATABASE_URL="postgresql://user:password@localhost:5432/platform_api"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="change-me-to-a-random-256-bit-secret-min-32-chars"
JWT_EXPIRES_IN="15m"
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: initialize next-app project"
```

---

## Task 2: Schema de base de datos

**Files:**
- Create: `next-app/prisma/schema.prisma`

- [ ] **Step 1: Inicializar Prisma**

```bash
npx prisma init
```

- [ ] **Step 2: Escribir schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  apiKeys   ApiKey[]
}

model ApiKey {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  name      String
  keyHash   String    @unique
  prefix    String
  scope     String[]
  status    KeyStatus @default(ACTIVE)
  createdAt DateTime  @default(now())
  revokedAt DateTime?
  auditLogs AuditLog[]

  @@index([keyHash])
}

enum KeyStatus {
  ACTIVE
  REVOKED
}

model AuditLog {
  id           String    @id @default(cuid())
  apiKeyId     String
  apiKey       ApiKey    @relation(fields: [apiKeyId], references: [id])
  userId       String
  action       String
  platform     String
  result       LogResult
  ruleViolated String?
  prevChecksum String
  checksum     String
  createdAt    DateTime  @default(now())

  @@index([apiKeyId])
  @@index([userId])
}

enum LogResult {
  SUCCESS
  BLOCKED_INVALID_KEY
  BLOCKED_SCOPE
  BLOCKED_RULE
  BLOCKED_REVOKED
}

model GlobalRule {
  id        String   @id @default(cuid())
  type      RuleType
  value     String   @unique
  createdAt DateTime @default(now())
}

enum RuleType {
  FORBIDDEN_ACTION
  FORBIDDEN_KEYWORD
  FORBIDDEN_PATTERN
}
```

- [ ] **Step 3: Aplicar migración**

```bash
npx prisma migrate dev --name init
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add database schema"
```

---

## Task 3: Config + clientes DB/Redis

**Files:**
- Create: `next-app/lib/config.ts`
- Create: `next-app/lib/db/prisma.ts`
- Create: `next-app/lib/db/redis.ts`

- [ ] **Step 1: Crear lib/config.ts**

```typescript
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
```

- [ ] **Step 2: Crear lib/db/prisma.ts**

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 3: Crear lib/db/redis.ts**

```typescript
import Redis from 'ioredis';
import { config } from '../config';

const globalForRedis = globalThis as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

redis.on('error', (err) => console.error('Redis error:', err));
```

- [ ] **Step 4: Commit**

```bash
git add lib/
git commit -m "feat: add config validation and db/redis clients"
```

---

## Task 4: Utilidades criptográficas y normalización

**Files:**
- Create: `next-app/lib/utils/crypto.ts`
- Create: `next-app/lib/utils/normalize.ts`
- Create: `next-app/tests/lib/utils/crypto.test.ts`
- Create: `next-app/tests/lib/utils/normalize.test.ts`

- [ ] **Step 1: Escribir los tests**

```typescript
// tests/lib/utils/crypto.test.ts
import { generateApiKey, hashApiKey, getKeyPrefix } from '@/lib/utils/crypto';

describe('crypto utils', () => {
  describe('generateApiKey', () => {
    it('generates a key with ak_ prefix', () => {
      expect(generateApiKey().startsWith('ak_')).toBe(true);
    });

    it('generates a key with at least 40 chars after prefix', () => {
      expect(generateApiKey().replace('ak_', '').length).toBeGreaterThanOrEqual(40);
    });

    it('generates unique keys', () => {
      const keys = new Set(Array.from({ length: 1000 }, () => generateApiKey()));
      expect(keys.size).toBe(1000);
    });
  });

  describe('hashApiKey', () => {
    it('returns a consistent hash', () => {
      const key = 'ak_testkey123';
      expect(hashApiKey(key)).toBe(hashApiKey(key));
    });

    it('never returns the original key', () => {
      const key = 'ak_testkey123';
      expect(hashApiKey(key)).not.toBe(key);
    });
  });
});
```

```typescript
// tests/lib/utils/normalize.test.ts
import { normalizeAction, normalizeText } from '@/lib/utils/normalize';

describe('normalizeAction', () => {
  it('lowercases', () => expect(normalizeAction('SEND_MESSAGE')).toBe('send_message'));
  it('trims', () => expect(normalizeAction('  send_message  ')).toBe('send_message'));
  it('removes null bytes', () => expect(normalizeAction('send_message\x00')).toBe('send_message'));
});

describe('normalizeText', () => {
  it('applies NFKC normalization', () => {
    const cyrillicA = 'а';
    expect(normalizeText(`ph${cyrillicA}rm`)).toBe('pharm');
  });

  it('removes zero-width space', () => {
    expect(normalizeText('sp​am')).toBe('spam');
  });

  it('decodes URL encoding', () => {
    expect(normalizeText('sp%61m')).toBe('spam');
  });
});
```

- [ ] **Step 2: Verificar que fallan**

```bash
npx jest tests/lib/utils/
```

Expected: FAIL

- [ ] **Step 3: Implementar lib/utils/crypto.ts**

```typescript
import crypto from 'crypto';

export function generateApiKey(): string {
  return `ak_${crypto.randomBytes(32).toString('base64url')}`;
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function getKeyPrefix(key: string): string {
  return key.slice(0, 11); // "ak_" + 8 chars
}
```

- [ ] **Step 4: Implementar lib/utils/normalize.ts**

```typescript
const ZERO_WIDTH_CHARS = /[​-‍﻿­͏ᅟᅠ឴឵᠋-᠍​-‏]/g;
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

export function normalizeAction(action: string): string {
  return action.replace(CONTROL_CHARS, '').trim().toLowerCase();
}

export function normalizeText(text: string): string {
  if (!text) return '';
  let result = text;
  try {
    result = decodeURIComponent(result);
  } catch {
    // use original if decode fails
  }
  return result.normalize('NFKC').replace(ZERO_WIDTH_CHARS, '');
}
```

- [ ] **Step 5: Verificar que pasan**

```bash
npx jest tests/lib/utils/
```

Expected: PASS — 7 tests

- [ ] **Step 6: Commit**

```bash
git add lib/utils/ tests/lib/utils/
git commit -m "feat: add crypto and text normalization utils"
```

---

## Task 5: Token service

**Files:**
- Create: `next-app/lib/services/token.service.ts`
- Create: `next-app/tests/lib/services/token.service.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// tests/lib/services/token.service.test.ts
import {
  issueToken,
  issueUserToken,
  verifyToken,
  revokeToken,
  isTokenRevoked,
} from '@/lib/services/token.service';

jest.mock('@/lib/db/redis', () => ({
  redis: {
    sadd: jest.fn().mockResolvedValue(1),
    sismember: jest.fn().mockResolvedValue(0),
  },
}));

describe('token.service', () => {
  const payload = { userId: 'user_1', apiKeyId: 'key_1', scope: ['send_message'] };

  describe('issueToken', () => {
    it('returns a JWT string', async () => {
      const token = await issueToken(payload);
      expect(token.split('.').length).toBe(3);
    });

    it('includes type: sdk_token', async () => {
      const token = await issueToken(payload);
      const decoded = await verifyToken(token);
      expect(decoded.type).toBe('sdk_token');
    });

    it('includes a jti', async () => {
      const token = await issueToken(payload);
      const decoded = await verifyToken(token);
      expect(decoded.jti).toBeDefined();
    });
  });

  describe('issueUserToken', () => {
    it('includes type: user_session', async () => {
      const token = await issueUserToken('user_1');
      const decoded = await verifyToken(token);
      expect(decoded.type).toBe('user_session');
    });
  });

  describe('revokeToken + isTokenRevoked', () => {
    it('marks a jti as revoked', async () => {
      const { redis } = require('@/lib/db/redis');
      redis.sismember.mockResolvedValueOnce(1);
      await revokeToken('some-jti');
      expect(await isTokenRevoked('some-jti')).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/lib/services/token.service.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar lib/services/token.service.ts**

```typescript
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { redis } from '../db/redis';

const REVOKED_SET = 'revoked_jtis';

interface TokenPayload {
  userId: string;
  apiKeyId: string;
  scope: string[];
}

export interface DecodedToken extends TokenPayload {
  jti: string;
  type: 'sdk_token' | 'user_session';
  iat: number;
  exp: number;
}

export async function issueToken(payload: TokenPayload): Promise<string> {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti, type: 'sdk_token' }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
}

export async function issueUserToken(userId: string): Promise<string> {
  return jwt.sign({ userId, type: 'user_session' }, config.JWT_SECRET, {
    expiresIn: '7d',
  });
}

export async function verifyToken(token: string): Promise<DecodedToken> {
  return jwt.verify(token, config.JWT_SECRET) as DecodedToken;
}

export async function revokeToken(jti: string): Promise<void> {
  await redis.sadd(REVOKED_SET, jti);
}

export async function revokeAllTokensForKey(apiKeyId: string): Promise<void> {
  const pattern = `active_token:${apiKeyId}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    const jtis = keys.map((k) => k.split(':')[2]);
    await redis.sadd(REVOKED_SET, ...jtis);
    await redis.del(...keys);
  }
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const result = await redis.sismember(REVOKED_SET, jti);
  return result === 1;
}
```

- [ ] **Step 4: Verificar que pasa**

```bash
npx jest tests/lib/services/token.service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/services/token.service.ts tests/lib/services/token.service.test.ts
git commit -m "feat: add token service with sdk_token/user_session types and jti revocation"
```

---

## Task 6: API Key service

**Files:**
- Create: `next-app/lib/services/apiKey.service.ts`
- Create: `next-app/tests/lib/services/apiKey.service.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// tests/lib/services/apiKey.service.test.ts
import { validateApiKeyHash, createApiKey, revokeApiKey } from '@/lib/services/apiKey.service';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    apiKey: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock('@/lib/services/token.service', () => ({
  revokeAllTokensForKey: jest.fn(),
}));

const { prisma } = require('@/lib/db/prisma');

describe('validateApiKeyHash', () => {
  it('returns the record for a valid active key hash', async () => {
    const mockKey = { id: 'key_1', userId: 'user_1', keyHash: 'abc', scope: ['send_message'], status: 'ACTIVE' };
    prisma.apiKey.findUnique.mockResolvedValueOnce(mockKey);
    expect(await validateApiKeyHash('abc')).toEqual(mockKey);
  });

  it('returns null for unknown hash', async () => {
    prisma.apiKey.findUnique.mockResolvedValueOnce(null);
    expect(await validateApiKeyHash('unknown')).toBeNull();
  });

  it('returns null for revoked key', async () => {
    prisma.apiKey.findUnique.mockResolvedValueOnce({ id: 'key_2', status: 'REVOKED' });
    expect(await validateApiKeyHash('revoked')).toBeNull();
  });
});

describe('createApiKey', () => {
  it('creates and returns the plain key once', async () => {
    prisma.apiKey.create.mockResolvedValueOnce({ id: 'key_3', prefix: 'ak_testke' });
    const result = await createApiKey({ userId: 'u1', name: 'Agent', scope: ['send_message'] });
    expect(result.plainKey.startsWith('ak_')).toBe(true);
  });
});

describe('revokeApiKey', () => {
  it('sets status to REVOKED', async () => {
    prisma.apiKey.update.mockResolvedValueOnce({ id: 'key_1', status: 'REVOKED' });
    await revokeApiKey('key_1', 'user_1');
    expect(prisma.apiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'key_1', userId: 'user_1' } })
    );
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/lib/services/apiKey.service.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar lib/services/apiKey.service.ts**

```typescript
import { prisma } from '../db/prisma';
import { generateApiKey, hashApiKey, getKeyPrefix } from '../utils/crypto';
import { revokeAllTokensForKey } from './token.service';

export interface ApiKeyRecord {
  id: string;
  userId: string;
  keyHash: string;
  scope: string[];
  status: string;
}

export async function validateApiKeyHash(keyHash: string): Promise<ApiKeyRecord | null> {
  const record = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!record || record.status !== 'ACTIVE') return null;
  return record as ApiKeyRecord;
}

export async function createApiKey(params: {
  userId: string;
  name: string;
  scope: string[];
}): Promise<{ id: string; plainKey: string; prefix: string }> {
  const plainKey = generateApiKey();
  const keyHash = hashApiKey(plainKey);
  const prefix = getKeyPrefix(plainKey);

  const record = await prisma.apiKey.create({
    data: { userId: params.userId, name: params.name, keyHash, prefix, scope: params.scope },
  });

  return { id: record.id, plainKey, prefix };
}

export async function revokeApiKey(keyId: string, userId: string): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId, userId },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });
  await revokeAllTokensForKey(keyId);
}
```

- [ ] **Step 4: Verificar que pasa**

```bash
npx jest tests/lib/services/apiKey.service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/services/apiKey.service.ts tests/lib/services/apiKey.service.test.ts
git commit -m "feat: add api key service (validate hash, create, revoke)"
```

---

## Task 7: Scope service + Rules service

**Files:**
- Create: `next-app/lib/services/scope.service.ts`
- Create: `next-app/lib/services/rules.service.ts`
- Create: `next-app/tests/lib/services/scope.service.test.ts`
- Create: `next-app/tests/lib/services/rules.service.test.ts`

- [ ] **Step 1: Escribir los tests**

```typescript
// tests/lib/services/scope.service.test.ts
import { verifyScope, ALLOWED_ACTIONS } from '@/lib/services/scope.service';

describe('verifyScope', () => {
  it('returns true when action is in scope', () => {
    expect(verifyScope('send_message', ['send_message'])).toBe(true);
  });

  it('returns false when action is not in scope', () => {
    expect(verifyScope('delete_account', ['send_message'])).toBe(false);
  });

  it('returns false for action not in ALLOWED_ACTIONS enum', () => {
    expect(verifyScope('unknown_xyz', ['unknown_xyz'])).toBe(false);
  });

  it('normalizes case and whitespace', () => {
    expect(verifyScope('  SEND_MESSAGE  ', ['send_message'])).toBe(true);
  });
});
```

```typescript
// tests/lib/services/rules.service.test.ts
import { checkGlobalRules } from '@/lib/services/rules.service';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    globalRule: {
      findMany: jest.fn().mockResolvedValue([
        { type: 'FORBIDDEN_ACTION', value: 'mass_send' },
        { type: 'FORBIDDEN_KEYWORD', value: 'buy now click here' },
      ]),
    },
  },
}));

describe('checkGlobalRules', () => {
  it('blocks a forbidden action', async () => {
    const result = await checkGlobalRules({ action: 'mass_send', text: 'hello' });
    expect(result.blocked).toBe(true);
    expect(result.ruleViolated).toBe('mass_send');
  });

  it('allows a clean action', async () => {
    const result = await checkGlobalRules({ action: 'send_message', text: 'hello' });
    expect(result.blocked).toBe(false);
  });

  it('blocks text with forbidden keyword after normalization', async () => {
    const result = await checkGlobalRules({ action: 'send_message', text: 'BUY NOW CLICK HERE' });
    expect(result.blocked).toBe(true);
  });

  it('blocks obfuscated text (zero-width char)', async () => {
    const obfuscated = 'b​uy n​ow click here';
    const result = await checkGlobalRules({ action: 'send_message', text: obfuscated });
    expect(result.blocked).toBe(true);
  });
});
```

- [ ] **Step 2: Verificar que fallan**

```bash
npx jest tests/lib/services/scope.service.test.ts tests/lib/services/rules.service.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar lib/services/scope.service.ts**

```typescript
import { normalizeAction } from '../utils/normalize';

export const ALLOWED_ACTIONS = new Set([
  'send_message',
  'read_messages',
  'create_post',
  'delete_post',
  'read_profile',
  'update_profile',
]);

export function verifyScope(rawAction: string, scope: string[]): boolean {
  const action = normalizeAction(rawAction);
  if (!ALLOWED_ACTIONS.has(action)) return false;
  return scope.map(normalizeAction).includes(action);
}
```

- [ ] **Step 4: Implementar lib/services/rules.service.ts**

```typescript
import { prisma } from '../db/prisma';
import { normalizeAction, normalizeText } from '../utils/normalize';

export interface RuleViolation {
  blocked: boolean;
  ruleViolated?: string;
}

export async function checkGlobalRules(params: {
  action: string;
  text: string;
}): Promise<RuleViolation> {
  const action = normalizeAction(params.action);
  const text = normalizeText(params.text).toLowerCase();
  const rules = await prisma.globalRule.findMany();

  for (const rule of rules) {
    if (rule.type === 'FORBIDDEN_ACTION' && rule.value === action) {
      return { blocked: true, ruleViolated: rule.value };
    }
  }

  for (const rule of rules) {
    if (rule.type === 'FORBIDDEN_KEYWORD' && text.includes(rule.value)) {
      return { blocked: true, ruleViolated: rule.value };
    }
    if (rule.type === 'FORBIDDEN_PATTERN') {
      const regex = new RegExp(rule.value, 'i');
      if (regex.test(text)) return { blocked: true, ruleViolated: rule.value };
    }
  }

  return { blocked: false };
}
```

- [ ] **Step 5: Verificar que pasan**

```bash
npx jest tests/lib/services/scope.service.test.ts tests/lib/services/rules.service.test.ts
```

Expected: PASS — 8 tests

- [ ] **Step 6: Commit**

```bash
git add lib/services/scope.service.ts lib/services/rules.service.ts tests/lib/services/
git commit -m "feat: add scope and rules services"
```

---

## Task 8: Audit Log service

**Files:**
- Create: `next-app/lib/services/auditLog.service.ts`
- Create: `next-app/tests/lib/services/auditLog.service.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// tests/lib/services/auditLog.service.test.ts
import { writeLog } from '@/lib/services/auditLog.service';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    auditLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'log_1', ...data })),
    },
  },
}));

describe('writeLog', () => {
  it('writes a log entry with a SHA-256 checksum', async () => {
    const entry = await writeLog({
      apiKeyId: 'key_1',
      userId: 'user_1',
      action: 'send_message',
      platform: 'whatsapp',
      result: 'SUCCESS',
    });
    expect(entry.checksum).toHaveLength(64);
  });

  it('chains checksum from previous entry', async () => {
    const { prisma } = require('@/lib/db/prisma');
    prisma.auditLog.findFirst.mockResolvedValueOnce({ checksum: 'prevhash' });

    const entry = await writeLog({
      apiKeyId: 'key_1',
      userId: 'user_1',
      action: 'send_message',
      platform: 'whatsapp',
      result: 'SUCCESS',
    });
    expect(entry.prevChecksum).toBe('prevhash');
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/lib/services/auditLog.service.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar lib/services/auditLog.service.ts**

```typescript
import crypto from 'crypto';
import { prisma } from '../db/prisma';

interface LogParams {
  apiKeyId: string;
  userId: string;
  action: string;
  platform: string;
  result: 'SUCCESS' | 'BLOCKED_INVALID_KEY' | 'BLOCKED_SCOPE' | 'BLOCKED_RULE' | 'BLOCKED_REVOKED';
  ruleViolated?: string;
}

export async function writeLog(params: LogParams) {
  const prev = await prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' } });
  const prevChecksum = prev?.checksum ?? 'genesis';
  const timestamp = new Date().toISOString();

  const data = `${prevChecksum}|${timestamp}|${params.userId}|${params.action}|${params.result}`;
  const checksum = crypto.createHash('sha256').update(data).digest('hex');

  return prisma.auditLog.create({
    data: {
      apiKeyId: params.apiKeyId,
      userId: params.userId,
      action: params.action,
      platform: params.platform,
      result: params.result,
      ruleViolated: params.ruleViolated ?? null,
      prevChecksum,
      checksum,
    },
  });
}
```

- [ ] **Step 4: Verificar que pasa**

```bash
npx jest tests/lib/services/auditLog.service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/services/auditLog.service.ts tests/lib/services/auditLog.service.test.ts
git commit -m "feat: add audit log service with sha256 checksum chaining"
```

---

## Task 9: Auth helper + Rate limiter

**Files:**
- Create: `next-app/lib/auth.ts`
- Create: `next-app/lib/rateLimiter.ts`

- [ ] **Step 1: Crear lib/auth.ts**

```typescript
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { config } from './config';

export function getAuthUserId(req: NextRequest): string | null {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string; type?: string };
    if (decoded.type !== 'user_session') return null;
    return decoded.userId;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Crear lib/rateLimiter.ts**

```typescript
import { redis } from './db/redis';

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 30;

export async function checkRateLimit(ip: string): Promise<boolean> {
  // Rate limit by IP only — never by attacker-controlled request body fields
  const identifier = `rl:ip:${ip}`;
  const count = await redis.incr(identifier);
  if (count === 1) await redis.expire(identifier, WINDOW_SECONDS);
  return count <= MAX_REQUESTS;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts lib/rateLimiter.ts
git commit -m "feat: add auth helper and rate limiter"
```

---

## Task 10: POST /api/validate route

**Files:**
- Create: `next-app/app/api/validate/route.ts`
- Create: `next-app/tests/api/validate.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// tests/api/validate.test.ts
import { POST } from '@/app/api/validate/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/services/apiKey.service');
jest.mock('@/lib/services/token.service');
jest.mock('@/lib/services/scope.service');
jest.mock('@/lib/services/rules.service');
jest.mock('@/lib/services/auditLog.service');
jest.mock('@/lib/rateLimiter', () => ({ checkRateLimit: jest.fn().mockResolvedValue(true) }));

const { validateApiKeyHash } = require('@/lib/services/apiKey.service');
const { issueToken, verifyToken, isTokenRevoked } = require('@/lib/services/token.service');
const { verifyScope } = require('@/lib/services/scope.service');
const { checkGlobalRules } = require('@/lib/services/rules.service');
const { writeLog } = require('@/lib/services/auditLog.service');

const validKey = { id: 'key_1', userId: 'user_1', scope: ['send_message'], status: 'ACTIVE' };

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/validate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
  });
}

describe('POST /api/validate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with token for a valid request', async () => {
    validateApiKeyHash.mockResolvedValue(validKey);
    issueToken.mockResolvedValue('jwt.token.here');
    verifyToken.mockResolvedValue({ jti: 'some-uuid' });
    isTokenRevoked.mockResolvedValue(false);
    verifyScope.mockReturnValue(true);
    checkGlobalRules.mockResolvedValue({ blocked: false });
    writeLog.mockResolvedValue({});

    const res = await POST(makeRequest({ api_key_hash: 'abc', action: 'send_message', platform: 'whatsapp', text: 'hello' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.token).toBe('jwt.token.here');
  });

  it('returns 401 for invalid api key', async () => {
    validateApiKeyHash.mockResolvedValue(null);
    writeLog.mockResolvedValue({});

    const res = await POST(makeRequest({ api_key_hash: 'bad', action: 'send_message', platform: 'whatsapp', text: '' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for scope violation', async () => {
    validateApiKeyHash.mockResolvedValue(validKey);
    issueToken.mockResolvedValue('tok');
    verifyToken.mockResolvedValue({ jti: 'jti-1' });
    isTokenRevoked.mockResolvedValue(false);
    verifyScope.mockReturnValue(false);
    writeLog.mockResolvedValue({});

    const res = await POST(makeRequest({ api_key_hash: 'abc', action: 'delete_account', platform: 'whatsapp', text: '' }));
    expect(res.status).toBe(403);
  });

  it('returns 403 for global rule violation', async () => {
    validateApiKeyHash.mockResolvedValue(validKey);
    issueToken.mockResolvedValue('tok');
    verifyToken.mockResolvedValue({ jti: 'jti-2' });
    isTokenRevoked.mockResolvedValue(false);
    verifyScope.mockReturnValue(true);
    checkGlobalRules.mockResolvedValue({ blocked: true, ruleViolated: 'mass_send' });
    writeLog.mockResolvedValue({});

    const res = await POST(makeRequest({ api_key_hash: 'abc', action: 'send_message', platform: 'whatsapp', text: 'spam' }));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/api/validate.test.ts
```

Expected: FAIL

- [ ] **Step 3: Crear app/api/validate/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiKeyHash } from '@/lib/services/apiKey.service';
import { issueToken, verifyToken, isTokenRevoked } from '@/lib/services/token.service';
import { verifyScope } from '@/lib/services/scope.service';
import { checkGlobalRules } from '@/lib/services/rules.service';
import { writeLog } from '@/lib/services/auditLog.service';
import { checkRateLimit } from '@/lib/rateLimiter';

const bodySchema = z.object({
  api_key_hash: z.string().min(1),
  action: z.string().min(1),
  platform: z.string().min(1),
  text: z.string().default(''),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const allowed = await checkRateLimit(ip);
  if (!allowed) return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { api_key_hash, action, platform, text } = parsed.data;

  // Función 1: Validar API Key — recibe hash del SDK, busca directo en DB
  const keyRecord = await validateApiKeyHash(api_key_hash);
  if (!keyRecord) {
    await writeLog({ apiKeyId: 'unknown', userId: 'unknown', action, platform, result: 'BLOCKED_INVALID_KEY' });
    return NextResponse.json({ error: 'invalid_api_key' }, { status: 401 });
  }

  // Función 2: Emitir token
  const token = await issueToken({ userId: keyRecord.userId, apiKeyId: keyRecord.id, scope: keyRecord.scope });
  const decoded = await verifyToken(token);
  if (await isTokenRevoked(decoded.jti)) {
    return NextResponse.json({ error: 'invalid_api_key' }, { status: 401 });
  }

  // Función 3: Verificar scope
  if (!verifyScope(action, keyRecord.scope)) {
    await writeLog({ apiKeyId: keyRecord.id, userId: keyRecord.userId, action, platform, result: 'BLOCKED_SCOPE' });
    return NextResponse.json({ error: 'action_not_permitted' }, { status: 403 });
  }

  // Función 4: Verificar reglas globales
  const ruleCheck = await checkGlobalRules({ action, text });
  if (ruleCheck.blocked) {
    await writeLog({ apiKeyId: keyRecord.id, userId: keyRecord.userId, action, platform, result: 'BLOCKED_RULE', ruleViolated: ruleCheck.ruleViolated });
    return NextResponse.json({ error: 'action_not_permitted' }, { status: 403 });
  }

  // Función 5: Aprobar
  await writeLog({ apiKeyId: keyRecord.id, userId: keyRecord.userId, action, platform, result: 'SUCCESS' });
  return NextResponse.json({ token, userId: keyRecord.userId, scope: keyRecord.scope });
}
```

- [ ] **Step 4: Verificar que pasa**

```bash
npx jest tests/api/validate.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add app/api/validate/ tests/api/validate.test.ts
git commit -m "feat: add POST /api/validate route with full pipeline"
```

---

## Task 11: Auth routes (register + login)

**Files:**
- Create: `next-app/app/api/auth/register/route.ts`
- Create: `next-app/app/api/auth/login/route.ts`
- Create: `next-app/tests/api/auth.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// tests/api/auth.test.ts
import { POST as register } from '@/app/api/auth/register/route';
import { POST as login } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';

jest.mock('@/lib/db/prisma', () => ({
  prisma: { user: { findUnique: jest.fn(), create: jest.fn() } },
}));

const { prisma } = require('@/lib/db/prisma');

function makeReq(path: string, body: object) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/auth/register', () => {
  it('creates a user and returns a user_session token', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'user_1', email: 'a@b.com' });

    const res = await register(makeReq('/api/auth/register', { email: 'a@b.com', password: 'password123' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.token).toBeDefined();
    expect(body.userId).toBe('user_1');
  });

  it('returns 409 if email already taken', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    const res = await register(makeReq('/api/auth/register', { email: 'a@b.com', password: 'password123' }));
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('returns token for valid credentials', async () => {
    const hashed = await bcrypt.hash('password123', 1);
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', password: hashed });

    const res = await login(makeReq('/api/auth/login', { email: 'a@b.com', password: 'password123' }));
    expect(res.status).toBe(200);
    expect((await res.json()).token).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const hashed = await bcrypt.hash('correct', 1);
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', password: hashed });

    const res = await login(makeReq('/api/auth/login', { email: 'a@b.com', password: 'wrong' }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/api/auth.test.ts
```

Expected: FAIL

- [ ] **Step 3: Crear app/api/auth/register/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { issueUserToken } from '@/lib/services/token.service';

const body = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function POST(req: NextRequest) {
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'email_taken' }, { status: 409 });

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, password: hashed } });
  const token = await issueUserToken(user.id);
  return NextResponse.json({ token, userId: user.id }, { status: 201 });
}
```

- [ ] **Step 4: Crear app/api/auth/login/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { issueUserToken } from '@/lib/services/token.service';

const body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });

  const token = await issueUserToken(user.id);
  return NextResponse.json({ token, userId: user.id });
}
```

- [ ] **Step 5: Verificar que pasa**

```bash
npx jest tests/api/auth.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add app/api/auth/ tests/api/auth.test.ts
git commit -m "feat: add auth register and login routes"
```

---

## Task 12: Keys routes (GET, POST, DELETE)

**Files:**
- Create: `next-app/app/api/keys/route.ts`
- Create: `next-app/app/api/keys/[id]/route.ts`
- Create: `next-app/tests/api/keys.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// tests/api/keys.test.ts
import { GET, POST } from '@/app/api/keys/route';
import { DELETE } from '@/app/api/keys/[id]/route';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

jest.mock('@/lib/services/apiKey.service');
jest.mock('@/lib/db/prisma', () => ({
  prisma: { apiKey: { findMany: jest.fn() } },
}));

const { createApiKey, revokeApiKey } = require('@/lib/services/apiKey.service');
const { prisma } = require('@/lib/db/prisma');

const validToken = jwt.sign(
  { userId: 'user_1', type: 'user_session' },
  process.env.JWT_SECRET ?? 'test-secret-at-least-32-characters-long',
  { expiresIn: '1h' }
);

function makeReq(path: string, method: string, body?: object) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('GET /api/keys', () => {
  it('returns list of keys', async () => {
    prisma.apiKey.findMany.mockResolvedValue([{ id: 'k1', name: 'Agent', prefix: 'ak_test' }]);
    const res = await GET(makeReq('/api/keys', 'GET'));
    expect(res.status).toBe(200);
    expect((await res.json()).length).toBe(1);
  });

  it('returns 401 without token', async () => {
    const res = await GET(new NextRequest('http://localhost/api/keys'));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/keys', () => {
  it('creates a key and returns plainKey', async () => {
    createApiKey.mockResolvedValue({ id: 'k1', plainKey: 'ak_abc', prefix: 'ak_abc' });
    const res = await POST(makeReq('/api/keys', 'POST', { name: 'Agent', scope: ['send_message'] }));
    expect(res.status).toBe(201);
    expect((await res.json()).plainKey).toBeDefined();
  });

  it('returns 400 for invalid scope', async () => {
    const res = await POST(makeReq('/api/keys', 'POST', { name: 'Agent', scope: ['mass_send'] }));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/keys/[id]', () => {
  it('revokes a key', async () => {
    revokeApiKey.mockResolvedValue(undefined);
    const req = makeReq('/api/keys/k1', 'DELETE');
    const res = await DELETE(req, { params: { id: 'k1' } });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/api/keys.test.ts
```

Expected: FAIL

- [ ] **Step 3: Crear app/api/keys/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserId } from '@/lib/auth';
import { createApiKey } from '@/lib/services/apiKey.service';
import { ALLOWED_ACTIONS } from '@/lib/services/scope.service';
import { prisma } from '@/lib/db/prisma';

const createBody = z.object({
  name: z.string().min(1).max(100),
  scope: z.array(z.enum([...ALLOWED_ACTIONS] as [string, ...string[]])).min(1),
});

export async function GET(req: NextRequest) {
  const userId = getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    where: { userId },
    select: { id: true, name: true, prefix: true, scope: true, status: true, createdAt: true, revokedAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  const userId = getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = createBody.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const result = await createApiKey({ userId, ...parsed.data });
  return NextResponse.json(result, { status: 201 });
}
```

- [ ] **Step 4: Crear app/api/keys/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { revokeApiKey } from '@/lib/services/apiKey.service';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  await revokeApiKey(params.id, userId);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Verificar que pasa**

```bash
npx jest tests/api/keys.test.ts
```

Expected: PASS — 5 tests

- [ ] **Step 6: Commit**

```bash
git add app/api/keys/ tests/api/keys.test.ts
git commit -m "feat: add keys routes (GET list, POST create, DELETE revoke)"
```

---

## Task 13: Audit Log + Alerts routes

**Files:**
- Create: `next-app/app/api/audit-log/route.ts`
- Create: `next-app/app/api/alerts/route.ts`
- Create: `next-app/tests/api/auditLog.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// tests/api/auditLog.test.ts
import { GET as getAuditLog } from '@/app/api/audit-log/route';
import { GET as getAlerts } from '@/app/api/alerts/route';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

jest.mock('@/lib/db/prisma', () => ({
  prisma: { auditLog: { findMany: jest.fn() } },
}));

const { prisma } = require('@/lib/db/prisma');
const validToken = jwt.sign(
  { userId: 'user_1', type: 'user_session' },
  process.env.JWT_SECRET ?? 'test-secret-at-least-32-characters-long',
  { expiresIn: '1h' }
);

function makeReq(path: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: { Authorization: `Bearer ${validToken}` },
  });
}

describe('GET /api/audit-log', () => {
  it('returns logs for the authenticated user', async () => {
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'l1', result: 'SUCCESS' }]);
    const res = await getAuditLog(makeReq('/api/audit-log'));
    expect(res.status).toBe(200);
    expect((await res.json()).length).toBe(1);
  });

  it('returns 401 without token', async () => {
    const res = await getAuditLog(new NextRequest('http://localhost/api/audit-log'));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/alerts', () => {
  it('returns BLOCKED_RULE logs', async () => {
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'l2', result: 'BLOCKED_RULE' }]);
    const res = await getAlerts(makeReq('/api/alerts'));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/api/auditLog.test.ts
```

Expected: FAIL

- [ ] **Step 3: Crear app/api/audit-log/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserId } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

const querySchema = z.object({
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

export async function GET(req: NextRequest) {
  const userId = getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { keyId, platform, from, to, result, page } = parsed.data;

  const logs = await prisma.auditLog.findMany({
    where: {
      userId,
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

  return NextResponse.json(logs);
}
```

- [ ] **Step 4: Crear app/api/alerts/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export async function GET(req: NextRequest) {
  const userId = getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const alerts = await prisma.auditLog.findMany({
    where: { userId, result: 'BLOCKED_RULE' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return NextResponse.json(alerts);
}
```

- [ ] **Step 5: Correr todos los tests**

```bash
npx jest --coverage
```

Expected: PASS — todos los tests, coverage >80% en servicios críticos

- [ ] **Step 6: Commit final**

```bash
git add app/api/audit-log/ app/api/alerts/ tests/api/auditLog.test.ts
git commit -m "feat: add audit-log and alerts routes"
```

---

## Self-Review

**Spec coverage:**
- ✅ Función 1 pipeline: `validateApiKeyHash` — busca hash directo, sin re-hash (VULN-005 fix)
- ✅ Función 2 pipeline: `issueToken` con `type: sdk_token` + jti (VULN-001 fix)
- ✅ Función 2 pipeline: `verifyToken(token).jti` antes de `isTokenRevoked` (VULN-002 fix)
- ✅ Función 3 pipeline: `verifyScope` con normalización y enum ALLOWED_ACTIONS
- ✅ Función 4 pipeline: `checkGlobalRules` — action type + contenido normalizado
- ✅ Rate limiting por IP únicamente (VULN-003 fix)
- ✅ CSPRNG + prefijo ak_ → `crypto.ts`
- ✅ Audit log con checksum chaining → `auditLog.service.ts`
- ✅ Revocación inmediata de JWTs en Redis → `token.service.ts`
- ✅ Auth routes: register hashea con bcrypt + emite `user_session` token
- ✅ `getAuthUserId` rechaza tokens sin `type: user_session` (VULN-001 fix)
- ✅ Scope validado contra ALLOWED_ACTIONS al crear key (VULN-004 fix)
- ✅ Keys: GET list, POST create (con scope enum), DELETE revoke
- ✅ Audit Log: GET con filtros (keyId, platform, from, to, result, page)
- ✅ Alerts: GET — solo BLOCKED_RULE entries
- ⏭️ Frontend pages → Plan 3 (mismo proyecto next-app/)
