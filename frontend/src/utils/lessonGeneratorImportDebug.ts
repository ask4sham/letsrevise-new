export function isImportDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as { __LR_EXPORT_DEBUG__?: boolean }).__LR_EXPORT_DEBUG__);
}

export function logImportDebug(
  label: string,
  data: Record<string, unknown>
): void {
  if (!isImportDebugEnabled()) return;
  console.info(`[LR import debug] ${label}`, data);
}
