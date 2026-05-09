import { supabase } from './db/supabase';

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 30;

export async function checkRateLimit(ip: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('ip', ip)
    .single();

  const now = new Date();

  if (!existing || (now.getTime() - new Date(existing.window_start).getTime()) > WINDOW_SECONDS * 1000) {
    await supabase
      .from('rate_limits')
      .upsert({ ip, count: 1, window_start: now.toISOString() });
    return true;
  }

  const newCount = existing.count + 1;
  await supabase.from('rate_limits').update({ count: newCount }).eq('ip', ip);
  return newCount <= MAX_REQUESTS;
}
