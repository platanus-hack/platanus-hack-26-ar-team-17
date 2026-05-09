import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/db/supabase';
import { issueUserToken } from '@/lib/services/token.service';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1).max(120).optional(),
  company: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { email, password, full_name, company } = parsed.data;

  const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
  if (existing) return NextResponse.json({ error: 'email_taken' }, { status: 409 });

  const hashed = await bcrypt.hash(password, 12);
  const { data: user, error } = await supabase
    .from('users')
    .insert({ email, password: hashed, full_name: full_name ?? null, company: company ?? null, kyc_status: 'PENDING' })
    .select()
    .single();

  if (error || !user) return NextResponse.json({ error: 'registration_failed', detail: error?.message }, { status: 500 });

  const token = await issueUserToken(user.id);
  return NextResponse.json({ token, userId: user.id, kycStatus: user.kyc_status }, { status: 201 });
}
