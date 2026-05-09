import { post } from '../http/client';
import { buildChallengePayload, signChallenge } from '../utils/ed25519';
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
}

export async function performChallengeFlow(
  agentId: string,
  privateKeyHex: string,
  requestedAction: string,
  platform: string,
  platformApiUrl: string,
): Promise<string> {
  const challenge = await post<ChallengeResponse>(
    `${platformApiUrl}/api/agent-auth/challenge`,
    { agentId, requestedAction, platform },
  );

  const payload = buildChallengePayload(challenge.challengeId, challenge.nonce, agentId);
  const signature = signChallenge(privateKeyHex, payload);

  const { accessToken, expiresAt } = await post<VerifyResponse>(
    `${platformApiUrl}/api/agent-auth/verify`,
    { agentId, challengeId: challenge.challengeId, signature },
  );

  setCachedToken(accessToken, expiresAt);
  return accessToken;
}
