import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { APP_SESSION_COOKIE } from './cookies';

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
