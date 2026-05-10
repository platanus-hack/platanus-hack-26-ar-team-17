import { generateKeyPairSync, verify as cryptoVerify } from 'crypto';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import * as client from '../../src/http/client';
import { clearCache, getCachedToken } from '../../src/auth/cache';
import { performChallengeFlow } from '../../src/auth/challengeFlow';
import { buildChallengePayload, deriveMLDSAPublicKey } from '../../src/utils/ed25519';

function makeKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const privDer = privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer;
  const privHex = privDer.slice(16).toString('hex');
  const pubDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  const pubHex = pubDer.slice(12).toString('hex');
  return { privHex, pubHex };
}

describe('performChallengeFlow', () => {
  let postSpy: jest.SpyInstance;

  beforeEach(() => {
    clearCache();
    postSpy = jest.spyOn(client, 'post');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls challenge and verify endpoints and returns the JWT', async () => {
    const { privHex } = makeKeyPair();
    const challengeNonce = 'abc123';
    const challengeId = 'chal-uuid-1';
    const agentId = 'agent-uuid-1';

    postSpy
      .mockResolvedValueOnce({ challengeId, nonce: challengeNonce, timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() })
      .mockResolvedValueOnce({ accessToken: 'jwt-token', expiresAt: new Date(Date.now() + 300000).toISOString() });

    const result = await performChallengeFlow(agentId, privHex, 'send_message', 'mcp', 'https://api.example.com');

    expect(postSpy).toHaveBeenCalledTimes(2);
    expect(postSpy).toHaveBeenNthCalledWith(
      1,
      'https://api.example.com/api/agent-auth/challenge',
      { agentId, requestedAction: 'send_message', platform: 'mcp' },
    );
    expect(postSpy).toHaveBeenNthCalledWith(
      2,
      'https://api.example.com/api/agent-auth/verify',
      expect.objectContaining({ agentId, challengeId }),
    );
    expect(result.token).toBe('jwt-token');
  });

  it('caches the token after a successful flow', async () => {
    const { privHex } = makeKeyPair();
    postSpy
      .mockResolvedValueOnce({ challengeId: 'c', nonce: 'n', timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() })
      .mockResolvedValueOnce({ accessToken: 'cached-token', expiresAt: new Date(Date.now() + 300000).toISOString() });

    await performChallengeFlow('agent-1', privHex, 'action', 'mcp', 'https://api.example.com');

    expect(getCachedToken()).toBe('cached-token');
  });

  it('sends a valid Ed25519 signature to the verify endpoint', async () => {
    const { privHex, pubHex } = makeKeyPair();
    const challengeId = 'chal-sig-test';
    const nonce = 'nonce-sig-test';
    const agentId = 'agent-sig-test';

    postSpy
      .mockResolvedValueOnce({ challengeId, nonce, timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() })
      .mockResolvedValueOnce({ accessToken: 'tok', expiresAt: new Date(Date.now() + 300000).toISOString() });

    await performChallengeFlow(agentId, privHex, 'action', 'mcp', 'https://api.example.com');

    const { signature } = postSpy.mock.calls[1][1];
    const payload = buildChallengePayload(challengeId, nonce, agentId);
    const prefix = Buffer.from('302a300506032b6570032100', 'hex');
    const spkiDer = Buffer.concat([prefix, Buffer.from(pubHex, 'hex')]);
    const ok = cryptoVerify(null, Buffer.from(payload, 'utf8'), { key: spkiDer, format: 'der', type: 'spki' }, Buffer.from(signature, 'hex'));
    expect(ok).toBe(true);
  });

  it('includes signaturePqc in verify body when privateKeyPqcSeed is provided', async () => {
    const { privHex } = makeKeyPair();
    const pqcSeed = 'a'.repeat(64);
    const challengeId = 'chal-pqc-test';
    const nonce = 'nonce-pqc-test';
    const agentId = 'agent-pqc-test';

    postSpy
      .mockResolvedValueOnce({ challengeId, nonce, timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() })
      .mockResolvedValueOnce({ accessToken: 'jwt-pqc', expiresAt: new Date(Date.now() + 300000).toISOString() });

    await performChallengeFlow(agentId, privHex, 'action', 'mcp', 'https://api.example.com', pqcSeed);

    const verifyCall = postSpy.mock.calls[1][1];
    expect(verifyCall.signaturePqc).toMatch(/^[0-9a-f]{6618}$/);

    // Verify the PQC signature is valid
    const payload = buildChallengePayload(challengeId, nonce, agentId);
    const pubHex = deriveMLDSAPublicKey(pqcSeed);
    const ok = ml_dsa65.verify(
      Buffer.from(verifyCall.signaturePqc, 'hex'),
      Buffer.from(payload, 'utf8'),
      Buffer.from(pubHex, 'hex'),
    );
    expect(ok).toBe(true);
  });

  it('does not include signaturePqc when no PQC seed is provided', async () => {
    const { privHex } = makeKeyPair();

    postSpy
      .mockResolvedValueOnce({ challengeId: 'c', nonce: 'n', timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() })
      .mockResolvedValueOnce({ accessToken: 'tok', expiresAt: new Date(Date.now() + 300000).toISOString() });

    await performChallengeFlow('agent-1', privHex, 'action', 'mcp', 'https://api.example.com');

    const verifyCall = postSpy.mock.calls[1][1];
    expect(verifyCall.signaturePqc).toBeUndefined();
  });
});
