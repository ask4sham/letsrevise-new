// frontend/src/utils/events.ts — paywall conversion events (backend survives adblock/refresh)

const RAW_API_BASE = (
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_API_BASE ||
  ""
).trim();
function normalizeApiHost(raw: string) {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;
}
const API_HOST = RAW_API_BASE ? normalizeApiHost(RAW_API_BASE) : "";
const API_BASE = API_HOST ? `${API_HOST}/api` : "";

export type PaywallEventType =
  | "PAYWALL_NOT_ENTITLED"
  | "FREE_PREVIEW_VIEW"
  | "SUBSCRIBE_CTA_CLICK";

export async function logPaywallEvent(
  type: PaywallEventType,
  params?: { lessonId?: string; meta?: Record<string, unknown> }
): Promise<void> {
  try {
    const url = API_BASE ? `${API_BASE}/events` : "/api/events";
    const token =
      typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        type,
        lessonId: params?.lessonId,
        meta: params?.meta || {},
      }),
      keepalive: true,
    });
  } catch {
    // swallow errors; logging must never break UX
  }
}
