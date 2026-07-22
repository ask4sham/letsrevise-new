/**
 * Module-level single-flight for fresh PracticeSet generation (Strict Mode safe).
 */
const inFlight = new Map<string, Promise<unknown>>();

export function runSingleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const p = Promise.resolve()
    .then(fn)
    .finally(() => {
      if (inFlight.get(key) === p) inFlight.delete(key);
    });
  inFlight.set(key, p);
  return p;
}

export function clearSingleFlightForTests(): void {
  inFlight.clear();
}
