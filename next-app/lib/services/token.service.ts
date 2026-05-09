import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { supabase } from '../db/supabase';

export interface DecodedToken {
  userId: string;
  agentId?: string;
  apiKeyId?: string;
  jti: string;
  type: 'sdk_token' | 'user_session' | 'agent_session';
  iat: number;
  exp: number;
}

export interface AgentTokenPayload {
  agentId: string;
  did: string;
  scopes: string[];
}

export function issueAgentSessionToken(agentId: string, did: string, scopes: string[]): string {
  const jti = crypto.randomUUID();
  return jwt.sign({ agentId, did, scopes, jti, type: 'agent_session' }, config.JWT_SECRET, {
    expiresIn: '5m',
  });
}

export async function issueToken(
  payload: { userId: string; agentId?: string; apiKeyId?: string },
  expiresIn: jwt.SignOptions['expiresIn'] = '5m',
): Promise<{ token: string; expiresAt: string }> {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ ...payload, jti, type: 'sdk_token' }, config.JWT_SECRET, { expiresIn });
  const decoded = jwt.decode(token) as { exp: number };
  const expiresAt = new Date(decoded.exp * 1000).toISOString();
  return { token, expiresAt };
}

export async function issueUserToken(userId: string): Promise<string> {
  const jti = crypto.randomUUID();
  return jwt.sign({ userId, jti, type: 'user_session' }, config.JWT_SECRET, {
    expiresIn: '7d',
  });
}

export async function verifyToken(token: string): Promise<DecodedToken> {
  return jwt.verify(token, config.JWT_SECRET) as DecodedToken;
}

export async function revokeToken(jti: string): Promise<void> {
  await supabase.from('revoked_tokens').insert({ jti });
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const { data } = await supabase
    .from('revoked_tokens')
    .select('jti')
    .eq('jti', jti)
    .single();
  return !!data;
}
