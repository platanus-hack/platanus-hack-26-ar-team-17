import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/db/supabase';
import { issueUserToken } from '@/lib/services/token.service';

const bodySchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { email, password } = parsed.data;

  const { data: user } = await supabase.from('users').select('*').eq('email', email).single();
  if (!user) return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });

  const token = await issueUserToken(user.id);
  return NextResponse.json({ token, userId: user.id });
}
