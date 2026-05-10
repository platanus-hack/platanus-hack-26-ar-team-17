export function verifyScope(action: string, scope: string[]): boolean {
  if (scope.length === 0) return true;
  return scope.includes(action);
}
