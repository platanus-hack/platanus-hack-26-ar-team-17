interface ValidateParams {
    token: string;
    hash: string;
    action: string;
    platform: string;
    platformApiUrl: string;
}
export declare function validate(params: ValidateParams): Promise<{
    allowed: boolean;
}>;
export {};
//# sourceMappingURL=validateKey.d.ts.map