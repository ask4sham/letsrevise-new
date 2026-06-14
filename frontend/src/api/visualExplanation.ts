/**
 * P1 GCSE Visual Explanation API.
 *
 * Generate bypasses the Netlify /api proxy (26s limit) and calls Render directly.
 * Feature flag and other routes still use same-origin proxy via services/api.
 */
import axios from "axios";

const RENDER_API_FALLBACK = "https://letsrevise-new.onrender.com";

function normalizeApiHost(raw: string): string {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;
}

/**
 * Backend host for the long-running generate call only (no trailing /api).
 * Prefers REACT_APP_API_BASE / REACT_APP_API_URL; falls back to Render on production Netlify.
 */
export function getVisualExplanationApiHost(): string {
  const raw = (process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_URL || "").trim();
  const fromEnv = normalizeApiHost(raw);
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:5000";
    }
  }

  return RENDER_API_FALLBACK;
}

/** Absolute URL for POST /visual-explanations/generate (direct to backend, not Netlify proxy). */
export function getVisualExplanationGenerateUrl(): string {
  const host = getVisualExplanationApiHost().replace(/\/+$/, "");
  return `${host}/api/visual-explanations/generate`;
}

export type VisualExplanationKeyPart = {
  label: string;
  what: string;
};

export type VisualExplanationContent = {
  what_image_shows: string;
  key_parts: VisualExplanationKeyPart[];
  step_by_step: string[];
  why_it_matters_gcse: string;
  common_mistake: string;
  exam_tip: string;
  exam_question: string;
  model_answer: string;
};

export type GenerateVisualExplanationParams = {
  topic: string;
  context?: string | null;
  subject?: string;
  exam_board?: string;
  tier?: string;
  lesson_id?: string | null;
  block_key?: string | null;
};

export type GenerateVisualExplanationResponse = {
  id: string;
  lesson_id: string | null;
  block_key: string | null;
  topic: string;
  subject: string;
  exam_board: string;
  tier: string;
  explanation: VisualExplanationContent;
  image_data_url: string | null;
  image_mime_type: string | null;
  provider_status: "image_generated" | "image_provider_unavailable";
  created_at: string;
};

export async function generateVisualExplanation(
  payload: GenerateVisualExplanationParams
): Promise<GenerateVisualExplanationResponse> {
  const url = getVisualExplanationGenerateUrl();
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await axios.post<GenerateVisualExplanationResponse>(url, payload, {
    timeout: 150_000,
    headers,
  });
  return res.data;
}
