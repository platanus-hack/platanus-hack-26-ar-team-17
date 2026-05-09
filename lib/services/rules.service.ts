import { supabase } from '../db/supabase';
import { normalizeAction, normalizeText } from '../utils/normalize';

export interface RuleViolation {
  blocked: boolean;
  ruleViolated?: string;
}

export async function checkGlobalRules(params: {
  action: string;
  text: string;
}): Promise<RuleViolation> {
  const action = normalizeAction(params.action);
  const text = normalizeText(params.text).toLowerCase();

  const { data: rules } = await supabase.from('global_rules').select('*');
  if (!rules) return { blocked: false };

  for (const rule of rules) {
    if (rule.type === 'FORBIDDEN_ACTION' && rule.value === action) {
      return { blocked: true, ruleViolated: rule.value };
    }
  }

  for (const rule of rules) {
    if (rule.type === 'FORBIDDEN_KEYWORD' && text.includes(rule.value)) {
      return { blocked: true, ruleViolated: rule.value };
    }
    if (rule.type === 'FORBIDDEN_PATTERN') {
      const regex = new RegExp(rule.value, 'i');
      if (regex.test(text)) return { blocked: true, ruleViolated: rule.value };
    }
  }

  return { blocked: false };
}
