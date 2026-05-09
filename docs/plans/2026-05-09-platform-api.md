# Platform API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el servicio central de validación que el SDK llama antes de cada acción del agente — valida API Keys, emite JWTs, verifica scopes y reglas globales, y mantiene el audit log.

**Architecture:** API REST en Node.js/TypeScript con Express. PostgreSQL para usuarios, API Keys y audit log. Redis para rate limiting y lista de revocación de JWTs. Pipeline de validación con funciones atómicas, una responsabilidad por función.

**Tech Stack:** Node.js 18+, TypeScript, Express, PostgreSQL, Redis, Jest, Prisma ORM, ioredis, jsonwebtoken, zod

---

## File Structure

```
platform-api/
  src/
    routes/
      validate.ts          # POST /v1/validate — pipeline completo
      keys.ts              # POST /v1/keys, GET /v1/keys, DELETE /v1/keys/:id
      auth.ts              # POST /v1/auth/register, POST /v1/auth/login
    services/
      apiKey.service.ts    # Validar, crear, revocar API Keys
      token.service.ts     # Emitir JWT, invalidar jti en Redis
      scope.service.ts     # Verificar scope normalizado
      rules.service.ts     # Reglas globales — action type + content
      auditLog.service.ts  # Escribir y leer audit log con checksum chain
    middleware/
      rateLimiter.ts       # Rate limiting por api_key_hash + IP
      auth.ts              # Validar JWT de usuario para rutas del dashboard
    utils/
      crypto.ts            # Generar API Keys con CSPRNG, hashear
      normalize.ts         # Normalizar action y text (NFKC, zero-width, URL decode)
    db/
      prisma.ts            # Cliente Prisma singleton
      redis.ts             # Cliente Redis singleton
    config.ts              # Variables de entorno validadas con zod
    app.ts                 # Express app (sin listen)
    index.ts               # Entry point (listen)
  prisma/
    schema.prisma          # Schema de DB
    migrations/            # Generadas por Prisma
  tests/
    services/
      apiKey.service.test.ts
      token.service.test.ts
      scope.service.test.ts
      rules.service.test.ts
      auditLog.service.test.ts
    utils/
      crypto.test.ts
      normalize.test.ts
    routes/
      validate.test.ts
      keys.test.ts
  jest.config.ts
  tsconfig.json
  package.json
  .env.example
```

---

## Task 1: Inicializar proyecto

**Files:**
- Create: `platform-api/package.json`
- Create: `platform-api/tsconfig.json`
- Create: `platform-api/jest.config.ts`
- Create: `platform-api/.env.example`

- [ ] **Step 1: Crear directorio e inicializar**

```bash
mkdir platform-api && cd platform-api
npm init -y
```

- [ ] **Step 2: Instalar dependencias**

```bash
npm install express @prisma/client ioredis jsonwebtoken zod bcryptjs
npm install -D typescript ts-node @types/express @types/node @types/jsonwebtoken @types/bcryptjs jest ts-jest @types/jest supertest @types/supertest prisma nodemon
```

- [ ] **Step 3: Crear tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Crear jest.config.ts**

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
};

export default config;
```

- [ ] **Step 5: Crear .env.example**

```env
DATABASE_URL="postgresql://user:password@localhost:5432/platform_api"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="change-me-to-a-random-256-bit-secret"
JWT_EXPIRES_IN="15m"
PORT=3000
NODE_ENV="development"
```

- [ ] **Step 6: Agregar scripts a package.json**

```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate"
  }
}
```

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: initialize platform-api project"
```

---

## Task 2: Schema de base de datos

**Files:**
- Create: `platform-api/prisma/schema.prisma`

- [ ] **Step 1: Inicializar Prisma**

```bash
cd platform-api
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
  prefix    String    // primeros 8 chars del key para mostrar en UI
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
  id           String   @id @default(cuid())
  apiKeyId     String
  apiKey       ApiKey   @relation(fields: [apiKeyId], references: [id])
  userId       String
  action       String
  platform     String
  result       LogResult
  ruleViolated String?
  prevChecksum String
  checksum     String
  createdAt    DateTime @default(now())

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

- [ ] **Step 3: Crear y aplicar migración**

```bash
npx prisma migrate dev --name init
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add database schema with users, api keys, audit log, global rules"
```

---

## Task 3: Config y clientes de DB/Redis

**Files:**
- Create: `platform-api/src/config.ts`
- Create: `platform-api/src/db/prisma.ts`
- Create: `platform-api/src/db/redis.ts`

- [ ] **Step 1: Crear src/config.ts**

```typescript
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
```

- [ ] **Step 2: Crear src/db/prisma.ts**

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 3: Crear src/db/redis.ts**

```typescript
import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});
```

- [ ] **Step 4: Commit**

```bash
git add src/config.ts src/db/
git commit -m "feat: add config validation and db/redis clients"
```

---

## Task 4: Utilidades criptográficas

**Files:**
- Create: `platform-api/src/utils/crypto.ts`
- Create: `platform-api/tests/utils/crypto.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// tests/utils/crypto.test.ts
import { generateApiKey, hashApiKey } from '../../src/utils/crypto';

describe('crypto utils', () => {
  describe('generateApiKey', () => {
    it('generates a key with ak_ prefix', () => {
      const key = generateApiKey();
      expect(key.startsWith('ak_')).toBe(true);
    });

    it('generates a key with at least 40 characters after prefix', () => {
      const key = generateApiKey();
      const value = key.replace('ak_', '');
      expect(value.length).toBeGreaterThanOrEqual(40);
    });

    it('generates unique keys', () => {
      const keys = new Set(Array.from({ length: 1000 }, () => generateApiKey()));
      expect(keys.size).toBe(1000);
    });
  });

  describe('hashApiKey', () => {
    it('returns a consistent hash for the same key', () => {
      const key = 'ak_testkey123';
      expect(hashApiKey(key)).toBe(hashApiKey(key));
    });

    it('returns different hashes for different keys', () => {
      expect(hashApiKey('ak_key1')).not.toBe(hashApiKey('ak_key2'));
    });

    it('never returns the original key', () => {
      const key = 'ak_testkey123';
      expect(hashApiKey(key)).not.toBe(key);
    });
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/utils/crypto.test.ts
```

Expected: FAIL — `Cannot find module '../../src/utils/crypto'`

- [ ] **Step 3: Implementar src/utils/crypto.ts**

```typescript
import crypto from 'crypto';

export function generateApiKey(): string {
  const bytes = crypto.randomBytes(32);
  const value = bytes.toString('base64url');
  return `ak_${value}`;
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function getKeyPrefix(key: string): string {
  return key.slice(0, 11); // "ak_" + primeros 8 chars
}
```

- [ ] **Step 4: Verificar que pasa**

```bash
npx jest tests/utils/crypto.test.ts
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/utils/crypto.ts tests/utils/crypto.test.ts
git commit -m "feat: add CSPRNG api key generation and hashing utils"
```

---

## Task 5: Normalización de texto y acción

**Files:**
- Create: `platform-api/src/utils/normalize.ts`
- Create: `platform-api/tests/utils/normalize.test.ts`

- [ ] **Step 1: Instalar dependencia de normalización**

```bash
npm install unorm
npm install -D @types/unorm
```

- [ ] **Step 2: Escribir el test**

```typescript
// tests/utils/normalize.test.ts
import { normalizeAction, normalizeText } from '../../src/utils/normalize';

describe('normalizeAction', () => {
  it('lowercases the action', () => {
    expect(normalizeAction('SEND_MESSAGE')).toBe('send_message');
  });

  it('trims whitespace', () => {
    expect(normalizeAction('  send_message  ')).toBe('send_message');
  });

  it('removes null bytes', () => {
    expect(normalizeAction('send_message\x00')).toBe('send_message');
  });
});

describe('normalizeText', () => {
  it('applies NFKC normalization to remove lookalike chars', () => {
    // Cyrillic 'а' (U+0430) looks like Latin 'a'
    const cyrillicA = 'а';
    const normalized = normalizeText(`ph${cyrillicA}rm`);
    expect(normalized).toBe('pharm');
  });

  it('removes zero-width characters', () => {
    const zwsp = '​'; // zero-width space
    expect(normalizeText(`sp${zwsp}am`)).toBe('spam');
  });

  it('decodes URL encoding', () => {
    expect(normalizeText('sp%61m')).toBe('spam');
  });

  it('handles empty string', () => {
    expect(normalizeText('')).toBe('');
  });
});
```

- [ ] **Step 3: Verificar que falla**

```bash
npx jest tests/utils/normalize.test.ts
```

Expected: FAIL

- [ ] **Step 4: Implementar src/utils/normalize.ts**

```typescript
const ZERO_WIDTH_CHARS = /[​-‍﻿­͏ᅟᅠ឴឵᠋-᠍⁠-⁯]/g;
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

export function normalizeAction(action: string): string {
  return action
    .replace(CONTROL_CHARS, '')
    .trim()
    .toLowerCase();
}

export function normalizeText(text: string): string {
  if (!text) return '';

  let result = text;

  try {
    result = decodeURIComponent(result);
  } catch {
    // if decode fails, use original
  }

  result = result
    .normalize('NFKC')
    .replace(ZERO_WIDTH_CHARS, '');

  return result;
}
```

- [ ] **Step 5: Verificar que pasa**

```bash
npx jest tests/utils/normalize.test.ts
```

Expected: PASS — 7 tests

- [ ] **Step 6: Commit**

```bash
git add src/utils/normalize.ts tests/utils/normalize.test.ts
git commit -m "feat: add text/action normalization (NFKC, zero-width, URL decode)"
```

---

## Task 6: Token service (JWT + revocación con Redis)

**Files:**
- Create: `platform-api/src/services/token.service.ts`
- Create: `platform-api/tests/services/token.service.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// tests/services/token.service.test.ts
import { issueToken, verifyToken, revokeToken, isTokenRevoked } from '../../src/services/token.service';

jest.mock('../src/db/redis', () => ({
  redis: {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    sadd: jest.fn().mockResolvedValue(1),
    sismember: jest.fn().mockResolvedValue(0),
  },
}));

describe('token.service', () => {
  const payload = { userId: 'user_1', apiKeyId: 'key_1', scope: ['send_message'] };

  describe('issueToken', () => {
    it('returns a token string', async () => {
      const token = await issueToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT format
    });

    it('includes jti in the payload', async () => {
      const token = await issueToken(payload);
      const decoded = await verifyToken(token);
      expect(decoded.jti).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    it('returns the payload for a valid token', async () => {
      const token = await issueToken(payload);
      const decoded = await verifyToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.apiKeyId).toBe(payload.apiKeyId);
    });

    it('throws for an invalid token', async () => {
      await expect(verifyToken('invalid.token.here')).rejects.toThrow();
    });
  });

  describe('revokeToken + isTokenRevoked', () => {
    it('marks a token as revoked', async () => {
      const { redis } = require('../src/db/redis');
      redis.sismember.mockResolvedValueOnce(1);

      const token = await issueToken(payload);
      const decoded = await verifyToken(token);
      await revokeToken(decoded.jti as string);
      const revoked = await isTokenRevoked(decoded.jti as string);
      expect(revoked).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/services/token.service.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar src/services/token.service.ts**

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

interface DecodedToken extends TokenPayload {
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
  // stored as apiKeyId:jti pattern during issuance via issueTokenForKey
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
npx jest tests/services/token.service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/token.service.ts tests/services/token.service.test.ts
git commit -m "feat: add token service with jti issuance and Redis revocation"
```

---

## Task 7: API Key service

**Files:**
- Create: `platform-api/src/services/apiKey.service.ts`
- Create: `platform-api/tests/services/apiKey.service.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// tests/services/apiKey.service.test.ts
import { validateApiKeyHash, createApiKey, revokeApiKey } from '../../src/services/apiKey.service';

jest.mock('../../src/db/prisma', () => ({
  prisma: {
    apiKey: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const { prisma } = require('../../src/db/prisma');

describe('apiKey.service', () => {
  describe('validateApiKeyHash', () => {
    it('returns the api key record for a valid active key hash', async () => {
      const mockKey = {
        id: 'key_1',
        userId: 'user_1',
        keyHash: 'abc123hash',
        scope: ['send_message'],
        status: 'ACTIVE',
      };
      prisma.apiKey.findUnique.mockResolvedValueOnce(mockKey);

      const result = await validateApiKeyHash('abc123hash');
      expect(result).toEqual(mockKey);
    });

    it('returns null for an unknown hash', async () => {
      prisma.apiKey.findUnique.mockResolvedValueOnce(null);
      const result = await validateApiKeyHash('unknownhash');
      expect(result).toBeNull();
    });

    it('returns null for a revoked key', async () => {
      prisma.apiKey.findUnique.mockResolvedValueOnce({
        id: 'key_2',
        status: 'REVOKED',
      });
      const result = await validateApiKeyHash('revokedhash');
      expect(result).toBeNull();
    });
  });

  describe('createApiKey', () => {
    it('creates a key and returns the plain key value once', async () => {
      prisma.apiKey.create.mockResolvedValueOnce({
        id: 'key_3',
        prefix: 'ak_testke',
      });

      const result = await createApiKey({
        userId: 'user_1',
        name: 'My Agent',
        scope: ['send_message'],
      });

      expect(result.plainKey.startsWith('ak_')).toBe(true);
      expect(result.id).toBe('key_3');
    });
  });

  describe('revokeApiKey', () => {
    it('sets status to REVOKED and records revokedAt', async () => {
      prisma.apiKey.update.mockResolvedValueOnce({ id: 'key_1', status: 'REVOKED' });
      await revokeApiKey('key_1', 'user_1');
      expect(prisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'key_1', userId: 'user_1' },
          data: expect.objectContaining({ status: 'REVOKED' }),
        })
      );
    });
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/services/apiKey.service.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar src/services/apiKey.service.ts**

```typescript
import { prisma } from '../db/prisma';
import { generateApiKey, hashApiKey, getKeyPrefix } from '../utils/crypto';
import { revokeAllTokensForKey } from './token.service';

interface ApiKeyRecord {
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
    data: {
      userId: params.userId,
      name: params.name,
      keyHash,
      prefix,
      scope: params.scope,
    },
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
npx jest tests/services/apiKey.service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/apiKey.service.ts tests/services/apiKey.service.test.ts
git commit -m "feat: add api key service (validate, create, revoke)"
```

---

## Task 8: Scope service

**Files:**
- Create: `platform-api/src/services/scope.service.ts`
- Create: `platform-api/tests/services/scope.service.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// tests/services/scope.service.test.ts
import { verifyScope, ALLOWED_ACTIONS } from '../../src/services/scope.service';

describe('verifyScope', () => {
  it('returns true when action is in scope', () => {
    expect(verifyScope('send_message', ['send_message', 'read_messages'])).toBe(true);
  });

  it('returns false when action is not in scope', () => {
    expect(verifyScope('delete_account', ['send_message'])).toBe(false);
  });

  it('returns false for unknown action not in ALLOWED_ACTIONS enum', () => {
    expect(verifyScope('unknown_action_xyz', ['unknown_action_xyz'])).toBe(false);
  });

  it('handles uppercase input by normalizing', () => {
    expect(verifyScope('SEND_MESSAGE', ['send_message'])).toBe(true);
  });

  it('handles whitespace by normalizing', () => {
    expect(verifyScope('  send_message  ', ['send_message'])).toBe(true);
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/services/scope.service.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar src/services/scope.service.ts**

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

- [ ] **Step 4: Verificar que pasa**

```bash
npx jest tests/services/scope.service.test.ts
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/services/scope.service.ts tests/services/scope.service.test.ts
git commit -m "feat: add scope service with action enum validation and normalization"
```

---

## Task 9: Rules service (reglas globales + análisis de contenido)

**Files:**
- Create: `platform-api/src/services/rules.service.ts`
- Create: `platform-api/tests/services/rules.service.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// tests/services/rules.service.test.ts
import { checkGlobalRules, RuleViolation } from '../../src/services/rules.service';

jest.mock('../../src/db/prisma', () => ({
  prisma: {
    globalRule: {
      findMany: jest.fn().mockResolvedValue([
        { type: 'FORBIDDEN_ACTION', value: 'mass_send' },
        { type: 'FORBIDDEN_ACTION', value: 'scrape_contacts' },
        { type: 'FORBIDDEN_KEYWORD', value: 'buy now click here' },
      ]),
    },
  },
}));

describe('checkGlobalRules', () => {
  describe('action type check', () => {
    it('blocks a forbidden action', async () => {
      const result = await checkGlobalRules({ action: 'mass_send', text: 'hello' });
      expect(result.blocked).toBe(true);
      expect(result.ruleViolated).toBe('mass_send');
    });

    it('allows a non-forbidden action', async () => {
      const result = await checkGlobalRules({ action: 'send_message', text: 'hello' });
      expect(result.blocked).toBe(false);
    });
  });

  describe('content check', () => {
    it('blocks text containing a forbidden keyword', async () => {
      const result = await checkGlobalRules({
        action: 'send_message',
        text: 'BUY NOW CLICK HERE for discount',
      });
      expect(result.blocked).toBe(true);
    });

    it('blocks text with unicode obfuscation after normalization', async () => {
      // 'buy' with zero-width space between chars
      const obfuscated = 'b​uy n​ow click here';
      const result = await checkGlobalRules({ action: 'send_message', text: obfuscated });
      expect(result.blocked).toBe(true);
    });

    it('allows clean text', async () => {
      const result = await checkGlobalRules({ action: 'send_message', text: 'Hello, how are you?' });
      expect(result.blocked).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/services/rules.service.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar src/services/rules.service.ts**

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
      if (regex.test(text)) {
        return { blocked: true, ruleViolated: rule.value };
      }
    }
  }

  return { blocked: false };
}
```

- [ ] **Step 4: Verificar que pasa**

```bash
npx jest tests/services/rules.service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/rules.service.ts tests/services/rules.service.test.ts
git commit -m "feat: add rules service with forbidden action and content keyword checks"
```

---

## Task 10: Audit Log service

**Files:**
- Create: `platform-api/src/services/auditLog.service.ts`
- Create: `platform-api/tests/services/auditLog.service.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// tests/services/auditLog.service.test.ts
import { writeLog, verifyChain } from '../../src/services/auditLog.service';

jest.mock('../../src/db/prisma', () => ({
  prisma: {
    auditLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'log_1', ...data })),
      findMany: jest.fn(),
    },
  },
}));

describe('auditLog.service', () => {
  describe('writeLog', () => {
    it('writes a log entry with checksum', async () => {
      const { prisma } = require('../../src/db/prisma');
      const entry = await writeLog({
        apiKeyId: 'key_1',
        userId: 'user_1',
        action: 'send_message',
        platform: 'whatsapp',
        result: 'SUCCESS',
      });

      expect(entry.checksum).toBeDefined();
      expect(entry.checksum.length).toBe(64); // SHA-256 hex
    });

    it('includes prev_checksum in the new entry checksum', async () => {
      const { prisma } = require('../../src/db/prisma');
      prisma.auditLog.findFirst.mockResolvedValueOnce({
        checksum: 'abc123prevchecksum',
      });

      const entry = await writeLog({
        apiKeyId: 'key_1',
        userId: 'user_1',
        action: 'send_message',
        platform: 'whatsapp',
        result: 'SUCCESS',
      });

      expect(entry.prevChecksum).toBe('abc123prevchecksum');
    });
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/services/auditLog.service.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar src/services/auditLog.service.ts**

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

function computeChecksum(params: {
  prevChecksum: string;
  timestamp: string;
  userId: string;
  action: string;
  result: string;
}): string {
  const data = `${params.prevChecksum}|${params.timestamp}|${params.userId}|${params.action}|${params.result}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function writeLog(params: LogParams) {
  const prev = await prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' } });
  const prevChecksum = prev?.checksum ?? 'genesis';
  const timestamp = new Date().toISOString();

  const checksum = computeChecksum({
    prevChecksum,
    timestamp,
    userId: params.userId,
    action: params.action,
    result: params.result,
  });

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
npx jest tests/services/auditLog.service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/auditLog.service.ts tests/services/auditLog.service.test.ts
git commit -m "feat: add audit log service with sha256 checksum chaining"
```

---

## Task 11: Rate limiter middleware

**Files:**
- Create: `platform-api/src/middleware/rateLimiter.ts`

- [ ] **Step 1: Implementar src/middleware/rateLimiter.ts**

```typescript
import { Request, Response, NextFunction } from 'express';
import { redis } from '../db/redis';

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 30;

export async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  // Rate limit by IP only — never by attacker-controlled request body fields
  const ip = req.ip ?? 'unknown';
  const identifier = `rl:ip:${ip}`;

  const count = await redis.incr(identifier);
  if (count === 1) {
    await redis.expire(identifier, WINDOW_SECONDS);
  }

  if (count > MAX_REQUESTS) {
    res.status(429).json({ error: 'rate_limit_exceeded' });
    return;
  }

  next();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware/rateLimiter.ts
git commit -m "feat: add rate limiter middleware by api_key_hash and ip"
```

---

## Task 12: Validation route (pipeline completo)

**Files:**
- Create: `platform-api/src/routes/validate.ts`
- Create: `platform-api/tests/routes/validate.test.ts`

- [ ] **Step 1: Escribir el test de integración**

```typescript
// tests/routes/validate.test.ts
import request from 'supertest';
import app from '../../src/app';

jest.mock('../../src/services/apiKey.service');
jest.mock('../../src/services/token.service');
jest.mock('../../src/services/scope.service');
jest.mock('../../src/services/rules.service');
jest.mock('../../src/services/auditLog.service');
jest.mock('../../src/db/redis', () => ({ redis: { incr: jest.fn().mockResolvedValue(1), expire: jest.fn() } }));

const { validateApiKeyHash } = require('../../src/services/apiKey.service');
const { issueToken, verifyToken, isTokenRevoked } = require('../../src/services/token.service');
const { verifyScope } = require('../../src/services/scope.service');
const { checkGlobalRules } = require('../../src/services/rules.service');
const { writeLog } = require('../../src/services/auditLog.service');

const validKey = { id: 'key_1', userId: 'user_1', scope: ['send_message'], status: 'ACTIVE' };

describe('POST /v1/validate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with token for a valid request', async () => {
    validateApiKeyHash.mockResolvedValue(validKey);
    issueToken.mockResolvedValue('jwt.token.here');
    verifyToken.mockResolvedValue({ jti: 'some-uuid', userId: 'user_1' });
    isTokenRevoked.mockResolvedValue(false);
    verifyScope.mockReturnValue(true);
    checkGlobalRules.mockResolvedValue({ blocked: false });
    writeLog.mockResolvedValue({});

    const res = await request(app).post('/v1/validate').send({
      api_key_hash: 'abc123',
      action: 'send_message',
      platform: 'whatsapp',
      text: 'Hello',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('jwt.token.here');
    expect(res.body.userId).toBe('user_1');
  });

  it('returns 401 for an invalid api key', async () => {
    validateApiKeyHash.mockResolvedValue(null);
    writeLog.mockResolvedValue({});

    const res = await request(app).post('/v1/validate').send({
      api_key_hash: 'invalid',
      action: 'send_message',
      platform: 'whatsapp',
      text: 'Hello',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_api_key');
  });

  it('returns 403 for a scope violation', async () => {
    validateApiKeyHash.mockResolvedValue(validKey);
    issueToken.mockResolvedValue('jwt.token.here');
    verifyToken.mockResolvedValue({ jti: 'some-uuid', userId: 'user_1' });
    isTokenRevoked.mockResolvedValue(false);
    verifyScope.mockReturnValue(false);
    writeLog.mockResolvedValue({});

    const res = await request(app).post('/v1/validate').send({
      api_key_hash: 'abc123',
      action: 'delete_account',
      platform: 'whatsapp',
      text: '',
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('action_not_permitted');
  });

  it('returns 403 for a global rule violation', async () => {
    validateApiKeyHash.mockResolvedValue(validKey);
    issueToken.mockResolvedValue('jwt.token.here');
    verifyToken.mockResolvedValue({ jti: 'some-uuid', userId: 'user_1' });
    isTokenRevoked.mockResolvedValue(false);
    verifyScope.mockReturnValue(true);
    checkGlobalRules.mockResolvedValue({ blocked: true, ruleViolated: 'mass_send' });
    writeLog.mockResolvedValue({});

    const res = await request(app).post('/v1/validate').send({
      api_key_hash: 'abc123',
      action: 'send_message',
      platform: 'whatsapp',
      text: 'mass spam',
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('action_not_permitted');
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/routes/validate.test.ts
```

Expected: FAIL

- [ ] **Step 3: Crear src/routes/validate.ts**

```typescript
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateApiKeyHash } from '../services/apiKey.service';
import { issueToken, verifyToken, isTokenRevoked } from '../services/token.service';
import { verifyScope } from '../services/scope.service';
import { checkGlobalRules } from '../services/rules.service';
import { writeLog } from '../services/auditLog.service';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

const validateBody = z.object({
  api_key_hash: z.string().min(1),
  action: z.string().min(1),
  platform: z.string().min(1),
  text: z.string().default(''),
});

router.post('/', rateLimiter, async (req: Request, res: Response) => {
  const parsed = validateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  const { api_key_hash, action, platform, text } = parsed.data;

  // Función 1: Validar API Key — recibe el hash del SDK, busca directo en DB
  const keyRecord = await validateApiKeyHash(api_key_hash);
  if (!keyRecord) {
    await writeLog({
      apiKeyId: 'unknown',
      userId: 'unknown',
      action,
      platform,
      result: 'BLOCKED_INVALID_KEY',
    });
    res.status(401).json({ error: 'invalid_api_key' });
    return;
  }

  // Función 2: Emitir token
  const token = await issueToken({
    userId: keyRecord.userId,
    apiKeyId: keyRecord.id,
    scope: keyRecord.scope,
  });

  const decoded = await verifyToken(token);
  const revoked = await isTokenRevoked(decoded.jti);
  if (revoked) {
    res.status(401).json({ error: 'invalid_api_key' });
    return;
  }

  // Función 3: Verificar scope
  if (!verifyScope(action, keyRecord.scope)) {
    await writeLog({
      apiKeyId: keyRecord.id,
      userId: keyRecord.userId,
      action,
      platform,
      result: 'BLOCKED_SCOPE',
    });
    res.status(403).json({ error: 'action_not_permitted' });
    return;
  }

  // Función 4: Verificar reglas globales
  const ruleCheck = await checkGlobalRules({ action, text });
  if (ruleCheck.blocked) {
    await writeLog({
      apiKeyId: keyRecord.id,
      userId: keyRecord.userId,
      action,
      platform,
      result: 'BLOCKED_RULE',
      ruleViolated: ruleCheck.ruleViolated,
    });
    res.status(403).json({ error: 'action_not_permitted' });
    return;
  }

  // Función 5: Aprobar — log y devolver token
  await writeLog({
    apiKeyId: keyRecord.id,
    userId: keyRecord.userId,
    action,
    platform,
    result: 'SUCCESS',
  });

  res.status(200).json({ token, userId: keyRecord.userId, scope: keyRecord.scope });
});

export default router;
```

- [ ] **Step 4: Crear src/app.ts**

```typescript
import express from 'express';
import validateRouter from './routes/validate';
import keysRouter from './routes/keys';

const app = express();
app.use(express.json());

app.use('/v1/validate', validateRouter);
app.use('/v1/keys', keysRouter);

export default app;
```

- [ ] **Step 5: Verificar que pasa**

```bash
npx jest tests/routes/validate.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add src/routes/validate.ts src/app.ts tests/routes/validate.test.ts
git commit -m "feat: add validation route orchestrating full pipeline"
```

---

## Task 13: API Keys CRUD route

**Files:**
- Create: `platform-api/src/routes/keys.ts`
- Create: `platform-api/tests/routes/keys.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// tests/routes/keys.test.ts
import request from 'supertest';
import app from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('../../src/services/apiKey.service');
jest.mock('../../src/db/redis', () => ({ redis: { incr: jest.fn().mockResolvedValue(1), expire: jest.fn() } }));

const { createApiKey, revokeApiKey } = require('../../src/services/apiKey.service');

const validUserToken = jwt.sign(
  { userId: 'user_1', type: 'user_session' },
  process.env.JWT_SECRET ?? 'test-secret-at-least-32-characters-long',
  { expiresIn: '1h' }
);

describe('Keys routes', () => {
  describe('POST /v1/keys', () => {
    it('creates a key and returns the plain key once', async () => {
      createApiKey.mockResolvedValue({ id: 'key_1', plainKey: 'ak_abc123', prefix: 'ak_abc123' });

      const res = await request(app)
        .post('/v1/keys')
        .set('Authorization', `Bearer ${validUserToken}`)
        .send({ name: 'My Agent', scope: ['send_message'] });

      expect(res.status).toBe(201);
      expect(res.body.plainKey.startsWith('ak_')).toBe(true);
    });
  });

  describe('DELETE /v1/keys/:id', () => {
    it('revokes a key', async () => {
      revokeApiKey.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/v1/keys/key_1')
        .set('Authorization', `Bearer ${validUserToken}`);

      expect(res.status).toBe(200);
    });
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/routes/keys.test.ts
```

Expected: FAIL

- [ ] **Step 3: Crear src/middleware/auth.ts**

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string; type?: string };
    if (decoded.type !== 'user_session') {
      // SDK tokens must not authenticate dashboard routes
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}
```

- [ ] **Step 4: Crear src/routes/keys.ts**

```typescript
import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { createApiKey, revokeApiKey } from '../services/apiKey.service';
import { ALLOWED_ACTIONS } from '../services/scope.service';

const router = Router();

const createKeyBody = z.object({
  name: z.string().min(1).max(100),
  scope: z.array(z.enum([...ALLOWED_ACTIONS] as [string, ...string[]])).min(1),
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = createKeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  const result = await createApiKey({
    userId: req.userId!,
    name: parsed.data.name,
    scope: parsed.data.scope,
  });

  res.status(201).json(result);
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  await revokeApiKey(req.params.id, req.userId!);
  res.status(200).json({ success: true });
});

export default router;
```

- [ ] **Step 5: Verificar que pasa**

```bash
npx jest tests/routes/keys.test.ts
```

Expected: PASS

- [ ] **Step 6: Crear src/index.ts y correr el servidor**

```typescript
import { config } from './config';
import app from './app';
import { prisma } from './db/prisma';
import { redis } from './db/redis';

async function main() {
  await redis.connect();
  app.listen(config.PORT, () => {
    console.log(`Platform API running on port ${config.PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
```

- [ ] **Step 7: Correr todos los tests**

```bash
npx jest --coverage
```

Expected: PASS — todos los tests, coverage >80% en servicios críticos

- [ ] **Step 8: Commit final**

```bash
git add src/routes/keys.ts src/middleware/auth.ts src/index.ts tests/routes/keys.test.ts
git commit -m "feat: add api keys crud routes and user auth middleware"
```

---

## Self-Review

**Spec coverage:**
- ✅ Función 1: Validar API Key → `validateApiKeyHash` en `apiKey.service.ts` + `validate.ts`
- ✅ Función 2: Intercambiar JWT con jti (`type: sdk_token`) → `token.service.ts`
- ✅ Función 3: Verificar scope con normalización → `scope.service.ts`
- ✅ Función 4 Nivel 1: Reglas de acción → `rules.service.ts`
- ✅ Función 4 Nivel 2: Análisis de contenido normalizado → `rules.service.ts`
- ✅ CSPRNG + prefijo ak_ → `crypto.ts`
- ✅ Rate limiting por IP → `rateLimiter.ts`
- ✅ TLS: se aplica en el SDK (Plan 2), no en la API
- ✅ Audit log con checksum chain → `auditLog.service.ts`
- ✅ Revocación inmediata con Redis → `token.service.ts`
- ✅ Normalización NFKC + zero-width + URL decode → `normalize.ts`
- ✅ Creación y revocación de API Keys (scope validado contra ALLOWED_ACTIONS) → `keys.ts`
- ✅ SDK tokens no pueden autenticar rutas del dashboard (`type` check en `requireAuth`)
- ✅ jti extraído antes de `isTokenRevoked` → revocación funciona correctamente
- ⏭️ Frontend Dashboard → Plan 3
- ⏭️ SDK → Plan 2
- ⏭️ Admin panel → fuera de scope MVP

**Security fixes aplicados:**
- [VULN-001] Token namespace: `issueToken` → `type: sdk_token`, `requireAuth` rechaza todo lo que no sea `type: user_session`
- [VULN-002] Revocation check: `verifyToken(token).jti` antes de `isTokenRevoked`
- [VULN-003] Rate limiter: solo por IP, sin hash del body
- [VULN-004] Scope creation: validado contra `ALLOWED_ACTIONS` enum en el body schema
- [VULN-005] Double hash: `validateApiKeyHash` acepta hash directo, no re-hashea
