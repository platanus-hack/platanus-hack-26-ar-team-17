import { ValidationResponse } from '../types';
interface VerifyRulesParams {
    apiResponse: ValidationResponse;
}
interface RulesResult {
    blocked: boolean;
    error?: string;
}
export declare function verifyRules(params: VerifyRulesParams): RulesResult;
export {};
//# sourceMappingURL=verifyRules.d.ts.map