-- Patch script — run in Supabase SQL editor on existing DB.

-- ── users ──────────────────────────────────────────────────────────────────
alter table users
  add column if not exists full_name       text,
  add column if not exists company         text,
  add column if not exists hash            text unique,
  add column if not exists kyc_status      text not null default 'PENDING',
  add column if not exists kyc_verified_at timestamptz,
  add column if not exists didit_session_id  text,
  add column if not exists didit_session_url text;

-- Backfill hash for existing users
update users set hash = encode(gen_random_bytes(16), 'hex') where hash is null;
alter table users alter column hash set not null;
alter table users alter column hash set default encode(gen_random_bytes(16), 'hex');

-- ── agents ──────────────────────────────────────────────────────────────────
create table if not exists agents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) not null,
  name       text not null,
  type       text not null default 'agent',   -- 'agent' | 'mcp'
  platform   text not null default 'custom',
  status     text not null default 'ACTIVE',
  created_at timestamptz default now()
);
create index if not exists agents_user_id_idx on agents(user_id);

-- Add type column if table already existed without it
alter table agents add column if not exists type text not null default 'agent';

-- ── api_keys ────────────────────────────────────────────────────────────────
-- api_keys belong to agents (not users directly)
alter table api_keys
  add column if not exists agent_id uuid references agents(id),
  add column if not exists scope    text[] not null default '{}';

create index if not exists api_keys_agent_id_idx on api_keys(agent_id);

-- ── audit_logs ──────────────────────────────────────────────────────────────
alter table audit_logs
  add column if not exists agent_id    text,
  add column if not exists user_input  text,
  add column if not exists executed_at timestamptz; -- SDK timestamp (agent clock)
