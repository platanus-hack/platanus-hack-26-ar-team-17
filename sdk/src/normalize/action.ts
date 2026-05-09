const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

export function normalizeAction(action: string): string {
  return action.replace(CONTROL_CHARS, '').trim().toLowerCase();
}
