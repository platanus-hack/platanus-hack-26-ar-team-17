-- 002_plain_key.sql
-- Persist the plain API key alongside its hash so the dashboard can display
-- the full secret to its owner after creation. This trades the ability to
-- "lose the key forever after creation" for a simpler UX. The hash is still
-- the source of truth for validation; plain_key is owner-only.

alter table api_keys
  add column if not exists plain_key text;
