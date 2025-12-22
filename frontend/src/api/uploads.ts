// /frontend/src/api/uploads.ts

export type UploadImageResult = {
  ok: boolean;
  url: string;        // e.g. "/uploads/images/gcse/file-123.png"
  filename: string;
  folder: string;     // e.g. "images/gcse"
};

const API_BASE =
  (process.env.REACT_APP_API_BASE as string) || "http://localhost:5000";

/**
 * Upload an image to the backend uploads API.
 * Backend endpoint: POST http://localhost:5000/api/uploads/image
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

  const res = await fetch(`${API_BASE}/api/uploads/image`, {
    method: "POST",
    body: form,
  });

  const data = (await res.json()) as UploadImageResult | { error: string };

  if (!res.ok) {
    const msg = "error" in data ? data.error : "Upload failed";
    throw new Error(msg);
  }

  const okData = data as UploadImageResult;

  // Convert "/uploads/..." to a full URL for the browser
  const publicUrl = okData.url.startsWith("http")
    ? okData.url
    : `${API_BASE}${okData.url}`;

  return { publicUrl, raw: okData };
}
