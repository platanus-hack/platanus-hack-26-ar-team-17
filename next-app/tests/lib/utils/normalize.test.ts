import { normalizeAction, normalizeText } from '@/lib/utils/normalize';

describe('normalizeAction', () => {
  it('lowercases', () => expect(normalizeAction('SEND_MESSAGE')).toBe('send_message'));
  it('trims', () => expect(normalizeAction('  send_message  ')).toBe('send_message'));
  it('removes null bytes', () => expect(normalizeAction('send_message\x00')).toBe('send_message'));
});

describe('normalizeText', () => {
  it('applies NFKC normalization (fullwidth → ascii)', () => {
    expect(normalizeText('ｐｈａｒｍ')).toBe('pharm');
  });

  it('removes zero-width space', () => {
    expect(normalizeText('sp​am')).toBe('spam');
  });

  it('decodes URL encoding', () => {
    expect(normalizeText('sp%61m')).toBe('spam');
  });
});
