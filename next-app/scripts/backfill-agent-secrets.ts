/**
 * Backfill HMAC secrets for agents that were created before the HMAC auth migration.
 *
 * Usage:
 *   ENCRYPTION_KEY=$(openssl rand -hex 32) npx ts-node scripts/backfill-agent-secrets.ts
 *
 * Output: a table of agent_id → plaintext apiSecret.
 * SAVE THIS OUTPUT — the plaintext secret is never stored and cannot be recovered.
 * Each agent operator must update their ZERO_API_SECRET env var with their entry.
 */

import { createClient } from '@supabase/supabase-js';
import { generateAgentSecret, encryptSecret } from '../lib/utils/crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  console.error('Generate one with: openssl rand -hex 32');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const { data: agents, error } = await supabase
    .from('agents')
    .select('id, name, user_id')
    .is('secret_enc', null);

  if (error) { console.error('Failed to fetch agents:', error.message); process.exit(1); }
  if (!agents || agents.length === 0) {
    console.log('No agents without secret_enc found. Nothing to do.');
    return;
  }

  console.log(`\nBackfilling secrets for ${agents.length} agent(s)...\n`);
  console.log('agent_id'.padEnd(40), 'name'.padEnd(30), 'apiSecret');
  console.log('-'.repeat(100));

  for (const agent of agents) {
    const apiSecret = generateAgentSecret();
    const secretEnc = encryptSecret(apiSecret, ENCRYPTION_KEY!);
    const secretPrefix = apiSecret.slice(0, 8);

    const { error: updateErr } = await supabase
      .from('agents')
      .update({ secret_enc: secretEnc, secret_prefix: secretPrefix })
      .eq('id', agent.id);

    if (updateErr) {
      console.error(`  FAILED ${agent.id}: ${updateErr.message}`);
      continue;
    }

    console.log(agent.id.padEnd(40), (agent.name ?? '').padEnd(30), apiSecret);
  }

  console.log('\nDone. Store each apiSecret in the corresponding agent\'s ZERO_API_SECRET env var.');
}

main().catch((err) => { console.error(err); process.exit(1); });
