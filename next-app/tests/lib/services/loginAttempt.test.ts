jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import {
  createPendingLoginAttempt,
  markLoginAttemptDecision,
  getLoginAttempt,
} from '@/lib/services/loginAttempt.service';
const { supabase } = require('@/lib/db/supabase');

beforeEach(() => jest.clearAllMocks());

describe('createPendingLoginAttempt', () => {
  it('inserts a PENDING row keyed by session_id', async () => {
    let captured: unknown = null;
    supabase.from.mockReturnValueOnce({
      insert: (payload: unknown) => {
        captured = payload;
        return Promise.resolve({ error: null });
      },
    });
    await createPendingLoginAttempt('sess_1', 'user_1');
    expect(captured).toEqual({ session_id: 'sess_1', user_id: 'user_1', decision: 'PENDING' });
  });
});

describe('markLoginAttemptDecision', () => {
  it('updates decision and decided_at', async () => {
    let captured: unknown = null;
    supabase.from.mockReturnValueOnce({
      update: (payload: unknown) => {
        captured = payload;
        return { eq: jest.fn().mockResolvedValue({ error: null }) };
      },
    });
    await markLoginAttemptDecision('sess_1', 'APPROVED');
    expect((captured as { decision: string }).decision).toBe('APPROVED');
    expect((captured as { decided_at: string }).decided_at).toBeDefined();
  });
});

describe('getLoginAttempt', () => {
  it('returns the row when present', async () => {
    supabase.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({
            data: { session_id: 'sess_1', user_id: 'u1', decision: 'APPROVED' },
            error: null,
          }),
        }),
      }),
    });
    const attempt = await getLoginAttempt('sess_1');
    expect(attempt?.decision).toBe('APPROVED');
  });

  it('returns null when missing', async () => {
    supabase.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    expect(await getLoginAttempt('missing')).toBeNull();
  });
});
