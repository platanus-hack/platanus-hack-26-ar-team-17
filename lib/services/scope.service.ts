import { normalizeAction } from '../utils/normalize';

export const ALLOWED_ACTIONS = new Set([
  'send_message',
  'read_messages',
  'create_post',
  'delete_post',
  'read_profile',
  'update_profile',
]);

export function verifyScope(rawAction: string, scope: string[]): boolean {
  const action = normalizeAction(rawAction);
  if (!ALLOWED_ACTIONS.has(action)) return false;
  return scope.map(normalizeAction).includes(action);
}
