# Migrating Agents to SDK v2 (HMAC Auth)

This guide covers migrating from the legacy API key flow (`ZERO_API_KEY` + `ZERO_USER_HASH`) to the HMAC-based authentication introduced in SDK v2 (`ZERO_AGENT_ID` + `ZERO_API_SECRET`).

The `/api/validate` endpoint accepts **both** formats simultaneously, so you can migrate agents one at a time without downtime.

---

## What changed

| SDK v1 (legacy) | SDK v2 (HMAC) |
|---|---|
| `ZERO_API_KEY` + `ZERO_USER_HASH` | `ZERO_AGENT_ID` + `ZERO_API_SECRET` |
| API key hash sent on every call | HMAC signature — raw secret never leaves the agent |
| No replay protection | Nonce + 5-minute timestamp window |
| No short-lived token | Server issues a 5-minute JWT on success |

---

## Server setup (one-time, per deployment)

### 1. Generate an encryption key

```bash
openssl rand -hex 32
```

This outputs a 64-character hex string. Add it to `next-app/.env`:

```
ENCRYPTION_KEY=<output from above>
```

This key encrypts every agent's HMAC secret at rest (AES-256-GCM). **Do not rotate it** without re-encrypting all `agents.secret_enc` rows first.

### 2. Run the database migration

In the Supabase SQL editor (or via CLI), run:

```sql
-- next-app/supabase/migrations/001_hmac_auth.sql
ALTER TABLE agents ADD COLUMN IF NOT EXISTS secret_enc    text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS secret_prefix text;

CREATE TABLE IF NOT EXISTS nonces (
  nonce      text        PRIMARY KEY,
  agent_id   uuid        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nonces_expires_at_idx ON nonces(expires_at);
```

Safe to run on an existing database. All statements are idempotent.

---

## Finding your env vars

### ZERO_AGENT_ID

The `agent.id` UUID returned by `POST /api/agents`. It is also visible in the dashboard under the agent's detail page.

If you no longer have it, query Supabase: `SELECT id, name FROM agents WHERE user_id = '<your user id>'`.

### ZERO_API_SECRET

Returned **once** as `apiSecret` in the `POST /api/agents` response body. If you missed it, the plaintext is gone — run the backfill script below to generate a new one.

---

## Backfilling secrets for existing agents

Agents created before the migration have `secret_enc = null` and cannot authenticate with SDK v2. Run this script to generate secrets for them:

```bash
cd next-app
ENCRYPTION_KEY=<your-64-char-hex> npx ts-node scripts/backfill-agent-secrets.ts
```

The script prints a table of `agent_id → apiSecret`. Save this output — the plaintext secret is never stored and cannot be recovered. Each agent operator must update their `ZERO_API_SECRET` env var.

---

## Migration checklist

1. [ ] Add `ENCRYPTION_KEY` to `next-app/.env` (generate with `openssl rand -hex 32`)
2. [ ] Run `001_hmac_auth.sql` in Supabase SQL editor
3. [ ] Run backfill script for existing agents; distribute secrets to operators
4. [ ] Update each agent's env: add `ZERO_AGENT_ID` and `ZERO_API_SECRET`, remove `ZERO_API_KEY` and `ZERO_USER_HASH`
5. [ ] Upgrade SDK package to v2
6. [ ] Verify with a test call — check `audit_logs` for `result = 'SUCCESS'`

---

## Failure scenarios

| Symptom | Cause | Fix |
|---|---|---|
| `{ allowed: false }` with SDK v2 | Agent has `secret_enc = null` (not migrated) | Run the backfill script and set `ZERO_API_SECRET` |
| `{ allowed: false }` immediately | `ENCRYPTION_KEY` not set on server | Add `ENCRYPTION_KEY` to `.env` and restart |
| `{ allowed: false }` with valid-looking signature | Stale timestamp (>5 min clock skew) | Sync the agent host clock with NTP |
| `{ allowed: false }` on first call after restart | Nonce table missing | Run `001_hmac_auth.sql` migration |
| SDK throws `AgentId must be a UUID` | `ZERO_AGENT_ID` is not a valid UUID format | Copy the exact UUID from `POST /api/agents` response or the dashboard |
| `{ allowed: false }` mid-session | 5-minute JWT expired and refresh failed | SDK retries HMAC automatically; ensure the agent host clock is not drifting |
| Old SDK still sending `token` + `hash` | Operator has not migrated to SDK v2 | Legacy path is still active — no immediate breakage; plan migration |
| `ENCRYPTION_KEY` rotated without re-encrypting | `decryptSecret` throws, all agents blocked | Restore old key or re-encrypt all `secret_enc` rows with the new key |
