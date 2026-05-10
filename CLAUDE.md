# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code Navigation

Always use the LSP tool for code navigation: go-to-definition, find-references, hover (type info), document symbols, and call hierarchy. Prefer LSP over grep or manual file reading when tracing symbols, understanding call sites, or verifying types.

## Project Overview

**zero.** - "the identity layer for the agentic internet" - Platanus Hack 26, Buenos Aires, team-17.

Three main pieces:

| Directory | What it is |
|---|---|
| Root (`app/`, `components/`) | Marketing landing page + KYC onboarding wizard |
| `next-app/` | Platform API — Next.js App Router API routes backed by Supabase |
| `sdk/` | npm package embedded in third-party MCP servers |

### How the system works (critical — get this right)

```
1. Human registers on zero. → gets a user_session JWT
2. Human creates an API key (name + scope) → gets plainKey once
3. Human injects the plainKey into an AI agent's context/config
4. Agent does its reasoning and decides to call an MCP tool
5. Agent calls the MCP server, passing its API key as part of the call
6. The MCP server (not the agent) runs AgentAuthSDK.run({ apiKey, action, platform, text })
7. SDK hashes the key, calls POST /api/validate on the Platform API
8. Platform API runs: rate limit → key lookup → scope check → global rules → audit log
9. SDK returns { allowed: true } or { allowed: false, error }
10. MCP server executes the tool if allowed, rejects it if not
```

The **SDK runs inside the MCP server**, not inside the agent. The agent is the client of the MCP; it supplies its API key and the MCP enforces authorization before acting on its behalf.

---

## Root — Landing Page + Onboarding

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix UI), `@paper-design/shaders-react`

**Commands (run from repo root):**
```bash
pnpm dev      # or npm run dev
pnpm build
pnpm lint
```

**Pages:**
- `/` — Marketing landing page composed of `Header`, `Hero`, `Features`, `HowItWorks`, `CTA`, `Footer`
- `/onboard` — KYC wizard (`app/components/Onboarding.tsx`)

**Onboarding wizard** (`app/components/Onboarding.tsx`) - 7-step KYC flow, all client-side demo:
1. welcome (identity type: personal / team / machine)
2. email + handle + password
3. phone + OTP
4. document upload (passport, driver license, etc.)
5. face liveness scan
6. bind first agent (name + capability scopes)
7. verified (shows identity DID card)

The wizard has a live status ticker on the right that logs each step, and uses a lime-green / black aesthetic with animated MeshGradient shaders.

**UI library:** shadcn components live in `components/ui/`. The project also has `@paper-design/shaders-react` for the animated gradient backgrounds.

---

## next-app — Platform API

**Stack:** Next.js 16, TypeScript, Supabase (PostgreSQL), `@supabase/supabase-js`, `jsonwebtoken`, `bcryptjs`, `zod`, Jest

> **Note from AGENTS.md:** This is Next.js 16 with breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing code.

**Commands (run from `next-app/`):**
```bash
npm run dev
npm run build
npm test              # jest
```

**Run a single test:**
```bash
cd next-app && npx jest tests/api/validate.test.ts
```

**Required env vars:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY   # server-side only, bypasses RLS
JWT_SECRET                  # min 32 chars
JWT_EXPIRES_IN              # default "15m"
```

**Database:** Supabase (PostgreSQL). Schema is in `next-app/supabase/schema.sql` — run it in the Supabase SQL editor to set up tables. Column names are snake_case.

**Schema tables:** `users`, `agents`, `api_keys`, `audit_logs`, `global_rules`, `revoked_tokens`, `rate_limits`

**Agents are a first-class entity** (critical): API keys belong to agents, not directly to users. An agent has `name`, `platform`, `scope[]`, and `status` (ACTIVE/DISABLED). `api_keys.agent_id → agents.id → users.id`. Scope lives on the agent, not the key. When an agent is disabled, all its keys are automatically revoked.

**Supabase client** (`lib/db/supabase.ts`): uses the service-role key server-side, bypassing RLS. Never expose this key to the browser.

**API routes** (`app/api/`):
- `POST /api/auth/register` — create user + return `user_session` JWT
- `POST /api/auth/login` — verify password + return `user_session` JWT
- `GET  /api/agents` — list agents for authenticated user
- `POST /api/agents` — create agent (name, platform, scope[]) + auto-creates a default API key; returns `{ agent, key: { id, plainKey, prefix } }`
- `DELETE /api/agents/[id]` — disable agent + revoke all its active keys
- `GET  /api/keys?agent_id=` — list keys (optionally filtered by agent, ownership enforced via join)
- `POST /api/keys` — create additional key for an agent (`{ agent_id, name }`); returns `{ id, plainKey, prefix }`
- `DELETE /api/keys/[id]` — revoke key (auth required)
- `GET  /api/audit-log` — filterable log (agentId, platform, from, to, result, page) (auth required)
- `GET  /api/alerts` — last 20 `BLOCKED_RULE` entries (auth required)
- `POST /api/validate` — **main endpoint called by the SDK** — no user auth; rate-limited by IP

**Auth helper** (`lib/auth.ts`): `getAuthUserId(req)` extracts `userId` from a `user_session` JWT. SDK tokens (`type: sdk_token`) are rejected here — they cannot authenticate dashboard routes.

**Validation pipeline** (`app/api/validate/route.ts`):
1. Rate-limit check by IP via Supabase `rate_limits` table (30 req/60s sliding window)
2. `validateApiKeyHash` — look up SHA-256 hash in `api_keys`, join through `agents` to get `user_id`/`scope`; reject if key REVOKED or agent DISABLED
3. `issueToken` — emit JWT with `jti` + `type: sdk_token`
4. `isTokenRevoked` — check `revoked_tokens` table
5. `verifyScope` — action must be in agent's scope AND in `ALLOWED_ACTIONS` enum
6. `checkGlobalRules` — check `global_rules` table (FORBIDDEN_ACTION, FORBIDDEN_KEYWORD, FORBIDDEN_PATTERN)
7. `writeLog` — append to `audit_logs` with `agentId`, `apiKeyId`, `userId`, `userInput`, and SHA-256 checksum chain

Success response includes `{ valid: true, token, agentId, userId, scope }`. All FK fields in `audit_logs` are nullable to allow logging BLOCKED_INVALID_KEY events that have no real agent/key/user.

**Test setup** (`tests/setup.ts`): sets hardcoded test env vars including a real Supabase URL/key (used in unit tests with mocked Supabase).

**JWT token types:**
- `sdk_token` — issued by `/api/validate`, short-lived, for SDK callers
- `user_session` — issued by auth routes, 7-day TTL, for dashboard routes

---

## sdk — Agent Auth SDK

**Stack:** Node.js 18+, TypeScript, native `https` module (no external HTTP deps), `zod`, Jest

**Commands (run from `sdk/`):**
```bash
npm test
npm run build    # tsc → dist/
```

**Run a single test:**
```bash
cd sdk && npx jest tests/pipeline/validateKey.test.ts
```

**Entry point:** `src/index.ts` — exports `AgentAuthSDK` class.

**Usage:**
```ts
const sdk = new AgentAuthSDK({ platformApiUrl: 'https://...' });
const result = await sdk.run({ apiKey, action, platform, text });
// result: { allowed: boolean, token?, userId?, error? }
```

**Pipeline** (inside `sdk.run`):
1. Hash API key with SHA-256, normalize action/text, POST to `/api/validate`
2. If API response `valid: false` → return `{ allowed: false }`
3. Verify scope locally against returned `scope[]`
4. Delegate rule check to API response (trust Platform API)
5. Return `{ allowed: true, token, userId }`

**TLS enforcement:** `src/http/client.ts` uses native `https` with `rejectUnauthorized: true`. Constructor throws if `platformApiUrl` doesn't start with `https://`. Non-HTTPS URLs throw at call time.

---

## Schema / Code Divergence Warning

The root `app/api/` and `supabase/schema.sql` are a **stale copy** of the old backend (before the agents refactor). They have no `agents` table; `api_keys` references `user_id` directly. Do not modify the root API routes — treat `next-app/` as the canonical backend.

---

## Cross-Cutting

**Normalization** (identical in both `next-app/lib/utils/normalize.ts` and `sdk/src/normalize/`):
- `normalizeAction`: strip control chars `[\x00-\x1F\x7F]`, trim, lowercase
- `normalizeText`: URL-decode, NFKC normalize, remove zero-width chars

This prevents homoglyph and Unicode obfuscation from bypassing scope or rule checks.

**API key format:** `ak_` prefix + 32 random bytes base64url-encoded. Only the first 11 chars (`ak_` + 8) are stored as `prefix` for display. The plain key is returned only once on creation; only its SHA-256 hash is stored.

**Audit log integrity:** Each entry includes `prev_checksum` (hash of the previous entry's fields), forming a tamper-evident chain. The genesis entry uses `"genesis"` as the starting prev value.

**Rate limiting:** Supabase `rate_limits` table, 30 req/60s sliding window per IP. No Redis.

**JWT revocation:** Supabase `revoked_tokens` table keyed by `jti`. No Redis.
