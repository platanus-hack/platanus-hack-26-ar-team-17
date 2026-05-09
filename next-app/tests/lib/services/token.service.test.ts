import {
  issueToken,
  issueUserToken,
  verifyToken,
  revokeToken,
  isTokenRevoked,
} from '@/lib/services/token.service';

jest.mock('@/lib/db/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

describe('token.service', () => {
  const payload = { userId: 'user_1', apiKeyId: 'key_1', scope: ['send_message'] };

  describe('issueToken', () => {
    it('returns a JWT string', async () => {
      const token = await issueToken(payload);
      expect(token.split('.').length).toBe(3);
    });

    it('includes type: sdk_token', async () => {
      const token = await issueToken(payload);
      const decoded = await verifyToken(token);
      expect(decoded.type).toBe('sdk_token');
    });

    it('includes a jti', async () => {
      const token = await issueToken(payload);
      const decoded = await verifyToken(token);
      expect(decoded.jti).toBeDefined();
    });
  });

  describe('issueUserToken', () => {
    it('includes type: user_session', async () => {
      const token = await issueUserToken('user_1');
      const decoded = await verifyToken(token);
      expect(decoded.type).toBe('user_session');
    });
  });

  describe('revokeToken + isTokenRevoked', () => {
    it('marks a jti as revoked', async () => {
      const { supabase } = require('@/lib/db/supabase');
      supabase.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { jti: 'some-jti' }, error: null }),
          }),
        }),
      });

      await revokeToken('some-jti');
      expect(await isTokenRevoked('some-jti')).toBe(true);
    });
  });
});
