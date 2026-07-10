/**
 * Lesson Revision Pack PDF V1 — frontend download helper.
 * Same blob-download pattern as topic summary export.
 */
import api from "../services/api";

export type DownloadLessonRevisionPackParams = {
  lessonId: string;
  /** Teacher/admin only — ignored for students on the server. */
  includeAnswers?: boolean;
};

/**
 * Request revision pack PDF and trigger file download.
 */
export async function downloadLessonRevisionPack(
  params: DownloadLessonRevisionPackParams
): Promise<void> {
  const lessonId = String(params.lessonId || "").trim();
  if (!lessonId) {
    throw new Error("Missing lesson id");
  }

  try {
    const res = await api.post(
      `/lessons/${encodeURIComponent(lessonId)}/export/revision-pack`,
      { includeAnswers: params.includeAnswers === true },
      { responseType: "blob" }
    );

    const blob = res.data as Blob;
    const contentDisposition = res.headers["content-disposition"];
    let filename = "revision-pack.pdf";
    if (contentDisposition) {
      const match = /filename="?([^";\n]+)"?/.exec(contentDisposition);
      if (match) filename = match[1];
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (e: any) {
    if (e?.response?.data instanceof Blob) {
      const text = await (e.response.data as Blob).text();
      let msg = "Could not download revision pack.";
      try {
        const json = JSON.parse(text);
        if (typeof json?.message === "string") msg = json.message;
        else if (typeof json?.error === "string") msg = json.error;
        if (json?.reason === "FREE_PREVIEW" || json?.reason === "NOT_ENTITLED") {
          msg = "Full lesson access is required to download the revision pack.";
        }
      } catch {
        /* ignore */
      }
      const err = new Error(msg) as Error & { response?: unknown };
      err.response = e.response;
      throw err;
    }
    throw e;
  }
}
