/**
 * PR-025: Topic summary PDF export API.
 */
import api from "../services/api";

export type PostTopicSummaryPdfParams = {
  topicSummaryLogId?: string;
  specKey: string;
  topicKey: string;
  mode?: string;
  includeCitations?: boolean;
  /** Fallback: full payload when logId not available */
  summary?: object;
  usedSources?: Array<{
    knowledgeDocumentId: string;
    sourceType: string;
    sourceId: string;
    title?: string;
    topicKey?: string;
  }>;
  confidenceLevel?: string;
  confidenceReason?: string;
};

/**
 * Request PDF export and trigger file download.
 * On 400 (no content), throws with message suitable for toast.
 */
export async function postTopicSummaryPdf(params: PostTopicSummaryPdfParams): Promise<void> {
  try {
    const res = await api.post(
      "/topic-summary/export",
      {
        topicSummaryLogId: params.topicSummaryLogId,
        specKey: params.specKey.trim(),
        topicKey: params.topicKey.trim(),
        mode: params.mode ?? "overview",
        includeCitations: params.includeCitations ?? true,
        ...(params.summary && { summary: params.summary }),
        ...(params.usedSources && { usedSources: params.usedSources }),
        ...(params.confidenceLevel && { confidenceLevel: params.confidenceLevel }),
        ...(params.confidenceReason && { confidenceReason: params.confidenceReason }),
      },
      { responseType: "blob" }
    );

    const blob = res.data as Blob;
    const contentDisposition = res.headers["content-disposition"];
    let filename = "topic-summary.pdf";
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
    if (e?.response?.status === 400 && e?.response?.data instanceof Blob) {
      const text = await (e.response.data as Blob).text();
      let msg = "No content to export yet. Generate a summary first.";
      try {
        const json = JSON.parse(text);
        if (typeof json?.message === "string") msg = json.message;
        else if (typeof json?.error === "string") msg = json.error;
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
