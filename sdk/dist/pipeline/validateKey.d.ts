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
export {};
//# sourceMappingURL=validateKey.d.ts.map