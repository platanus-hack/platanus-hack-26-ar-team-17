import { ValidationResponse } from '../types';

interface VerifyRulesParams {
  apiResponse: ValidationResponse;
}

interface RulesResult {
  blocked: boolean;
  error?: string;
}

export function verifyRules(params: VerifyRulesParams): RulesResult {
  if (!params.apiResponse.valid || params.apiResponse.error === 'action_not_permitted') {
    return { blocked: true, error: params.apiResponse.error };
  }
  return { blocked: false };
}
