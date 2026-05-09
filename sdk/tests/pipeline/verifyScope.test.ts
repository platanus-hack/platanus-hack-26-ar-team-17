import { verifyScope } from '../../src/pipeline/verifyScope';

describe('verifyScope', () => {
  it('returns true when action is in scope', () => {
    expect(verifyScope('send_message', ['send_message', 'read_messages'])).toBe(true);
  });

  it('returns false when action is not in scope', () => {
    expect(verifyScope('delete_account', ['send_message'])).toBe(false);
  });

  it('normalizes before comparing', () => {
    expect(verifyScope('SEND_MESSAGE', ['send_message'])).toBe(true);
  });

  it('returns false for empty scope array', () =>
    expect(verifyScope('send_message', [])).toBe(false));

  it('normalizes scope entries (uppercase in scope list)', () =>
    expect(verifyScope('send_message', ['SEND_MESSAGE'])).toBe(true));

  it('returns false when action normalizes to empty string', () =>
    // '\x00\x01' → '' after normalizeAction; '' is not in any scope
    expect(verifyScope('\x00\x01', ['send_message'])).toBe(false));

  it('returns false for empty action string', () =>
    expect(verifyScope('', ['send_message'])).toBe(false));
});
