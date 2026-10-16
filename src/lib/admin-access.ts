/** Only a successful server role check can authorize the owner panel. */
export function canOpenAdmin(roleResult: boolean | null, error: unknown): boolean {
  return roleResult === true && !error;
}