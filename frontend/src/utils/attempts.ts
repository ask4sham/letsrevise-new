/**
 * PR12: Log practice/checkpoint attempts (teacher monitoring).
 * Uses same API base + auth token pattern as events.ts. Swallows errors.
 */

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

export type AttemptPayload = {
  lessonId: string;
  source: "checkpoint" | "practice";
  questionType: "mcq" | "short";
  questionId?: string;
  selected?: string;
  answerText?: string;
  isCorrect: boolean;
  /** PR12.3: 1=low, 2=medium, 3=high. Optional; backend defaults to 2. */
  confidence?: 1 | 2 | 3;
  /** Lesson `pages[].pageId` for checkpoint source — optional but recommended for analytics. */
  pageId?: string;
  /** Optional revision when checkpoint content changes (string or number). */
  checkpointRevision?: string | number;
};

export async function logAttempt(payload: AttemptPayload): Promise<void> {
  try {
    const url = API_BASE ? `${API_BASE}/attempts` : "/api/attempts";
    const token =
      typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // swallow errors; logging must never break UX
  }
}
