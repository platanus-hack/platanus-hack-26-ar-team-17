export declare function generateNonce(): string;
export declare function buildPayload(agentId: string, timestamp: string, nonce: string, action: string, platform: string): string;
export declare function signPayload(secret: string, payload: string): string;
//# sourceMappingURL=hmac.d.ts.map