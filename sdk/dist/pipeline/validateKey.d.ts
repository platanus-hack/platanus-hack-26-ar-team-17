import { ValidationResponse } from '../types';
interface ValidateParams {
    agentId: string;
    apiSecret: string;
    action: string;
    platform: string;
    platformApiUrl: string;
}
export declare function validate(params: ValidateParams): Promise<{
    allowed: boolean;
    token?: string;
}>;
interface ValidateKeyParams {
    apiKey: string;
    action: string;
    platform: string;
    text: string;
    platformApiUrl: string;
}
export declare function validateKeyAndGetToken(params: ValidateKeyParams): Promise<ValidationResponse>;
export {};
//# sourceMappingURL=validateKey.d.ts.map