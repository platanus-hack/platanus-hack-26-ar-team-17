import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { APP_SESSION_COOKIE } from './cookies';
import { isTokenRevoked } from './services/token.service';
import { supabase } from './db/supabase';

function decodeUserSession(token: string): { userId: string; jti: string } | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as {
      userId: string;
      type?: string;
      jti?: string;
    };
    if (decoded.type !== 'user_session') return null;
    if (!decoded.userId || !decoded.jti) return null;
    return { userId: decoded.userId, jti: decoded.jti };
  } catch {
    return null;
  }
}

async function sessionFromToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const decoded = decodeUserSession(token);
  if (!decoded) return null;
  if (await isTokenRevoked(decoded.jti)) return null;
  return decoded.userId;
}

/** Supabase Auth user id, after verifying JWT and revocation list. */
export async function getAuthUserId(req: NextRequest): Promise<string | null> {
  const headerToken = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? undefined;
  const cookieToken = req.cookies.get(APP_SESSION_COOKIE)?.value;

  if (headerToken) {
    const fromHeader = await sessionFromToken(headerToken);
    if (fromHeader) return fromHeader;
  }

  if (cookieToken) {
    return sessionFromToken(cookieToken);
  }

  return null;
}

// JWT carries Supabase auth.users.id; owner-scoped tables FK to our internal users.id.
export async function getInternalUserId(
  req: NextRequest,
): Promise<{ internalId: string; userHash: string | null } | null> {
  const authUserId = await getAuthUserId(req);
  if (!authUserId) return null;
  const { data } = await supabase
    .from('users')
    .select('id, hash')
    .eq('auth_user_id', authUserId)
    .single<{ id: string; hash: string | null }>();
  if (!data) return null;
  return { internalId: data.id, userHash: data.hash };
}
