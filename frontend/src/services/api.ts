// frontend/src/services/api.ts
import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";

/**
 * Base URL rules:
 * - If REACT_APP_API_URL exists, use it
 * - Else if REACT_APP_API_BASE exists, use it
 * - Else default to localhost
 *
 * IMPORTANT:
 * This file sets baseURL to `${API_HOST}/api`
 * and SAFELY strips a trailing `/api` from env vars
 * to prevent `/api/api` bugs.
 */

// When REACT_APP_API_BASE is set, use it (Docker, staging, prod).
// When unset on localhost, use "" so CRA proxy forwards /api/* to backend.
const isDev =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const rawFromEnv = (
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  ""
).trim();

const baseURL =
  rawFromEnv || (isDev ? "" : "http://localhost:5000");
const RAW_API_BASE = baseURL;

// Normalize host (remove trailing slashes AND trailing /api)
function normalizeApiHost(raw: string) {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;
}

const API_HOST = normalizeApiHost(RAW_API_BASE);
// In dev with proxy: baseURL "" so requests are same-origin; we'll send full path /api/... in interceptor.
const BASE_URL = baseURL === "" ? "" : `${API_HOST}/api`;

// ---- Guardrail logging + warnings (prevents silent drift) ----
(function logApiTargetOnce() {
  // eslint-disable-next-line no-console
  console.info("[LetsRevise] API_HOST:", API_HOST);
  // eslint-disable-next-line no-console
  console.info("[LetsRevise] axios baseURL:", BASE_URL);
  if (BASE_URL === "") {
    // eslint-disable-next-line no-console
    console.info("[LetsRevise] Using dev proxy: requests to /api/* are proxied to backend (ensure backend is running on port 5000).");
  }

  try {
    const isLocalUI =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    const apiIsRender = API_HOST.includes("onrender.com");
    const apiIsLocal =
      API_HOST.includes("localhost") || API_HOST.includes("127.0.0.1");

    if (isLocalUI && apiIsRender) {
      // eslint-disable-next-line no-console
      console.warn(
        "[LetsRevise] WARNING: UI is running on localhost but API_HOST points to Render. " +
          "This commonly causes invalid signature / 401 logout loops. " +
          "Fix env + clear localStorage + re-login."
      );
    }

    if (!isLocalUI && apiIsLocal) {
      // eslint-disable-next-line no-console
      console.warn(
        "[LetsRevise] WARNING: UI is not localhost but API_HOST points to localhost. " +
          "This is likely misconfigured for production/staging."
      );
    }
  } catch {
    // Ignore non-browser environments
  }
})();
// -------------------------------------------------------------

// Create axios instance with correct base URL
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // 120 seconds for AI calls (covers Render cold start ~60s)
  withCredentials: false, // Avoid CORS preflight issues; backend still works without
  headers: {
    "Content-Type": "application/json",
  },
});

// ===============================
// Request interceptor (baseURL + JWT)
// ===============================
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // In dev with proxy (baseURL ""): ensure path is /api/... so proxy forwards to backend /api/...
    if (BASE_URL === "" && config.url && !config.url.startsWith("/api")) {
      const path = config.url.startsWith("/") ? config.url : `/${config.url}`;
      config.url = `/api${path}`;
    }

    // FormData: do not set Content-Type so axios/browser sets multipart/form-data with boundary
    if (config.data && typeof FormData !== "undefined" && config.data instanceof FormData) {
      if (config.headers) {
        const h = config.headers as AxiosHeaders & Record<string, unknown>;
        if (typeof h.delete === "function") h.delete("Content-Type");
        else delete h["Content-Type"];
      }
    }

    const token = localStorage.getItem("token");

    if (token) {
      // Ensure headers are AxiosHeaders (Axios v1 safe)
      if (!config.headers) {
        config.headers = new AxiosHeaders();
      } else if (!(config.headers instanceof AxiosHeaders)) {
        config.headers = AxiosHeaders.from(config.headers as any);
      }

      (config.headers as AxiosHeaders).set("Authorization", `Bearer ${token}`);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ===============================
// Response interceptor (errors)
// ===============================
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    const data = error.response?.data as Record<string, unknown> | undefined;
    let message =
      (typeof data?.details === "string" ? data.details : null) ||
      (typeof data?.error === "string" ? data.error : null) ||
      (typeof data?.msg === "string" ? data.msg : null) ||
      (typeof data?.message === "string" ? data.message : null) ||
      error.message ||
      "Something went wrong";
    // Axios "Network Error" = request never reached server (backend down, wrong URL, CORS, etc.)
    if (message === "Network Error" || (error.message && error.message === "Network Error")) {
      const hint = BASE_URL
        ? "Backend may be starting (Render cold start ~60s). Try again in a moment."
        : "Set REACT_APP_API_BASE (e.g. https://letsrevise-new.onrender.com) and rebuild.";
      message = `Cannot reach server. ${hint}`;
    }

    if (error.response?.status === 401) {
      // Preserve existing behaviour
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    return Promise.reject({
      message,
      status: error.response?.status,
      data: error.response?.data,
    });
  }
);

/**
 * apiCall(method, url, data?, options?)
 * url is relative to /api
 *
 * Example:
 * apiCall("get", "/parent/children")
 */
export const apiCall = async <T = any>(
  method: "get" | "post" | "put" | "delete",
  url: string,
  data?: any,
  options?: AxiosRequestConfig
): Promise<T> => {
  try {
    const response = await api.request<T>({
      method,
      url,
      data,
      ...(options || {}),
    });
    return response.data;
  } catch (err) {
    console.error(`API Error (${method.toUpperCase()} ${url}):`, err);
    throw err;
  }
};

// Convenience exports (backwards-compatible)
export const get = (url: string, params?: any) => api.get(url, { params });
export const post = (url: string, data?: any) => api.post(url, data);
export const put = (url: string, data?: any) => api.put(url, data);
export const del = (url: string) => api.delete(url);

// ✅ NEW: Visuals helper
// GET /api/visuals/:conceptKey?level=KS3|GCSE|A-Level
export const getVisual = (conceptKey: string, level: string) =>
  api.get(`/visuals/${encodeURIComponent(conceptKey)}`, {
    params: { level },
  });

// GET /api/visuals/id/:id — for diagram blocks (visualId)
export const getVisualById = (id: string, level?: string) =>
  api.get(`/visuals/id/${encodeURIComponent(id)}`, {
    params: level ? { level } : undefined,
  });

// GET /api/visuals — list for diagram picker
export const listVisuals = (subject?: string) =>
  api.get("/visuals", { params: subject ? { subject } : undefined });

export default api;
