# zero.

> The identity layer for the agentic internet

<img src="./project-logo.png" alt="zero. logo" width="180" />

**Track:** Future | Platanus Hack 26, Buenos Aires &nbsp;|&nbsp; **Live:** [platanus-hack-26-ar-team-17.vercel.app](https://platanus-hack-26-ar-team-17.vercel.app/)

---

## The Problem

AI agents are acting on real systems: WhatsApp, MCP servers, wallets, CRMs, internal APIs. But the web still treats them as anonymous processes: a loose API key, a bot token, a borrowed `user_id`. When something goes wrong, the trail ends at "the agent did it." That is not enough for a world where agents buy, publish, move sensitive data, and coordinate across services.

## What zero. does

Zero puts a cryptographic license plate on every agent before it touches the real world. One call before every side effect:

```ts
const auth = await zero.run();

if (!auth.allowed) {
  return { ok: false, reason: 'blocked_by_zero' };
}

await performRealAction();
```

- **HMAC-SHA256** signatures with nonce + timestamp (replay-proof, secret never transmitted)
- **Ed25519 challenge-response**: the agent's private key never leaves its runtime.
  The server issues a one-time challenge; the agent signs `challengeId|nonce|agentId` locally
  and sends only the signature. Each challenge expires in 60 seconds and is single-use,
  so replay attacks are impossible.
- **Post-quantum layer (ML-DSA-65)**: Ed25519 is secure against classical computers, but a
  sufficiently powerful quantum computer could break elliptic-curve signatures via Shor's
  algorithm. zero. supports an optional second signature using ML-DSA-65 (formerly Dilithium 3),
  a NIST-standardized lattice-based algorithm resistant to quantum attacks. When
  `ZERO_PRIVATE_KEY_PQC` is set, both signatures are computed and verified independently -
  either one failing blocks the request. This makes zero. ready for a post-quantum future
  without breaking existing integrations.
- **Scope-based authorization** per agent (allowed actions defined at registration)
- **Tamper-evident audit log**: SHA-256 checksum chain across all entries
- **Instant revocation**: disable an agent; all future calls are blocked immediately
- **Rate limiting**: 30 req/60s per IP, backed by Postgres (no Redis required)

---

## Architecture

| Component | What it does | Stack |
|---|---|---|
| **Landing + Onboard** (root) | Marketing page + 7-step KYC identity wizard | Next.js 16, React 19, shadcn/ui, Tailwind v4 |
| **Platform API** (`next-app/`) | REST API: agents, keys, validation, audit log | Next.js 16, Supabase (PostgreSQL), JWT |
| **Agent SDK** (`sdk/`) | `@zero-gate/sdk`, embedded in MCP servers | Node.js 18+, TypeScript, native `crypto` |
| **CLI** (`cli/`) | `@zero-gate/cli`, provision agents from terminal | Node.js, TypeScript |

---

## How It Works

1. **Human registers** on zero. and completes KYC verification (via Didit biometric + document check)
2. **Human creates an agent** (name, platform, scope) and receives credentials once
3. **Credentials are injected** into the agent's environment (`ZERO_AGENT_ID` + `ZERO_API_SECRET`)
4. **Agent reasons** and decides to call an MCP tool
5. **Agent calls the MCP server**
6. **MCP server calls `zero.run()`** before executing any side effect
7. **SDK signs** the request with HMAC-SHA256, POSTs to `/api/validate`
8. **Platform validates:** rate limit → signature verify → nonce replay check → scope check → global rules → audit log
9. **SDK returns** `{ allowed: true, token }` or `{ allowed: false }`
10. **MCP server executes the tool** only if allowed; otherwise rejects

---

## Quick Start

### Try the live platform

Visit [platanus-hack-26-ar-team-17.vercel.app](https://platanus-hack-26-ar-team-17.vercel.app/), register, and create your first agent from the dashboard.

### Install the CLI

```sh
npm install -g https://github.com/platanus-hack/platanus-hack-26-ar-team-17/raw/main/cli/zero-gate-cli-0.1.0.tgz

zero login                    # paste your CLI token from the dashboard
zero agents create my-bot     # creates an agent, prints credentials
zero agents list
```

### Add the SDK to your MCP server

```sh
zero init    # installs @zero-gate/sdk and scaffolds .env.local
```

Or manually:

```sh
npm install @zero-gate/sdk
```

```ts
import { ZeroGateSDK } from '@zero-gate/sdk';

const zero = new ZeroGateSDK();

// Call this inside every MCP tool handler before the side effect:
const { allowed } = await zero.run();
if (!allowed) throw new Error('Unauthorized by zero.');
```

Agent env vars:

```
ZERO_AGENT_ID=<uuid>          # from dashboard or CLI
ZERO_API_SECRET=<secret>           # HMAC mode, shown once at creation
# Ed25519 mode (alternative):
ZERO_PRIVATE_KEY=<64-char hex>        # Ed25519 private key seed
ZERO_PRIVATE_KEY_PQC=<64-char hex>    # ML-DSA-65 key (optional, post-quantum layer)
```

---

## Self-Hosting the Platform API

```bash
cd next-app
cp .env.example .env    # fill in the values below
npm install
npm run dev             # http://localhost:3000
```

Run `next-app/supabase/schema.sql` in your Supabase SQL editor to create the schema.

| Variable | Description |
|---|---|
| `ENCRYPTION_KEY` | 64-char hex AES-256 key: `openssl rand -hex 32` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only) |
| `JWT_SECRET` | Min 32-char secret for signing all JWTs |
| `DIDIT_API_KEY` | Didit KYC integration key |
| `DIDIT_KYC_WORKFLOW_ID` | Didit KYC workflow UUID |
| `SITE_URL` | Public URL of your deployment |
| `DIDIT_MOCK` | Set to any value to skip KYC (dev only) |

---

## API Reference

### Agent validation (called by the SDK, no user auth)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/validate` | HMAC mode: verify signature, issue JWT |
| `POST` | `/api/agent-auth/challenge` | Ed25519 mode: issue one-time challenge |
| `POST` | `/api/agent-auth/verify` | Ed25519 mode: verify signature, issue JWT |

`POST /api/validate` body: `{ agentId, timestamp, nonce, action, platform, signature }`
Response: `{ allowed: true, token, expiresAt }` or `{ allowed: false }`

### Dashboard (requires `user_session` JWT)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login with Google OAuth |
| `POST` | `/api/agents` | Create agent → returns `{ agent, apiSecret }` once |
| `GET` | `/api/agents` | List agents |
| `DELETE` | `/api/agents/[id]` | Disable agent + revoke all its keys |
| `POST` | `/api/keys` | Create additional key for an agent |
| `DELETE` | `/api/keys/[id]` | Revoke key |
| `GET` | `/api/audit-log` | Filterable audit log |
| `GET` | `/api/alerts` | Last 20 blocked-rule events |

---

## Running Tests

```bash
# Platform API
cd next-app && npm test

# Single test file
cd next-app && npx jest tests/integration/hmac-mcp-e2e.test.ts --no-coverage

# SDK
cd sdk && npm test
```

---

## Team

- Martin Pulitano ([@MartinPuli](https://github.com/MartinPuli))
- Candela Mena Bisignano ([@CandelaMenaBisignano07](https://github.com/CandelaMenaBisignano07))
- Julian Stiefkens ([@juop12](https://github.com/juop12))
- Cielo Dahy ([@ununpentio](https://github.com/ununpentio))
