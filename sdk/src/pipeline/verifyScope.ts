import { normalizeAction } from '../normalize/action';

export function verifyScope(action: string, scope: string[]): boolean {
  const normalized = normalizeAction(action);
  return scope.map(normalizeAction).includes(normalized);
}
