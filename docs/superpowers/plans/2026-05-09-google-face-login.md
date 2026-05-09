# Google + Face Recognition Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace email/password auth in `next-app` with Google OAuth + per-login face match. Store DNI plus Google profile data on a `profiles` table.

**Architecture:** Supabase Auth handles Google OAuth (browser-side). face-api.js extracts a 128-d descriptor in the browser at registration and login. The backend verifies the Supabase access token, compares the descriptor against the stored one (Euclidean distance < 0.6), and issues an existing-format app JWT delivered as an HttpOnly cookie. Existing JWT-protected routes are unchanged.

**Tech Stack:** Next.js 16 (App Router), Supabase (`@supabase/supabase-js`), `face-api.js` (browser, TensorFlow.js), Jest + ts-jest.

**Companion design doc:** `docs/superpowers/specs/2026-05-09-google-face-login-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `next-app/supabase/schema.sql` | Modify | Replace `users` table with `profiles`; retarget FK on `api_keys` |
| `next-app/.env.example` | Modify | Document new vars; mark Didit vars unused |
| `next-app/package.json` | Modify | Add `face-api.js` |
| `next-app/lib/services/faceMatch.service.ts` | Create | Pure functions: `euclideanDistance`, `isMatch`, `isValidDescriptor`, `FACE_MATCH_THRESHOLD` |
| `next-app/lib/services/profile.service.ts` | Create | `getProfileByUserId`, `createProfile` |
| `next-app/lib/cookies.ts` | Create | `setSessionCookie(res, token)`, `clearSessionCookie(res)`, constant `APP_SESSION_COOKIE` |
| `next-app/lib/auth.ts` | Modify | `getAuthUserId` reads cookie when no Bearer header is present |
| `next-app/lib/services/token.service.ts` | Modify | `issueUserToken` adds `jti` so user sessions can be revoked |
| `next-app/app/api/auth/register/route.ts` | Replace | New flow: Supabase token + DNI + descriptor → profile + cookie + JWT |
| `next-app/app/api/auth/login/route.ts` | Replace | New flow: Supabase token + descriptor → match → cookie + JWT; also exports `DELETE` for sign-out |
| `next-app/tests/api/auth.test.ts` | Replace | Tests for the new register/login/logout flow |
| `next-app/tests/lib/services/faceMatch.test.ts` | Create | Unit tests for distance/match/validation |
| `next-app/tests/lib/services/profile.test.ts` | Create | Unit tests for profile CRUD against mocked supabase |
| `next-app/tests/lib/cookies.test.ts` | Create | Unit tests for set/clear cookie helpers |
| `next-app/tests/lib/auth.test.ts` | Create | Tests for `getAuthUserId` (header path + cookie path) |
| `next-app/lib/client/supabaseBrowser.ts` | Create | Browser-side Supabase client (uses publishable key) |
| `next-app/lib/client/faceApi.ts` | Create | Lazy-load face-api.js + models, expose `extractDescriptor(canvas)` |
| `next-app/components/WebcamCapture.tsx` | Create | `getUserMedia` → `<video>` + capture-to-canvas button |
| `next-app/public/models/*` | Create | face-api.js model weight files (~6 MB) |
| `next-app/app/login/page.tsx` | Create | Google sign-in + selfie capture + POST to `/api/auth/login` |
| `next-app/app/register/page.tsx` | Create | Google sign-in + DNI input + selfie capture + POST to `/api/auth/register` |
| `next-app/app/dashboard/page.tsx` | Create | Stub destination after successful login |
| `next-app/app/page.tsx` | Modify | Replace boilerplate with links to `/login` and `/register` |

> **Note:** No `app/auth/callback/route.ts`. Supabase's browser SDK detects the OAuth response in the URL automatically when `/login` or `/register` is the redirect target.

---

## Task 1: Database schema migration

**Files:**
- Modify: `next-app/supabase/schema.sql`

- [ ] **Step 1: Replace the schema file**

Replace the entire contents of `next-app/supabase/schema.sql` with:

```sql
-- Run this SQL in the Supabase SQL editor.
-- Assumes a fresh schema; drops the legacy `users` table.

do $$ begin
  create type key_status as enum ('ACTIVE', 'REVOKED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type log_result as enum ('SUCCESS', 'BLOCKED_INVALID_KEY', 'BLOCKED_SCOPE', 'BLOCKED_RULE', 'BLOCKED_REVOKED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type rule_type as enum ('FORBIDDEN_ACTION', 'FORBIDDEN_KEYWORD', 'FORBIDDEN_PATTERN');
exception when duplicate_object then null; end $$;

drop table if exists users cascade;

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  email text not null,
  google_sub text unique,
  full_name text,
  picture_url text,
  dni text not null,
  face_descriptor jsonb not null,
  enrolled_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- profiles.user_id is UNIQUE, which already creates a btree index — no extra index needed.

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_hash text unique not null,
  prefix text not null,
  scope text[] not null default '{}',
  status key_status not null default 'ACTIVE',
  created_at timestamptz default now(),
  revoked_at timestamptz
);
create index if not exists api_keys_key_hash_idx on api_keys(key_hash);
create index if not exists api_keys_user_id_idx on api_keys(user_id);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  api_key_id text not null,
  user_id text not null,
  action text not null,
  platform text not null,
  result log_result not null,
  rule_violated text,
  prev_checksum text not null,
  checksum text not null,
  created_at timestamptz default now()
);
create index if not exists audit_logs_api_key_id_idx on audit_logs(api_key_id);
create index if not exists audit_logs_user_id_idx on audit_logs(user_id);

create table if not exists global_rules (
  id uuid primary key default gen_random_uuid(),
  type rule_type not null,
  value text unique not null,
  created_at timestamptz default now()
);

create table if not exists revoked_tokens (
  jti text primary key,
  revoked_at timestamptz default now()
);

create table if not exists rate_limits (
  ip text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);
```

- [ ] **Step 2: Apply the schema in Supabase**

Open the Supabase SQL editor for the project (URL from `NEXT_PUBLIC_SUPABASE_URL`) and run the file. If the project already has data you care about, back it up first.

- [ ] **Step 3: Configure Google OAuth provider in Supabase**

In the Supabase dashboard → Authentication → Providers, enable Google. Add `http://localhost:3000/login` and `http://localhost:3000/register` to the list of redirect URLs. (Production URLs added later when deploying.)

- [ ] **Step 4: Commit**

```bash
git add next-app/supabase/schema.sql
git commit -m "feat(db): replace users with profiles table for Google+face auth"
```

---

## Task 2: Install face-api.js

**Files:**
- Modify: `next-app/package.json`

- [ ] **Step 1: Install package**

```bash
cd next-app && npm install face-api.js@^0.22.2
```

- [ ] **Step 2: Verify package.json updated**

Run `cat next-app/package.json | grep face-api`
Expected: `"face-api.js": "^0.22.2"` is listed in `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add next-app/package.json next-app/package-lock.json
git commit -m "chore: add face-api.js dependency"
```

---

## Task 3: Update env.example

**Files:**
- Modify: `next-app/.env.example`

- [ ] **Step 1: Replace `.env.example`**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
SUPABASE_SERVICE_ROLE_KEY=sb_service_role_your_key_here
JWT_SECRET=change-me-to-a-random-256-bit-secret-min-32-chars
JWT_EXPIRES_IN=15m

# --- Unused in current design (kept for possible future KYC integration) ---
# DIDIT_API_KEY=
# DIDIT_WORKFLOW_ID=
# DIDIT_WEBHOOK_SECRET=
```

- [ ] **Step 2: Commit**

```bash
git add next-app/.env.example
git commit -m "chore: document required env for Google+face auth"
```

---

## Task 4: faceMatch service — tests first

**Files:**
- Test: `next-app/tests/lib/services/faceMatch.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `next-app/tests/lib/services/faceMatch.test.ts`:

```ts
import {
  euclideanDistance,
  isMatch,
  isValidDescriptor,
  FACE_MATCH_THRESHOLD,
} from '@/lib/services/faceMatch.service';

const zeros = Array(128).fill(0);
const ones = Array(128).fill(1);

function descriptorWithFirst(value: number): number[] {
  const d = Array(128).fill(0);
  d[0] = value;
  return d;
}

describe('euclideanDistance', () => {
  it('returns 0 for identical vectors', () => {
    expect(euclideanDistance(ones, ones)).toBe(0);
  });

  it('is symmetric', () => {
    const a = descriptorWithFirst(0.5);
    const b = descriptorWithFirst(0.1);
    expect(euclideanDistance(a, b)).toBeCloseTo(euclideanDistance(b, a), 10);
  });

  it('produces expected value for orthogonal unit-like pair', () => {
    const a = descriptorWithFirst(1);
    const b = descriptorWithFirst(0);
    expect(euclideanDistance(a, b)).toBeCloseTo(1, 10);
  });
});

describe('isValidDescriptor', () => {
  it('accepts a normal 128-length descriptor', () => {
    const d = Array.from({ length: 128 }, (_, i) => Math.sin(i));
    expect(isValidDescriptor(d)).toBe(true);
  });

  it('rejects non-array input', () => {
    expect(isValidDescriptor(null)).toBe(false);
    expect(isValidDescriptor('hello')).toBe(false);
    expect(isValidDescriptor({ 0: 1 })).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(isValidDescriptor(Array(127).fill(0.1))).toBe(false);
    expect(isValidDescriptor(Array(129).fill(0.1))).toBe(false);
  });

  it('rejects NaN values', () => {
    const d = Array(128).fill(0.1);
    d[5] = NaN;
    expect(isValidDescriptor(d)).toBe(false);
  });

  it('rejects Infinity values', () => {
    const d = Array(128).fill(0.1);
    d[5] = Infinity;
    expect(isValidDescriptor(d)).toBe(false);
  });

  it('rejects all-zero descriptors', () => {
    expect(isValidDescriptor(zeros)).toBe(false);
  });

  it('rejects all-equal descriptors', () => {
    expect(isValidDescriptor(Array(128).fill(0.42))).toBe(false);
  });
});

describe('isMatch', () => {
  it('returns true for identical descriptors', () => {
    const d = Array.from({ length: 128 }, (_, i) => Math.sin(i));
    expect(isMatch(d, d)).toBe(true);
  });

  it('returns true just below threshold', () => {
    const a = Array(128).fill(0);
    const b = Array(128).fill(0);
    b[0] = FACE_MATCH_THRESHOLD - 0.01;
    expect(isMatch(a, b)).toBe(true);
  });

  it('returns false just above threshold', () => {
    const a = Array(128).fill(0);
    const b = Array(128).fill(0);
    b[0] = FACE_MATCH_THRESHOLD + 0.01;
    expect(isMatch(a, b)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd next-app && npx jest tests/lib/services/faceMatch.test.ts
```

Expected: all tests fail because `@/lib/services/faceMatch.service` does not exist.

- [ ] **Step 3: Create the implementation**

Create `next-app/lib/services/faceMatch.service.ts`:

```ts
export const FACE_MATCH_THRESHOLD = 0.6;

export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function isMatch(a: number[], b: number[]): boolean {
  return euclideanDistance(a, b) < FACE_MATCH_THRESHOLD;
}

export function isValidDescriptor(d: unknown): d is number[] {
  if (!Array.isArray(d)) return false;
  if (d.length !== 128) return false;
  if (!d.every((v) => typeof v === 'number' && Number.isFinite(v))) return false;
  const allZero = d.every((v) => v === 0);
  const allEqual = d.every((v) => v === d[0]);
  return !allZero && !allEqual;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd next-app && npx jest tests/lib/services/faceMatch.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add next-app/lib/services/faceMatch.service.ts next-app/tests/lib/services/faceMatch.test.ts
git commit -m "feat(auth): add face descriptor compare service"
```

---

## Task 5: profile service — tests first

**Files:**
- Test: `next-app/tests/lib/services/profile.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `next-app/tests/lib/services/profile.test.ts`:

```ts
jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { getProfileByUserId, createProfile, ProfileInput } from '@/lib/services/profile.service';
const { supabase } = require('@/lib/db/supabase');

beforeEach(() => jest.clearAllMocks());

describe('getProfileByUserId', () => {
  it('returns profile row when present', async () => {
    supabase.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({
            data: { user_id: 'u1', dni: '12345678', face_descriptor: [1, 2, 3] },
            error: null,
          }),
        }),
      }),
    });
    const profile = await getProfileByUserId('u1');
    expect(profile).not.toBeNull();
    expect(profile!.user_id).toBe('u1');
  });

  it('returns null when no profile exists', async () => {
    supabase.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
    });
    expect(await getProfileByUserId('missing')).toBeNull();
  });
});

describe('createProfile', () => {
  const input: ProfileInput = {
    user_id: 'u1',
    email: 'a@b.com',
    google_sub: 'google_sub_xyz',
    full_name: 'Ada Lovelace',
    picture_url: 'https://x/y.png',
    dni: '12345678',
    face_descriptor: Array(128).fill(0.1),
  };

  it('inserts and returns the new profile', async () => {
    supabase.from.mockReturnValueOnce({
      insert: () => ({
        select: () => ({
          single: jest.fn().mockResolvedValue({ data: { ...input, id: 'p1' }, error: null }),
        }),
      }),
    });
    const profile = await createProfile(input);
    expect(profile.id).toBe('p1');
    expect(supabase.from).toHaveBeenCalledWith('profiles');
  });

  it('throws when supabase returns an error', async () => {
    supabase.from.mockReturnValueOnce({
      insert: () => ({
        select: () => ({
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
        }),
      }),
    });
    await expect(createProfile(input)).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd next-app && npx jest tests/lib/services/profile.test.ts
```

Expected: tests fail because the service does not exist.

- [ ] **Step 3: Create the implementation**

Create `next-app/lib/services/profile.service.ts`:

```ts
import { supabase } from '../db/supabase';

export interface ProfileInput {
  user_id: string;
  email: string;
  google_sub: string | null;
  full_name: string | null;
  picture_url: string | null;
  dni: string;
  face_descriptor: number[];
}

export interface Profile extends ProfileInput {
  id: string;
  enrolled_at?: string;
  updated_at?: string;
}

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  return (data as Profile | null) ?? null;
}

export async function createProfile(input: ProfileInput): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Profile;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd next-app && npx jest tests/lib/services/profile.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add next-app/lib/services/profile.service.ts next-app/tests/lib/services/profile.test.ts
git commit -m "feat(auth): add profile service for Google+face users"
```

---

## Task 6: Cookie helper — tests first

**Files:**
- Test: `next-app/tests/lib/cookies.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `next-app/tests/lib/cookies.test.ts`:

```ts
import { NextResponse } from 'next/server';
import { setSessionCookie, clearSessionCookie, APP_SESSION_COOKIE } from '@/lib/cookies';

describe('setSessionCookie', () => {
  it('sets an HttpOnly secure SameSite=Strict cookie with the JWT value', () => {
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, 'jwt.value.here');
    const cookie = res.cookies.get(APP_SESSION_COOKIE);
    expect(cookie?.value).toBe('jwt.value.here');
    const headerStr = res.headers.get('set-cookie') ?? '';
    expect(headerStr).toMatch(/HttpOnly/i);
    expect(headerStr).toMatch(/SameSite=Strict/i);
    expect(headerStr).toMatch(/Path=\//i);
  });
});

describe('clearSessionCookie', () => {
  it('emits a Max-Age=0 cookie on the response', () => {
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    const headerStr = res.headers.get('set-cookie') ?? '';
    expect(headerStr).toMatch(new RegExp(`${APP_SESSION_COOKIE}=`));
    expect(headerStr).toMatch(/Max-Age=0/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd next-app && npx jest tests/lib/cookies.test.ts
```

Expected: fails — module not found.

- [ ] **Step 3: Create the implementation**

Create `next-app/lib/cookies.ts`:

```ts
import { NextResponse } from 'next/server';

export const APP_SESSION_COOKIE = 'app_session';

export function setSessionCookie(res: NextResponse, jwt: string): void {
  res.cookies.set(APP_SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(APP_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd next-app && npx jest tests/lib/cookies.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add next-app/lib/cookies.ts next-app/tests/lib/cookies.test.ts
git commit -m "feat(auth): add app_session HttpOnly cookie helpers"
```

---

## Task 7: `issueUserToken` — add jti so user sessions are revocable

**Files:**
- Modify: `next-app/lib/services/token.service.ts`
- Test: `next-app/tests/lib/services/token.service.test.ts`

- [ ] **Step 1: Add a failing test**

Open `next-app/tests/lib/services/token.service.test.ts` and append:

```ts
import jwt from 'jsonwebtoken';
import { issueUserToken } from '@/lib/services/token.service';
import { config } from '@/lib/config';

describe('issueUserToken', () => {
  it('embeds a jti in the user_session token', async () => {
    const token = await issueUserToken('user_42');
    const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string; type: string; jti?: string };
    expect(decoded.userId).toBe('user_42');
    expect(decoded.type).toBe('user_session');
    expect(typeof decoded.jti).toBe('string');
    expect(decoded.jti!.length).toBeGreaterThan(10);
  });
});
```

If the file already imports `jsonwebtoken` and `config`, do not re-import.

- [ ] **Step 2: Run the new test**

```bash
cd next-app && npx jest tests/lib/services/token.service.test.ts -t 'embeds a jti'
```

Expected: fail — current `issueUserToken` does not include a jti.

- [ ] **Step 3: Update `issueUserToken`**

Edit `next-app/lib/services/token.service.ts`. Replace the `issueUserToken` function with:

```ts
export async function issueUserToken(userId: string): Promise<string> {
  const jti = crypto.randomUUID();
  return jwt.sign({ userId, jti, type: 'user_session' }, config.JWT_SECRET, {
    expiresIn: '7d',
  });
}
```

(`crypto` is already imported in this file.)

- [ ] **Step 4: Run all token service tests**

```bash
cd next-app && npx jest tests/lib/services/token.service.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add next-app/lib/services/token.service.ts next-app/tests/lib/services/token.service.test.ts
git commit -m "feat(auth): include jti in user_session JWT for revocation"
```

---

## Task 8: `getAuthUserId` reads cookie when no Authorization header

**Files:**
- Modify: `next-app/lib/auth.ts`
- Test: `next-app/tests/lib/auth.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `next-app/tests/lib/auth.test.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { issueUserToken } from '@/lib/services/token.service';
import { APP_SESSION_COOKIE } from '@/lib/cookies';

function reqWith({ header, cookie }: { header?: string; cookie?: string }) {
  const headers: Record<string, string> = {};
  if (header) headers['Authorization'] = `Bearer ${header}`;
  if (cookie) headers['cookie'] = `${APP_SESSION_COOKIE}=${cookie}`;
  return new NextRequest('http://localhost/x', { headers });
}

describe('getAuthUserId', () => {
  it('returns userId from a valid Bearer token', async () => {
    const token = await issueUserToken('user_alpha');
    expect(getAuthUserId(reqWith({ header: token }))).toBe('user_alpha');
  });

  it('returns userId from a valid app_session cookie when no header is set', async () => {
    const token = await issueUserToken('user_beta');
    expect(getAuthUserId(reqWith({ cookie: token }))).toBe('user_beta');
  });

  it('prefers the Authorization header when both are present', async () => {
    const headerToken = await issueUserToken('user_header');
    const cookieToken = await issueUserToken('user_cookie');
    expect(getAuthUserId(reqWith({ header: headerToken, cookie: cookieToken }))).toBe('user_header');
  });

  it('returns null when neither is set', () => {
    expect(getAuthUserId(reqWith({}))).toBeNull();
  });

  it('returns null for an invalid cookie value', () => {
    expect(getAuthUserId(reqWith({ cookie: 'not-a-jwt' }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd next-app && npx jest tests/lib/auth.test.ts
```

Expected: cookie-based tests fail (the existing implementation only reads the header).

- [ ] **Step 3: Update `lib/auth.ts`**

Replace the contents of `next-app/lib/auth.ts` with:

```ts
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { APP_SESSION_COOKIE } from './cookies';

function verifyUserSession(token: string): string | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string; type?: string };
    if (decoded.type !== 'user_session') return null;
    return decoded.userId;
  } catch {
    return null;
  }
}

export function getAuthUserId(req: NextRequest): string | null {
  const headerToken = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (headerToken) {
    const fromHeader = verifyUserSession(headerToken);
    if (fromHeader) return fromHeader;
  }

  const cookieToken = req.cookies.get(APP_SESSION_COOKIE)?.value;
  if (cookieToken) {
    return verifyUserSession(cookieToken);
  }
  return null;
}
```

- [ ] **Step 4: Run tests**

```bash
cd next-app && npx jest tests/lib/auth.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add next-app/lib/auth.ts next-app/tests/lib/auth.test.ts
git commit -m "feat(auth): support app_session cookie in getAuthUserId"
```

---

## Task 9: `/api/auth/register` — replace tests + implementation

**Files:**
- Replace: `next-app/app/api/auth/register/route.ts`
- Replace: `next-app/tests/api/auth.test.ts` (this task overwrites the file completely)

- [ ] **Step 1: Write the new register tests**

Replace the entire contents of `next-app/tests/api/auth.test.ts` with:

```ts
import { POST as register } from '@/app/api/auth/register/route';
import { POST as login, DELETE as logout } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';
import { APP_SESSION_COOKIE } from '@/lib/cookies';

jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));
jest.mock('@/lib/services/profile.service', () => ({
  getProfileByUserId: jest.fn(),
  createProfile: jest.fn(),
}));
jest.mock('@/lib/rateLimiter', () => ({
  checkRateLimit: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/lib/services/token.service', () => ({
  issueUserToken: jest.fn().mockResolvedValue('mock.user.token'),
  revokeToken: jest.fn().mockResolvedValue(undefined),
  verifyToken: jest.fn(),
}));

const { supabase } = require('@/lib/db/supabase');
const { getProfileByUserId, createProfile } = require('@/lib/services/profile.service');
const { checkRateLimit } = require('@/lib/rateLimiter');
const { revokeToken, verifyToken } = require('@/lib/services/token.service');

beforeEach(() => jest.clearAllMocks());

function makePost(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const validDescriptor = Array.from({ length: 128 }, (_, i) => Math.sin(i));

const googleUser = {
  id: 'auth_user_1',
  email: 'a@b.com',
  app_metadata: { provider: 'google' },
  user_metadata: {
    full_name: 'Ada Lovelace',
    avatar_url: 'https://x/y.png',
    sub: 'google_sub_xyz',
  },
};

describe('POST /api/auth/register', () => {
  it('creates a profile and issues a session cookie', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce(null);
    createProfile.mockResolvedValueOnce({ id: 'p1', user_id: 'auth_user_1' });

    const res = await register(makePost('/api/auth/register', {
      supabase_access_token: 'sb.token',
      dni: '12345678',
      face_descriptor: validDescriptor,
    }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.userId).toBe('auth_user_1');
    expect(res.headers.get('set-cookie') ?? '').toMatch(new RegExp(`${APP_SESSION_COOKIE}=mock\\.user\\.token`));
    expect(createProfile).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'auth_user_1',
      email: 'a@b.com',
      google_sub: 'google_sub_xyz',
      full_name: 'Ada Lovelace',
      picture_url: 'https://x/y.png',
      dni: '12345678',
      face_descriptor: validDescriptor,
    }));
  });

  it('returns 409 when a profile already exists for this user', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce({ id: 'p1', user_id: 'auth_user_1' });

    const res = await register(makePost('/api/auth/register', {
      supabase_access_token: 'sb.token',
      dni: '12345678',
      face_descriptor: validDescriptor,
    }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('already_registered');
  });

  it('returns 401 when Supabase token is invalid', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'bad' } });
    const res = await register(makePost('/api/auth/register', {
      supabase_access_token: 'bad',
      dni: '12345678',
      face_descriptor: validDescriptor,
    }));
    expect(res.status).toBe(401);
  });

  it('returns 401 when provider is not google', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { ...googleUser, app_metadata: { provider: 'email' } } },
      error: null,
    });
    const res = await register(makePost('/api/auth/register', {
      supabase_access_token: 'sb.token',
      dni: '12345678',
      face_descriptor: validDescriptor,
    }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing dni', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    const res = await register(makePost('/api/auth/register', {
      supabase_access_token: 'sb.token',
      face_descriptor: validDescriptor,
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid descriptor (length 127)', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    const res = await register(makePost('/api/auth/register', {
      supabase_access_token: 'sb.token',
      dni: '12345678',
      face_descriptor: Array(127).fill(0.1),
    }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  const profile = {
    id: 'p1',
    user_id: 'auth_user_1',
    email: 'a@b.com',
    dni: '12345678',
    full_name: 'Ada Lovelace',
    picture_url: 'https://x/y.png',
    face_descriptor: validDescriptor,
  };

  it('issues a session for matching face', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce(profile);

    const res = await login(makePost('/api/auth/login', {
      supabase_access_token: 'sb.token',
      face_descriptor: validDescriptor,
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.userId).toBe('auth_user_1');
    expect(body.profile).toEqual({
      dni: '12345678',
      full_name: 'Ada Lovelace',
      email: 'a@b.com',
      picture_url: 'https://x/y.png',
    });
    expect(res.headers.get('set-cookie') ?? '').toMatch(new RegExp(`${APP_SESSION_COOKIE}=mock\\.user\\.token`));
  });

  it('returns 401 face_mismatch when descriptor distance > 0.6', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce(profile);

    const farDescriptor = validDescriptor.map((v) => v + 5);
    const res = await login(makePost('/api/auth/login', {
      supabase_access_token: 'sb.token',
      face_descriptor: farDescriptor,
    }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('face_mismatch');
  });

  it('returns 404 not_registered when no profile exists', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce(null);

    const res = await login(makePost('/api/auth/login', {
      supabase_access_token: 'sb.token',
      face_descriptor: validDescriptor,
    }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_registered');
  });

  it('returns 401 invalid_token when Supabase rejects the token', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'bad' } });
    const res = await login(makePost('/api/auth/login', {
      supabase_access_token: 'bad',
      face_descriptor: validDescriptor,
    }));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate-limited', async () => {
    checkRateLimit.mockResolvedValueOnce(false);
    const res = await login(makePost('/api/auth/login', {
      supabase_access_token: 'sb.token',
      face_descriptor: validDescriptor,
    }));
    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid descriptor', async () => {
    const res = await login(makePost('/api/auth/login', {
      supabase_access_token: 'sb.token',
      face_descriptor: Array(127).fill(0.1),
    }));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/auth/login', () => {
  it('revokes the cookie JWT and clears the cookie', async () => {
    verifyToken.mockResolvedValueOnce({ jti: 'jti_123' });
    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'DELETE',
      headers: { cookie: `${APP_SESSION_COOKIE}=some.jwt` },
    });
    const res = await logout(req);
    expect(res.status).toBe(200);
    expect(revokeToken).toHaveBeenCalledWith('jti_123');
    expect(res.headers.get('set-cookie') ?? '').toMatch(/Max-Age=0/i);
  });

  it('is idempotent when no cookie is set', async () => {
    const req = new NextRequest('http://localhost/api/auth/login', { method: 'DELETE' });
    const res = await logout(req);
    expect(res.status).toBe(200);
    expect(revokeToken).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd next-app && npx jest tests/api/auth.test.ts
```

Expected: tests fail — old register/login routes still use email+password.

- [ ] **Step 3: Replace `app/api/auth/register/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/db/supabase';
import { issueUserToken } from '@/lib/services/token.service';
import { getProfileByUserId, createProfile } from '@/lib/services/profile.service';
import { isValidDescriptor } from '@/lib/services/faceMatch.service';
import { setSessionCookie } from '@/lib/cookies';

const bodySchema = z.object({
  supabase_access_token: z.string().min(1),
  dni: z.string().min(1),
  face_descriptor: z.array(z.number()),
});

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { supabase_access_token, dni, face_descriptor } = parsed.data;

  if (!isValidDescriptor(face_descriptor)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser(supabase_access_token);
  if (userError || !userResult?.user) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }
  const user = userResult.user;
  if (user.app_metadata?.provider !== 'google') {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const existing = await getProfileByUserId(user.id);
  if (existing) {
    return NextResponse.json({ error: 'already_registered' }, { status: 409 });
  }

  await createProfile({
    user_id: user.id,
    email: user.email ?? '',
    google_sub: (user.user_metadata?.sub as string) ?? null,
    full_name: (user.user_metadata?.full_name as string) ?? null,
    picture_url: (user.user_metadata?.avatar_url as string) ?? null,
    dni,
    face_descriptor,
  });

  const token = await issueUserToken(user.id);
  const res = NextResponse.json({ userId: user.id }, { status: 201 });
  setSessionCookie(res, token);
  return res;
}
```

- [ ] **Step 4: Re-run register tests**

```bash
cd next-app && npx jest tests/api/auth.test.ts -t '/api/auth/register'
```

Expected: all register tests pass. Login/logout tests still fail (next task).

- [ ] **Step 5: Commit**

```bash
git add next-app/app/api/auth/register/route.ts next-app/tests/api/auth.test.ts
git commit -m "feat(auth): /api/auth/register uses Google OAuth + face enrollment"
```

---

## Task 10: `/api/auth/login` — replace implementation, add `DELETE`

**Files:**
- Replace: `next-app/app/api/auth/login/route.ts`

- [ ] **Step 1: Replace `app/api/auth/login/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/db/supabase';
import { issueUserToken, revokeToken, verifyToken } from '@/lib/services/token.service';
import { getProfileByUserId } from '@/lib/services/profile.service';
import { isValidDescriptor, isMatch } from '@/lib/services/faceMatch.service';
import { setSessionCookie, clearSessionCookie, APP_SESSION_COOKIE } from '@/lib/cookies';
import { checkRateLimit } from '@/lib/rateLimiter';

const bodySchema = z.object({
  supabase_access_token: z.string().min(1),
  face_descriptor: z.array(z.number()),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!(await checkRateLimit(ip))) {
    return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { supabase_access_token, face_descriptor } = parsed.data;

  if (!isValidDescriptor(face_descriptor)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser(supabase_access_token);
  if (userError || !userResult?.user) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }
  const user = userResult.user;

  const profile = await getProfileByUserId(user.id);
  if (!profile) {
    return NextResponse.json({ error: 'not_registered' }, { status: 404 });
  }

  if (!isMatch(face_descriptor, profile.face_descriptor)) {
    return NextResponse.json({ error: 'face_mismatch' }, { status: 401 });
  }

  const token = await issueUserToken(profile.user_id);
  const res = NextResponse.json({
    userId: profile.user_id,
    profile: {
      dni: profile.dni,
      full_name: profile.full_name,
      email: profile.email,
      picture_url: profile.picture_url,
    },
  });
  setSessionCookie(res, token);
  return res;
}

export async function DELETE(req: NextRequest) {
  const cookieToken = req.cookies.get(APP_SESSION_COOKIE)?.value;
  if (cookieToken) {
    try {
      const decoded = await verifyToken(cookieToken);
      if (decoded.jti) await revokeToken(decoded.jti);
    } catch {
      // invalid cookie — nothing to revoke
    }
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
```

- [ ] **Step 2: Run all auth tests**

```bash
cd next-app && npx jest tests/api/auth.test.ts
```

Expected: all register, login, and logout tests pass.

- [ ] **Step 3: Run the full test suite to confirm no regressions**

```bash
cd next-app && npx jest
```

Expected: every existing test still passes.

- [ ] **Step 4: Commit**

```bash
git add next-app/app/api/auth/login/route.ts
git commit -m "feat(auth): /api/auth/login does face match; add DELETE for sign-out"
```

---

## Task 11: Browser Supabase client

**Files:**
- Create: `next-app/lib/client/supabaseBrowser.ts`

- [ ] **Step 1: Create the module**

```ts
'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    },
  );
  return cached;
}
```

- [ ] **Step 2: Commit**

```bash
git add next-app/lib/client/supabaseBrowser.ts
git commit -m "feat(auth): add browser Supabase client for OAuth"
```

---

## Task 12: Add face-api.js model weights

**Files:**
- Create: `next-app/public/models/*` (downloaded weight files)

- [ ] **Step 1: Download the weights**

```bash
mkdir -p next-app/public/models
cd next-app/public/models
BASE='https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'
for f in \
  ssd_mobilenetv1_model-weights_manifest.json \
  ssd_mobilenetv1_model-shard1 \
  ssd_mobilenetv1_model-shard2 \
  face_landmark_68_model-weights_manifest.json \
  face_landmark_68_model-shard1 \
  face_recognition_model-weights_manifest.json \
  face_recognition_model-shard1 \
  face_recognition_model-shard2 ; do
  curl -fL "$BASE/$f" -o "$f"
done
```

- [ ] **Step 2: Confirm files are present**

```bash
ls next-app/public/models | wc -l
```

Expected: `8` (one manifest + shards for each of the three models).

- [ ] **Step 3: Commit**

```bash
git add next-app/public/models
git commit -m "chore(auth): add face-api.js model weights"
```

---

## Task 13: face-api.js client wrapper

**Files:**
- Create: `next-app/lib/client/faceApi.ts`

- [ ] **Step 1: Create the wrapper**

```ts
'use client';

import * as faceapi from 'face-api.js';

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

const MODEL_URL = '/models';

async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    modelsLoaded = true;
  })();
  return loadingPromise;
}

export async function ensureFaceModelsLoaded(): Promise<void> {
  await loadModels();
}

export async function extractDescriptor(canvas: HTMLCanvasElement): Promise<number[] | null> {
  await loadModels();
  const detection = await faceapi
    .detectSingleFace(canvas)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detection) return null;
  return Array.from(detection.descriptor);
}
```

- [ ] **Step 2: Commit**

```bash
git add next-app/lib/client/faceApi.ts
git commit -m "feat(auth): add face-api.js wrapper for descriptor extraction"
```

---

## Task 14: Webcam capture component

**Files:**
- Create: `next-app/components/WebcamCapture.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onCapture: (canvas: HTMLCanvasElement) => void;
  buttonLabel?: string;
}

export default function WebcamCapture({ onCapture, buttonLabel = 'Take selfie' }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 480, height: 360, facingMode: 'user' },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e) {
        setError('Camera access was denied or is unavailable.');
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas);
  };

  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="flex flex-col items-center gap-3">
      <video ref={videoRef} className="rounded-lg border" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />
      <button
        type="button"
        onClick={capture}
        disabled={!ready}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add next-app/components/WebcamCapture.tsx
git commit -m "feat(auth): add WebcamCapture component"
```

---

## Task 15: Register page

**Files:**
- Create: `next-app/app/register/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import WebcamCapture from '@/components/WebcamCapture';
import { getSupabaseBrowser } from '@/lib/client/supabaseBrowser';
import { ensureFaceModelsLoaded, extractDescriptor } from '@/lib/client/faceApi';

export default function RegisterPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const [token, setToken] = useState<string | null>(null);
  const [dni, setDni] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ensureFaceModelsLoaded().catch(() => setError('Could not load face models.'));
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setToken(data.session.access_token);
    });
    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      setToken(session?.access_token ?? null);
    });
    return () => sub.data.subscription.unsubscribe();
  }, [supabase]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/register` },
    });
  };

  const handleCapture = async (canvas: HTMLCanvasElement) => {
    if (!token) return setError('Sign in with Google first.');
    if (!dni.trim()) return setError('Enter your DNI.');
    setBusy(true);
    setError(null);
    try {
      const descriptor = await extractDescriptor(canvas);
      if (!descriptor) {
        setError('No face detected. Make sure your face is centered.');
        return;
      }
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabase_access_token: token,
          dni: dni.trim(),
          face_descriptor: descriptor,
        }),
      });
      if (r.status === 409) return setError('You are already registered. Try logging in.');
      if (!r.ok) return setError(`Registration failed (${r.status}).`);
      router.push('/dashboard');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Register</h1>
      {!token ? (
        <button onClick={signInWithGoogle} className="rounded bg-black px-4 py-2 text-white">
          Sign up with Google
        </button>
      ) : (
        <>
          <input
            type="text"
            placeholder="DNI"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            className="rounded border px-3 py-2"
          />
          <WebcamCapture onCapture={handleCapture} buttonLabel={busy ? 'Submitting…' : 'Capture & register'} />
        </>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add next-app/app/register/page.tsx
git commit -m "feat(auth): add /register page with Google + DNI + selfie flow"
```

---

## Task 16: Login page

**Files:**
- Create: `next-app/app/login/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import WebcamCapture from '@/components/WebcamCapture';
import { getSupabaseBrowser } from '@/lib/client/supabaseBrowser';
import { ensureFaceModelsLoaded, extractDescriptor } from '@/lib/client/faceApi';

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ensureFaceModelsLoaded().catch(() => setError('Could not load face models.'));
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setToken(data.session.access_token);
    });
    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      setToken(session?.access_token ?? null);
    });
    return () => sub.data.subscription.unsubscribe();
  }, [supabase]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    });
  };

  const handleCapture = async (canvas: HTMLCanvasElement) => {
    if (!token) return setError('Sign in with Google first.');
    setBusy(true);
    setError(null);
    try {
      const descriptor = await extractDescriptor(canvas);
      if (!descriptor) {
        setError('No face detected. Try again.');
        return;
      }
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabase_access_token: token,
          face_descriptor: descriptor,
        }),
      });
      if (r.status === 404) return setError('No account yet. Please register first.');
      if (r.status === 401) return setError('Face did not match. Try again.');
      if (r.status === 429) return setError('Too many attempts. Wait a minute.');
      if (!r.ok) return setError(`Login failed (${r.status}).`);
      router.push('/dashboard');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {!token ? (
        <button onClick={signInWithGoogle} className="rounded bg-black px-4 py-2 text-white">
          Sign in with Google
        </button>
      ) : (
        <WebcamCapture onCapture={handleCapture} buttonLabel={busy ? 'Verifying…' : 'Verify face'} />
      )}
      {error && <p className="text-red-600">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add next-app/app/login/page.tsx
git commit -m "feat(auth): add /login page with Google + selfie flow"
```

---

## Task 17: Dashboard stub + home page links

**Files:**
- Create: `next-app/app/dashboard/page.tsx`
- Modify: `next-app/app/page.tsx`

- [ ] **Step 1: Create dashboard page**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/client/supabaseBrowser';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    await fetch('/api/auth/login', { method: 'DELETE', credentials: 'include' });
    await supabase.auth.signOut();
    router.push('/login');
  };

  useEffect(() => {
    fetch('/api/keys', { credentials: 'include' }).then((r) => {
      if (r.status === 401) router.push('/login');
    });
  }, [router]);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-zinc-600">You are signed in.</p>
      <button onClick={handleLogout} disabled={busy} className="rounded bg-zinc-200 px-4 py-2">
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </main>
  );
}
```

- [ ] **Step 2: Replace home page**

Replace `next-app/app/page.tsx` with:

```tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Welcome</h1>
      <Link href="/login" className="rounded bg-black px-4 py-2 text-center text-white">
        Sign in
      </Link>
      <Link href="/register" className="rounded bg-zinc-200 px-4 py-2 text-center">
        Register
      </Link>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add next-app/app/dashboard/page.tsx next-app/app/page.tsx
git commit -m "feat(auth): add dashboard + home page links"
```

---

## Task 18: Manual smoke test

**Files:** none

- [ ] **Step 1: Start dev server**

```bash
cd next-app && npm run dev
```

Open `http://localhost:3000`.

- [ ] **Step 2: Register a new account**

1. Click `Register`.
2. Click `Sign up with Google` → complete Google OAuth.
3. Browser returns to `/register` with active Supabase session. Allow webcam access.
4. Enter a DNI (any string) and click `Capture & register`.
5. Expect redirect to `/dashboard`. Confirm an `app_session` cookie was set (DevTools → Application → Cookies; `HttpOnly` ticked).

- [ ] **Step 3: Sign out**

Click `Sign out` on the dashboard. Confirm:
- Redirect to `/login`.
- The `app_session` cookie is gone.
- A row exists in `revoked_tokens` for the JWT's `jti` (Supabase SQL editor).

- [ ] **Step 4: Sign back in**

1. Click `Sign in with Google`. The same Google account.
2. Allow webcam, click `Verify face`.
3. Expect redirect to `/dashboard`.

- [ ] **Step 5: Negative test — face mismatch**

Close your eyes / cover the lower half of your face / use a different person and click `Verify face`. Expect the error message `Face did not match. Try again.`

- [ ] **Step 6: Negative test — unregistered Google account**

Sign out, then sign in with a *different* Google account that has not registered. Expect: `No account yet. Please register first.`

- [ ] **Step 7: Run the full unit + API test suite once more**

```bash
cd next-app && npx jest
```

Expected: all tests pass.

- [ ] **Step 8: Commit (if any incidental fixes were made during smoke test)**

```bash
git status
# If clean, no commit needed.
```

---

## Self-Review Checklist (for the engineer executing this plan)

- [ ] Schema applied to Supabase project (Task 1).
- [ ] Google OAuth provider enabled in Supabase dashboard with `/login` and `/register` redirect URLs.
- [ ] All Jest tests pass: `cd next-app && npx jest`.
- [ ] Cookie attributes verified in DevTools after login: `HttpOnly`, `SameSite=Strict`, `Path=/`.
- [ ] Manual smoke test (Task 18) all green.
