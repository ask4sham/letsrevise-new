/**
 * PR-PAST-PAPERS-UI-1: Admin media upload with confirmCopyright.
 */

export async function uploadPdfWithConfirmation(file: File, token: string): Promise<{
  mediaId: string;
  url: string;
  sha256: string;
  mimeType: string;
  size: number;
  originalName: string;
}> {
  const form = new FormData();
  form.append("file", file);
  form.append("confirmCopyright", "true");

  const apiBase = (process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_URL || "").trim().replace(/\/+$/, "");
  const base = apiBase || "";

  const res = await fetch(`${base}/api/admin/media/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Upload failed");
  }
  return data;
}
