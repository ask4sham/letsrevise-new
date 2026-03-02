/**
 * Canonical doc filenames for Content Coverage (Sprint Order / Question Bank Audit).
 * Use hyphen in filenames; never spaces — matches backend scripts and docs viewer.
 */
export function specKeyToFileKey(specKey: string): string {
  return (specKey || "").trim().toLowerCase().replace(/_/g, "-");
}

export function sprintOrderFilename(specKey: string): string {
  return `SPRINT_ORDER_${specKeyToFileKey(specKey)}.md`;
}

export function questionBankAuditFilename(specKey: string): string {
  return `QUESTION_BANK_AUDIT_${specKeyToFileKey(specKey)}.md`;
}
