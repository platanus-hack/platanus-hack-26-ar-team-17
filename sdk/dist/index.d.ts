export interface SDKConfig {
    agentId?: string;
    apiSecret?: string;
    privateKey?: string;
    privateKeyPqc?: string;
    /** Override the Platform API URL (useful for tests and local dev). */
    platformApiUrl?: string;
}
export interface RunResult {
    allowed: boolean;
    token?: string;
    receipt?: string;
}
export declare class ZeroGateSDK {
    private agentId;
    private apiSecret;
    private privateKey;
    private privateKeyPqc;
    private platform;
    private platformApiUrl;
    private readonly mode;
    constructor(config?: SDKConfig);
    run(): Promise<RunResult>;
}
//# sourceMappingURL=index.d.ts.map