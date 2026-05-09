import { AgentRequest, PipelineResult, SDKConfig } from './types';
export declare class AgentAuthSDK {
    private config;
    constructor(config: SDKConfig);
    run(request: AgentRequest): Promise<PipelineResult>;
}
export type { AgentRequest, PipelineResult, SDKConfig } from './types';
//# sourceMappingURL=index.d.ts.map