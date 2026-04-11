// /frontend/src/utils/uploadImage.ts
import { getUploadBaseUrl } from "../services/mediaUrl";
import { getErrorMessageFromData } from "./apiErrorMessage";
import { apiUrl } from "./apiBaseUrl";

export type UploadImageResult = {
  ok: boolean;
  url: string;        // e.g. "/uploads/images/gcse/your-file.png"
  filename: string;
  folder: string;     // e.g. "images/gcse"
};

/**
 * Legacy override only. Prefer `REACT_APP_API_BASE` / `REACT_APP_API_URL` (see `docs/URL_AND_ENV.md`).
 * `REACT_APP_BACKEND_URL` is supported only for older setups that pointed uploads at a separate host.
 */
function uploadImageEndpoint(): string {
  const raw = (process.env.REACT_APP_BACKEND_URL || "").trim();
  if (!raw) return apiUrl("/api/uploads/image");
  const root = raw.replace(/\/+$/, "").replace(/\/api\/?$/, "");
  return `${root}/api/uploads/image`;
}

/**
 * Upload an image file to the backend uploads API.
 * Backend endpoint: POST /api/uploads/image
 * Form field name MUST be: "file"
 */
export async function uploadImage(
  file: File,
  folder: string = "images"
): Promise<UploadImageResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);

  const res = await fetch(uploadImageEndpoint(), {
    method: "POST",
    body: form,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = getErrorMessageFromData(data, `Upload failed (${res.status})`);
    throw new Error(msg);
  }

  return data as UploadImageResult;
}

/**
 * Converts a returned "/uploads/..." path into a full URL.
 * ALWAYS uses backend (Render), never Netlify.
 */
export function toPublicUrl(uploadPath: string): string {
  if (!uploadPath) return "";
  if (uploadPath.startsWith("http")) return uploadPath;
  const base = getUploadBaseUrl();
  const path = uploadPath.startsWith("/") ? uploadPath : `/${uploadPath}`;
  return `${base}${path}`;
}
