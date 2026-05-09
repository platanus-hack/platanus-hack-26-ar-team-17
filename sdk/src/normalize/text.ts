const ZERO_WIDTH_CHARS = /[​-‍﻿­͏ᅟᅠ឴឵᠋-᠍​-‏]/g;

export function normalizeText(text: string): string {
  if (!text) return '';

  let result = text;

  try {
    result = decodeURIComponent(result);
  } catch {
    // use original if decode fails
  }

  return result.normalize('NFKC').replace(ZERO_WIDTH_CHARS, '');
}
