import { supabase } from '../db/supabase';

// Attempts to insert the nonce. Returns false if it already exists (replay attack).
export async function consumeNonce(nonce: string, agentId: string, expiresAt: Date): Promise<boolean> {
  const { error } = await supabase
    .from('nonces')
    .insert({ nonce, agent_id: agentId, expires_at: expiresAt.toISOString() });

  if (error) {
    // Unique constraint violation means nonce was already used
    if (error.code === '23505') return false;
    throw error;
  }
  return true;
}

// Best-effort cleanup of expired nonces — call periodically (e.g., from a cron or on each validate)
export async function cleanupExpiredNonces(): Promise<void> {
  await supabase.from('nonces').delete().lt('expires_at', new Date().toISOString());
}
