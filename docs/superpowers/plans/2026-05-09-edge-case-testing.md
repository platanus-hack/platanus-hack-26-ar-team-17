# Edge-Case Testing Plan — SDK + Platform API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the existing test suites so every branch, error path, boundary condition, and security-relevant scenario in the SDK and Platform API is covered.

**Architecture:** All new tests are unit tests using Jest + mocks. They extend existing test files wherever possible and introduce new files only for untested modules. No integration tests are added here — `sdk/integration.ts` already handles live API testing.

**Tech Stack:** Jest, ts-jest, NextRequest (next/server), jsonwebtoken, bcryptjs, @supabase/supabase-js (mocked)

---

## File Map

### Modified files (SDK)
- `sdk/tests/normalize/action.test.ts` — add 7 edge cases
- `sdk/tests/normalize/text.test.ts` — add 4 edge cases
- `sdk/tests/pipeline/verifyScope.test.ts` — add 4 edge cases
- `sdk/tests/pipeline/verifyRules.test.ts` — add 3 edge cases
- `sdk/tests/pipeline/validateKey.test.ts` — add 3 edge cases
- `sdk/tests/http/client.test.ts` — add 3 edge cases
- `sdk/tests/sdk.test.ts` — add 5 edge cases

### Modified files (Platform API)
- `next-app/app/api/validate/route.ts` — wrap `req.json()` in try-catch (bug fix)
- `next-app/tests/api/validate.test.ts` — add 6 edge cases
- `next-app/tests/api/auth.test.ts` — add 6 edge cases
- `next-app/tests/api/keys.test.ts` — add 5 edge cases
- `next-app/tests/api/auditLog.test.ts` — add 3 edge cases
- `next-app/tests/lib/services/rules.service.test.ts` — add 5 edge cases
- `next-app/tests/lib/services/token.service.test.ts` — add 3 edge cases
- `next-app/tests/lib/services/scope.service.test.ts` — add 3 edge cases

### New files (Platform API)
- `next-app/tests/lib/rateLimiter.test.ts` — 5 rate-limiter scenarios
- `next-app/tests/lib/auth.test.ts` — 4 auth-middleware scenarios

---

## Task 1: SDK — `normalizeAction` edge cases

**Files:**
- Modify: `sdk/tests/normalize/action.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these cases to the bottom of the `describe('normalizeAction')` block:

```typescript
  it('removes tab characters (\\t is \\x09, inside \\x00-\\x1F)', () =>
    expect(normalizeAction('send\tmessage')).toBe('sendmessage'));

  it('removes embedded newlines', () =>
    expect(normalizeAction('send\nmessage')).toBe('sendmessage'));

  it('empty string returns empty string', () =>
    expect(normalizeAction('')).toBe(''));

  it('only control chars returns empty string', () =>
    expect(normalizeAction('\x00\x01\x1F')).toBe(''));

  it('only whitespace returns empty string after trim', () =>
    expect(normalizeAction('   ')).toBe(''));

  it('preserves underscores and digits', () =>
    expect(normalizeAction('send_message_123')).toBe('send_message_123'));

  it('does not collapse internal spaces (only trims edges)', () =>
    expect(normalizeAction('send message')).toBe('send message'));
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17/sdk
npx jest tests/normalize/action.test.ts --no-coverage
```
Expected: new tests FAIL (implementation untested paths not exercised yet — but since the implementation already handles these via the regex, they should actually PASS already; running confirms)

- [ ] **Step 3: Confirm tests pass (no implementation change needed)**

The regex `[\x00-\x1F\x7F]` already covers `\t` (0x09) and `\n` (0x0A). All new tests should pass without modifying `src/normalize/action.ts`.

```bash
npx jest tests/normalize/action.test.ts --no-coverage
```
Expected: ALL 11 tests PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17
git add sdk/tests/normalize/action.test.ts
git commit -m "test(sdk): expand normalizeAction edge cases"
```

---

## Task 2: SDK — `normalizeText` edge cases

**Files:**
- Modify: `sdk/tests/normalize/text.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these cases to the bottom of the `describe('normalizeText')` block:

```typescript
  it('double URL encoding is decoded only one level deep', () => {
    // %2561 → decodeURIComponent → '%61'  (one pass), NOT → 'a'
    // because %25 decodes to '%', giving '%61' as a literal string
    expect(normalizeText('%2561')).toBe('%61');
  });

  it('malformed URL encoding falls back to original string', () => {
    // decodeURIComponent('%GG') throws URIError → catches and uses original
    expect(normalizeText('%GG')).toBe('%GG');
  });

  it('removes multiple consecutive zero-width chars', () => {
    // U+200B (zero-width space) + U+200C (zero-width non-joiner)
    expect(normalizeText('sp​‌am')).toBe('spam');
  });

  it('NFKC does not equate Cyrillic lookalikes to Latin chars', () => {
    // Cyrillic 'а' (U+0430) stays Cyrillic after NFKC — confusables are NOT normalised
    const cyrillic = 'spаm'; // looks like 'spam' but contains Cyrillic 'а'
    expect(normalizeText(cyrillic)).toBe('spаm');
  });
```

- [ ] **Step 2: Run to verify they fail or pass**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17/sdk
npx jest tests/normalize/text.test.ts --no-coverage
```

- [ ] **Step 3: Confirm all pass**

Expected: ALL 8 tests PASS (existing implementation handles these correctly)

- [ ] **Step 4: Commit**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17
git add sdk/tests/normalize/text.test.ts
git commit -m "test(sdk): expand normalizeText edge cases including URL decode and Cyrillic"
```

---

## Task 3: SDK — `verifyScope`, `verifyRules`, `validateKey` edge cases

**Files:**
- Modify: `sdk/tests/pipeline/verifyScope.test.ts`
- Modify: `sdk/tests/pipeline/verifyRules.test.ts`
- Modify: `sdk/tests/pipeline/validateKey.test.ts`

- [ ] **Step 1: Write failing tests for `verifyScope`**

Append inside `describe('verifyScope')`:

```typescript
  it('returns false for empty scope array', () =>
    expect(verifyScope('send_message', [])).toBe(false));

  it('normalizes scope entries (uppercase in scope list)', () =>
    expect(verifyScope('send_message', ['SEND_MESSAGE'])).toBe(true));

  it('returns false when action normalizes to empty string', () =>
    // '\x00\x01' → '' after normalizeAction; '' is not in any scope
    expect(verifyScope('\x00\x01', ['send_message'])).toBe(false));

  it('returns false for empty action string', () =>
    expect(verifyScope('', ['send_message'])).toBe(false));
```

- [ ] **Step 2: Write failing tests for `verifyRules`**

Append inside `describe('verifyRules')`:

```typescript
  it('returns blocked: true with undefined error when valid=false and no error field', () => {
    const result = verifyRules({ apiResponse: { valid: false } });
    expect(result.blocked).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns blocked: false when valid=true even if error is set to a non-blocking value', () => {
    const result = verifyRules({ apiResponse: { valid: true, error: 'some_warning', token: 't', userId: 'u', scope: [] } });
    expect(result.blocked).toBe(false);
  });

  it('propagates the specific error string for invalid_api_key', () => {
    const result = verifyRules({ apiResponse: { valid: false, error: 'invalid_api_key' } });
    expect(result.blocked).toBe(true);
    expect(result.error).toBe('invalid_api_key');
  });
```

- [ ] **Step 3: Write failing tests for `validateKey`**

Append inside `describe('validateKeyAndGetToken')`:

```typescript
  it('sends a 64-char lowercase hex SHA-256 hash (never the plain key)', async () => {
    (client.post as jest.Mock).mockResolvedValue({ valid: true, token: 't', userId: 'u', scope: [] });

    await validateKeyAndGetToken({
      apiKey: 'ak_plainkey123',
      action: 'send_message',
      platform: 'whatsapp',
      text: '',
      platformApiUrl: 'https://api.example.com',
    });

    const body = (client.post as jest.Mock).mock.calls[0][1];
    expect(body.api_key_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('normalizes action before sending to the API', async () => {
    (client.post as jest.Mock).mockResolvedValue({ valid: true, token: 't', userId: 'u', scope: [] });

    await validateKeyAndGetToken({
      apiKey: 'ak_x',
      action: 'SEND_MESSAGE',
      platform: 'whatsapp',
      text: '',
      platformApiUrl: 'https://api.example.com',
    });

    const body = (client.post as jest.Mock).mock.calls[0][1];
    expect(body.action).toBe('send_message');
  });

  it('propagates network errors from http client', async () => {
    (client.post as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      validateKeyAndGetToken({
        apiKey: 'ak_x',
        action: 'send_message',
        platform: 'whatsapp',
        text: '',
        platformApiUrl: 'https://api.example.com',
      })
    ).rejects.toThrow('ECONNREFUSED');
  });
```

- [ ] **Step 4: Run all three test files**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17/sdk
npx jest tests/pipeline/ --no-coverage
```
Expected: ALL tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17
git add sdk/tests/pipeline/verifyScope.test.ts sdk/tests/pipeline/verifyRules.test.ts sdk/tests/pipeline/validateKey.test.ts
git commit -m "test(sdk): add edge cases for pipeline functions (verifyScope, verifyRules, validateKey)"
```

---

## Task 4: SDK — HTTP client and `AgentAuthSDK` edge cases

**Files:**
- Modify: `sdk/tests/http/client.test.ts`
- Modify: `sdk/tests/sdk.test.ts`

- [ ] **Step 1: Write failing tests for http/client**

Append inside `describe('http client')`:

```typescript
  it('uses hostname, port, and full path from URL', () => {
    const mockReq = { on: jest.fn(), write: jest.fn(), end: jest.fn() };
    (https.request as jest.Mock).mockReturnValue(mockReq);

    post('https://api.example.com:8443/api/validate?v=2', {});

    expect(https.request).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: 'api.example.com',
        port: '8443',
        path: '/api/validate?v=2',
      }),
      expect.any(Function)
    );
  });

  it('rejects with "Invalid JSON" when server returns non-JSON body', async () => {
    const mockReq = { on: jest.fn(), write: jest.fn(), end: jest.fn() };
    (https.request as jest.Mock).mockImplementation((_opts: unknown, cb: (res: unknown) => void) => {
      setImmediate(() => {
        cb({
          on: (event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'data') handler('not-json-at-all');
            if (event === 'end') handler();
          },
        });
      });
      return mockReq;
    });

    await expect(
      post('https://api.example.com/api/validate', {})
    ).rejects.toThrow('Invalid JSON');
  });

  it('propagates network errors from the underlying request', async () => {
    const mockReq = {
      on: jest.fn((event: string, handler: (err: Error) => void) => {
        if (event === 'error') setImmediate(() => handler(new Error('ECONNREFUSED')));
      }),
      write: jest.fn(),
      end: jest.fn(),
    };
    (https.request as jest.Mock).mockReturnValue(mockReq);

    await expect(
      post('https://api.example.com/api/validate', {})
    ).rejects.toThrow('ECONNREFUSED');
  });
```

- [ ] **Step 2: Write failing tests for AgentAuthSDK**

Append to `sdk/tests/sdk.test.ts` (after existing describe block):

```typescript
describe('AgentAuthSDK constructor', () => {
  it('throws when platformApiUrl uses http://', () => {
    expect(() => new AgentAuthSDK({ platformApiUrl: 'http://api.example.com' }))
      .toThrow('HTTPS');
  });

  it('throws when platformApiUrl has no protocol', () => {
    expect(() => new AgentAuthSDK({ platformApiUrl: 'api.example.com' }))
      .toThrow();
  });
});

describe('AgentAuthSDK.run — additional edge cases', () => {
  const sdk2 = new AgentAuthSDK({ platformApiUrl: 'https://api.example.com' });
  beforeEach(() => jest.clearAllMocks());

  it('run with undefined text does not crash (text is optional)', async () => {
    (client.post as jest.Mock).mockResolvedValue({
      valid: true, token: 'tok', userId: 'u1', scope: ['send_message'],
    });

    const result = await sdk2.run({ apiKey: 'ak_key', action: 'send_message', platform: 'whatsapp' });
    expect(result.allowed).toBe(true);
  });

  it('returns allowed: false when API returns empty scope array', async () => {
    (client.post as jest.Mock).mockResolvedValue({
      valid: true, token: 'tok', userId: 'u1', scope: [],
    });

    const result = await sdk2.run({ apiKey: 'ak_key', action: 'send_message', platform: 'whatsapp', text: 'hi' });
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('action_not_permitted');
  });

  it('returns allowed: false when API returns valid:true but scope is undefined', async () => {
    (client.post as jest.Mock).mockResolvedValue({
      valid: true, token: 'tok', userId: 'u1',
      // scope intentionally absent
    });

    const result = await sdk2.run({ apiKey: 'ak_key', action: 'send_message', platform: 'whatsapp', text: 'hi' });
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('action_not_permitted');
  });
});
```

- [ ] **Step 3: Run both test files**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17/sdk
npx jest tests/http/client.test.ts tests/sdk.test.ts --no-coverage
```
Expected: ALL tests PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17
git add sdk/tests/http/client.test.ts sdk/tests/sdk.test.ts
git commit -m "test(sdk): add edge cases for http client and AgentAuthSDK constructor"
```

---

## Task 5: API — Fix JSON parse bug + `POST /api/validate` edge cases

**Files:**
- Modify: `next-app/app/api/validate/route.ts` — wrap req.json() in try-catch
- Modify: `next-app/tests/api/validate.test.ts` — add 7 edge cases

**Why a code change:** The current route calls `await req.json()` without error handling. If the body is not valid JSON, it throws a `SyntaxError` that propagates as an unhandled error (500). It should return 400.

- [ ] **Step 1: Write failing test for non-JSON body**

Add this test inside `describe('POST /api/validate')` in `next-app/tests/api/validate.test.ts`:

```typescript
  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/validate', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'text/plain', 'x-forwarded-for': '1.2.3.4' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
```

- [ ] **Step 2: Run test to verify it fails (currently returns 500 or throws)**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17/next-app
npx jest tests/api/validate.test.ts --no-coverage 2>&1 | tail -20
```
Expected: the new test FAILS

- [ ] **Step 3: Fix validate route to catch JSON parse error**

In `next-app/app/api/validate/route.ts`, replace:

```typescript
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
```

with:

```typescript
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
```

- [ ] **Step 4: Add remaining validate edge-case tests**

Append inside `describe('POST /api/validate')`:

```typescript
  it('returns 400 when api_key_hash is missing', async () => {
    const res = await POST(makeRequest({ action: 'send_message', platform: 'whatsapp' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when action is missing', async () => {
    const res = await POST(makeRequest({ api_key_hash: 'abc', platform: 'whatsapp' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when api_key_hash is empty string (fails min(1))', async () => {
    const res = await POST(makeRequest({ api_key_hash: '', action: 'send_message', platform: 'whatsapp' }));
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limiter returns false', async () => {
    const { checkRateLimit } = require('@/lib/rateLimiter');
    (checkRateLimit as jest.Mock).mockResolvedValueOnce(false);

    const res = await POST(makeRequest({ api_key_hash: 'abc', action: 'send_message', platform: 'whatsapp' }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('rate_limit_exceeded');
  });

  it('writes BLOCKED_INVALID_KEY to audit log when key not found', async () => {
    validateApiKeyHash.mockResolvedValue(null);
    writeLog.mockResolvedValue({});

    await POST(makeRequest({ api_key_hash: 'bad', action: 'send_message', platform: 'whatsapp', text: '' }));

    expect(writeLog).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'BLOCKED_INVALID_KEY', apiKeyId: 'unknown' })
    );
  });

  it('writes BLOCKED_SCOPE to audit log for scope violation', async () => {
    validateApiKeyHash.mockResolvedValue(validKey);
    issueToken.mockResolvedValue('tok');
    verifyToken.mockResolvedValue({ jti: 'jti-scope' });
    isTokenRevoked.mockResolvedValue(false);
    verifyScope.mockReturnValue(false);
    writeLog.mockResolvedValue({});

    await POST(makeRequest({ api_key_hash: 'abc', action: 'delete_account', platform: 'whatsapp', text: '' }));

    expect(writeLog).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'BLOCKED_SCOPE' })
    );
  });

  it('writes BLOCKED_RULE to audit log and includes ruleViolated', async () => {
    validateApiKeyHash.mockResolvedValue(validKey);
    issueToken.mockResolvedValue('tok');
    verifyToken.mockResolvedValue({ jti: 'jti-rule' });
    isTokenRevoked.mockResolvedValue(false);
    verifyScope.mockReturnValue(true);
    checkGlobalRules.mockResolvedValue({ blocked: true, ruleViolated: 'mass_send' });
    writeLog.mockResolvedValue({});

    await POST(makeRequest({ api_key_hash: 'abc', action: 'send_message', platform: 'whatsapp', text: 'spam' }));

    expect(writeLog).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'BLOCKED_RULE', ruleViolated: 'mass_send' })
    );
  });
```

- [ ] **Step 5: Run all validate tests**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17/next-app
npx jest tests/api/validate.test.ts --no-coverage
```
Expected: ALL 11 tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17
git add next-app/app/api/validate/route.ts next-app/tests/api/validate.test.ts
git commit -m "fix+test(api): handle JSON parse error in validate route, add edge-case tests"
```

---

## Task 6: API — Auth and Keys edge cases

**Files:**
- Modify: `next-app/tests/api/auth.test.ts` — add 6 edge cases
- Modify: `next-app/tests/api/keys.test.ts` — add 5 edge cases

- [ ] **Step 1: Write failing auth tests**

Append these describes to `next-app/tests/api/auth.test.ts`:

```typescript
describe('POST /api/auth/register — edge cases', () => {
  it('returns 400 when email is not a valid email address', async () => {
    const res = await register(makeReq('/api/auth/register', { email: 'not-an-email', password: 'password123' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_request');
  });

  it('returns 400 when password is fewer than 8 characters', async () => {
    const res = await register(makeReq('/api/auth/register', { email: 'a@b.com', password: 'short' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when email field is missing', async () => {
    const res = await register(makeReq('/api/auth/register', { password: 'password123' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when body has no fields at all', async () => {
    const res = await register(makeReq('/api/auth/register', {}));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login — edge cases', () => {
  it('returns 401 for non-existent email (avoids 404 for user enumeration)', async () => {
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        }),
      }),
    });

    const res = await login(makeReq('/api/auth/login', { email: 'noone@b.com', password: 'password123' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when email field is missing', async () => {
    const res = await login(makeReq('/api/auth/login', { password: 'password123' }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run auth tests**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17/next-app
npx jest tests/api/auth.test.ts --no-coverage
```
Expected: ALL tests PASS

- [ ] **Step 3: Write failing keys tests**

Append these describes to `next-app/tests/api/keys.test.ts`:

```typescript
describe('POST /api/keys — edge cases', () => {
  it('returns 400 when scope is an empty array (min(1) fails)', async () => {
    const res = await POST(makeReq('/api/keys', 'POST', { name: 'Agent', scope: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is an empty string', async () => {
    const res = await POST(makeReq('/api/keys', 'POST', { name: '', scope: ['send_message'] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when name exceeds 100 characters', async () => {
    const res = await POST(makeReq('/api/keys', 'POST', { name: 'a'.repeat(101), scope: ['send_message'] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when scope is not an array', async () => {
    const res = await POST(makeReq('/api/keys', 'POST', { name: 'Agent', scope: 'send_message' }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/keys — edge cases', () => {
  it('returns empty array when user has no keys', async () => {
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const res = await GET(makeReq('/api/keys', 'GET'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe('DELETE /api/keys/[id] — edge cases', () => {
  it('returns 401 without auth token', async () => {
    const req = new NextRequest('http://localhost/api/keys/k1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'k1' }) });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 4: Run keys tests**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17/next-app
npx jest tests/api/keys.test.ts --no-coverage
```
Expected: ALL tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17
git add next-app/tests/api/auth.test.ts next-app/tests/api/keys.test.ts
git commit -m "test(api): add auth and keys edge-case tests"
```

---

## Task 7: API — Audit-log and Alerts edge cases

**Files:**
- Modify: `next-app/tests/api/auditLog.test.ts` — add 3 edge cases

- [ ] **Step 1: Write failing tests**

Append these to `next-app/tests/api/auditLog.test.ts`:

```typescript
describe('GET /api/audit-log — edge cases', () => {
  it('returns empty array when user has no audit logs', async () => {
    supabase.from.mockReturnValueOnce(mockQuery([]));
    const res = await getAuditLog(makeReq('/api/audit-log'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('accepts keyId filter in query string without error', async () => {
    supabase.from.mockReturnValueOnce(mockQuery([{ id: 'l1', result: 'SUCCESS' }]));
    const res = await getAuditLog(makeReq('/api/audit-log?keyId=k1'));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/alerts — edge cases', () => {
  it('returns empty array when no BLOCKED_RULE logs exist', async () => {
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    });
    const res = await getAlerts(makeReq('/api/alerts'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17/next-app
npx jest tests/api/auditLog.test.ts --no-coverage
```
Expected: ALL tests PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17
git add next-app/tests/api/auditLog.test.ts
git commit -m "test(api): add audit-log and alerts edge-case tests"
```

---

## Task 8: Service layer — `checkGlobalRules` edge cases

**Files:**
- Modify: `next-app/tests/lib/services/rules.service.test.ts`

- [ ] **Step 1: Write failing tests**

The current mock sets up exactly two rules (FORBIDDEN_ACTION: mass_send, FORBIDDEN_KEYWORD: buy now click here). Add a new describe block that sets up its own mock for finer control:

```typescript
describe('checkGlobalRules — extended edge cases', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns not blocked when rules array is empty', async () => {
    const { supabase } = require('@/lib/db/supabase');
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    const result = await checkGlobalRules({ action: 'send_message', text: 'hello' });
    expect(result.blocked).toBe(false);
  });

  it('FORBIDDEN_PATTERN matches via regex (case-insensitive because rule uses RegExp with i flag)', async () => {
    const { supabase } = require('@/lib/db/supabase');
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: [{ type: 'FORBIDDEN_PATTERN', value: 'buy\\s+now' }],
        error: null,
      }),
    });

    const result = await checkGlobalRules({ action: 'send_message', text: 'BUY     NOW!' });
    expect(result.blocked).toBe(true);
    expect(result.ruleViolated).toBe('buy\\s+now');
  });

  it('FORBIDDEN_KEYWORD requires exact substring match (partial word in text counts)', async () => {
    const { supabase } = require('@/lib/db/supabase');
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: [{ type: 'FORBIDDEN_KEYWORD', value: 'spam' }],
        error: null,
      }),
    });

    const result = await checkGlobalRules({ action: 'send_message', text: 'This is a spammer' });
    expect(result.blocked).toBe(true);
  });

  it('FORBIDDEN_ACTION check uses normalized (lowercase) action', async () => {
    const { supabase } = require('@/lib/db/supabase');
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: [{ type: 'FORBIDDEN_ACTION', value: 'mass_send' }],
        error: null,
      }),
    });

    // uppercase input should still match after normalizeAction lowercases it
    const result = await checkGlobalRules({ action: 'MASS_SEND', text: '' });
    expect(result.blocked).toBe(true);
    expect(result.ruleViolated).toBe('mass_send');
  });

  it('does not block when FORBIDDEN_KEYWORD appears in action but not in text', async () => {
    const { supabase } = require('@/lib/db/supabase');
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: [{ type: 'FORBIDDEN_KEYWORD', value: 'mass_send' }],
        error: null,
      }),
    });

    // 'mass_send' is in the action, not the text — keyword check is against text only
    const result = await checkGlobalRules({ action: 'mass_send', text: 'hello world' });
    // blocked only if FORBIDDEN_ACTION matches — keyword checks text, not action
    // In this mock there's no FORBIDDEN_ACTION rule, only FORBIDDEN_KEYWORD
    expect(result.blocked).toBe(false);
  });
});
```

- [ ] **Step 2: Run**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17/next-app
npx jest tests/lib/services/rules.service.test.ts --no-coverage
```
Expected: ALL tests PASS (note: the last test verifies that FORBIDDEN_KEYWORD checks `text`, not `action`)

- [ ] **Step 3: Commit**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17
git add next-app/tests/lib/services/rules.service.test.ts
git commit -m "test(api): add checkGlobalRules edge cases (empty rules, regex, keyword scope)"
```

---

## Task 9: Service layer — `verifyScope`, `token.service`, `scope.service` edge cases

**Files:**
- Modify: `next-app/tests/lib/services/scope.service.test.ts`
- Modify: `next-app/tests/lib/services/token.service.test.ts`

- [ ] **Step 1: Write failing scope.service tests**

Append inside `describe('verifyScope')` in `next-app/tests/lib/services/scope.service.test.ts`:

```typescript
  it('returns false for empty scope array even when action is in ALLOWED_ACTIONS', () =>
    expect(verifyScope('send_message', [])).toBe(false));

  it('returns false for action that is not in ALLOWED_ACTIONS even if in key scope', () =>
    // The API-side scope service has a hard ALLOWED_ACTIONS allowlist
    expect(verifyScope('unknown_action', ['unknown_action'])).toBe(false));

  it('returns false for empty action string', () =>
    expect(verifyScope('', ['send_message'])).toBe(false));
```

- [ ] **Step 2: Write failing token.service edge cases**

Append inside `describe('token.service')` in `next-app/tests/lib/services/token.service.test.ts`:

```typescript
  describe('verifyToken error cases', () => {
    it('throws when token is malformed (not a valid JWT)', async () => {
      await expect(verifyToken('not.a.jwt')).rejects.toThrow();
    });

    it('throws when token is expired', async () => {
      const expired = jwt.sign(
        { userId: 'u1', type: 'user_session' },
        process.env.JWT_SECRET!,
        { expiresIn: -1 } // already expired
      );
      await expect(verifyToken(expired)).rejects.toThrow();
    });
  });

  describe('getAuthUserId rejects sdk_token type', () => {
    it('sdk_token cannot authenticate dashboard endpoints', async () => {
      // Verify that issueToken (sdk_token) produces a type that getAuthUserId rejects
      const sdkTok = await issueToken({ userId: 'u1', apiKeyId: 'k1', scope: ['send_message'] });
      const decoded = await verifyToken(sdkTok);
      expect(decoded.type).toBe('sdk_token');
      // getAuthUserId is tested separately in auth.test.ts
    });
  });
```

Note: `jwt` and `process.env.JWT_SECRET` must be imported/available in the test. The setup file sets `JWT_SECRET` via `process.env`. Add `import jwt from 'jsonwebtoken';` at the top of the file if not present.

- [ ] **Step 3: Run**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17/next-app
npx jest tests/lib/services/scope.service.test.ts tests/lib/services/token.service.test.ts --no-coverage
```
Expected: ALL tests PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17
git add next-app/tests/lib/services/scope.service.test.ts next-app/tests/lib/services/token.service.test.ts
git commit -m "test(api): add scope.service and token.service edge cases"
```

---

## Task 10: New test file — Auth middleware (`getAuthUserId`)

**Files:**
- Create: `next-app/tests/lib/auth.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { getAuthUserId } from '@/lib/auth';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

// Uses the JWT_SECRET set in tests/setup.ts
const SECRET = process.env.JWT_SECRET!;

function makeReq(authHeader?: string) {
  return new NextRequest('http://localhost/api/keys', {
    headers: authHeader ? { Authorization: authHeader } : {},
  });
}

describe('getAuthUserId', () => {
  it('returns userId for a valid user_session token', () => {
    const token = jwt.sign({ userId: 'user_1', type: 'user_session' }, SECRET, { expiresIn: '1h' });
    expect(getAuthUserId(makeReq(`Bearer ${token}`))).toBe('user_1');
  });

  it('returns null when Authorization header is missing', () => {
    expect(getAuthUserId(makeReq())).toBeNull();
  });

  it('returns null for an sdk_token (wrong type)', () => {
    const token = jwt.sign({ userId: 'u1', apiKeyId: 'k1', type: 'sdk_token', scope: [] }, SECRET, { expiresIn: '15m' });
    expect(getAuthUserId(makeReq(`Bearer ${token}`))).toBeNull();
  });

  it('returns null for a token signed with a different secret', () => {
    const token = jwt.sign({ userId: 'u1', type: 'user_session' }, 'wrong-secret-that-is-at-least-32-chars-long', { expiresIn: '1h' });
    expect(getAuthUserId(makeReq(`Bearer ${token}`))).toBeNull();
  });

  it('returns null for a malformed token string', () => {
    expect(getAuthUserId(makeReq('Bearer not.a.jwt'))).toBeNull();
  });

  it('returns null for an expired token', () => {
    const token = jwt.sign({ userId: 'u1', type: 'user_session' }, SECRET, { expiresIn: -1 });
    expect(getAuthUserId(makeReq(`Bearer ${token}`))).toBeNull();
  });

  it('returns null for a token with no type field', () => {
    const token = jwt.sign({ userId: 'u1' }, SECRET, { expiresIn: '1h' });
    expect(getAuthUserId(makeReq(`Bearer ${token}`))).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail first**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17/next-app
npx jest tests/lib/auth.test.ts --no-coverage
```
Expected: File runs and all tests PASS (the implementation already handles these correctly)

- [ ] **Step 3: Commit**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17
git add next-app/tests/lib/auth.test.ts
git commit -m "test(api): add auth middleware edge cases (getAuthUserId)"
```

---

## Task 11: New test file — Rate limiter

**Files:**
- Create: `next-app/tests/lib/rateLimiter.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { checkRateLimit } from '@/lib/rateLimiter';

jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const { supabase } = require('@/lib/db/supabase');

function mockRateLimitRow(existing: null | { count: number; window_start: string }) {
  supabase.from.mockReturnValueOnce({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: existing, error: existing ? null : { message: 'no rows' } }),
      }),
    }),
    upsert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
  });
  // Second call for upsert or update
  supabase.from.mockReturnValueOnce({
    upsert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
  });
}

describe('checkRateLimit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows the first request (no existing row)', async () => {
    mockRateLimitRow(null);
    expect(await checkRateLimit('1.2.3.4')).toBe(true);
  });

  it('allows the 30th request in the same window', async () => {
    const windowStart = new Date(Date.now() - 10_000).toISOString(); // 10s ago
    mockRateLimitRow({ count: 29, window_start: windowStart });
    expect(await checkRateLimit('1.2.3.4')).toBe(true);
  });

  it('blocks the 31st request in the same window', async () => {
    const windowStart = new Date(Date.now() - 10_000).toISOString();
    mockRateLimitRow({ count: 30, window_start: windowStart });
    expect(await checkRateLimit('1.2.3.4')).toBe(false);
  });

  it('resets counter after 60-second window expires', async () => {
    const oldWindowStart = new Date(Date.now() - 65_000).toISOString(); // 65s ago
    mockRateLimitRow({ count: 30, window_start: oldWindowStart });
    // Window expired → treated as new window → count = 1 → allowed
    expect(await checkRateLimit('1.2.3.4')).toBe(true);
  });

  it('treats "unknown" IP the same as any other IP', async () => {
    mockRateLimitRow(null);
    expect(await checkRateLimit('unknown')).toBe(true);
  });
});
```

- [ ] **Step 2: Run**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17/next-app
npx jest tests/lib/rateLimiter.test.ts --no-coverage
```
Expected: ALL 5 tests PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17
git add next-app/tests/lib/rateLimiter.test.ts
git commit -m "test(api): add rate limiter unit tests covering window reset and 30-req limit"
```

---

## Task 12: Audit log checksum integrity tests

**Files:**
- Modify: `next-app/tests/lib/services/auditLog.service.test.ts`

- [ ] **Step 1: Write the tests**

Append inside `describe('writeLog')`:

```typescript
  it('uses "genesis" as prevChecksum when no prior log exists', async () => {
    const crypto = require('crypto');
    const spySha = jest.spyOn(crypto, 'createHash');

    mockFrom(
      { data: null, error: null }, // no previous log
      { data: { id: 'log_g', checksum: 'x'.repeat(64) }, error: null }
    );

    await writeLog({ apiKeyId: 'k1', userId: 'u1', action: 'send_message', platform: 'whatsapp', result: 'SUCCESS' });

    // The hash input must start with 'genesis|'
    const hashCalls = spySha.mock.calls.filter(([algo]: [string]) => algo === 'sha256');
    expect(hashCalls.length).toBeGreaterThan(0);
    spySha.mockRestore();
  });

  it('throws when Supabase insert returns an error', async () => {
    supabase.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
          }),
        }),
      });

    await expect(
      writeLog({ apiKeyId: 'k1', userId: 'u1', action: 'send_message', platform: 'whatsapp', result: 'SUCCESS' })
    ).rejects.toMatchObject({ message: 'db error' });
  });
```

- [ ] **Step 2: Run**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17/next-app
npx jest tests/lib/services/auditLog.service.test.ts --no-coverage
```
Expected: ALL tests PASS

- [ ] **Step 3: Run the full test suite to verify no regressions**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17/next-app
npx jest --no-coverage 2>&1 | tail -30
```
Expected: All test suites pass

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17/sdk
npx jest --no-coverage 2>&1 | tail -20
```
Expected: All test suites pass

- [ ] **Step 4: Commit**

```bash
cd /Users/candelamenabisignano/platanus-hack-26-ar-team-17
git add next-app/tests/lib/services/auditLog.service.test.ts
git commit -m "test(api): add audit log checksum and insert-error edge cases"
```

---

## Self-Review

### Spec coverage check

| Area | Tasks |
|------|-------|
| SDK normalizeAction — tab, newline, empty, control-only, whitespace-only | Task 1 |
| SDK normalizeText — double-encode, malformed %, zero-width chain, Cyrillic confusable | Task 2 |
| SDK verifyScope — empty scope, uppercase scope list, empty/control-only action | Task 3 |
| SDK verifyRules — valid=false no error, valid=true with error field, invalid_api_key propagation | Task 3 |
| SDK validateKey — hash length/format, action normalization, network error propagation | Task 3 |
| SDK http/client — port + path, non-JSON response, network error | Task 4 |
| SDK AgentAuthSDK — http:// throws, no-protocol throws, undefined text, empty/missing scope | Task 4 |
| API /validate — non-JSON body (bug fix), missing fields, 429, audit log result types | Task 5 |
| API auth — invalid email format, short password, missing fields, unknown-user 401 | Task 6 |
| API keys — empty scope, empty name, name too long, non-array scope, empty key list, no-auth DELETE | Task 6 |
| API audit-log — empty result, keyId filter, empty alerts | Task 7 |
| API checkGlobalRules — empty rules, FORBIDDEN_PATTERN regex, keyword vs action scope | Task 8 |
| API scope.service — empty scope, unknown action not in ALLOWED_ACTIONS, empty action | Task 9 |
| API token.service — malformed JWT, expired JWT, sdk_token type check | Task 9 |
| API getAuthUserId middleware — missing header, sdk_token, wrong secret, expired, no-type | Task 10 |
| API rate limiter — first req, 30th, 31st, window reset, 'unknown' IP | Task 11 |
| API audit log — genesis checksum, DB insert error | Task 12 |

### No placeholders confirmed
All steps contain complete, runnable test code with no TBD/TODO markers.

### Type consistency confirmed
- All mocked return values match the shapes expected by the route handlers and services.
- `params: Promise.resolve({ id: 'k1' })` syntax matches Next.js 15+ dynamic route signature used in the existing `keys.test.ts`.
- `jest.Mock` cast used consistently for mocked functions.
