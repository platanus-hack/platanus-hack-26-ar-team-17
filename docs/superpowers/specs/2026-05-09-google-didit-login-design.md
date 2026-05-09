# Google + Didit Biometric Login — Design (revised)

**Date:** 2026-05-09
**Supersedes:** `2026-05-09-google-face-login-design.md` (face-api.js approach)
**Status:** Approved

## Why this version supersedes the previous one

The previous design used `face-api.js` in the browser to extract a 128-d descriptor and compared it server-side. That approach has no liveness detection (printed photo defeats it), worse accuracy, manually-typed DNI, and ~6 MB of model weights to ship. Didit already runs as a service and has a dedicated **Biometric Authentication** workflow built for exactly this use case: re-authenticate a returning user with a live selfie + liveness check, matched against the template captured during their initial KYC. It's also already configured in the project's `.env` files.

## Goals

- Users sign in with Google. No passwords.
- First-time users complete a Didit **KYC** verification (DNI scan + selfie + liveness). The DNI and identity data come from the verified document.
- Returning users complete a Didit **Biometric Authentication** verification on every login (live selfie + liveness, matched 1:1 against their KYC template).
- Each user has DNI, full name, email, picture, and Google sub on a `profiles` row plus a Didit verification reference.
- Existing JWT-based protections on `/api/keys`, `/api/audit-log`, etc. continue to work.

## Non-Goals

- In-browser face matching (face-api.js). Removed.
- DNI typed by the user. Replaced by document-extracted DNI.
- Step-up biometric checks for individual sensitive actions.
- Production-grade biometric data retention / consent UX.
- E2E browser tests against real Google + Didit (smoke test only).

## Architecture

```
REGISTER:
  Browser: "Sign up with Google"
  → Supabase OAuth (Google) — returns access token in browser
  → POST /api/auth/register { supabase_access_token }
  → Server creates a Didit KYC session
      (POST /v3/sessions/ with workflow_id=KYC, vendor_data=auth_user_id, callback=...)
  → Server returns the Didit verification_url
  → Browser redirects to Didit hosted page
  → User completes DNI + selfie + liveness on Didit
  → Didit fires webhook → /api/didit/webhook
      → server creates `profiles` row from KYC result
  → Didit redirects user back to /auth/didit-callback?session_id=...
      → server polls Didit retrieve API to confirm "Approved"
      → if approved: issue app JWT, set HttpOnly cookie, redirect to /dashboard
      → otherwise: error page

LOGIN:
  Browser: "Sign in with Google"
  → Supabase OAuth → access token
  → POST /api/auth/login { supabase_access_token }
  → Server checks `profiles` exists; if not → 404 not_registered
  → Server creates a Didit Biometric Authentication session
      (workflow_id=BIOMETRIC, vendor_data=auth_user_id, callback=...)
  → Server returns verification_url
  → Browser redirects to Didit
  → User does selfie + liveness; Didit matches against prior KYC template (linked via vendor_data)
  → Webhook fires
  → User redirected to /auth/didit-callback
      → if approved: app JWT cookie + /dashboard
      → if mismatch: error

LOGOUT:
  DELETE /api/auth/login → revoke jti, clear cookie, supabase.auth.signOut()
```

### Key architectural choices

- **Two Didit workflows**, configured in the Didit dashboard, identified by separate IDs in env: `DIDIT_KYC_WORKFLOW_ID` and `DIDIT_BIOMETRIC_WORKFLOW_ID`.
- **`vendor_data` is `auth.users.id`**. This is what links the biometric auth attempt to the user's stored KYC template.
- **Webhook is the source of truth.** It writes the profile / records the verification result. The user-facing callback (`/auth/didit-callback`) double-checks via the retrieve API before issuing the cookie — handles the case where Didit redirects faster than the webhook arrives.
- **Same JWT/cookie flow as before.** `issueUserToken` (with `jti`) issues the cookie. Existing protected routes unchanged.
- **No browser-side ML.** No face-api.js, no model weights, no descriptor storage.
- **DNI is verified, not typed.** It comes from Didit's parsed document fields.

## Data Model

```sql
drop table if exists users cascade;

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  email text not null,
  google_sub text unique,
  full_name text,
  picture_url text,
  dni text not null,
  didit_kyc_session_id text not null,        -- the Didit session_id of the original KYC
  verification_status text not null default 'PENDING',  -- PENDING | APPROVED | REJECTED
  enrolled_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

- `face_descriptor` removed. We don't store biometric vectors anymore — Didit holds the template.
- `didit_kyc_session_id` is what we reference if we ever need to re-pull the verification details.
- `verification_status` exists primarily for the small window between webhook receipt and user return; for v1 we always insert as `APPROVED` once the webhook arrives with that decision.

## API

All routes under `app/api/`.

### `POST /api/auth/register`

Body: `{ supabase_access_token: string }`

1. Verify Supabase token; reject if not Google provider.
2. If a profile already exists for this `auth_user.id` → `409 already_registered`.
3. Call `Didit.createSession(workflow_id=DIDIT_KYC_WORKFLOW_ID, vendor_data=auth_user.id, callback=<site>/auth/didit-callback?intent=register)`.
4. Persist a placeholder row in `profiles` with `verification_status='PENDING'` and the new Didit `session_id` (so the webhook can resolve it). DNI and identity fields stay empty until the webhook fills them in.
5. Return `{ verification_url, session_id }`. Frontend redirects.

### `POST /api/auth/login`

Body: `{ supabase_access_token: string }`

1. Rate-limit by IP.
2. Verify Supabase token.
3. Look up profile by `auth_user.id`. Missing → `404 not_registered`. Status not `APPROVED` → `409 verification_pending`.
4. Call `Didit.createSession(workflow_id=DIDIT_BIOMETRIC_WORKFLOW_ID, vendor_data=auth_user.id, callback=<site>/auth/didit-callback?intent=login)`.
5. Return `{ verification_url, session_id }`. Frontend redirects.

### `DELETE /api/auth/login`

Same as before. Reads `app_session` cookie, revokes its jti, clears cookie.

### `POST /api/didit/webhook`

Body: Didit webhook payload. Headers carry an HMAC signature.

1. Verify HMAC against `DIDIT_WEBHOOK_SECRET`. Mismatch → `401`.
2. Parse `session_id`, `vendor_data`, `workflow_id`, decision (`Approved` / `Declined` / etc.), and (for KYC) the document fields (`dni`, `full_name`, `nationality`, `date_of_birth`).
3. Branch on workflow:
   - **KYC workflow** → update the placeholder `profiles` row (matched by `user_id = vendor_data`): set `dni`, `full_name`, `verification_status` per decision, plus `email`, `google_sub`, `picture_url` derived from the user's Supabase metadata (looked up via `supabase.auth.admin.getUserById(vendor_data)`).
   - **Biometric workflow** → mark a transient login record approved/rejected. Cheapest impl: store `(session_id, vendor_data, decision)` in a `didit_login_attempts` table. The callback page reads it.
4. Return `200 { ok: true }`.

### `GET /auth/didit-callback?session_id=…&intent=register|login`

Page (server component):

1. Look up the result. Two sources, in order:
   - Local DB (`profiles` for register, `didit_login_attempts` for login).
   - If still missing/pending: call Didit retrieve API (`GET /v3/sessions/{session_id}`) and compare.
2. If `APPROVED`: issue app JWT (`issueUserToken(user_id)`), set HttpOnly cookie, redirect to `/dashboard`.
3. If `DECLINED` or `mismatched`: render an error message with a "Try again" link.
4. If still `PENDING` (webhook not yet arrived): poll up to ~10 seconds with backoff; then show "Verification taking longer than expected" and a refresh link.

### Removed routes

`app/api/auth/login/route.ts` (old email/password) and the previous Google+face version both already replaced.

### Error codes

`invalid_request`, `invalid_token`, `not_registered`, `already_registered`, `verification_pending`, `verification_failed`, `rate_limit_exceeded`.

## New table: `didit_login_attempts`

```sql
create table didit_login_attempts (
  session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  decision text not null default 'PENDING',
  created_at timestamptz default now(),
  decided_at timestamptz
);
create index on didit_login_attempts(user_id);
```

A login starts a row with `PENDING`. Webhook updates it. Callback reads it. Cleanup of old rows is a future concern.

## Frontend

### Pages
| Path | Purpose |
|------|---------|
| `app/login/page.tsx` | Google sign-in button → on session, POST `/api/auth/login` → redirect to `verification_url` |
| `app/register/page.tsx` | Google sign-in button → on session, POST `/api/auth/register` → redirect to `verification_url` |
| `app/auth/didit-callback/page.tsx` | Reads `?session_id=&intent=…`, finalizes the flow (cookie issuance + redirect, or error) |
| `app/dashboard/page.tsx` | Stub destination + sign-out button |
| `app/page.tsx` | Links to /login and /register |

### Removed components / files
- `lib/services/faceMatch.service.ts` and tests
- `face-api.js` dependency
- `lib/client/faceApi.ts`
- `components/WebcamCapture.tsx`
- `public/models/*` (none were downloaded — work paused before T12)

### New module
- `lib/services/didit.service.ts` — `createSession()`, `getSession()`, `verifyWebhookSignature()`.

## Security & Privacy

- HMAC verification on every webhook (`DIDIT_WEBHOOK_SECRET`).
- HttpOnly + Secure + SameSite=Strict cookie unchanged.
- Rate-limit on `/api/auth/login`.
- Generic error codes; never leak whether a Google account exists.
- We don't store any biometric vectors / images. Didit holds the template.
- DNI is verified-from-document, not user-typed.

## Environment

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
JWT_EXPIRES_IN=15m

DIDIT_API_KEY=...
DIDIT_API_URL=https://verification.didit.me
DIDIT_KYC_WORKFLOW_ID=...
DIDIT_BIOMETRIC_WORKFLOW_ID=...
DIDIT_WEBHOOK_SECRET=...
SITE_URL=http://localhost:3000
```

Supabase dashboard: enable Google provider, redirect URLs include `/login` and `/register`.

Didit dashboard: create two workflows (KYC and Biometric Authentication), copy their IDs into env. Webhook URL: `${SITE_URL}/api/didit/webhook`.

## Testing

### Unit
- `tests/lib/services/didit.test.ts` — `createSession` builds the right body and headers; `verifyWebhookSignature` accepts good signatures and rejects bad ones; `getSession` parses results.
- `tests/lib/services/profile.test.ts` — updated for new fields.
- `tests/lib/auth.test.ts` — unchanged (cookie path).
- `tests/lib/services/faceMatch.test.ts` — deleted.

### API
- `tests/api/auth/register.test.ts` — happy path returns `{verification_url}`; existing profile → 409; bad token → 401.
- `tests/api/auth/login.test.ts` — happy path returns `{verification_url}`; not registered → 404; pending status → 409; rate limited → 429.
- `tests/api/auth/logout.test.ts` — unchanged.
- `tests/api/didit/webhook.test.ts` — bad signature → 401; KYC approved → profile written; KYC declined → status REJECTED; biometric approved → login attempt updated.
- `tests/api/auth/didit-callback.test.ts` — only added if it's a route handler. The page-component variant is verified manually.

### Mocks
- `Didit.createSession`, `Didit.getSession`, `Didit.verifyWebhookSignature` mocked per test.
- `supabase.auth.getUser` and `supabase.auth.admin.getUserById` mocked.

### Out of scope
E2E with Playwright + real Didit + real Google.

## Migration & Rollout

Hackathon scope. Apply the schema, set Didit env vars, manually smoke-test register → login → logout end-to-end.

## Open Questions

None blocking. Practical question for execution: confirm the team has set up two Didit workflows in their dashboard and copied the IDs; this is a manual step the executor cannot do.
