import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { supabase } from '../db/supabase';

interface TokenPayload {
  userId: string;
  apiKeyId: string;
}

export interface DecodedToken extends TokenPayload {
  jti: string;
  type: 'sdk_token' | 'user_session';
  iat: number;
  exp: number;
}

export async function issueToken(payload: TokenPayload): Promise<string> {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti, type: 'sdk_token' }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export async function issueUserToken(userId: string): Promise<string> {
  return jwt.sign({ userId, type: 'user_session' }, config.JWT_SECRET, {
    expiresIn: '7d',
  });
}

export async function verifyToken(token: string): Promise<DecodedToken> {
  return jwt.verify(token, config.JWT_SECRET) as DecodedToken;
}

export async function revokeToken(jti: string): Promise<void> {
  await supabase.from('revoked_tokens').insert({ jti });
}

export async function revokeAllTokensForKey(_apiKeyId: string): Promise<void> {
  // Tokens are short-lived; revocation via jti is handled per-token
  // In production, store active jtis per key and revoke in bulk here
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const { data } = await supabase
    .from('revoked_tokens')
    .select('jti')
    .eq('jti', jti)
    .single();
  return !!data;
}
