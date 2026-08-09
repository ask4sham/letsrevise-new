/**
 * Ref-counted document.body scroll lock for overlays (lightbox, modals).
 * Each acquire returns an idempotent release closure for that acquire only.
 * Overflow is restored only when the final active lock is released.
 */

let lockCount = 0;
let savedOverflow = "";

/** Acquire a body scroll lock. Returns a release function (safe to call once). */
export function lockBodyScroll(): () => void {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (lockCount <= 0) return;
    lockCount -= 1;
    if (lockCount === 0) {
      document.body.style.overflow = savedOverflow;
      savedOverflow = "";
    }
  };
}

/** @internal Test harness only — not for application use. */
export function __resetBodyScrollLockForTests(): void {
  lockCount = 0;
  savedOverflow = "";
}

/** @internal Test harness only — not for application use. */
export function __getBodyScrollLockCountForTests(): number {
  return lockCount;
}
