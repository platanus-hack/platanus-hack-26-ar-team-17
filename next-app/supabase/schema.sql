-- Run this SQL in the Supabase SQL editor to create the schema

create type key_status as enum ('ACTIVE', 'REVOKED');
create type agent_status as enum ('ACTIVE', 'DISABLED');
create type log_result as enum ('SUCCESS', 'BLOCKED_INVALID_KEY', 'BLOCKED_SCOPE', 'BLOCKED_RULE', 'BLOCKED_REVOKED');
create type rule_type as enum ('FORBIDDEN_ACTION', 'FORBIDDEN_KEYWORD', 'FORBIDDEN_PATTERN');

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password text not null,
  created_at timestamptz default now()
);

create table agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  name text not null,
  platform text not null,
  scope text[] not null default '{}',
  status agent_status not null default 'ACTIVE',
  created_at timestamptz default now()
);
create index on agents(user_id);

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete cascade not null,
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
  -- FKs are nullable because BLOCKED_INVALID_KEY logs have no real agent/key/user
  agent_id uuid references agents(id),
  api_key_id uuid references api_keys(id),
  user_id uuid references users(id),
  action text not null,
  user_input text,
  platform text not null,
  result log_result not null,
  rule_violated text,
  prev_checksum text not null,
  checksum text not null,
  created_at timestamptz default now()
);
create index on audit_logs(agent_id);
create index on audit_logs(api_key_id);
create index on audit_logs(user_id);
create index on audit_logs(created_at desc);

create table global_rules (
  id uuid primary key default gen_random_uuid(),
  type rule_type not null,
  value text unique not null,
  created_at timestamptz default now()
);

-- Replaces Redis SET for JWT revocation
create table revoked_tokens (
  jti text primary key,
  revoked_at timestamptz default now()
);

-- Replaces Redis INCR for rate limiting (60-second sliding window)
create table rate_limits (
  ip text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);
