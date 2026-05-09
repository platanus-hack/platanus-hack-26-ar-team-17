-- Run this in the Supabase SQL editor if you already have tables and need to patch them.

-- Add missing columns to users
alter table users
  add column if not exists full_name text,
  add column if not exists company text,
  add column if not exists kyc_status text not null default 'PENDING',
  add column if not exists kyc_verified_at timestamptz,
  add column if not exists didit_session_id text,
  add column if not exists didit_session_url text;

-- Create agents table if missing
create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  name text not null,
  platform text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz default now()
);
create index if not exists agents_user_id_idx on agents(user_id);

-- Fix api_keys: add agent_id if it doesn't exist (drop user_id constraint if needed)
alter table api_keys
  add column if not exists agent_id uuid references agents(id);

-- Add missing columns to audit_logs
alter table audit_logs
  add column if not exists agent_id text,
  add column if not exists user_input text;
