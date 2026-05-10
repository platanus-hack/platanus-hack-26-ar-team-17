import { supabase } from '../db/supabase';
import { generateApiKey, hashApiKey, getKeyPrefix } from '../utils/crypto';

export interface ApiKeyRecord {
  id: string;
  agent_id: string;
  user_id: string;
  status: string;
}

export async function validateApiKeyAndHash(
  keyHash: string,
  userHash: string,
): Promise<ApiKeyRecord | null> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, agent_id, status, agents!inner(user_id, status, users!inner(hash))')
    .eq('key_hash', keyHash)
    .single<{
      id: string;
      agent_id: string;
      status: string;
      agents: { user_id: string; status: string; users: { hash: string } };
    }>();

  if (error || !data || !data.agents) return null;
  if (data.status !== 'ACTIVE') return null;
  if (data.agents.status !== 'ACTIVE') return null;
  if (data.agents.users.hash !== userHash) return null;

  return { id: data.id, agent_id: data.agent_id, user_id: data.agents.user_id, status: data.status };
}

export async function createApiKey(params: {
  agentId: string;
  name: string;
  scope?: string[];
}): Promise<{ id: string; plainKey: string; prefix: string }> {
  const plainKey = generateApiKey();
  const keyHash = hashApiKey(plainKey);
  const prefix = getKeyPrefix(plainKey);
  const scope = params.scope ?? [];

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ agent_id: params.agentId, name: params.name, key_hash: keyHash, prefix, scope })
    .select()
    .single();

  if (error || !data) throw error ?? new Error('Failed to create API key');
  return { id: data.id, plainKey, prefix };
}

export async function revokeApiKey(keyId: string, userId: string): Promise<void> {
  const { data: key } = await supabase
    .from('api_keys')
    .select('id, agents!inner(user_id)')
    .eq('id', keyId)
    .single<{ id: string; agents: { user_id: string } }>();

  if (!key || key.agents.user_id !== userId) return;

  await supabase
    .from('api_keys')
    .update({ status: 'REVOKED', revoked_at: new Date().toISOString() })
    .eq('id', keyId);
}
