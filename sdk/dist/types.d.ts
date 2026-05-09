export interface AgentRequest {
    apiKey: string;
    action: string;
    platform: string;
    text?: string;
}
export interface ValidationResponse {
    valid: boolean;
    token?: string;
    userId?: string;
    scope?: string[];
    error?: string;
}
export interface PipelineResult {
    allowed: boolean;
    token?: string;
    userId?: string;
    error?: string;
}
export interface SDKConfig {
    platformApiUrl: string;
}
//# sourceMappingURL=types.d.ts.map