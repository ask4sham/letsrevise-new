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
 */
export async function postTopicSummaryPdf(params: PostTopicSummaryPdfParams): Promise<void> {
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
}
