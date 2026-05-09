# Google + Face Recognition Login — Design

**Date:** 2026-05-09
**Status:** Approved (pending spec review)
**Owner:** team-17

## Problem

Replace the existing email/password authentication with Google OAuth gated by a face-recognition step on every login. Capture user identity data (DNI plus Google profile fields) at registration so it can be referenced from any user-scoped resource in the system.

## Goals

- Users sign in with Google. No passwords.
- Every login requires both a valid Google session and a successful face match against a stored reference.
- Each user has DNI, full name, email, picture, and Google sub stored on a profile row.
- Existing JWT-based protections on `/api/keys`, `/api/audit-log`, etc. continue to work without changes to those routes.
- API key flow (`/api/validate`) is unaffected.

## Non-Goals

- Liveness detection (a printed photo can defeat v1; documented limitation).
- DNI document scan / verification — DNI is user-typed text in v1.
- Step-up face check on individual sensitive actions — face check is at login only.
- Compliance hardening for production biometric data handling — out of scope for hackathon.
- End-to-end browser tests against real Google + webcam.

## Architecture

```
REGISTER:
  [Google OAuth via Supabase] → [Form: DNI + selfie capture]
  → POST /api/auth/register {supabase_token, dni, face_descriptor}
  → Backend verifies Supabase token, inserts profile row,
    sets HttpOnly cookie containing app JWT, returns {userId}.

LOGIN:
  [Google OAuth via Supabase] → [Selfie capture only]
  → POST /api/auth/login {supabase_token, face_descriptor}
  → Backend verifies token, compares descriptor with stored,
    sets HttpOnly cookie, returns {userId, profile}.

LOGOUT:
  → DELETE /api/auth/login
  → Backend revokes JWT (jti added to revoked_tokens),
    clears cookie, client also calls supabase.auth.signOut().
```

### Architectural choices

- **Supabase Auth handles Google OAuth.** The app never touches OAuth tokens directly. The Supabase session is used as proof "this Google account belongs to this user" and is then exchanged (after face match) for the app's own JWT.
- **face-api.js runs in the browser.** The server stores and compares 128-float descriptors only — never raw selfie images.
- **Existing custom JWT (`issueUserToken`) preserved.** It is issued only after the face check passes. Downstream protected routes (`/api/keys`, `/api/audit-log`, `/api/alerts`) are unchanged.
- **JWT delivery via HttpOnly cookie** (`Set-Cookie: app_session=…; HttpOnly; Secure; SameSite=Strict; Path=/`). `lib/auth.ts` is extended to accept the cookie in addition to the existing `Authorization: Bearer` header.
- **Existing `users` table is dropped.** `api_keys` and `audit_logs` are migrated to reference `auth.users(id)` directly.

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
  face_descriptor jsonb not null,
  enrolled_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on profiles(user_id);

alter table api_keys
  drop constraint api_keys_user_id_fkey,
  add constraint api_keys_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
```

- `face_descriptor` is `jsonb` storing a 128-element float array. No `pgvector` dependency. Server-side comparison.
- `dni` is plain text. Not validated against a document.
- `email`, `full_name`, `picture_url`, `google_sub` are copied from Supabase `auth.users.user_metadata` at registration so user-facing reads do not require crossing the `auth` schema.
- `audit_logs.user_id` is already `text`; no change.

## API

All routes live under `app/api/auth/`.

### `POST /api/auth/register`

Body:
```ts
{ supabase_access_token: string, dni: string, face_descriptor: number[] }
```

Logic:
1. Call `supabase.auth.getUser(supabase_access_token)`. Reject on error → `401 invalid_token`.
2. Reject if `user.app_metadata.provider !== 'google'` → `401 invalid_token`.
3. Reject if a profile row already exists for `user.id` → `409 already_registered`.
4. Validate `dni` non-empty and `face_descriptor` is a 128-length array of finite numbers, not all zero/equal → else `400 invalid_request`.
5. Insert into `profiles` with fields copied from Supabase user metadata plus `dni` and `face_descriptor`.
6. Issue app JWT via existing `issueUserToken(user.id)`.
7. Set HttpOnly cookie + return `{ userId }`.

### `POST /api/auth/login`

Body:
```ts
{ supabase_access_token: string, face_descriptor: number[] }
```

Logic:
1. Rate limit by IP via existing `checkRateLimit`. Exceeded → `429 rate_limit_exceeded`.
2. Validate `face_descriptor` shape (length 128, finite numbers, not degenerate) → else `400 invalid_request`.
3. `supabase.auth.getUser(supabase_access_token)` → reject on error → `401 invalid_token`.
4. Look up `profiles` by `user_id = auth_user.id`. Missing → `404 not_registered`.
5. Compute Euclidean distance against stored descriptor. `distance >= 0.6` → `401 face_mismatch`.
6. Issue app JWT via `issueUserToken(profile.user_id)`.
7. Set HttpOnly cookie + return `{ userId, profile: { dni, full_name, email, picture_url } }`.

### `DELETE /api/auth/login` (sign out)

1. Read app JWT from `app_session` cookie.
2. If valid: call existing `revokeToken(jti)` to add to `revoked_tokens`.
3. `Set-Cookie: app_session=; Max-Age=0`.
4. Return `{ ok: true }`.
5. Client also calls `supabase.auth.signOut()` to clear the Supabase session.

### Routes removed

- `app/api/auth/login/route.ts` (old email/password)
- `app/api/auth/register/route.ts` (old email/password)

### Error codes

`invalid_request`, `invalid_token`, `not_registered`, `already_registered`, `face_mismatch`, `rate_limit_exceeded`. Generic and stable for the frontend.

## Frontend

The repo currently has no UI. Add a minimal App Router frontend.

### New routes

| Path | Purpose |
|------|---------|
| `app/login/page.tsx` | Google sign-in → after Supabase OAuth returns, prompts for selfie → `POST /api/auth/login` |
| `app/register/page.tsx` | Google sign-up → form for DNI + selfie capture → `POST /api/auth/register` |
| `app/auth/callback/route.ts` | Supabase OAuth callback. Exchanges code for session, redirects back to `/login` or `/register` per the `next` query param |
| `app/dashboard/page.tsx` | Stub destination after successful login. Demonstrates the cookie-protected route flow |

### New shared modules

| File | Purpose |
|------|---------|
| `components/WebcamCapture.tsx` | `getUserMedia` → `<video>` → captures one frame to `<canvas>` on user click |
| `lib/client/faceApi.ts` | Lazy-loads face-api.js + SSD MobileNet + face-recognition models from `/public/models/`. Exports `extractDescriptor(canvas) → number[128]` |
| `lib/client/supabaseBrowser.ts` | Browser Supabase client for `signInWithOAuth` and reading session |
| `public/models/*` | face-api.js model weights (~6 MB) |

### Login flow (client)

1. `/login` mounts. If no Supabase session → render "Sign in with Google" button. On click: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '/auth/callback?next=/login' } })`.
2. After Google + callback, `/login` re-mounts with active Supabase session. Mount `<WebcamCapture />`, lazy-load face-api models in the background.
3. User clicks "Verify face" → frame captured → `extractDescriptor()` runs → `fetch('/api/auth/login', {credentials: 'include', body: { supabase_access_token, face_descriptor }})`.
4. On 200 → redirect to `/dashboard`. On `404 not_registered` → show "Please register first" with link to `/register`. On `401 face_mismatch` → allow retry.

### Register flow (client)

Identical except the page also shows a `<input name="dni">` and submits to `/api/auth/register`.

### Cookie auth in `lib/auth.ts`

Extend `getAuthUserId` to first try the `Authorization: Bearer …` header (existing path, used by SDK callers) and fall back to the `app_session` cookie. Both produce the same JWT verification path.

## Face-Match Algorithm

### Client-side extraction
- Models: `ssd_mobilenetv1` + `face_recognition_model`.
- Pipeline: `detectSingleFace(canvas).withFaceLandmarks().withFaceDescriptor()` → `Float32Array(128)`.
- If 0 or >1 faces detected → frontend shows error, does not submit.

### Server-side comparison

```ts
// lib/services/faceMatch.service.ts
export const FACE_MATCH_THRESHOLD = 0.6;

export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function isMatch(a: number[], b: number[]): boolean {
  return euclideanDistance(a, b) < FACE_MATCH_THRESHOLD;
}

export function isValidDescriptor(d: unknown): d is number[] {
  if (!Array.isArray(d) || d.length !== 128) return false;
  if (!d.every(Number.isFinite)) return false;
  const allZero = d.every(v => v === 0);
  const allEqual = d.every(v => v === d[0]);
  return !allZero && !allEqual;
}
```

### Limitations (documented, not solved in v1)

- **No liveness detection.** A printed photo or video replay will pass. First thing to add post-MVP.
- **Biometric data handling.** Storing a face descriptor is biometric data under GDPR / Argentine privacy law. For a hackathon demo this is acceptable; production would require explicit consent UI, retention policy, and encryption-at-rest of the `face_descriptor` column.

## Security & Privacy

- HTTPS is required for `getUserMedia` (browser enforces).
- HttpOnly + Secure + SameSite=Strict cookie blocks JS access and most CSRF vectors.
- Login endpoint is rate-limited per IP via existing `checkRateLimit`.
- Failed logins return generic codes but distinguish `not_registered` (so the frontend can route to register) vs `face_mismatch`. We accept this minor enumeration risk in exchange for UX.
- Server validates descriptor shape before doing any database read, to avoid wasting work on malformed input.

## Environment

New variables required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # required by lib/db/supabase.ts (already used)
JWT_SECRET=...                        # existing
JWT_EXPIRES_IN=15m                    # existing
```

Supabase dashboard configuration:
- Enable Google OAuth provider.
- Set authorized redirect URL to the deployed callback (`https://<host>/auth/callback`) and `http://localhost:3000/auth/callback` for dev.

Didit env vars (`DIDIT_*`) remain in `.env.example` but are unused by this design. Left for a possible future KYC step.

## Testing

Repo uses Jest + ts-jest with tests under `tests/api/` and `tests/lib/`. Follow that pattern.

### Unit — `tests/lib/services/faceMatch.test.ts`
- `euclideanDistance` returns 0 for identical vectors and is symmetric.
- `euclideanDistance` produces expected values on hand-picked pairs.
- `isValidDescriptor` rejects wrong length, NaN, Infinity, all-zeros, all-equal arrays.
- `isMatch` returns true just under 0.6 distance, false just over.

### Unit — `tests/lib/auth.test.ts` (extended)
- `getAuthUserId` returns userId when only `Authorization: Bearer …` is set (existing behavior preserved).
- `getAuthUserId` returns userId when only the `app_session` cookie is set.
- `getAuthUserId` prefers the `Authorization` header when both are present.
- `getAuthUserId` returns null for an invalid cookie value.

### API — `tests/api/auth/`

`register.test.ts`:
- Valid Supabase token + new user + DNI + 128-vec → 200, profile inserted, cookie set, JWT returned.
- Existing profile for same `auth.users.id` → 409 `already_registered`.
- Invalid Supabase token → 401 `invalid_token`.
- Bad descriptor (length 127, NaN, missing) → 400 `invalid_request`.
- Missing `dni` → 400 `invalid_request`.

`login.test.ts`:
- Valid token + matching descriptor → 200, JWT returned, cookie set.
- Valid token, no profile → 404 `not_registered`.
- Valid token, mismatched descriptor → 401 `face_mismatch`.
- Invalid Supabase token → 401 `invalid_token`.
- Rate limit triggers → 429.

`logout.test.ts`:
- Valid cookie → 200, JWT in `revoked_tokens`, cookie cleared.
- Missing cookie → 200 (idempotent), nothing revoked.

### Mocks
- `supabase.auth.getUser` mocked per test.
- DB client mocked using the existing pattern under `tests/`.
- No real face-api.js in server tests — descriptors are hand-crafted vectors.

### Out of scope
- E2E browser tests with Playwright + Google + webcam fixture.

## Migration & Rollout

This is a hackathon project with no production users. Strategy:

1. Apply schema changes via a single SQL script (drop `users`, create `profiles`, retarget `api_keys` FK).
2. Configure Google provider in Supabase dashboard.
3. Deploy app with new auth routes; old email/password routes are removed in the same change.
4. Manual smoke test: register a new user end-to-end, then log out and log back in.

No backfill needed.

## Open Questions

None. All design decisions resolved during brainstorming.
