import { validateApiKeyAndHash, createApiKey, revokeApiKey } from '@/lib/services/apiKey.service';

jest.mock('@/lib/db/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { supabase } = require('@/lib/db/supabase');

beforeEach(() => jest.clearAllMocks());

function selectSingle(singleResult: unknown) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(singleResult),
      }),
    }),
  };
}

describe('validateApiKeyAndHash', () => {
  it('returns the joined record for a valid active key with correct hash', async () => {
    supabase.from.mockReturnValueOnce(
      selectSingle({
        data: {
          id: 'key_1',
          agent_id: 'agent_1',
          status: 'ACTIVE',
          agents: { user_id: 'user_1', status: 'ACTIVE', users: { hash: 'correct-hash' } },
        },
        error: null,
      })
    );
    expect(await validateApiKeyAndHash('abc', 'correct-hash')).toMatchObject({
      id: 'key_1',
      agent_id: 'agent_1',
      user_id: 'user_1',
    });
  });

  it('returns null for unknown hash', async () => {
    supabase.from.mockReturnValueOnce(
      selectSingle({ data: null, error: { message: 'not found' } })
    );
    expect(await validateApiKeyAndHash('unknown', 'hash')).toBeNull();
  });

  it('returns null for revoked key', async () => {
    supabase.from.mockReturnValueOnce(
      selectSingle({
        data: { id: 'key_2', agent_id: 'agent_2', status: 'REVOKED', agents: { user_id: 'u', status: 'ACTIVE', users: { hash: 'h' } } },
        error: null,
      })
    );
    expect(await validateApiKeyAndHash('revoked', 'h')).toBeNull();
  });

  it('returns null when the parent agent is disabled', async () => {
    supabase.from.mockReturnValueOnce(
      selectSingle({
        data: { id: 'key_3', agent_id: 'agent_3', status: 'ACTIVE', agents: { user_id: 'u', status: 'DISABLED', users: { hash: 'h' } } },
        error: null,
      })
    );
    expect(await validateApiKeyAndHash('disabled-agent', 'h')).toBeNull();
  });

  it('returns null when user hash does not match', async () => {
    supabase.from.mockReturnValueOnce(
      selectSingle({
        data: { id: 'key_4', agent_id: 'agent_4', status: 'ACTIVE', agents: { user_id: 'u', status: 'ACTIVE', users: { hash: 'correct' } } },
        error: null,
      })
    );
    expect(await validateApiKeyAndHash('key', 'wrong-hash')).toBeNull();
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
    const result = await createApiKey({ agentId: 'agent_1', name: 'default' });
    expect(result.plainKey.startsWith('ak_')).toBe(true);
    expect(result.id).toBe('key_3');
  });
});

describe('revokeApiKey', () => {
  it('revokes when the key belongs to the user', async () => {
    supabase.from
      .mockReturnValueOnce(selectSingle({
        data: { id: 'key_1', agents: { user_id: 'user_1' } },
        error: null,
      }))
      .mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });
    await expect(revokeApiKey('key_1', 'user_1')).resolves.not.toThrow();
  });

  it('no-ops when the key belongs to a different user', async () => {
    supabase.from.mockReturnValueOnce(selectSingle({
      data: { id: 'key_1', agents: { user_id: 'someone_else' } },
      error: null,
    }));
    await expect(revokeApiKey('key_1', 'user_1')).resolves.not.toThrow();
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});
