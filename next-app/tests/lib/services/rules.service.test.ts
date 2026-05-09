import { checkGlobalRules } from '@/lib/services/rules.service';

jest.mock('@/lib/db/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        data: [
          { type: 'FORBIDDEN_ACTION', value: 'mass_send' },
          { type: 'FORBIDDEN_KEYWORD', value: 'buy now click here' },
        ],
        error: null,
      }),
    }),
  },
}));

describe('checkGlobalRules', () => {
  it('blocks a forbidden action', async () => {
    const result = await checkGlobalRules({ action: 'mass_send', text: 'hello' });
    expect(result.blocked).toBe(true);
    expect(result.ruleViolated).toBe('mass_send');
  });

  it('allows a clean action', async () => {
    const result = await checkGlobalRules({ action: 'send_message', text: 'hello' });
    expect(result.blocked).toBe(false);
  });

  it('blocks text with forbidden keyword after normalization', async () => {
    const result = await checkGlobalRules({ action: 'send_message', text: 'BUY NOW CLICK HERE' });
    expect(result.blocked).toBe(true);
  });

  it('blocks text with forbidden keyword lowercased', async () => {
    const result = await checkGlobalRules({ action: 'send_message', text: 'buy now click here extra' });
    expect(result.blocked).toBe(true);
  });
});

describe('checkGlobalRules — extended edge cases', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns not blocked when rules array is empty', async () => {
    const { supabase } = require('@/lib/db/supabase');
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    const result = await checkGlobalRules({ action: 'send_message', text: 'hello' });
    expect(result.blocked).toBe(false);
  });

  it('FORBIDDEN_PATTERN matches via regex (case-insensitive)', async () => {
    const { supabase } = require('@/lib/db/supabase');
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: [{ type: 'FORBIDDEN_PATTERN', value: 'buy\\s+now' }],
        error: null,
      }),
    });

    const result = await checkGlobalRules({ action: 'send_message', text: 'BUY     NOW!' });
    expect(result.blocked).toBe(true);
    expect(result.ruleViolated).toBe('buy\\s+now');
  });

  it('FORBIDDEN_KEYWORD matches as substring within text', async () => {
    const { supabase } = require('@/lib/db/supabase');
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: [{ type: 'FORBIDDEN_KEYWORD', value: 'spam' }],
        error: null,
      }),
    });

    const result = await checkGlobalRules({ action: 'send_message', text: 'This is a spammer' });
    expect(result.blocked).toBe(true);
  });

  it('FORBIDDEN_ACTION check uses normalized (lowercase) action', async () => {
    const { supabase } = require('@/lib/db/supabase');
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: [{ type: 'FORBIDDEN_ACTION', value: 'mass_send' }],
        error: null,
      }),
    });

    const result = await checkGlobalRules({ action: 'MASS_SEND', text: '' });
    expect(result.blocked).toBe(true);
    expect(result.ruleViolated).toBe('mass_send');
  });

  it('FORBIDDEN_KEYWORD checks text only, not action', async () => {
    const { supabase } = require('@/lib/db/supabase');
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: [{ type: 'FORBIDDEN_KEYWORD', value: 'mass_send' }],
        error: null,
      }),
    });

    // 'mass_send' appears in the action, but keyword check is against text only
    const result = await checkGlobalRules({ action: 'mass_send', text: 'hello world' });
    expect(result.blocked).toBe(false);
  });
});
