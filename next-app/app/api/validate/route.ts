import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/db/supabase';
import { hashApiKey } from '@/lib/utils/crypto';
import { writeLog } from '@/lib/services/auditLog.service';
import { checkGlobalRules } from '@/lib/services/rules.service';
import { verifyScope } from '@/lib/services/scope.service';

const bodySchema = z.object({
  token: z.string().min(1),
  hash: z.string().min(1),
  action: z.string().min(1),
  platform: z.string().min(1),
  text: z.string().optional().default(''),
});

type KeyRow = {
  id: string;
  agent_id: string;
  status: string;
  scope: string[] | null;
  agents: {
    user_id: string;
    status: string;
    users: { hash: string };
  };
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ allowed: false }, { status: 200 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ allowed: false }, { status: 200 });

  const { token, hash, action, platform, text } = parsed.data;
  const keyHash = hashApiKey(token);

  const { data } = await supabase
    .from('api_keys')
    .select(
      'id, agent_id, status, scope, agents!inner(user_id, status, users!inner(hash))',
    )
    .eq('key_hash', keyHash)
    .single<KeyRow>();

  const baseLog = {
    action,
    platform,
    userInput: text,
  };

  if (!data) {
    void writeLog({
      agentId: null,
      apiKeyId: null,
      userId: null,
      ...baseLog,
      result: 'BLOCKED_INVALID_KEY',
    }).catch(() => {});
    return NextResponse.json({ allowed: false });
  }

  const keyOk =
    data.status === 'ACTIVE' &&
    data.agents?.status === 'ACTIVE' &&
    data.agents?.users?.hash === hash;

  if (!keyOk) {
    void writeLog({
      agentId: data.agent_id,
      apiKeyId: data.id,
      userId: data.agents.user_id,
      ...baseLog,
      result: 'BLOCKED_INVALID_KEY',
    }).catch(() => {});
    return NextResponse.json({ allowed: false });
  }

  const scope = Array.isArray(data.scope) ? data.scope : [];

  if (!verifyScope(action, scope)) {
    void writeLog({
      agentId: data.agent_id,
      apiKeyId: data.id,
      userId: data.agents.user_id,
      ...baseLog,
      result: 'BLOCKED_SCOPE',
    }).catch(() => {});
    return NextResponse.json({ allowed: false });
  }

  const ruleCheck = await checkGlobalRules({ action, text });
  if (ruleCheck.blocked) {
    void writeLog({
      agentId: data.agent_id,
      apiKeyId: data.id,
      userId: data.agents.user_id,
      ...baseLog,
      result: 'BLOCKED_RULE',
      ruleViolated: ruleCheck.ruleViolated,
    }).catch(() => {});
    return NextResponse.json({ allowed: false });
  }

  void writeLog({
    agentId: data.agent_id,
    apiKeyId: data.id,
    userId: data.agents.user_id,
    ...baseLog,
    result: 'SUCCESS',
  }).catch(() => {});

  return NextResponse.json({ allowed: true });
}
