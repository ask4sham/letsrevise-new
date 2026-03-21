/**
 * Centralized auth storage — single source of truth for token/user in localStorage.
 * Keys: "token", "user"
 * Only LoginPage should set auth. Logout and 401 handlers must use clearAuth.
 */
const TOKEN_KEY = "token";
const USER_KEY = "user";

const DEBUG = typeof process !== "undefined" && process.env.REACT_APP_DEBUG_AUTH === "1";

function log(msg: string, data?: unknown) {
  if (DEBUG && typeof console !== "undefined") {
    console.log(`[auth] ${msg}`, data !== undefined ? data : "");
  }
}

/** Log auth state on load (dev only) to trace persistence bugs */
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const t = localStorage.getItem(TOKEN_KEY);
  const u = localStorage.getItem(USER_KEY);
  if (t || u) {
    console.info("[auth] On load: token=" + (t ? "present" : "absent") + ", user=" + (u ? "present" : "absent"));
  }
}

export function clearAuth(): void {
  try {
    const hadToken = !!localStorage.getItem(TOKEN_KEY);
    const hadUser = !!localStorage.getItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("postLoginRedirect");
    if (DEBUG && (hadToken || hadUser)) {
      console.log("[auth] clearAuth: removed token and user from localStorage");
    }
  } catch {
    // ignore
  }
}

export function readAuth(): { token: string | null; user: unknown | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    log("readAuth", { hasToken: !!token, hasUser: !!rawUser });
    if (!token || !rawUser) return { token: null, user: null };
    const user = JSON.parse(rawUser) as unknown;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

/** Only call on successful login. Never repopulate from profile/etc. */
export function setAuth(token: string, user: unknown): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    log("setAuth (login only)");
  } catch {
    // ignore
  }
}

/**
 * Update cached user object — only when we have a valid session (e.g. 200 from /users/me).
 * Does NOT set token. Use with caution.
 */
export function updateUser(user: unknown): void {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      log("updateUser: no token, skipping (won't repopulate user alone)");
      return;
    }
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    log("updateUser (token already present)");
  } catch {
    // ignore
  }
}
