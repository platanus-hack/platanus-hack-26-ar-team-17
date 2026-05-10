export interface SDKConfig {
    agentId?: string;
    apiSecret?: string;
}
export interface RunResult {
    allowed: boolean;
    token?: string;
}
export declare class ZeroGateSDK {
    private agentId;
    private apiSecret;
    private platform;
    constructor(config?: SDKConfig);
    run(): Promise<RunResult>;
}
//# sourceMappingURL=index.d.ts.map