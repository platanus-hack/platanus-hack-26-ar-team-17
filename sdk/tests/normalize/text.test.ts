import { normalizeText } from '../../src/normalize/text';

describe('normalizeText', () => {
  it('applies NFKC normalization (fullwidth → ascii)', () => {
    // Fullwidth chars (U+FF41 etc.) normalize to ASCII via NFKC
    expect(normalizeText('ｐｈａｒｍ')).toBe('pharm');
  });

  it('removes zero-width space', () => {
    expect(normalizeText('sp​am')).toBe('spam');
  });

  it('decodes URL encoding', () => {
    expect(normalizeText('sp%61m')).toBe('spam');
  });

  it('handles empty string', () => {
    expect(normalizeText('')).toBe('');
  });
});
