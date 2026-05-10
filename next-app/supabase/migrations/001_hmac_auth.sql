-- Migration: add HMAC authentication columns to agents and create nonces table.
-- Safe to run on an existing database — all statements are idempotent.

ALTER TABLE agents ADD COLUMN IF NOT EXISTS secret_enc    text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS secret_prefix text;

CREATE TABLE IF NOT EXISTS nonces (
  nonce      text        PRIMARY KEY,
  agent_id   uuid        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nonces_expires_at_idx ON nonces(expires_at);
