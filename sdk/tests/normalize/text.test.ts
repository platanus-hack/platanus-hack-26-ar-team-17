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

  it('double URL encoding is decoded only one level deep', () => {
    // %2561 → decodeURIComponent → '%61'  (one pass), NOT → 'a'
    // because %25 decodes to '%', giving '%61' as a literal string
    expect(normalizeText('%2561')).toBe('%61');
  });

  it('malformed URL encoding falls back to original string', () => {
    // decodeURIComponent('%GG') throws URIError → catches and uses original
    expect(normalizeText('%GG')).toBe('%GG');
  });

  it('removes multiple consecutive zero-width chars', () => {
    // U+200B (zero-width space) + U+200C (zero-width non-joiner)
    expect(normalizeText('sp​‌am')).toBe('spam');
  });

  it('NFKC does not equate Cyrillic lookalikes to Latin chars', () => {
    // Cyrillic 'а' (U+0430) stays Cyrillic after NFKC — confusables are NOT normalised
    const cyrillic = 'spаm'; // looks like 'spam' but contains Cyrillic 'а'
    expect(normalizeText(cyrillic)).toBe('spаm');
  });
});
