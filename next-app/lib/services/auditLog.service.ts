import crypto from 'crypto';
import { supabase } from '../db/supabase';

interface LogParams {
  agentId: string | null;
  apiKeyId: string | null;
  userId: string | null;
  action: string;
  platform: string;
  result: 'SUCCESS' | 'BLOCKED_INVALID_KEY' | 'BLOCKED_SCOPE' | 'BLOCKED_RULE' | 'BLOCKED_REVOKED';
  ruleViolated?: string;
  userInput?: string;
}

export async function writeLog(params: LogParams) {
  const { data: prev } = await supabase
    .from('audit_logs')
    .select('checksum')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const prevChecksum = prev?.checksum ?? 'genesis';
  const timestamp = new Date().toISOString();
  const data = `${prevChecksum}|${timestamp}|${params.userId ?? 'unknown'}|${params.action}|${params.result}`;
  const checksum = crypto.createHash('sha256').update(data).digest('hex');

  const { data: entry, error } = await supabase
    .from('audit_logs')
    .insert({
      agent_id: params.agentId,
      api_key_id: params.apiKeyId,
      user_id: params.userId,
      action: params.action,
      user_input: params.userInput ?? null,
      platform: params.platform,
      result: params.result,
      rule_violated: params.ruleViolated ?? null,
      prev_checksum: prevChecksum,
      checksum,
    })
    .select()
    .single();

  if (error) throw error;
  return entry;
}
