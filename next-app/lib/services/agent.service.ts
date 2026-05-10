import { supabase } from '../db/supabase';
import { createApiKey } from './apiKey.service';

export type AgentType = 'agent' | 'mcp';

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  type: AgentType;
  platform: string;
  status: 'ACTIVE' | 'DISABLED';
  created_at: string;
}

export function getMcpUrl(userHash: string, agentId: string, baseUrl: string): string {
  return `${baseUrl}/api/mcp/${userHash}/${agentId}`;
}

export async function listAgents(userId: string): Promise<Agent[]> {
  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Agent[];
}

export async function countAgentsForUser(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('agents')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
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
  type: AgentType;
  platform: string;
  keyName?: string;
  keyScope?: string[];
}): Promise<{ agent: Agent; key: { id: string; plainKey: string; prefix: string } | null }> {
  const { data: agent, error } = await supabase
    .from('agents')
    .insert({ user_id: params.userId, name: params.name, type: params.type, platform: params.platform })
    .select()
    .single<Agent>();

  if (error || !agent) throw error ?? new Error('Failed to create agent');

  // MCP agents don't need an API key — they auth via user hash in URL
  if (params.type === 'mcp') return { agent, key: null };

  const key = await createApiKey({
    agentId: agent.id,
    name: params.keyName ?? 'default',
    scope: params.keyScope ?? [],
  });
  return { agent, key };
}

export async function disableAgent(agentId: string, userId: string): Promise<void> {
  const owned = await getAgent(agentId, userId);
  if (!owned) return;

  await supabase.from('agents').update({ status: 'DISABLED' }).eq('id', agentId);
  await supabase
    .from('api_keys')
    .update({ status: 'REVOKED', revoked_at: new Date().toISOString() })
    .eq('agent_id', agentId)
    .eq('status', 'ACTIVE');
}
