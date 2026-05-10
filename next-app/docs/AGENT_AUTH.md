# Agent Authentication - Ed25519 Challenge-Response

AI agents authenticate to the zero. platform using Ed25519 asymmetric cryptography.
Instead of sending a long-lived API key, an agent proves identity by signing a
one-time challenge with its private key. The backend issues a short-lived JWT session
token in return.

## Architecture

```
Agent Runtime              Zero SDK               Zero Backend
     |                        |                        |
     |  action request        |                        |
     |----------------------->|                        |
     |                        |  POST /agent-auth/challenge
     |                        |----------------------->|
     |                        |  { challengeId, nonce, expiresAt }
     |                        |<-----------------------|
     |  sign(nonce|challengeId|agentId)                |
     |<-----------------------|                        |
     |  signature             |                        |
     |----------------------->|                        |
     |                        |  POST /agent-auth/verify
     |                        |  { agentId, challengeId, signature }
     |                        |----------------------->|
     |                        |  { accessToken, receipt }
     |                        |<-----------------------|
     |                        |  (caches JWT for 5 min)|
     |  allowed               |                        |
     |<-----------------------|                        |
```

## Security Properties

- **Private key never leaves the agent runtime** - the SDK only receives a signature
- **Replay prevention** - each challenge is single-use with a 60-second TTL
- **Short-lived sessions** - JWTs expire after 5 minutes
- **Tamper-evident audit log** - each log entry chains SHA-256 checksums to the previous
- **Signed receipts** - the backend returns a signed JWT receipt for each successful auth
- **Revocation** - agents can be disabled instantly; new challenges will be refused

## Key Generation

Generate an Ed25519 keypair in Node.js:

```js
const { generateKeyPairSync } = require('crypto');

const { publicKey, privateKey } = generateKeyPairSync('ed25519');

// Export raw 32-byte public key as hex (send to /api/agents/register)
const pubDer = publicKey.export({ type: 'spki', format: 'der' });
const pubHex = pubDer.slice(12).toString('hex');
console.log('publicKey:', pubHex);

// Export raw 32-byte private key as hex (keep secret - never share)
const privDer = privateKey.export({ type: 'pkcs8', format: 'der' });
const privHex = privDer.slice(16).toString('hex');
console.log('privateKey:', privHex);
```

## API Endpoints

### POST /api/agents/register

Register a new agent with its Ed25519 public key. Requires a user session JWT.

```bash
curl -X POST https://your-app.vercel.app/api/agents/register \
  -H "Authorization: Bearer <user-session-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-mcp-agent",
    "platform": "mcp",
    "publicKey": "<64-char hex public key>"
  }'
```

Response:
```json
{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "did": "did:zero:550e8400-e29b-41d4-a716-446655440000"
}
```

---

### POST /api/agent-auth/challenge

Request a one-time challenge. Called by the SDK before each authentication.

```bash
curl -X POST https://your-app.vercel.app/api/agent-auth/challenge \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "550e8400-e29b-41d4-a716-446655440000",
    "requestedAction": "send_message",
    "platform": "mcp"
  }'
```

Response:
```json
{
  "challengeId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "nonce": "a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "expiresAt": "2024-01-15T10:31:00.000Z"
}
```

---

### POST /api/agent-auth/verify

Submit a signed challenge to receive a session JWT. Called by the SDK after the agent signs.

The signature covers the payload: `<challengeId>|<nonce>|<agentId>`

```bash
curl -X POST https://your-app.vercel.app/api/agent-auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "550e8400-e29b-41d4-a716-446655440000",
    "challengeId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "signature": "<128-char hex Ed25519 signature>"
  }'
```

Response:
```json
{
  "accessToken": "<5-minute JWT>",
  "expiresAt": "2024-01-15T10:35:00.000Z",
  "receipt": "<1-hour JWT receipt proving this auth event>"
}
```

Error codes:
- `404 challenge_not_found` - unknown challengeId
- `401 challenge_already_used` - replay attempt
- `401 challenge_expired` - challenge TTL exceeded
- `403 agent_revoked` - agent has been disabled
- `401 invalid_signature` - signature verification failed

---

### POST /api/agents/revoke

Disable an agent immediately. Requires a user session JWT (owner only).

```bash
curl -X POST https://your-app.vercel.app/api/agents/revoke \
  -H "Authorization: Bearer <user-session-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

Response:
```json
{
  "revoked": true,
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "revokedAt": "2024-01-15T10:32:00.000Z"
}
```

After revocation:
- New challenge requests return `403 agent_revoked`
- All API keys for the agent are revoked
- Existing JWTs expire within their remaining lifetime (max 5 min)

---

## SDK Usage

```typescript
import { ZeroGateSDK } from '@zero-gate/sdk';

const sdk = new ZeroGateSDK({
  agentId: process.env.ZERO_AGENT_ID,
  privateKey: process.env.ZERO_PRIVATE_KEY, // 64-char hex, 32 raw bytes
});

const result = await sdk.run();
// result.allowed === true
// result.token   - the session JWT
// result.receipt - signed proof of authentication (optional, present on fresh auth)

// On subsequent calls within 5 min, the SDK serves the cached JWT without
// making any network requests.
```

Environment variables accepted by the SDK:
- `ZERO_AGENT_ID` - agent UUID from /api/agents/register
- `ZERO_PRIVATE_KEY` - 64-char hex private key seed

## Receipt Verification

Decode the receipt JWT to inspect the auth event:

```js
const jwt = require('jsonwebtoken');
const decoded = jwt.decode(result.receipt);
// {
//   type: 'auth_receipt',
//   receiptId: '...',
//   agentId: '...',
//   action: 'agent_auth',
//   platform: 'mcp',
//   result: 'AUTH_SUCCESS',
//   timestamp: '...',
//   iat: ...,
//   exp: ...
// }
```

The receipt is signed with the server's JWT secret and expires after 1 hour.
Use `jwt.verify(receipt, JWT_SECRET)` server-side to confirm authenticity.
