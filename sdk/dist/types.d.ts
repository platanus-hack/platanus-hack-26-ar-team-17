export interface SDKConfig {
    /**
     * Agent UUID from the zero. platform.
     * Required for both HMAC mode and Ed25519+PQC mode.
     */
    agentId?: string;
    /**
     * HMAC secret for the agent. Defaults to env var ZERO_API_SECRET.
     * Required when using HMAC auth mode (agentId + apiSecret).
     */
    apiSecret?: string;
    /**
     * Ed25519 private key seed as a 64-char hex string (32 raw bytes).
     * Defaults to env var ZERO_PRIVATE_KEY.
     * Required when using Ed25519+PQC challenge-response auth mode.
     * The key is held in memory only and never sent over the network.
     */
    privateKey?: string;
    /**
     * ML-DSA-65 private key seed as a 64-char hex string (32 raw bytes).
     * Defaults to env var ZERO_PRIVATE_KEY_PQC.
     * Optional post-quantum signature added on top of Ed25519 in challenge-response mode.
     */
    privateKeyPqc?: string;
    /** Override the Platform API URL (useful for tests and local dev). */
    platformApiUrl?: string;
}
export interface ValidationResponse {
    allowed: boolean;
}
export interface PipelineResult {
    allowed: boolean;
}
//# sourceMappingURL=types.d.ts.map