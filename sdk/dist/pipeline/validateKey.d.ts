import { ValidationResponse } from '../types';
interface ValidateParams {
    apiKey: string;
    userHash: string;
    action: string;
    platform: string;
    text: string;
    executedAt: string;
    platformApiUrl: string;
}
export declare function validateKeyAndGetToken(params: ValidateParams): Promise<ValidationResponse>;
export {};
//# sourceMappingURL=validateKey.d.ts.map