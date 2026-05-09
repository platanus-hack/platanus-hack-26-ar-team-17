import { POST } from '@/app/api/validate/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/services/apiKey.service');
jest.mock('@/lib/services/token.service');
jest.mock('@/lib/services/scope.service');
jest.mock('@/lib/services/rules.service');
jest.mock('@/lib/services/auditLog.service');
jest.mock('@/lib/rateLimiter', () => ({ checkRateLimit: jest.fn().mockResolvedValue(true) }));

const { validateApiKeyHash } = require('@/lib/services/apiKey.service');
const { issueToken, verifyToken, isTokenRevoked } = require('@/lib/services/token.service');
const { verifyScope } = require('@/lib/services/scope.service');
const { checkGlobalRules } = require('@/lib/services/rules.service');
const { writeLog } = require('@/lib/services/auditLog.service');

const validKey = { id: 'key_1', user_id: 'user_1', scope: ['send_message'], status: 'ACTIVE' };

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/validate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
  });
}

describe('POST /api/validate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with token for a valid request', async () => {
    validateApiKeyHash.mockResolvedValue(validKey);
    issueToken.mockResolvedValue('jwt.token.here');
    verifyToken.mockResolvedValue({ jti: 'some-uuid' });
    isTokenRevoked.mockResolvedValue(false);
    verifyScope.mockReturnValue(true);
    checkGlobalRules.mockResolvedValue({ blocked: false });
    writeLog.mockResolvedValue({});

    const res = await POST(makeRequest({ api_key_hash: 'abc', action: 'send_message', platform: 'whatsapp', text: 'hello' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.token).toBe('jwt.token.here');
  });

  it('returns 401 for invalid api key', async () => {
    validateApiKeyHash.mockResolvedValue(null);
    writeLog.mockResolvedValue({});

    const res = await POST(makeRequest({ api_key_hash: 'bad', action: 'send_message', platform: 'whatsapp', text: '' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for scope violation', async () => {
    validateApiKeyHash.mockResolvedValue(validKey);
    issueToken.mockResolvedValue('tok');
    verifyToken.mockResolvedValue({ jti: 'jti-1' });
    isTokenRevoked.mockResolvedValue(false);
    verifyScope.mockReturnValue(false);
    writeLog.mockResolvedValue({});

    const res = await POST(makeRequest({ api_key_hash: 'abc', action: 'delete_account', platform: 'whatsapp', text: '' }));
    expect(res.status).toBe(403);
  });

  it('returns 403 for global rule violation', async () => {
    validateApiKeyHash.mockResolvedValue(validKey);
    issueToken.mockResolvedValue('tok');
    verifyToken.mockResolvedValue({ jti: 'jti-2' });
    isTokenRevoked.mockResolvedValue(false);
    verifyScope.mockReturnValue(true);
    checkGlobalRules.mockResolvedValue({ blocked: true, ruleViolated: 'mass_send' });
    writeLog.mockResolvedValue({});

    const res = await POST(makeRequest({ api_key_hash: 'abc', action: 'send_message', platform: 'whatsapp', text: 'spam' }));
    expect(res.status).toBe(403);
  });
});
