import { supabase } from '../db/supabase';

export type LoginDecision = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LoginAttempt {
  session_id: string;
  user_id: string;
  decision: LoginDecision;
  created_at?: string;
  decided_at?: string | null;
}

export async function createPendingLoginAttempt(sessionId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('didit_login_attempts')
    .insert({ session_id: sessionId, user_id: userId, decision: 'PENDING' });
  if (error) throw new Error(error.message);
}

export async function markLoginAttemptDecision(sessionId: string, decision: 'APPROVED' | 'REJECTED'): Promise<void> {
  const { error } = await supabase
    .from('didit_login_attempts')
    .update({ decision, decided_at: new Date().toISOString() })
    .eq('session_id', sessionId);
  if (error) throw new Error(error.message);
}

export async function getLoginAttempt(sessionId: string): Promise<LoginAttempt | null> {
  const { data } = await supabase
    .from('didit_login_attempts')
    .select('*')
    .eq('session_id', sessionId)
    .single();
  return (data as LoginAttempt | null) ?? null;
}
