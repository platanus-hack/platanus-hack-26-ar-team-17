export interface ChallengeFlowResult {
    token: string;
    receipt?: string;
}
export declare function performChallengeFlow(agentId: string, privateKeyHex: string, requestedAction: string, platform: string, platformApiUrl: string): Promise<ChallengeFlowResult>;
//# sourceMappingURL=challengeFlow.d.ts.map