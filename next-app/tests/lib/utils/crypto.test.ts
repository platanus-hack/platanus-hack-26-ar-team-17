import { generateApiKey, hashApiKey, getKeyPrefix } from '@/lib/utils/crypto';

describe('generateApiKey', () => {
  it('generates a key with ak_ prefix', () => {
    expect(generateApiKey().startsWith('ak_')).toBe(true);
  });

  it('generates a key with at least 40 chars after prefix', () => {
    expect(generateApiKey().replace('ak_', '').length).toBeGreaterThanOrEqual(40);
  });

  it('generates unique keys', () => {
    const keys = new Set(Array.from({ length: 1000 }, () => generateApiKey()));
    expect(keys.size).toBe(1000);
  });
});

describe('hashApiKey', () => {
  it('returns a consistent hash', () => {
    const key = 'ak_testkey123';
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });

  it('never returns the original key', () => {
    const key = 'ak_testkey123';
    expect(hashApiKey(key)).not.toBe(key);
  });
});
