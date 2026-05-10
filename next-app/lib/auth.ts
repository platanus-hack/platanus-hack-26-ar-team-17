import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { APP_SESSION_COOKIE } from './cookies';
import { supabase } from './db/supabase';

function verifyUserSession(token: string): string | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string; type?: string };
    if (decoded.type !== 'user_session') return null;
    return decoded.userId;
  } catch {
    return null;
  }
}

export function getAuthUserId(req: NextRequest): string | null {
  const headerToken = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (headerToken) {
    const fromHeader = verifyUserSession(headerToken);
    if (fromHeader) return fromHeader;
  }

  const cookieToken = req.cookies.get(APP_SESSION_COOKIE)?.value;
  if (cookieToken) {
    return verifyUserSession(cookieToken);
  }
  return null;
}

// JWT carries Supabase auth.users.id; most owner-scoped tables FK to our internal users.id.
// This translates one to the other (and returns null for unauthenticated or unknown users).
export async function getInternalUserId(
  req: NextRequest,
): Promise<{ internalId: string; userHash: string | null } | null> {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return null;
  const { data } = await supabase
    .from('users')
    .select('id, hash')
    .eq('auth_user_id', authUserId)
    .single<{ id: string; hash: string | null }>();
  if (!data) return null;
  return { internalId: data.id, userHash: data.hash };
}
