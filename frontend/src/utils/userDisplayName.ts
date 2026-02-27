/**
 * PR-AUTH-UI-1: Centralize display name derivation for consistent UI (avatar, review CTA, etc.).
 */
export function getUserDisplayName(user: any): string | undefined {
  return (
    user?.firstName?.trim() ||
    user?.name?.split?.(" ")?.[0]?.trim() ||
    user?.email?.split?.("@")?.[0] ||
    undefined
  );
}
