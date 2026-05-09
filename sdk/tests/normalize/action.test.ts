import { normalizeAction } from '../../src/normalize/action';

describe('normalizeAction', () => {
  it('lowercases', () => expect(normalizeAction('SEND_MESSAGE')).toBe('send_message'));
  it('trims', () => expect(normalizeAction('  send_message  ')).toBe('send_message'));
  it('removes null bytes', () => expect(normalizeAction('send_message\x00')).toBe('send_message'));
  it('removes control chars', () => expect(normalizeAction('send\x1fmessage')).toBe('sendmessage'));
});
