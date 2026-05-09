import { supabase } from '../db/supabase';
import { createApiKey } from './apiKey.service';

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  platform: string;
  status: 'ACTIVE' | 'DISABLED';
  created_at: string;
}

export async function listAgents(userId: string): Promise<Agent[]> {
  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Agent[];
}

export async function getAgent(agentId: string, userId: string): Promise<Agent | null> {
  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .eq('user_id', userId)
    .single<Agent>();
  return data;
}

export async function createAgent(params: {
  userId: string;
  name: string;
  platform: string;
}): Promise<{ agent: Agent; key: { id: string; plainKey: string; prefix: string } }> {
  const { data: agent, error } = await supabase
    .from('agents')
    .insert({
      user_id: params.userId,
      name: params.name,
      platform: params.platform,
    })
    .select()
    .single<Agent>();

  if (error || !agent) throw error ?? new Error('Failed to create agent');

  const key = await createApiKey({ agentId: agent.id, name: 'default' });
  return { agent, key };
}

export async function disableAgent(agentId: string, userId: string): Promise<void> {
  const owned = await getAgent(agentId, userId);
  if (!owned) return;

  const now = new Date().toISOString();
  await supabase.from('agents').update({ status: 'DISABLED' }).eq('id', agentId);
  await supabase
    .from('api_keys')
    .update({ status: 'REVOKED', revoked_at: now })
    .eq('agent_id', agentId)
    .eq('status', 'ACTIVE');
}
