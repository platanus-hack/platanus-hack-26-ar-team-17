import { NextRequest, NextResponse } from 'next/server';
import { APP_SESSION_COOKIE } from '@/lib/cookies';
import { getSessionFieldsForAuthUser } from '@/lib/services/profile.service';
import { isTokenRevoked, verifyToken } from '@/lib/services/token.service';

export async function GET(req: NextRequest) {
  const cookieToken = req.cookies.get(APP_SESSION_COOKIE)?.value;
  if (!cookieToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const decoded = await verifyToken(cookieToken);
    if (decoded.type !== 'user_session') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (decoded.jti && (await isTokenRevoked(decoded.jti))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const fields = await getSessionFieldsForAuthUser(decoded.userId);
    return NextResponse.json({
      token: cookieToken,
      userId: decoded.userId,
      kycStatus: fields?.kycStatus ?? 'PENDING',
      displayName: fields?.displayName ?? 'Account',
    });
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}
