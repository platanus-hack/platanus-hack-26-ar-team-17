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
