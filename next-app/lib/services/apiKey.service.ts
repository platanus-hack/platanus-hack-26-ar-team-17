import { supabase } from '../db/supabase';
import { generateApiKey, hashApiKey, getKeyPrefix } from '../utils/crypto';

export interface ApiKeyRecord {
  id: string;
  user_id: string;
  key_hash: string;
  scope: string[];
  status: string;
}

export async function validateApiKeyHash(keyHash: string): Promise<ApiKeyRecord | null> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .single();
  if (error || !data) return null;
  if (data.status !== 'ACTIVE') return null;
  return data as ApiKeyRecord;
}

export async function createApiKey(params: {
  userId: string;
  name: string;
}): Promise<{ id: string; plainKey: string; prefix: string }> {
  const plainKey = generateApiKey();
  const keyHash = hashApiKey(plainKey);
  const prefix = getKeyPrefix(plainKey);

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ user_id: params.userId, name: params.name, key_hash: keyHash, prefix, scope: [] })
    .select()
    .single();

  if (error || !data) throw error ?? new Error('Failed to create API key');
  return { id: data.id, plainKey, prefix };
}

export async function revokeApiKey(keyId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('api_keys')
    .update({ status: 'REVOKED', revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('user_id', userId);
  if (error) throw error;
}
