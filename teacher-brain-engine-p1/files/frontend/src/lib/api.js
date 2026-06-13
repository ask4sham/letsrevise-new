import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
const API = `${BASE}/api`;

const TOKEN_KEY = "tb.access_token";

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore quota/permission errors */
    }
  },
  clear: () => tokenStore.set(null),
};

const client = axios.create({
  baseURL: API,
  timeout: 120_000,
});

// Attach Bearer token on every request
client.interceptors.request.use((config) => {
  const t = tokenStore.get();
  if (t) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

// 401 → wipe token + bounce to /login. 429 is NOT redirected (budget cap).
let isHandling401 = false;
client.interceptors.response.use(
  (r) => r,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    if (status === 401 && !url.includes("/auth/") && !isHandling401) {
      isHandling401 = true;
      tokenStore.clear();
      const next = encodeURIComponent(
        window.location.pathname + window.location.search
      );
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = `/login?next=${next}`;
      }
      setTimeout(() => {
        isHandling401 = false;
      }, 800);
    }
    return Promise.reject(error);
  }
);

// ----- Error shape helpers -----

/** True if the error is a 429 budget-cap response. */
export function is429(error) {
  return error?.response?.status === 429;
}

/** True if the error is a 422 schema-validation response. */
export function is422(error) {
  return error?.response?.status === 422;
}

/** True if the error is a 503 transient LLM provider/timeout response. */
export function is503(error) {
  return error?.response?.status === 503;
}

/** True if the error is a 409 in-flight-duplicate response. */
export function is409(error) {
  return error?.response?.status === 409;
}

/**
 * Extracts a user-friendly string from any axios error response.
 * Handles 429 budget shape: {detail, code, limit_type}.
 * Handles 422 validation shape: {detail, code, validation_errors}.
 * Handles FastAPI 422 detail arrays of {msg,...} objects.
 */
export function formatApiError(error) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  if (status === 429) {
    if (data?.detail && typeof data.detail === "string") return data.detail;
    if (data?.limit_type === "daily")
      return "Daily AI usage limit reached. Please try again tomorrow.";
    if (data?.limit_type === "monthly")
      return "Monthly AI usage limit reached.";
    return "AI usage limit reached.";
  }
  if (status === 422 && data?.code === "INVALID_GENERATED_LESSON") {
    return (
      data.detail ||
      "The AI response was not valid enough to save. Please try again."
    );
  }
  if (status === 503) {
    if (data?.code === "LLM_TIMEOUT")
      return "The AI service took too long to respond. Please try again.";
    return "The AI service is temporarily unavailable. Please try again.";
  }
  if (status === 409 && data?.code === "GENERATION_ALREADY_IN_PROGRESS") {
    return "A generation request is already in progress. Please wait.";
  }
  const detail = data?.detail;
  if (detail == null) return error?.message || "Request failed.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

/** Returns the budget-cap response payload if 429, else null. */
export function get429Payload(error) {
  if (!is429(error)) return null;
  const data = error?.response?.data || {};
  return {
    detail: data.detail || "AI usage limit reached.",
    code: data.code || "LLM_LIMIT_REACHED",
    limit_type: data.limit_type || "unknown",
  };
}

/** Returns the validation-error payload if a 422 INVALID_GENERATED_LESSON, else null. */
export function get422Payload(error) {
  if (!is422(error)) return null;
  const data = error?.response?.data || {};
  if (data.code !== "INVALID_GENERATED_LESSON") return null;
  return {
    detail:
      data.detail ||
      "The AI response was not valid enough to save. Please try again.",
    code: data.code,
    validation_errors: Array.isArray(data.validation_errors)
      ? data.validation_errors.slice(0, 6)
      : [],
  };
}

/** Returns the 503 provider-failure payload if applicable, else null. */
export function get503Payload(error) {
  if (!is503(error)) return null;
  const data = error?.response?.data || {};
  return {
    detail:
      data.detail ||
      "The AI service is temporarily unavailable. Please try again.",
    code: data.code || "LLM_PROVIDER_UNAVAILABLE",
    retryable: data.retryable !== false,
  };
}

export const api = {
  // ----- AUTH -----
  login: (email, password) =>
    client.post("/auth/login", { email, password }).then((r) => r.data),
  register: (email, password, name) =>
    client.post("/auth/register", { email, password, name }).then((r) => r.data),
  me: () => client.get("/auth/me").then((r) => r.data),
  logout: () =>
    client
      .post("/auth/logout")
      .then((r) => r.data)
      .catch(() => ({ ok: true })),
  usage: () => client.get("/auth/usage").then((r) => r.data),

  // ----- LESSONS -----
  health: () => client.get("/").then((r) => r.data),
  generate: (topic, exam_board = "AQA", tier = "Higher") =>
    client.post("/lessons/generate", { topic, exam_board, tier }).then((r) => r.data),
  score: (blocks) =>
    client.post("/lessons/score", { blocks }).then((r) => r.data),
  list: (limit = 30) =>
    client.get("/lessons", { params: { limit } }).then((r) => r.data),
  get: (id) => client.get(`/lessons/${id}`).then((r) => r.data),
  remove: (id) => client.delete(`/lessons/${id}`).then((r) => r.data),
  mark: (lessonId, payload) =>
    client.post(`/lessons/${lessonId}/mark`, payload).then((r) => r.data),

  // ----- VISUAL EXPLANATIONS (P1.0) -----
  generateVisualExplanation: (payload) =>
    client.post("/visual-explanations/generate", payload).then((r) => r.data),
};

export default api;
