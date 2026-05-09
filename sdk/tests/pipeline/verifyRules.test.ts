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

  it('returns blocked: true with undefined error when valid=false and no error field', () => {
    const result = verifyRules({ apiResponse: { valid: false } });
    expect(result.blocked).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns blocked: false when valid=true even if error is set to a non-blocking value', () => {
    const result = verifyRules({ apiResponse: { valid: true, error: 'some_warning', token: 't', userId: 'u', scope: [] } });
    expect(result.blocked).toBe(false);
  });

  it('propagates the specific error string for invalid_api_key', () => {
    const result = verifyRules({ apiResponse: { valid: false, error: 'invalid_api_key' } });
    expect(result.blocked).toBe(true);
    expect(result.error).toBe('invalid_api_key');
  });
});
