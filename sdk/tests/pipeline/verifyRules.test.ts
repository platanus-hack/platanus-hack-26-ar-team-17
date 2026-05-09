import { verifyRules } from '../../src/pipeline/verifyRules';

describe('verifyRules', () => {
  it('returns blocked: false when platform api approves', () => {
    const result = verifyRules({ apiResponse: { valid: true, token: 't', userId: 'u', scope: [] } });
    expect(result.blocked).toBe(false);
  });

  it('returns blocked: true when platform api returns action_not_permitted', () => {
    const result = verifyRules({ apiResponse: { valid: false, error: 'action_not_permitted' } });
    expect(result.blocked).toBe(true);
  });
});
