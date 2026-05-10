import { supabase } from '../db/supabase';
import { normalizeAction, normalizeText } from '../utils/normalize';

export interface RuleViolation {
  blocked: boolean;
  ruleViolated?: string;
}

/** Limits regex DoS from admin-supplied patterns stored in DB. */
const MAX_PATTERN_CHARS = 256;
const MAX_KEYWORD_CHARS = 512;
/** Bound matching input size for validation requests. */
const MAX_TEXT_MATCH_CHARS = 50_000;

function compileSafePattern(source: string): RegExp | null {
  if (source.length > MAX_PATTERN_CHARS) return null;
  try {
    return new RegExp(source, 'i');
  } catch {
    return null;
  }
}

export async function checkGlobalRules(params: {
  action: string;
  text: string;
}): Promise<RuleViolation> {
  const action = normalizeAction(params.action);
  const rawText = normalizeText(params.text).toLowerCase();
  const text =
    rawText.length > MAX_TEXT_MATCH_CHARS ? rawText.slice(0, MAX_TEXT_MATCH_CHARS) : rawText;

  const { data: rules } = await supabase.from('global_rules').select('*');
  if (!rules) return { blocked: false };

  for (const rule of rules) {
    if (rule.type === 'FORBIDDEN_ACTION' && rule.value === action) {
      return { blocked: true, ruleViolated: rule.value };
    }
  }

  for (const rule of rules) {
    if (rule.type === 'FORBIDDEN_KEYWORD') {
      if (rule.value.length > MAX_KEYWORD_CHARS) continue;
      if (text.includes(rule.value)) return { blocked: true, ruleViolated: rule.value };
    }
    if (rule.type === 'FORBIDDEN_PATTERN') {
      const regex = compileSafePattern(rule.value);
      if (!regex) continue;
      if (regex.test(text)) return { blocked: true, ruleViolated: rule.value };
    }
  }

  return { blocked: false };
}
