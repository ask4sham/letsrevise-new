// /frontend/src/api/uploads.ts
import { getUploadBaseUrl } from "../services/mediaUrl";
import { getErrorMessageFromData } from "../utils/apiErrorMessage";
import { apiUrl } from "../utils/apiBaseUrl";

export type UploadImageResult = {
  ok: boolean;
  url: string;        // e.g. "/uploads/images/gcse/file-123.png"
  filename: string;
  folder: string;     // e.g. "images/gcse"
};

/**
 * Upload an image to the backend uploads API.
 * Backend endpoint: POST /api/uploads/image (same-origin + proxy in dev, or env host)
 * Expects multipart/form-data with field name: "file"
 * Optional text field: "folder" (e.g. "images/gcse")
 */
export async function uploadImage(
  file: File,
  folder: string = "images"
): Promise<{ publicUrl: string; raw: UploadImageResult }> {
  const form = new FormData();
  form.append("file", file);          // MUST be "file"
  form.append("folder", folder);      // optional

  const res = await fetch(apiUrl("/api/uploads/image"), {
    method: "POST",
    body: form,
  });

  const data = (await res.json()) as UploadImageResult | { error: string };

  if (!res.ok) {
    throw new Error(getErrorMessageFromData(data, "Upload failed"));
  }

  const okData = data as UploadImageResult;

  // Convert "/uploads/..." to full URL. ALWAYS use backend (Render), never Netlify.
  const publicUrl = okData.url.startsWith("http")
    ? okData.url
    : `${getUploadBaseUrl()}${okData.url.startsWith("/") ? okData.url : `/${okData.url}`}`;

  return { publicUrl, raw: okData };
}
