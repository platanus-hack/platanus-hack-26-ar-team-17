import { post } from '../http/client';
import { buildChallengePayload, signChallenge, signChallengeMLDSA } from '../utils/ed25519';
import { setCachedToken } from './cache';

interface ChallengeResponse {
  challengeId: string;
  nonce: string;
  timestamp: string;
  expiresAt: string;
}

interface VerifyResponse {
  accessToken: string;
  expiresAt: string;
  receipt?: string;
}

export interface ChallengeFlowResult {
  token: string;
  receipt?: string;
}

export async function performChallengeFlow(
  agentId: string,
  privateKeyHex: string,
  requestedAction: string,
  platform: string,
  platformApiUrl: string,
  privateKeyPqcSeed?: string,
): Promise<ChallengeFlowResult> {
  const challenge = await post<ChallengeResponse>(
    `${platformApiUrl}/api/agent-auth/challenge`,
    { agentId, requestedAction, platform },
  );

  const payload = buildChallengePayload(challenge.challengeId, challenge.nonce, agentId);
  const signature = signChallenge(privateKeyHex, payload);

  const verifyBody: Record<string, string> = {
    agentId,
    challengeId: challenge.challengeId,
    signature,
  };
  if (privateKeyPqcSeed) {
    verifyBody.signaturePqc = signChallengeMLDSA(privateKeyPqcSeed, payload);
  }

  const { accessToken, expiresAt, receipt } = await post<VerifyResponse>(
    `${platformApiUrl}/api/agent-auth/verify`,
    verifyBody,
  );

  setCachedToken(accessToken, expiresAt);
  return { token: accessToken, receipt };
}
