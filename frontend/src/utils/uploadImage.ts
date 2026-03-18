// /frontend/src/utils/uploadImage.ts
import { getUploadBaseUrl } from "../services/mediaUrl";

export type UploadImageResult = {
  ok: boolean;
  url: string;        // e.g. "/uploads/images/gcse/your-file.png"
  filename: string;
  folder: string;     // e.g. "images/gcse"
};

const BACKEND_BASE =
  (process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || "http://localhost:5000")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/?$/, "");

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

  const res = await fetch(`${BACKEND_BASE}/api/uploads/image`, {
    method: "POST",
    body: form,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) ||
      `Upload failed (${res.status})`;
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
