import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', req.url));
  }

  // Redirect to client-side callback page to finalize with access token
  const callbackUrl = new URL('/auth/callback', req.url);
  callbackUrl.searchParams.set('code', code);
  return NextResponse.redirect(callbackUrl);
}
