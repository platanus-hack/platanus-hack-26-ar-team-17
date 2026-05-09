import { verifyScope, ALLOWED_ACTIONS } from '@/lib/services/scope.service';

describe('verifyScope', () => {
  it('returns true when action is in scope', () => {
    expect(verifyScope('send_message', ['send_message'])).toBe(true);
  });

  it('returns false when action is not in scope', () => {
    expect(verifyScope('delete_account', ['send_message'])).toBe(false);
  });

  it('returns false for action not in ALLOWED_ACTIONS enum', () => {
    expect(verifyScope('unknown_xyz', ['unknown_xyz'])).toBe(false);
  });

  it('normalizes case and whitespace', () => {
    expect(verifyScope('  SEND_MESSAGE  ', ['send_message'])).toBe(true);
  });
});
