import { supabase } from '../db/supabase';
import { createApiKey } from './apiKey.service';
import { config } from '../config';

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

export interface AgentWithMcpUrl extends Agent {
  mcp_url: string | null;
}

export interface AgentKeySummary {
  id: string;
  name: string;
  prefix: string;
  status: 'ACTIVE' | 'REVOKED';
  created_at: string;
  revoked_at: string | null;
}

export function getMcpUrl(userHash: string, agentId: string, baseUrl: string): string {
  return `${baseUrl}/api/mcp/${userHash}/${agentId}`;
}

function toMcpUrl(agent: Agent, userHash: string | null): string | null {
  if (agent.type !== 'mcp' || !userHash) return null;
  return getMcpUrl(userHash, agent.id, config.SITE_URL);
}

export async function listAgents(userId: string): Promise<Agent[]> {
  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Agent[];
}

export async function listAgentsWithMcpUrl(
  userId: string,
  userHash: string | null,
): Promise<AgentWithMcpUrl[]> {
  const agents = await listAgents(userId);
  return agents.map(a => ({ ...a, mcp_url: toMcpUrl(a, userHash) }));
}

export async function getAgentWithKeys(
  agentId: string,
  userId: string,
  userHash: string | null,
): Promise<{ agent: AgentWithMcpUrl; keys: AgentKeySummary[] } | null> {
  const agent = await getAgent(agentId, userId);
  if (!agent) return null;

  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, name, prefix, status, created_at, revoked_at')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  return {
    agent: { ...agent, mcp_url: toMcpUrl(agent, userHash) },
    keys: (keys ?? []) as AgentKeySummary[],
  };
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
}): Promise<{ agent: Agent; key: { id: string; plainKey: string; prefix: string } | null }> {
  const { data: agent, error } = await supabase
    .from('agents')
    .insert({ user_id: params.userId, name: params.name, type: params.type, platform: params.platform })
    .select()
    .single<Agent>();

  if (error || !agent) throw error ?? new Error('Failed to create agent');

  // MCP agents don't need an API key — they auth via user hash in URL
  if (params.type === 'mcp') return { agent, key: null };

  const key = await createApiKey({ agentId: agent.id, name: 'default' });
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
