/**
 * PR-AUTH-UI-1: Single source of truth for current user + token from localStorage.
 * Uses authStorage — never writes except via validation clear.
 *
 * Token validation: When token+user exist, we validate via GET /api/users/me. If 401 (expired/invalid),
 * we clear localStorage so the user sees the public home page instead of "stuck" logged-in UI.
 */
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { readAuth as readAuthStorage, clearAuth } from "../utils/authStorage";
import { getErrorMessageFromData } from "../utils/apiErrorMessage";

export interface CurrentUser {
  _id: string;
  userType: string;
  shamCoins?: number;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  purchasedLessons?: Array<{ lessonId: string; purchasedAt: string }>;
  entitlements?: any;
  level?: string;
  stage?: string;
  educationLevel?: string;
  academicLevel?: string;
  [key: string]: any;
}

function readAuth(): { token: string | null; user: CurrentUser | null } {
  const { token, user } = readAuthStorage();
  return { token, user: user as CurrentUser | null };
}

export interface UseCurrentUserOptions {
  /** Re-read from localStorage when route (pathname/search/hash) changes. Default true. */
  watchLocation?: boolean;
}

export function useCurrentUser(options: UseCurrentUserOptions = {}) {
  const { watchLocation = true } = options;
  const location = useLocation();
  const [state, setState] = useState<{ token: string | null; user: CurrentUser | null }>(readAuth);

  const refresh = useCallback(() => {
    setState(readAuth());
  }, []);

  // On mount: hydrate once
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Validate token when we have one — clears stale auth so user sees public home
  useEffect(() => {
    const { token } = readAuth();
    if (!token) return;
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/users/me`
        : "";
    if (!url) return;
    let cancelled = false;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          clearAuth();
          setState({ token: null, user: null });
          if (process.env.NODE_ENV !== "production") {
            console.info("[auth] Token invalid (401), cleared localStorage");
          }
          return;
        }
        if (!res.ok && process.env.NODE_ENV !== "production") {
          const text = await res.text();
          let parsed: unknown;
          try {
            parsed = text ? JSON.parse(text) : null;
          } catch {
            parsed = null;
          }
          console.warn(
            "[auth] /users/me:",
            res.status,
            getErrorMessageFromData(parsed, `HTTP ${res.status}`)
          );
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Network error: keep current state (avoid clearing on transient failures)
      });
    return () => { cancelled = true; };
  }, []);

  // Cross-tab: when another tab updates storage
  useEffect(() => {
    const handleStorage = () => refresh();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [refresh]);

  // Same-tab: when location changes (e.g. after login redirect or dashboard click)
  useEffect(() => {
    if (watchLocation) refresh();
  }, [watchLocation, location.pathname, location.search, location.hash, refresh]);

  const { token, user } = state;
  const isLoggedIn = !!(token && user);

  return { token, user, isLoggedIn, refresh };
}
