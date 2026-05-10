import { consumeNonce, cleanupExpiredNonces } from '@/lib/services/nonce.service';

jest.mock('@/lib/db/supabase', () => ({ supabase: { from: jest.fn() } }));

const { supabase } = require('@/lib/db/supabase');

const AGENT_ID = '00000000-0000-0000-0000-000000000001';
const NONCE = 'abc123nonce';
const EXPIRES = new Date(Date.now() + 5 * 60 * 1000);

function mockInsert(error: unknown) {
  supabase.from.mockReturnValueOnce({
    insert: jest.fn().mockResolvedValue({ error }),
  });
}

function mockDelete() {
  supabase.from.mockReturnValueOnce({
    delete: jest.fn().mockReturnValue({
      lt: jest.fn().mockResolvedValue({ error: null }),
    }),
  });
}

describe('consumeNonce', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns true when nonce is inserted successfully', async () => {
    mockInsert(null);
    const result = await consumeNonce(NONCE, AGENT_ID, EXPIRES);
    expect(result).toBe(true);
  });

  it('returns false when nonce already exists (unique constraint violation)', async () => {
    mockInsert({ code: '23505', message: 'duplicate key value' });
    const result = await consumeNonce(NONCE, AGENT_ID, EXPIRES);
    expect(result).toBe(false);
  });

  it('throws on unexpected database errors', async () => {
    mockInsert({ code: '42P01', message: 'relation does not exist' });
    await expect(consumeNonce(NONCE, AGENT_ID, EXPIRES)).rejects.toMatchObject({ code: '42P01' });
  });

  it('passes correct fields to supabase insert', async () => {
    const insertSpy = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValueOnce({ insert: insertSpy });

    await consumeNonce(NONCE, AGENT_ID, EXPIRES);

    expect(insertSpy).toHaveBeenCalledWith({
      nonce: NONCE,
      agent_id: AGENT_ID,
      expires_at: EXPIRES.toISOString(),
    });
  });
});

describe('cleanupExpiredNonces', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes nonces with expires_at in the past', async () => {
    mockDelete();
    await expect(cleanupExpiredNonces()).resolves.not.toThrow();
    expect(supabase.from).toHaveBeenCalledWith('nonces');
  });
});
