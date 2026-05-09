import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { config } from './config';

export function getAuthUserId(req: NextRequest): string | null {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string; type?: string };
    if (decoded.type !== 'user_session') return null;
    return decoded.userId;
  } catch {
    return null;
  }
}
