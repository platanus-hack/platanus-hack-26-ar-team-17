import { validateApiKeyHash, createApiKey, revokeApiKey } from '@/lib/services/apiKey.service';

jest.mock('@/lib/db/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { supabase } = require('@/lib/db/supabase');

function mockChain(singleResult: unknown) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(singleResult),
      }),
    }),
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(singleResult),
      }),
    }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    }),
  };
}

describe('validateApiKeyHash', () => {
  it('returns the record for a valid active key hash', async () => {
    supabase.from.mockReturnValueOnce(
      mockChain({ data: { id: 'key_1', user_id: 'user_1', key_hash: 'abc', scope: ['send_message'], status: 'ACTIVE' }, error: null })
    );
    expect(await validateApiKeyHash('abc')).toMatchObject({ id: 'key_1' });
  });

  it('returns null for unknown hash', async () => {
    supabase.from.mockReturnValueOnce(
      mockChain({ data: null, error: { message: 'not found' } })
    );
    expect(await validateApiKeyHash('unknown')).toBeNull();
  });

  it('returns null for revoked key', async () => {
    supabase.from.mockReturnValueOnce(
      mockChain({ data: { id: 'key_2', status: 'REVOKED' }, error: null })
    );
    expect(await validateApiKeyHash('revoked')).toBeNull();
  });
});

describe('createApiKey', () => {
  it('creates and returns the plain key once', async () => {
    supabase.from.mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'key_3', prefix: 'ak_testke' }, error: null }),
        }),
      }),
    });
    const result = await createApiKey({ userId: 'u1', name: 'Agent', scope: ['send_message'] });
    expect(result.plainKey.startsWith('ak_')).toBe(true);
  });
});

describe('revokeApiKey', () => {
  it('sets status to REVOKED', async () => {
    supabase.from.mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });
    await expect(revokeApiKey('key_1', 'user_1')).resolves.not.toThrow();
  });
});
