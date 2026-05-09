# Google + Didit Biometric Login Implementation Plan (revised)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace email/password auth with Google OAuth + Didit Biometric Authentication. Keep work already done that still applies (cookies, jti, cookie auth, browser Supabase).

**Architecture:** Browser does Google OAuth via Supabase, then POSTs to our register/login endpoints which create a Didit session (KYC for register, Biometric Auth for login) and return a `verification_url`. Browser redirects to Didit hosted page. Didit posts a webhook to `/api/didit/webhook` and redirects user to `/auth/didit-callback`, which finalizes the flow by issuing the app JWT cookie.

**Tech Stack:** Next.js 16 (App Router), Supabase (`@supabase/supabase-js`), Didit `POST /v3/sessions/`, Jest + ts-jest.

**Companion design:** `docs/superpowers/specs/2026-05-09-google-didit-login-design.md`

**What's already merged (T1–T11) and stays:**
- Schema profile table (will be amended below)
- env.example (will be amended below)
- profile service (will be amended below)
- cookies helper, jti in JWT, cookie-aware getAuthUserId
- /api/auth/register and /api/auth/login (will be REWRITTEN below)
- Browser Supabase client

**What needs to be undone:**
- face-api.js dependency
- `lib/services/faceMatch.service.ts` and tests
- (model weights, face-api wrapper, webcam component were never written)

---

## File Structure (deltas from prior plan)

| File | Action |
|------|--------|
| `next-app/lib/services/faceMatch.service.ts` | DELETE |
| `next-app/tests/lib/services/faceMatch.test.ts` | DELETE |
| `next-app/package.json` | MODIFY — uninstall face-api.js |
| `next-app/supabase/schema.sql` | MODIFY — drop `face_descriptor`, add `didit_kyc_session_id` and `verification_status`; add `didit_login_attempts` table |
| `next-app/.env.example` | MODIFY — `DIDIT_KYC_WORKFLOW_ID`, `DIDIT_BIOMETRIC_WORKFLOW_ID`, `DIDIT_API_URL`, `SITE_URL` |
| `next-app/lib/services/didit.service.ts` | CREATE — `createSession`, `getSession`, `verifyWebhookSignature` |
| `next-app/lib/services/profile.service.ts` | MODIFY — drop `face_descriptor`, add `didit_kyc_session_id`, `verification_status` |
| `next-app/lib/services/loginAttempt.service.ts` | CREATE — `createPending`, `markDecided`, `getDecision` |
| `next-app/app/api/auth/register/route.ts` | REPLACE — Didit KYC session start |
| `next-app/app/api/auth/login/route.ts` | REPLACE POST — Didit Biometric session start. DELETE method unchanged. |
| `next-app/app/api/didit/webhook/route.ts` | CREATE — webhook handler |
| `next-app/app/auth/didit-callback/page.tsx` | CREATE — finalizes the flow |
| `next-app/app/login/page.tsx` | CREATE — Google OAuth → POST /api/auth/login → redirect |
| `next-app/app/register/page.tsx` | CREATE — Google OAuth → POST /api/auth/register → redirect |
| `next-app/app/dashboard/page.tsx` | CREATE |
| `next-app/app/page.tsx` | MODIFY — links to /login and /register |
| `next-app/tests/api/auth.test.ts` | REPLACE |
| `next-app/tests/lib/services/didit.test.ts` | CREATE |
| `next-app/tests/api/didit/webhook.test.ts` | CREATE |

---

## Task R0: Cleanup — remove face-api.js artifacts

**Files:**
- Delete: `next-app/lib/services/faceMatch.service.ts`
- Delete: `next-app/tests/lib/services/faceMatch.test.ts`
- Modify: `next-app/package.json`

- [ ] **Step 1: Uninstall face-api.js**

```bash
cd next-app && npm uninstall face-api.js
```

- [ ] **Step 2: Delete the service and its tests**

```bash
rm next-app/lib/services/faceMatch.service.ts
rm next-app/tests/lib/services/faceMatch.test.ts
```

- [ ] **Step 3: Confirm jest still passes**

```bash
cd next-app && npx jest
```

Expected: tests for register/login currently DO depend on `isValidDescriptor` and `isMatch` from this service. They'll fail — that is expected and gets fixed in later tasks. As long as nothing UNRELATED broke, proceed.

- [ ] **Step 4: Commit**

```bash
git add next-app/package.json next-app/package-lock.json next-app/lib/services/faceMatch.service.ts next-app/tests/lib/services/faceMatch.test.ts
git commit -m "revert: drop face-api.js, faceMatch service (replaced by Didit)"
```

`git add` on deleted files records the deletion.

---

## Task R1: Schema update — replace `face_descriptor`, add `didit_login_attempts`

**Files:** Modify `next-app/supabase/schema.sql`

- [ ] **Step 1: Edit the `profiles` table block**

In `next-app/supabase/schema.sql`, replace:

```sql
  dni text not null,
  face_descriptor jsonb not null,
  enrolled_at timestamptz default now(),
```

with:

```sql
  dni text,
  didit_kyc_session_id text not null,
  verification_status text not null default 'PENDING',
  enrolled_at timestamptz default now(),
```

(`dni` becomes nullable because it's filled in by the webhook after the session, not at insert.)

- [ ] **Step 2: Append the login attempts table**

Add at the end of the file:

```sql
create table if not exists didit_login_attempts (
  session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  decision text not null default 'PENDING',
  created_at timestamptz default now(),
  decided_at timestamptz
);
create index if not exists didit_login_attempts_user_id_idx on didit_login_attempts(user_id);
```

- [ ] **Step 3: Apply in Supabase SQL editor**

(Manual — user does this.)

- [ ] **Step 4: Commit**

```bash
git add next-app/supabase/schema.sql
git commit -m "feat(db): swap face_descriptor for didit fields, add login attempts table"
```

---

## Task R2: Env vars

**Files:** Modify `next-app/.env.example`

- [ ] **Step 1: Replace contents**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
SUPABASE_SERVICE_ROLE_KEY=sb_service_role_your_key_here
JWT_SECRET=change-me-to-a-random-256-bit-secret-min-32-chars
JWT_EXPIRES_IN=15m

DIDIT_API_KEY=your-didit-api-key
DIDIT_API_URL=https://verification.didit.me
DIDIT_KYC_WORKFLOW_ID=your-kyc-workflow-uuid
DIDIT_BIOMETRIC_WORKFLOW_ID=your-biometric-auth-workflow-uuid
DIDIT_WEBHOOK_SECRET=your-webhook-secret-from-didit-console

SITE_URL=http://localhost:3000
```

- [ ] **Step 2: Update `lib/config.ts` to validate them**

Replace `next-app/lib/config.ts` with:

```ts
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  DIDIT_API_KEY: z.string().min(1).optional(),
  DIDIT_API_URL: z.string().url().default('https://verification.didit.me'),
  DIDIT_KYC_WORKFLOW_ID: z.string().min(1).optional(),
  DIDIT_BIOMETRIC_WORKFLOW_ID: z.string().min(1).optional(),
  DIDIT_WEBHOOK_SECRET: z.string().min(1).optional(),
  SITE_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
```

The Didit fields are `optional()` so tests / dev without Didit config don't crash. Routes that need them must validate at use site.

- [ ] **Step 3: Add the test setup vars**

Append to `next-app/tests/setup.ts`:

```ts
process.env.DIDIT_API_KEY = 'test-didit-key';
process.env.DIDIT_API_URL = 'https://verification.example.com';
process.env.DIDIT_KYC_WORKFLOW_ID = 'kyc-workflow-id';
process.env.DIDIT_BIOMETRIC_WORKFLOW_ID = 'bio-workflow-id';
process.env.DIDIT_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.SITE_URL = 'http://localhost:3000';
```

- [ ] **Step 4: Run tests to confirm config still loads**

```bash
cd next-app && npx jest tests/lib/services/token.service.test.ts tests/lib/cookies.test.ts tests/lib/auth.test.ts
```

Expected: pass. (Other suites may be broken at this point — the cleanup task removed faceMatch — but token / cookies / auth shouldn't depend on that.)

- [ ] **Step 5: Commit**

```bash
git add -f next-app/.env.example next-app/lib/config.ts next-app/tests/setup.ts
git commit -m "chore: env config for Didit KYC + biometric workflows"
```

---

## Task R3: Didit service (TDD)

**Files:**
- Create: `next-app/lib/services/didit.service.ts`
- Create: `next-app/tests/lib/services/didit.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `next-app/tests/lib/services/didit.test.ts`:

```ts
import {
  createSession,
  verifyWebhookSignature,
  getSession,
  DiditSessionResult,
} from '@/lib/services/didit.service';

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('createSession', () => {
  it('POSTs the right payload and returns parsed session', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          session_id: 'sess_1',
          session_token: 'tok',
          url: 'https://verify.example.com/sess_1',
        }),
        { status: 200 },
      ),
    );

    const result = await createSession({
      workflowId: 'wf_kyc',
      vendorData: 'user_42',
      callback: 'https://app.example.com/auth/didit-callback?intent=register',
    });

    expect(result.session_id).toBe('sess_1');
    expect(result.verification_url).toBe('https://verify.example.com/sess_1');

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://verification.example.com/v3/sessions/');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      workflow_id: 'wf_kyc',
      vendor_data: 'user_42',
      callback: 'https://app.example.com/auth/didit-callback?intent=register',
    });
    expect((init?.headers as Record<string, string>)['x-api-key']).toBe('test-didit-key');
    expect((init?.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('throws on non-2xx response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'boom' }), { status: 500 }),
    );
    await expect(
      createSession({ workflowId: 'w', vendorData: 'u', callback: 'c' }),
    ).rejects.toThrow();
  });
});

describe('verifyWebhookSignature', () => {
  const secret = 'test-webhook-secret';
  const body = JSON.stringify({ session_id: 'sess', vendor_data: 'u', decision: 'Approved' });

  function sign(payload: string): string {
    const crypto = require('crypto');
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  it('accepts a valid signature', () => {
    expect(verifyWebhookSignature(body, sign(body))).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(verifyWebhookSignature(body + 'extra', sign(body))).toBe(false);
  });

  it('rejects an empty signature', () => {
    expect(verifyWebhookSignature(body, '')).toBe(false);
  });
});

describe('getSession', () => {
  it('GETs and returns the session result', async () => {
    const payload: DiditSessionResult = {
      session_id: 'sess_1',
      vendor_data: 'user_42',
      workflow_id: 'wf_kyc',
      decision: 'Approved',
      kyc: { document_number: '12345678', full_name: 'Ada Lovelace' },
    };
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );

    const result = await getSession('sess_1');
    expect(result.decision).toBe('Approved');
    expect(result.kyc?.document_number).toBe('12345678');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd next-app && npx jest tests/lib/services/didit.test.ts
```

Expected: module not found.

- [ ] **Step 3: Create the implementation**

Create `next-app/lib/services/didit.service.ts`:

```ts
import crypto from 'crypto';
import { config } from '../config';

export interface CreateSessionInput {
  workflowId: string;
  vendorData: string;
  callback: string;
}

export interface CreateSessionResult {
  session_id: string;
  verification_url: string;
  session_token?: string;
}

export interface DiditSessionResult {
  session_id: string;
  vendor_data: string;
  workflow_id: string;
  decision: 'Approved' | 'Declined' | 'In Review' | string;
  kyc?: {
    document_number?: string;
    full_name?: string;
    nationality?: string;
    date_of_birth?: string;
  };
}

export async function createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
  const apiKey = config.DIDIT_API_KEY;
  if (!apiKey) throw new Error('DIDIT_API_KEY not configured');

  const res = await fetch(`${config.DIDIT_API_URL}/v3/sessions/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      workflow_id: input.workflowId,
      vendor_data: input.vendorData,
      callback: input.callback,
    }),
  });

  if (!res.ok) {
    throw new Error(`Didit createSession failed: ${res.status}`);
  }
  const json = (await res.json()) as { session_id: string; url: string; session_token?: string };
  return {
    session_id: json.session_id,
    verification_url: json.url,
    session_token: json.session_token,
  };
}

export async function getSession(sessionId: string): Promise<DiditSessionResult> {
  const apiKey = config.DIDIT_API_KEY;
  if (!apiKey) throw new Error('DIDIT_API_KEY not configured');

  const res = await fetch(`${config.DIDIT_API_URL}/v3/sessions/${sessionId}/`, {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`Didit getSession failed: ${res.status}`);
  return (await res.json()) as DiditSessionResult;
}

export function verifyWebhookSignature(rawBody: string, signature: string | null | undefined): boolean {
  if (!signature) return false;
  const secret = config.DIDIT_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}
```

- [ ] **Step 4: Run tests**

```bash
cd next-app && npx jest tests/lib/services/didit.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add next-app/lib/services/didit.service.ts next-app/tests/lib/services/didit.test.ts
git commit -m "feat(auth): add Didit service for sessions and webhook signature"
```

---

## Task R4: Profile service update

**Files:**
- Modify: `next-app/lib/services/profile.service.ts`
- Modify: `next-app/tests/lib/services/profile.test.ts`

- [ ] **Step 1: Replace `lib/services/profile.service.ts`**

```ts
import { supabase } from '../db/supabase';

export interface ProfileInput {
  user_id: string;
  email: string;
  google_sub: string | null;
  full_name: string | null;
  picture_url: string | null;
  dni: string | null;
  didit_kyc_session_id: string;
  verification_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
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
    .insert({ verification_status: 'PENDING', ...input })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function updateProfileFromKycResult(
  userId: string,
  fields: { dni: string; full_name: string | null; verification_status: 'APPROVED' | 'REJECTED' },
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      dni: fields.dni,
      full_name: fields.full_name,
      verification_status: fields.verification_status,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Update tests**

Replace `next-app/tests/lib/services/profile.test.ts`:

```ts
jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import {
  getProfileByUserId,
  createProfile,
  updateProfileFromKycResult,
  ProfileInput,
} from '@/lib/services/profile.service';
const { supabase } = require('@/lib/db/supabase');

beforeEach(() => jest.clearAllMocks());

describe('getProfileByUserId', () => {
  it('returns profile row when present', async () => {
    supabase.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({
            data: { user_id: 'u1', dni: '12345678', didit_kyc_session_id: 'sess1' },
            error: null,
          }),
        }),
      }),
    });
    const profile = await getProfileByUserId('u1');
    expect(profile?.user_id).toBe('u1');
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
    google_sub: 'gsub',
    full_name: null,
    picture_url: null,
    dni: null,
    didit_kyc_session_id: 'sess_1',
  };

  it('inserts a PENDING profile and returns it', async () => {
    let captured: unknown = null;
    supabase.from.mockReturnValueOnce({
      insert: (payload: unknown) => {
        captured = payload;
        return {
          select: () => ({
            single: jest.fn().mockResolvedValue({ data: { ...input, id: 'p1', verification_status: 'PENDING' }, error: null }),
          }),
        };
      },
    });
    const profile = await createProfile(input);
    expect(profile.id).toBe('p1');
    expect((captured as ProfileInput).verification_status).toBe('PENDING');
  });

  it('throws on supabase error', async () => {
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

describe('updateProfileFromKycResult', () => {
  it('updates dni / full_name / verification_status', async () => {
    let captured: unknown = null;
    supabase.from.mockReturnValueOnce({
      update: (payload: unknown) => {
        captured = payload;
        return { eq: jest.fn().mockResolvedValue({ data: null, error: null }) };
      },
    });
    await updateProfileFromKycResult('u1', { dni: '12345678', full_name: 'Ada', verification_status: 'APPROVED' });
    expect((captured as { dni: string; verification_status: string }).dni).toBe('12345678');
    expect((captured as { verification_status: string }).verification_status).toBe('APPROVED');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd next-app && npx jest tests/lib/services/profile.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add next-app/lib/services/profile.service.ts next-app/tests/lib/services/profile.test.ts
git commit -m "feat(auth): profile service tracks Didit verification status"
```

---

## Task R5: Login attempt service (TDD)

**Files:**
- Create: `next-app/lib/services/loginAttempt.service.ts`
- Create: `next-app/tests/lib/services/loginAttempt.test.ts`

- [ ] **Step 1: Write failing tests**

Create `next-app/tests/lib/services/loginAttempt.test.ts`:

```ts
jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import {
  createPendingLoginAttempt,
  markLoginAttemptDecision,
  getLoginAttempt,
} from '@/lib/services/loginAttempt.service';
const { supabase } = require('@/lib/db/supabase');

beforeEach(() => jest.clearAllMocks());

describe('createPendingLoginAttempt', () => {
  it('inserts a PENDING row keyed by session_id', async () => {
    let captured: unknown = null;
    supabase.from.mockReturnValueOnce({
      insert: (payload: unknown) => {
        captured = payload;
        return Promise.resolve({ error: null });
      },
    });
    await createPendingLoginAttempt('sess_1', 'user_1');
    expect(captured).toEqual({ session_id: 'sess_1', user_id: 'user_1', decision: 'PENDING' });
  });
});

describe('markLoginAttemptDecision', () => {
  it('updates decision and decided_at', async () => {
    let captured: unknown = null;
    supabase.from.mockReturnValueOnce({
      update: (payload: unknown) => {
        captured = payload;
        return { eq: jest.fn().mockResolvedValue({ error: null }) };
      },
    });
    await markLoginAttemptDecision('sess_1', 'APPROVED');
    expect((captured as { decision: string }).decision).toBe('APPROVED');
    expect((captured as { decided_at: string }).decided_at).toBeDefined();
  });
});

describe('getLoginAttempt', () => {
  it('returns the row when present', async () => {
    supabase.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({
            data: { session_id: 'sess_1', user_id: 'u1', decision: 'APPROVED' },
            error: null,
          }),
        }),
      }),
    });
    const attempt = await getLoginAttempt('sess_1');
    expect(attempt?.decision).toBe('APPROVED');
  });

  it('returns null when missing', async () => {
    supabase.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    expect(await getLoginAttempt('missing')).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
cd next-app && npx jest tests/lib/services/loginAttempt.test.ts
```

- [ ] **Step 3: Create implementation**

`next-app/lib/services/loginAttempt.service.ts`:

```ts
import { supabase } from '../db/supabase';

export type LoginDecision = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LoginAttempt {
  session_id: string;
  user_id: string;
  decision: LoginDecision;
  created_at?: string;
  decided_at?: string | null;
}

export async function createPendingLoginAttempt(sessionId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('didit_login_attempts')
    .insert({ session_id: sessionId, user_id: userId, decision: 'PENDING' });
  if (error) throw new Error(error.message);
}

export async function markLoginAttemptDecision(sessionId: string, decision: 'APPROVED' | 'REJECTED'): Promise<void> {
  const { error } = await supabase
    .from('didit_login_attempts')
    .update({ decision, decided_at: new Date().toISOString() })
    .eq('session_id', sessionId);
  if (error) throw new Error(error.message);
}

export async function getLoginAttempt(sessionId: string): Promise<LoginAttempt | null> {
  const { data } = await supabase
    .from('didit_login_attempts')
    .select('*')
    .eq('session_id', sessionId)
    .single();
  return (data as LoginAttempt | null) ?? null;
}
```

- [ ] **Step 4: Run tests**

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add next-app/lib/services/loginAttempt.service.ts next-app/tests/lib/services/loginAttempt.test.ts
git commit -m "feat(auth): track Didit biometric login attempts"
```

---

## Task R6: Replace `/api/auth/register`

**Files:**
- Modify: `next-app/app/api/auth/register/route.ts`
- Modify: `next-app/tests/api/auth.test.ts` (replace with the new shape)

- [ ] **Step 1: Replace the test file**

Replace `next-app/tests/api/auth.test.ts` with:

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
  updateProfileFromKycResult: jest.fn(),
}));
jest.mock('@/lib/services/loginAttempt.service', () => ({
  createPendingLoginAttempt: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/services/didit.service', () => ({
  createSession: jest.fn(),
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
const { createSession } = require('@/lib/services/didit.service');
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

const googleUser = {
  id: 'auth_user_1',
  email: 'a@b.com',
  app_metadata: { provider: 'google' },
  user_metadata: { full_name: 'Ada Lovelace', avatar_url: 'https://x/y.png', sub: 'gsub' },
};

describe('POST /api/auth/register', () => {
  it('creates a Didit KYC session and inserts a PENDING profile', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce(null);
    createSession.mockResolvedValueOnce({ session_id: 'sess_kyc_1', verification_url: 'https://verify/sess_kyc_1' });
    createProfile.mockResolvedValueOnce({ id: 'p1' });

    const res = await register(makePost('/api/auth/register', { supabase_access_token: 'sb' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.verification_url).toBe('https://verify/sess_kyc_1');
    expect(body.session_id).toBe('sess_kyc_1');
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      vendorData: 'auth_user_1',
      callback: expect.stringContaining('/auth/didit-callback'),
    }));
    expect(createProfile).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'auth_user_1',
      didit_kyc_session_id: 'sess_kyc_1',
      dni: null,
    }));
  });

  it('returns 409 when a profile already exists', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce({ id: 'p1' });
    const res = await register(makePost('/api/auth/register', { supabase_access_token: 'sb' }));
    expect(res.status).toBe(409);
  });

  it('returns 401 for invalid Supabase token', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'bad' } });
    const res = await register(makePost('/api/auth/register', { supabase_access_token: 'bad' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 if provider is not google', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { ...googleUser, app_metadata: { provider: 'email' } } }, error: null,
    });
    const res = await register(makePost('/api/auth/register', { supabase_access_token: 'sb' }));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/login', () => {
  const profile = { id: 'p1', user_id: 'auth_user_1', verification_status: 'APPROVED' };

  it('creates a Didit Biometric session and pending login attempt', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce(profile);
    createSession.mockResolvedValueOnce({ session_id: 'sess_bio_1', verification_url: 'https://verify/sess_bio_1' });

    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'sb' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.verification_url).toBe('https://verify/sess_bio_1');
  });

  it('returns 404 when profile missing', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce(null);
    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'sb' }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_registered');
  });

  it('returns 409 when verification still PENDING', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce({ ...profile, verification_status: 'PENDING' });
    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'sb' }));
    expect(res.status).toBe(409);
  });

  it('returns 429 when rate-limited', async () => {
    checkRateLimit.mockResolvedValueOnce(false);
    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'sb' }));
    expect(res.status).toBe(429);
  });

  it('returns 401 invalid_token when Supabase rejects', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'bad' } });
    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'bad' }));
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/auth/login', () => {
  it('revokes JWT and clears cookie', async () => {
    verifyToken.mockResolvedValueOnce({ jti: 'jti_1' });
    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'DELETE',
      headers: { cookie: `${APP_SESSION_COOKIE}=tok` },
    });
    const res = await logout(req);
    expect(res.status).toBe(200);
    expect(revokeToken).toHaveBeenCalledWith('jti_1');
    expect(res.headers.get('set-cookie') ?? '').toMatch(/Max-Age=0/i);
  });

  it('is idempotent without cookie', async () => {
    const req = new NextRequest('http://localhost/api/auth/login', { method: 'DELETE' });
    const res = await logout(req);
    expect(res.status).toBe(200);
    expect(revokeToken).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Replace `app/api/auth/register/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/db/supabase';
import { getProfileByUserId, createProfile } from '@/lib/services/profile.service';
import { createSession } from '@/lib/services/didit.service';
import { config } from '@/lib/config';

const bodySchema = z.object({ supabase_access_token: z.string().min(1) });

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { data: userResult, error } = await supabase.auth.getUser(parsed.data.supabase_access_token);
  if (error || !userResult?.user) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }
  const user = userResult.user;
  if (user.app_metadata?.provider !== 'google') {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  if (await getProfileByUserId(user.id)) {
    return NextResponse.json({ error: 'already_registered' }, { status: 409 });
  }

  if (!config.DIDIT_KYC_WORKFLOW_ID) {
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }

  const session = await createSession({
    workflowId: config.DIDIT_KYC_WORKFLOW_ID,
    vendorData: user.id,
    callback: `${config.SITE_URL}/auth/didit-callback?intent=register`,
  });

  await createProfile({
    user_id: user.id,
    email: user.email ?? '',
    google_sub: (user.user_metadata?.sub as string) ?? null,
    full_name: (user.user_metadata?.full_name as string) ?? null,
    picture_url: (user.user_metadata?.avatar_url as string) ?? null,
    dni: null,
    didit_kyc_session_id: session.session_id,
    verification_status: 'PENDING',
  });

  return NextResponse.json(
    { verification_url: session.verification_url, session_id: session.session_id },
    { status: 201 },
  );
}
```

- [ ] **Step 3: Run register tests**

```bash
cd next-app && npx jest tests/api/auth.test.ts -t '/api/auth/register'
```

Expected: pass. Login/logout still failing (next task).

- [ ] **Step 4: Commit**

```bash
git add next-app/app/api/auth/register/route.ts next-app/tests/api/auth.test.ts
git commit -m "feat(auth): /api/auth/register starts Didit KYC session"
```

---

## Task R7: Replace `/api/auth/login` POST

**Files:** Modify `next-app/app/api/auth/login/route.ts`

- [ ] **Step 1: Replace the file**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/db/supabase';
import { revokeToken, verifyToken } from '@/lib/services/token.service';
import { getProfileByUserId } from '@/lib/services/profile.service';
import { createSession } from '@/lib/services/didit.service';
import { createPendingLoginAttempt } from '@/lib/services/loginAttempt.service';
import { clearSessionCookie, APP_SESSION_COOKIE } from '@/lib/cookies';
import { checkRateLimit } from '@/lib/rateLimiter';
import { config } from '@/lib/config';

const bodySchema = z.object({ supabase_access_token: z.string().min(1) });

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

  const { data: userResult, error } = await supabase.auth.getUser(parsed.data.supabase_access_token);
  if (error || !userResult?.user) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }
  const user = userResult.user;

  const profile = await getProfileByUserId(user.id);
  if (!profile) return NextResponse.json({ error: 'not_registered' }, { status: 404 });
  if (profile.verification_status !== 'APPROVED') {
    return NextResponse.json({ error: 'verification_pending' }, { status: 409 });
  }

  if (!config.DIDIT_BIOMETRIC_WORKFLOW_ID) {
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }

  const session = await createSession({
    workflowId: config.DIDIT_BIOMETRIC_WORKFLOW_ID,
    vendorData: user.id,
    callback: `${config.SITE_URL}/auth/didit-callback?intent=login`,
  });

  await createPendingLoginAttempt(session.session_id, user.id);

  return NextResponse.json({
    verification_url: session.verification_url,
    session_id: session.session_id,
  });
}

export async function DELETE(req: NextRequest) {
  const cookieToken = req.cookies.get(APP_SESSION_COOKIE)?.value;
  if (cookieToken) {
    try {
      const decoded = await verifyToken(cookieToken);
      if (decoded.jti) await revokeToken(decoded.jti);
    } catch {
      // ignore
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

Expected: all pass.

- [ ] **Step 3: Run the full suite**

```bash
cd next-app && npx jest
```

Expected: pass (other tests still good).

- [ ] **Step 4: Commit**

```bash
git add next-app/app/api/auth/login/route.ts
git commit -m "feat(auth): /api/auth/login starts Didit Biometric session"
```

---

## Task R8: Webhook handler `/api/didit/webhook` (TDD)

**Files:**
- Create: `next-app/app/api/didit/webhook/route.ts`
- Create: `next-app/tests/api/didit/webhook.test.ts`

- [ ] **Step 1: Write failing tests**

Create `next-app/tests/api/didit/webhook.test.ts`:

```ts
import { POST as webhook } from '@/app/api/didit/webhook/route';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

jest.mock('@/lib/services/profile.service', () => ({
  updateProfileFromKycResult: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/services/loginAttempt.service', () => ({
  markLoginAttemptDecision: jest.fn().mockResolvedValue(undefined),
}));

const { updateProfileFromKycResult } = require('@/lib/services/profile.service');
const { markLoginAttemptDecision } = require('@/lib/services/loginAttempt.service');

beforeEach(() => jest.clearAllMocks());

const SECRET = 'test-webhook-secret';

function sign(body: string): string {
  return crypto.createHmac('sha256', SECRET).update(body).digest('hex');
}

function makeWebhookReq(body: object, signatureOverride?: string) {
  const raw = JSON.stringify(body);
  const sig = signatureOverride ?? sign(raw);
  return new NextRequest('http://localhost/api/didit/webhook', {
    method: 'POST',
    body: raw,
    headers: { 'content-type': 'application/json', 'x-didit-signature': sig },
  });
}

describe('POST /api/didit/webhook', () => {
  it('rejects invalid signature', async () => {
    const res = await webhook(makeWebhookReq({ session_id: 's', vendor_data: 'u' }, 'bogus'));
    expect(res.status).toBe(401);
  });

  it('updates profile on KYC approved', async () => {
    const res = await webhook(makeWebhookReq({
      session_id: 'sess_kyc',
      vendor_data: 'user_1',
      workflow_id: 'kyc-workflow-id',
      decision: 'Approved',
      kyc: { document_number: '12345678', full_name: 'Ada' },
    }));
    expect(res.status).toBe(200);
    expect(updateProfileFromKycResult).toHaveBeenCalledWith('user_1', {
      dni: '12345678',
      full_name: 'Ada',
      verification_status: 'APPROVED',
    });
  });

  it('marks profile REJECTED on KYC declined', async () => {
    const res = await webhook(makeWebhookReq({
      session_id: 'sess_kyc',
      vendor_data: 'user_1',
      workflow_id: 'kyc-workflow-id',
      decision: 'Declined',
    }));
    expect(res.status).toBe(200);
    expect(updateProfileFromKycResult).toHaveBeenCalledWith('user_1', {
      dni: '',
      full_name: null,
      verification_status: 'REJECTED',
    });
  });

  it('updates login attempt on biometric approved', async () => {
    const res = await webhook(makeWebhookReq({
      session_id: 'sess_bio',
      vendor_data: 'user_1',
      workflow_id: 'bio-workflow-id',
      decision: 'Approved',
    }));
    expect(res.status).toBe(200);
    expect(markLoginAttemptDecision).toHaveBeenCalledWith('sess_bio', 'APPROVED');
  });

  it('updates login attempt on biometric declined', async () => {
    const res = await webhook(makeWebhookReq({
      session_id: 'sess_bio',
      vendor_data: 'user_1',
      workflow_id: 'bio-workflow-id',
      decision: 'Declined',
    }));
    expect(res.status).toBe(200);
    expect(markLoginAttemptDecision).toHaveBeenCalledWith('sess_bio', 'REJECTED');
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
cd next-app && npx jest tests/api/didit/webhook.test.ts
```

- [ ] **Step 3: Implement**

Create `next-app/app/api/didit/webhook/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/services/didit.service';
import { updateProfileFromKycResult } from '@/lib/services/profile.service';
import { markLoginAttemptDecision } from '@/lib/services/loginAttempt.service';
import { config } from '@/lib/config';

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get('x-didit-signature');
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let payload: {
    session_id: string;
    vendor_data: string;
    workflow_id: string;
    decision: string;
    kyc?: { document_number?: string; full_name?: string };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const { workflow_id, vendor_data, session_id, decision, kyc } = payload;
  const isApproved = decision === 'Approved';
  const finalStatus = isApproved ? 'APPROVED' : 'REJECTED';

  if (workflow_id === config.DIDIT_KYC_WORKFLOW_ID) {
    await updateProfileFromKycResult(vendor_data, {
      dni: isApproved ? (kyc?.document_number ?? '') : '',
      full_name: isApproved ? (kyc?.full_name ?? null) : null,
      verification_status: finalStatus,
    });
  } else if (workflow_id === config.DIDIT_BIOMETRIC_WORKFLOW_ID) {
    await markLoginAttemptDecision(session_id, finalStatus);
  }
  // Unknown workflows are silently OK'd — Didit retries are bounded.

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run tests**

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add next-app/app/api/didit/webhook next-app/tests/api/didit
git commit -m "feat(auth): handle Didit verification webhook"
```

---

## Task R9: Callback page `/auth/didit-callback`

**Files:** Create `next-app/app/auth/didit-callback/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getProfileByUserId } from '@/lib/services/profile.service';
import { getLoginAttempt } from '@/lib/services/loginAttempt.service';
import { issueUserToken } from '@/lib/services/token.service';
import { APP_SESSION_COOKIE } from '@/lib/cookies';

interface SearchParams {
  session_id?: string;
  intent?: 'register' | 'login';
}

async function setCookieAndRedirect(userId: string, target: string) {
  const token = await issueUserToken(userId);
  (await cookies()).set(APP_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect(target);
}

export default async function DiditCallback({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { session_id, intent } = await searchParams;
  if (!session_id || !intent) {
    return <main className="p-8"><h1>Verification error</h1><p>Missing session.</p></main>;
  }

  if (intent === 'register') {
    // The webhook updates the profile by user_id; we don't know it directly here.
    // Pull the placeholder profile via the KYC session by querying the profile table.
    // For v1: use a small endpoint or keep the user_id in a cookie set during register.
    // Simpler: read user_id from the Supabase session cookie set by the browser SDK.
    // For a hackathon: the browser already has the Supabase session — let it post status to /api/auth/me.
    return (
      <main className="p-8">
        <h1>Almost done</h1>
        <p>Verification submitted. Once confirmed you'll be redirected to your dashboard.</p>
        <script dangerouslySetInnerHTML={{ __html: clientPollScript('register', session_id) }} />
      </main>
    );
  }

  // login intent
  const attempt = await getLoginAttempt(session_id);
  if (!attempt) {
    return (
      <main className="p-8">
        <h1>Almost done</h1>
        <p>Waiting for verification result…</p>
        <script dangerouslySetInnerHTML={{ __html: clientPollScript('login', session_id) }} />
      </main>
    );
  }
  if (attempt.decision === 'APPROVED') {
    await setCookieAndRedirect(attempt.user_id, '/dashboard');
  }
  if (attempt.decision === 'REJECTED') {
    return <main className="p-8"><h1>Verification failed</h1><p>The face check did not match. Please try again.</p></main>;
  }
  // PENDING
  return (
    <main className="p-8">
      <h1>Almost done</h1>
      <p>Waiting for verification result…</p>
      <script dangerouslySetInnerHTML={{ __html: clientPollScript('login', session_id) }} />
    </main>
  );
}

function clientPollScript(intent: 'register' | 'login', sessionId: string): string {
  return `
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const r = await fetch('/api/auth/finalize?intent=${intent}&session_id=${encodeURIComponent(sessionId)}', { credentials: 'include' });
        if (r.status === 200) {
          window.location.href = '/dashboard';
          clearInterval(interval);
          return;
        }
        if (r.status === 410) {
          document.body.innerHTML = '<main class="p-8"><h1>Verification failed</h1><p>Please try again.</p></main>';
          clearInterval(interval);
          return;
        }
      } catch (e) {}
      if (attempts >= maxAttempts) { clearInterval(interval); }
    }, 1500);
  `;
}
```

The polling script hits a finalize endpoint described in Task R10.

- [ ] **Step 2: Commit**

```bash
git add next-app/app/auth/didit-callback
git commit -m "feat(auth): Didit callback page polls for verification result"
```

---

## Task R10: `/api/auth/finalize` (helper for polling)

**Files:**
- Create: `next-app/app/api/auth/finalize/route.ts`
- Create: `next-app/tests/api/auth/finalize.test.ts`

This endpoint is called by the callback page's polling script. It returns 200 + sets cookie when the verification is finally APPROVED, 410 if REJECTED, 202 if still PENDING.

- [ ] **Step 1: Write failing tests**

Create `next-app/tests/api/auth/finalize.test.ts`:

```ts
import { GET as finalize } from '@/app/api/auth/finalize/route';
import { NextRequest } from 'next/server';
import { APP_SESSION_COOKIE } from '@/lib/cookies';

jest.mock('@/lib/services/loginAttempt.service', () => ({
  getLoginAttempt: jest.fn(),
}));
jest.mock('@/lib/services/profile.service', () => ({
  getProfileByUserId: jest.fn(),
}));
jest.mock('@/lib/services/token.service', () => ({
  issueUserToken: jest.fn().mockResolvedValue('mock.token'),
}));
jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));

const { getLoginAttempt } = require('@/lib/services/loginAttempt.service');
const { getProfileByUserId } = require('@/lib/services/profile.service');
const { supabase } = require('@/lib/db/supabase');

beforeEach(() => jest.clearAllMocks());

function makeReq(qs: string, cookieHeader?: string) {
  const headers: Record<string, string> = {};
  if (cookieHeader) headers['cookie'] = cookieHeader;
  return new NextRequest(`http://localhost/api/auth/finalize?${qs}`, { headers });
}

describe('GET /api/auth/finalize?intent=login', () => {
  it('returns 200 + cookie when login attempt is APPROVED', async () => {
    getLoginAttempt.mockResolvedValueOnce({ session_id: 's', user_id: 'u1', decision: 'APPROVED' });
    const res = await finalize(makeReq('intent=login&session_id=s'));
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie') ?? '').toMatch(new RegExp(`${APP_SESSION_COOKIE}=mock\\.token`));
  });

  it('returns 410 when REJECTED', async () => {
    getLoginAttempt.mockResolvedValueOnce({ session_id: 's', user_id: 'u1', decision: 'REJECTED' });
    const res = await finalize(makeReq('intent=login&session_id=s'));
    expect(res.status).toBe(410);
  });

  it('returns 202 when PENDING', async () => {
    getLoginAttempt.mockResolvedValueOnce({ session_id: 's', user_id: 'u1', decision: 'PENDING' });
    const res = await finalize(makeReq('intent=login&session_id=s'));
    expect(res.status).toBe(202);
  });
});

describe('GET /api/auth/finalize?intent=register', () => {
  it('returns 200 + cookie when KYC profile is APPROVED', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    getProfileByUserId.mockResolvedValueOnce({ user_id: 'u1', verification_status: 'APPROVED' });
    const res = await finalize(makeReq('intent=register&session_id=s&supabase_access_token=sb'));
    expect(res.status).toBe(200);
  });

  it('returns 410 when REJECTED', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    getProfileByUserId.mockResolvedValueOnce({ user_id: 'u1', verification_status: 'REJECTED' });
    const res = await finalize(makeReq('intent=register&session_id=s&supabase_access_token=sb'));
    expect(res.status).toBe(410);
  });
});
```

- [ ] **Step 2: Implement**

Create `next-app/app/api/auth/finalize/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/db/supabase';
import { getLoginAttempt } from '@/lib/services/loginAttempt.service';
import { getProfileByUserId } from '@/lib/services/profile.service';
import { issueUserToken } from '@/lib/services/token.service';
import { setSessionCookie } from '@/lib/cookies';

const querySchema = z.object({
  intent: z.enum(['login', 'register']),
  session_id: z.string().min(1),
  supabase_access_token: z.string().optional(),
});

async function approveResponse(userId: string): Promise<NextResponse> {
  const token = await issueUserToken(userId);
  const res = NextResponse.json({ ok: true }, { status: 200 });
  setSessionCookie(res, token);
  return res;
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  if (parsed.data.intent === 'login') {
    const attempt = await getLoginAttempt(parsed.data.session_id);
    if (!attempt) return NextResponse.json({ status: 'pending' }, { status: 202 });
    if (attempt.decision === 'APPROVED') return approveResponse(attempt.user_id);
    if (attempt.decision === 'REJECTED') return NextResponse.json({ error: 'rejected' }, { status: 410 });
    return NextResponse.json({ status: 'pending' }, { status: 202 });
  }

  // intent === 'register' — needs the Supabase token to identify the user
  if (!parsed.data.supabase_access_token) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const { data: userResult, error } = await supabase.auth.getUser(parsed.data.supabase_access_token);
  if (error || !userResult?.user) return NextResponse.json({ error: 'invalid_token' }, { status: 401 });

  const profile = await getProfileByUserId(userResult.user.id);
  if (!profile) return NextResponse.json({ status: 'pending' }, { status: 202 });
  if (profile.verification_status === 'APPROVED') return approveResponse(profile.user_id);
  if (profile.verification_status === 'REJECTED') return NextResponse.json({ error: 'rejected' }, { status: 410 });
  return NextResponse.json({ status: 'pending' }, { status: 202 });
}
```

- [ ] **Step 3: Update the polling script in the callback page**

Open `app/auth/didit-callback/page.tsx`. The poll URL for register intent must include the Supabase access token. Replace the `clientPollScript` body:

```ts
function clientPollScript(intent: 'register' | 'login', sessionId: string): string {
  return `
    (async () => {
      const SUPABASE_URL = '${process.env.NEXT_PUBLIC_SUPABASE_URL}';
      const KEY = '${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}';
      const stored = window.localStorage.getItem('sb-' + SUPABASE_URL.split('//')[1].split('.')[0] + '-auth-token');
      let supabaseToken = '';
      try {
        const parsed = JSON.parse(stored || '{}');
        supabaseToken = parsed.access_token || '';
      } catch {}
      let attempts = 0;
      const maxAttempts = 10;
      const interval = setInterval(async () => {
        attempts++;
        const params = new URLSearchParams({ intent: '${intent}', session_id: '${sessionId}' });
        if ('${intent}' === 'register' && supabaseToken) params.set('supabase_access_token', supabaseToken);
        try {
          const r = await fetch('/api/auth/finalize?' + params.toString(), { credentials: 'include' });
          if (r.status === 200) { window.location.href = '/dashboard'; clearInterval(interval); return; }
          if (r.status === 410) { document.body.innerHTML = '<main class="p-8"><h1>Verification failed</h1><p>Please try again.</p></main>'; clearInterval(interval); return; }
        } catch (e) {}
        if (attempts >= maxAttempts) { clearInterval(interval); }
      }, 1500);
    })();
  `;
}
```

- [ ] **Step 4: Run tests**

```bash
cd next-app && npx jest
```

Expected: all pass (full suite).

- [ ] **Step 5: Commit**

```bash
git add next-app/app/api/auth/finalize next-app/app/auth/didit-callback next-app/tests/api/auth/finalize.test.ts
git commit -m "feat(auth): /api/auth/finalize for callback polling"
```

---

## Task R11: Login + register pages

**Files:**
- Create: `next-app/app/login/page.tsx`
- Create: `next-app/app/register/page.tsx`

- [ ] **Step 1: `app/login/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/client/supabaseBrowser';

export default function LoginPage() {
  const supabase = getSupabaseBrowser();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
    const sub = supabase.auth.onAuthStateChange((_e, session) => setToken(session?.access_token ?? null));
    return () => sub.data.subscription.unsubscribe();
  }, [supabase]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    });
  };

  const startBiometricAuth = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabase_access_token: token }),
      });
      const body = await r.json();
      if (r.status === 404) return setError('No account yet. Please register first.');
      if (r.status === 409) return setError('Your verification is still being processed.');
      if (r.status === 429) return setError('Too many attempts. Please wait.');
      if (!r.ok || !body.verification_url) return setError('Login failed.');
      window.location.href = body.verification_url;
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {!token ? (
        <button onClick={signInWithGoogle} className="rounded bg-black px-4 py-2 text-white">Sign in with Google</button>
      ) : (
        <button onClick={startBiometricAuth} disabled={busy} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
          {busy ? 'Starting verification…' : 'Verify with face'}
        </button>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 2: `app/register/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/client/supabaseBrowser';

export default function RegisterPage() {
  const supabase = getSupabaseBrowser();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
    const sub = supabase.auth.onAuthStateChange((_e, session) => setToken(session?.access_token ?? null));
    return () => sub.data.subscription.unsubscribe();
  }, [supabase]);

  const signUpWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/register` },
    });
  };

  const startKyc = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabase_access_token: token }),
      });
      const body = await r.json();
      if (r.status === 409) return setError('You are already registered. Try logging in.');
      if (!r.ok || !body.verification_url) return setError('Registration failed.');
      window.location.href = body.verification_url;
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Register</h1>
      {!token ? (
        <button onClick={signUpWithGoogle} className="rounded bg-black px-4 py-2 text-white">Sign up with Google</button>
      ) : (
        <button onClick={startKyc} disabled={busy} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
          {busy ? 'Starting verification…' : 'Verify identity (DNI + selfie)'}
        </button>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add next-app/app/login next-app/app/register
git commit -m "feat(auth): login and register pages redirect to Didit"
```

---

## Task R12: Dashboard + home

**Files:**
- Create: `next-app/app/dashboard/page.tsx`
- Modify: `next-app/app/page.tsx`

- [ ] **Step 1: `app/dashboard/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
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

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-zinc-600">You are signed in.</p>
      <button onClick={handleLogout} disabled={busy} className="rounded bg-zinc-200 px-4 py-2 disabled:opacity-50">
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </main>
  );
}
```

- [ ] **Step 2: Replace `app/page.tsx`**

```tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Welcome</h1>
      <Link href="/login" className="rounded bg-black px-4 py-2 text-center text-white">Sign in</Link>
      <Link href="/register" className="rounded bg-zinc-200 px-4 py-2 text-center">Register</Link>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add next-app/app/dashboard next-app/app/page.tsx
git commit -m "feat(auth): dashboard and home page"
```

---

## Task R13: Manual smoke test

(Performed by the user.)

- [ ] **Step 1: Apply schema in Supabase**
- [ ] **Step 2: Configure Didit dashboard**
  - Create KYC workflow → copy ID into `DIDIT_KYC_WORKFLOW_ID`
  - Create Biometric Authentication workflow → copy ID into `DIDIT_BIOMETRIC_WORKFLOW_ID`
  - Set webhook URL to `${SITE_URL}/api/didit/webhook`
- [ ] **Step 3: `npm run dev`**
- [ ] **Step 4: Register flow** (Google → Didit hosted KYC → callback → /dashboard)
- [ ] **Step 5: Sign out** (cookie cleared, JWT revoked)
- [ ] **Step 6: Login flow** (Google → Didit Biometric → callback → /dashboard)
- [ ] **Step 7: Reject flow** (use a different person at biometric step → see error)
- [ ] **Step 8: Run full unit + API suite**: `cd next-app && npx jest`

---

## Self-Review Checklist (engineer executing)

- [ ] Schema applied; profiles columns + didit_login_attempts table exist.
- [ ] Both Didit workflows created and IDs in env.
- [ ] Webhook URL registered in Didit console.
- [ ] All Jest tests pass.
- [ ] Manual smoke test green.
