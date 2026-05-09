const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;
const ZERO_WIDTH_CHARS = /[​-‍﻿­͏ᅟᅠ឴឵᠋-᠍​-‏]/g;

export function normalizeAction(action: string): string {
  return action.replace(CONTROL_CHARS, '').trim().toLowerCase();
}

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
