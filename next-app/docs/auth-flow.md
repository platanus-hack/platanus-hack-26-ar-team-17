# Authentication and Authorization Flow

This document is written for AI coding agents working in this repository. It covers every auth path in the system.

---

## 1. Human User Login Flow

### New user (first login)

1. User visits `/onboard` and submits the registration form (email, password, name).
2. `POST /api/auth/register` hashes the password with bcrypt, inserts into `users` table, issues a `user_session` JWT (7-day TTL), and returns it in an `HttpOnly` cookie.
3. If `DIDIT_API_KEY` is configured, the route also triggers a Didit KYC session (`POST /api/kyc/sessions`) and redirects the user to the Didit verification URL.
4. After Didit finishes verification, it sends a webhook to `POST /api/webhooks/didit`. The webhook handler validates the `x-signature` HMAC-SHA256 header, then updates `users.kyc_status` to `APPROVED` (or `REJECTED`).

### Returning user

1. User submits `POST /api/auth/login` with email + password.
2. Route fetches the user by email, verifies the bcrypt hash, issues a new `user_session` JWT, and sets it as an `HttpOnly` cookie.
3. If the user's `kyc_status` is not `APPROVED`, dashboard routes block access.

### Auth helper

`lib/auth.ts:getAuthUserId(req)` extracts `userId` from the `user_session` JWT in the cookie. It rejects tokens with `type !== 'user_session'` - SDK tokens cannot authenticate dashboard API routes.

---

## 2. Agent Authentication Flow (SDK / HMAC)

This is the flow used by AI agents at runtime. The raw secret never travels the network.

### Setup (one-time, done by a human user)

1. Authenticated user calls `POST /api/agents` with `{ name, platform, scope[] }`.
2. `lib/services/agent.service.ts:createAgent` generates:
   - An `apiSecret` via `generateAgentSecret()` (48 random bytes, base64url-encoded).
   - `secret_enc = encryptSecret(apiSecret, ENCRYPTION_KEY)` stored in `agents.secret_enc` (AES-256-GCM, format: `iv_hex:authTag_hex:ciphertext_hex`).
   - `secret_prefix = apiSecret.slice(0, 8)` stored for display only.
3. The response includes `{ agent, key: { id, plainKey, prefix }, apiSecret }`. The `apiSecret` is shown **once** and never stored in plaintext. The agent operator injects it as `ZERO_API_SECRET` in the agent's environment.

### Per-call authentication (SDK)

The SDK (`sdk/src/pipeline/validateKey.ts`) runs inside the MCP server process, not inside the agent.

```
1. getCachedToken(agentId) — check in-memory JWT cache
   - Cache hit (token valid + not within 30s of expiry): return { allowed: true, token }
   - Cache miss: continue to HMAC auth flow

2. nonce = generateNonce()          // crypto.randomBytes(32).hex — 64-char hex string
3. timestamp = new Date().toISOString()
4. payload = buildPayload(agentId, timestamp, nonce, action, platform)
            // format: "${agentId}|${timestamp}|${nonce}|${action}|${platform}"
5. signature = signPayload(apiSecret, payload)
            // HMAC-SHA256(apiSecret, payload), hex-encoded

6. POST /api/validate {
     agentId, timestamp, nonce, action, platform, signature
   }

7. On success: setCachedToken(agentId, res.token, res.expiresAt)
8. Return { allowed: res.allowed, token: res.token }
```

### Server-side validation (`POST /api/validate`)

```
1. Rate limit check — 30 req/60s per IP (Supabase rate_limits table)
2. Parse + schema validate body (agentId must be a valid UUID)
3. Timestamp check — reject if |now - timestamp| > 5 minutes (CLOCK_SKEW_MS)
4. Fetch agent: SELECT ... FROM agents WHERE id = agentId AND status = 'ACTIVE'
   - Not found or secret_enc is null → BLOCKED_INVALID_KEY, return { allowed: false }
5. Nonce consumption:
   INSERT INTO nonces (nonce, agent_id, expires_at)
   - Postgres error 23505 (unique violation) → replay detected → return { allowed: false }
   - Other DB error → throw
6. Decrypt secret: decryptSecret(agent.secret_enc, ENCRYPTION_KEY) → raw HMAC secret
   - Missing ENCRYPTION_KEY env var → return { allowed: false }
   - Decryption error → return { allowed: false }
7. Recompute HMAC: buildHmacPayload(...) → verifyHmacSignature(secret, payload, signature)
   - Uses crypto.timingSafeEqual to prevent timing attacks
   - Mismatch → BLOCKED_INVALID_KEY, return { allowed: false }
8. Issue JWT: issueToken({ agentId, userId }, '5m') → { token, expiresAt }
9. writeLog({ ..., result: 'SUCCESS' }) — fire-and-forget (void)
10. cleanupExpiredNonces() — fire-and-forget (void)
11. Return { allowed: true, token, expiresAt }
```

---

## 3. Token Types

| Type | Issued by | TTL | Transport | Used for |
|---|---|---|---|---|
| `user_session` | `/api/auth/register`, `/api/auth/login` | 7 days | `HttpOnly` cookie | Dashboard API routes |
| `sdk_token` | `/api/validate` | 5 minutes | In-memory (SDK cache) | Agent calls via SDK |

Both types include a `jti` (JWT ID) for revocation. `sdk_token` tokens cannot authenticate dashboard routes - `getAuthUserId` rejects them.

---

## 4. KYC States

`users.kyc_status` transitions: `PENDING` -> `APPROVED` | `REJECTED`

- Only `APPROVED` users can create agents.
- The Didit webhook (`POST /api/webhooks/didit`) drives status transitions.
- The webhook validates `x-signature: HMAC-SHA256(DIDIT_WEBHOOK_SECRET, raw_body)`.

---

## 5. Nonce Replay Protection

- Nonces are single-use and stored in the `nonces` table with an `expires_at` of `timestamp + 5 minutes`.
- The `nonces.nonce` column has a `PRIMARY KEY` constraint (unique). An INSERT that conflicts returns Postgres error `23505`, which `consumeNonce` interprets as a replay and returns `false`.
- `cleanupExpiredNonces()` deletes rows where `expires_at < now()`. It runs fire-and-forget after each successful validation.

---

## 6. Agent Revocation

- `DELETE /api/agents/[id]` sets `agents.status = 'DISABLED'`.
- All future HMAC validations for that agent return `BLOCKED_INVALID_KEY` because the agent lookup filters `WHERE status = 'ACTIVE'`.
- Existing short-lived JWTs (`sdk_token`, 5-min TTL) expire naturally. There is no active revocation of issued SDK tokens; the window is limited to 5 minutes.

---

## 7. Encryption

HMAC secrets are stored encrypted in `agents.secret_enc` using AES-256-GCM.

- Key source: `ENCRYPTION_KEY` env var (64-char hex = 32 bytes).
- Format: `iv_hex:authTag_hex:ciphertext_hex` (each component hex-encoded).
- Implemented in `lib/utils/crypto.ts:encryptSecret` / `decryptSecret`.

---

## 8. Environment Variables

| Variable | Where | Description |
|---|---|---|
| `ENCRYPTION_KEY` | `next-app/.env` | 32-byte AES-256 key as 64-char hex. Required to create or validate agents. |
| `JWT_SECRET` | `next-app/.env` | Min 32 chars. Signs all JWTs. |
| `JWT_EXPIRES_IN` | `next-app/.env` | Default TTL for `user_session` tokens (e.g. `7d`). SDK tokens always use `5m`. |
| `ZERO_AGENT_ID` | agent `.env` | Agent UUID returned on creation. |
| `ZERO_API_SECRET` | agent `.env` | HMAC signing secret returned on creation (shown once). |
| `DIDIT_API_KEY` | `next-app/.env` | Optional. Required for KYC verification flow. |
| `DIDIT_WEBHOOK_SECRET` | `next-app/.env` | Validates incoming Didit webhook signatures. |
