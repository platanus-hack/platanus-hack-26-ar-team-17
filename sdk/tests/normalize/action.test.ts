import { normalizeAction } from '../../src/normalize/action';

describe('normalizeAction', () => {
  it('lowercases', () => expect(normalizeAction('SEND_MESSAGE')).toBe('send_message'));
  it('trims', () => expect(normalizeAction('  send_message  ')).toBe('send_message'));
  it('removes null bytes', () => expect(normalizeAction('send_message\x00')).toBe('send_message'));
  it('removes control chars', () => expect(normalizeAction('send\x1fmessage')).toBe('sendmessage'));

  it('removes tab characters (\\t is \\x09, inside \\x00-\\x1F)', () =>
    expect(normalizeAction('send\tmessage')).toBe('sendmessage'));

  it('removes embedded newlines', () =>
    expect(normalizeAction('send\nmessage')).toBe('sendmessage'));

  it('empty string returns empty string', () =>
    expect(normalizeAction('')).toBe(''));

  it('only control chars returns empty string', () =>
    expect(normalizeAction('\x00\x01\x1F')).toBe(''));

  it('only whitespace returns empty string after trim', () =>
    expect(normalizeAction('   ')).toBe(''));

  it('preserves underscores and digits', () =>
    expect(normalizeAction('send_message_123')).toBe('send_message_123'));

  it('does not collapse internal spaces (only trims edges)', () =>
    expect(normalizeAction('send message')).toBe('send message'));
});
