"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performChallengeFlow = performChallengeFlow;
const client_1 = require("../http/client");
const ed25519_1 = require("../utils/ed25519");
const cache_1 = require("./cache");
async function performChallengeFlow(agentId, privateKeyHex, requestedAction, platform, platformApiUrl, privateKeyPqcSeed) {
    const challenge = await (0, client_1.post)(`${platformApiUrl}/api/agent-auth/challenge`, { agentId, requestedAction, platform });
    const payload = (0, ed25519_1.buildChallengePayload)(challenge.challengeId, challenge.nonce, agentId);
    const signature = (0, ed25519_1.signChallenge)(privateKeyHex, payload);
    const verifyBody = {
        agentId,
        challengeId: challenge.challengeId,
        signature,
    };
    if (privateKeyPqcSeed) {
        verifyBody.signaturePqc = (0, ed25519_1.signChallengeMLDSA)(privateKeyPqcSeed, payload);
    }
    const { accessToken, expiresAt, receipt } = await (0, client_1.post)(`${platformApiUrl}/api/agent-auth/verify`, verifyBody);
    (0, cache_1.setCachedToken)(accessToken, expiresAt);
    return { token: accessToken, receipt };
}
