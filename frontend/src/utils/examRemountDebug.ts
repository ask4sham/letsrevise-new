/**
 * Temporary instrumentation for embedded exam question remount investigation.
 * Remove after root cause is confirmed and fixed.
 *
 * Enabled in development automatically.
 * On production builds, add ?examRemountDebug=1 to the lesson URL.
 */
function formatTimestamp(): string {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

export function isExamRemountDebugEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem("examRemountDebug") === "1") return true;
    return new URLSearchParams(window.location.search).get("examRemountDebug") === "1";
  } catch {
    return false;
  }
}

export function examRemountLog(event: string, detail?: Record<string, unknown>): void {
  if (!isExamRemountDebugEnabled()) return;
  const ts = formatTimestamp();
  if (detail != null) {
    console.log(`[exam-remount] ${ts} ${event}`, detail);
  } else {
    console.log(`[exam-remount] ${ts} ${event}`);
  }
}
