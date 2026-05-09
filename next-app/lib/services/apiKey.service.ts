import { supabase } from '../db/supabase';
import { generateApiKey, hashApiKey, getKeyPrefix } from '../utils/crypto';

const ALL_SCOPES = ['send_message', 'read_messages', 'create_post', 'delete_post', 'read_profile', 'update_profile'];

export interface ApiKeyRecord {
  id: string;
  user_id: string;
  status: string;
}

export async function validateApiKeyHash(keyHash: string): Promise<ApiKeyRecord | null> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, user_id, status')
    .eq('key_hash', keyHash)
    .single<{ id: string; user_id: string; status: string }>();

  if (error || !data) return null;
  if (data.status !== 'ACTIVE') return null;
  return { id: data.id, user_id: data.user_id, status: data.status };
}

export async function createApiKey(params: {
  userId: string;
  name: string;
  scope?: string[];
}): Promise<{ id: string; plainKey: string; prefix: string }> {
  const plainKey = generateApiKey();
  const keyHash = hashApiKey(plainKey);
  const prefix = getKeyPrefix(plainKey);
  const scope = params.scope ?? ALL_SCOPES;

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ user_id: params.userId, name: params.name, key_hash: keyHash, prefix, scope })
    .select()
    .single();

  if (error || !data) throw error ?? new Error('Failed to create API key');
  return { id: data.id, plainKey, prefix };
}

export async function revokeApiKey(keyId: string, userId: string): Promise<void> {
  const { data: key } = await supabase
    .from('api_keys')
    .select('id, user_id')
    .eq('id', keyId)
    .single<{ id: string; user_id: string }>();

  if (!key || key.user_id !== userId) return;

  const { error } = await supabase
    .from('api_keys')
    .update({ status: 'REVOKED', revoked_at: new Date().toISOString() })
    .eq('id', keyId);

  if (error) throw error;
}
