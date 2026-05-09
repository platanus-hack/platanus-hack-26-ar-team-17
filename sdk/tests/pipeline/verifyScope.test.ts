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
});
