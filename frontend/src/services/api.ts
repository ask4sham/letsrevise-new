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

// Raw value from env or fallback
const RAW_API_BASE =
  (process.env.REACT_APP_API_URL ||
    process.env.REACT_APP_API_BASE ||
    "").trim() || "http://localhost:5000";

// Normalize host (remove trailing slashes AND trailing /api)
function normalizeApiHost(raw: string) {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;
}

const API_HOST = normalizeApiHost(RAW_API_BASE);
const BASE_URL = `${API_HOST}/api`;

// ---- Guardrail logging + warnings (prevents silent drift) ----
(function logApiTargetOnce() {
  // eslint-disable-next-line no-console
  console.info("[LetsRevise] API_HOST:", API_HOST);
  // eslint-disable-next-line no-console
  console.info("[LetsRevise] axios baseURL:", BASE_URL);

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
  timeout: 120000, // 120 seconds for AI calls
  headers: {
    "Content-Type": "application/json",
  },
});

// ===============================
// Request interceptor (JWT)
// ===============================
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
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
    const message =
      (error.response?.data as any)?.msg ||
      (error.response?.data as any)?.message ||
      error.message ||
      "Something went wrong";

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

export default api;
