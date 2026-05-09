export interface SDKConfig {
    apiKey?: string;
    userHash?: string;
}
export interface RunResult {
    allowed: boolean;
}
export declare class ZeroGateSDK {
    private apiKey;
    private userHash;
    private platform;
    constructor(config?: SDKConfig);
    run(): Promise<RunResult>;
}
//# sourceMappingURL=index.d.ts.map