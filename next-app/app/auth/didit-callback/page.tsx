import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getProfileByUserId } from '@/lib/services/profile.service';
import { getLoginAttempt } from '@/lib/services/loginAttempt.service';
import { issueUserToken } from '@/lib/services/token.service';
import { APP_SESSION_COOKIE } from '@/lib/cookies';

interface SearchParams {
  // Didit returns these as `verificationSessionId` and `status`.
  // We accept the snake_case forms as fallbacks for compatibility.
  verificationSessionId?: string;
  session_id?: string;
  status?: string;
  intent?: 'register' | 'login';
}

async function setCookieAndRedirect(userId: string, target: string) {
  const token = await issueUserToken(userId);
  (await cookies()).set(APP_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect(target);
}

export default async function DiditCallback({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const session_id = params.verificationSessionId ?? params.session_id;
  const { intent, status } = params;
  if (!session_id || !intent) {
    return <main className="p-8"><h1>Verification error</h1><p>Missing session.</p></main>;
  }
  if (status && status !== 'Approved' && status !== 'In Review') {
    return <main className="p-8"><h1>Verification failed</h1><p>{status}. Please try again.</p></main>;
  }

  if (intent === 'register') {
    // The webhook updates the profile by user_id; we don't know it directly here.
    // Pull the placeholder profile via the KYC session by querying the profile table.
    // For v1: use a small endpoint or keep the user_id in a cookie set during register.
    // Simpler: read user_id from the Supabase session cookie set by the browser SDK.
    // For a hackathon: the browser already has the Supabase session — let it post status to /api/auth/me.
    return (
      <main className="p-8">
        <h1>Almost done</h1>
        <p>Verification submitted. Once confirmed you'll be redirected to your dashboard.</p>
        <script dangerouslySetInnerHTML={{ __html: clientPollScript('register', session_id) }} />
      </main>
    );
  }

  // login intent
  const attempt = await getLoginAttempt(session_id);
  if (!attempt) {
    return (
      <main className="p-8">
        <h1>Almost done</h1>
        <p>Waiting for verification result…</p>
        <script dangerouslySetInnerHTML={{ __html: clientPollScript('login', session_id) }} />
      </main>
    );
  }
  if (attempt.decision === 'APPROVED') {
    await setCookieAndRedirect(attempt.user_id, '/dashboard');
  }
  if (attempt.decision === 'REJECTED') {
    return <main className="p-8"><h1>Verification failed</h1><p>The face check did not match. Please try again.</p></main>;
  }
  // PENDING
  return (
    <main className="p-8">
      <h1>Almost done</h1>
      <p>Waiting for verification result…</p>
      <script dangerouslySetInnerHTML={{ __html: clientPollScript('login', session_id) }} />
    </main>
  );
}

function clientPollScript(intent: 'register' | 'login', sessionId: string): string {
  return `
    (async () => {
      const SUPABASE_URL = '${process.env.NEXT_PUBLIC_SUPABASE_URL}';
      const KEY = '${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}';
      const stored = window.localStorage.getItem('sb-' + SUPABASE_URL.split('//')[1].split('.')[0] + '-auth-token');
      let supabaseToken = '';
      try {
        const parsed = JSON.parse(stored || '{}');
        supabaseToken = parsed.access_token || '';
      } catch {}
      let attempts = 0;
      const maxAttempts = 10;
      const interval = setInterval(async () => {
        attempts++;
        const params = new URLSearchParams({ intent: '${intent}', session_id: '${sessionId}' });
        if ('${intent}' === 'register' && supabaseToken) params.set('supabase_access_token', supabaseToken);
        try {
          const r = await fetch('/api/auth/finalize?' + params.toString(), { credentials: 'include' });
          if (r.status === 200) { window.location.href = '/dashboard'; clearInterval(interval); return; }
          if (r.status === 410) { document.body.innerHTML = '<main class="p-8"><h1>Verification failed</h1><p>Please try again.</p></main>'; clearInterval(interval); return; }
        } catch (e) {}
        if (attempts >= maxAttempts) { clearInterval(interval); }
      }, 1500);
    })();
  `;
}
