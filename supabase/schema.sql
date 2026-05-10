-- Run this SQL in the Supabase SQL editor to create the schema from scratch.
-- If you already have tables, use migration_001_patch.sql instead.

create type key_status as enum ('ACTIVE', 'REVOKED');
create type log_result as enum ('SUCCESS', 'BLOCKED_INVALID_KEY', 'BLOCKED_RULE', 'BLOCKED_REVOKED');
create type rule_type as enum ('FORBIDDEN_ACTION', 'FORBIDDEN_KEYWORD', 'FORBIDDEN_PATTERN');

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password text not null,
  full_name text,
  company text,
  kyc_status text not null default 'PENDING',
  kyc_verified_at timestamptz,
  didit_session_id text,
  didit_session_url text,
  created_at timestamptz default now()
);

create table agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  name text not null,
  platform text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz default now()
);
create index on agents(user_id);

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) not null,
  name text not null,
  key_hash text unique not null,
  prefix text not null,
  status key_status not null default 'ACTIVE',
  created_at timestamptz default now(),
  revoked_at timestamptz
);
create index on api_keys(key_hash);
create index on api_keys(agent_id);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id text,
  api_key_id text,
  user_id text,
  action text not null,
  user_input text,
  platform text not null,
  result log_result not null,
  rule_violated text,
  prev_checksum text not null,
  checksum text not null,
  created_at timestamptz default now()
);
create index on audit_logs(api_key_id);
create index on audit_logs(user_id);

create table global_rules (
  id uuid primary key default gen_random_uuid(),
  type rule_type not null,
  value text unique not null,
  created_at timestamptz default now()
);

create table revoked_tokens (
  jti text primary key,
  revoked_at timestamptz default now()
);

create table rate_limits (
  ip text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);
