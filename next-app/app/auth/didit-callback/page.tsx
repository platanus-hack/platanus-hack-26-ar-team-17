import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
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
    return <main className="p-8"><h1>Error de verificación</h1><p>Falta la sesión.</p></main>;
  }
  if (status && status !== 'Approved' && status !== 'In Review') {
    return <main className="p-8"><h1>La verificación falló</h1><p>{status}. Intenta de nuevo.</p></main>;
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
        <p data-verification-status>
          Verificación enviada. Cuando se confirme, te redirigiremos al panel.
        </p>
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
        <p data-verification-status>Esperando resultado de verificación...</p>
        <script dangerouslySetInnerHTML={{ __html: clientPollScript('login', session_id) }} />
      </main>
    );
  }
  if (attempt.decision === 'APPROVED') {
    await setCookieAndRedirect(attempt.user_id, '/auth/sync-session');
  }
  if (attempt.decision === 'REJECTED') {
    return <main className="p-8"><h1>La verificación falló</h1><p>La verificación facial no coincidió. Intenta de nuevo.</p></main>;
  }
  // PENDING
  return (
    <main className="p-8">
      <h1>Almost done</h1>
      <p data-verification-status>Esperando resultado de verificación...</p>
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
      const maxAttempts = 40;
      const description = document.querySelector('[data-verification-status]');
      const setStatus = (text) => {
        if (description) description.textContent = text;
      };
      const interval = setInterval(async () => {
        attempts++;
        const params = new URLSearchParams({ intent: '${intent}', session_id: '${sessionId}' });
        if ('${intent}' === 'register' && supabaseToken) params.set('supabase_access_token', supabaseToken);
        try {
          const r = await fetch('/api/auth/finalize?' + params.toString(), { credentials: 'include' });
          if (r.status === 200) {
            const body = await r.json().catch(() => ({}));
            if (body.token && body.userId) {
              localStorage.setItem('zero_auth', JSON.stringify({
                token: body.token,
                userId: body.userId,
                kycStatus: body.kycStatus ?? null,
                displayName: body.displayName ?? null,
              }));
            }
            const next = body.kycStatus === 'VERIFIED' ? '/agents' : '/kyc';
            window.location.href = next;
            clearInterval(interval);
            return;
          }
          if (r.status === 410) { document.body.innerHTML = '<main class="p-8"><h1>La verificación falló</h1><p>Intenta de nuevo.</p></main>'; clearInterval(interval); return; }
          if (r.status === 202 && attempts > 6) setStatus('Aprobado por Didit. Esperando que el servidor termine de sincronizar...');
        } catch (e) {}
        if (attempts >= maxAttempts) {
          setStatus('La verificación está tardando más de lo esperado. Actualiza esta página en un momento.');
          clearInterval(interval);
        }
      }, 1500);
    })();
  `;
}
