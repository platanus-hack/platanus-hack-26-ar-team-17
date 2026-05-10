import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { APP_SESSION_COOKIE } from './cookies';
import { isTokenRevoked } from './services/token.service';

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

/** Supabase Auth user id (`sub`), after verifying JWT and revocation list. */
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
