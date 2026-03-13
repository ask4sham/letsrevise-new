/**
 * PR-012: Sprint order API — generate and download markdown.
 */
import api from "../services/api";
import type { SpecKey } from "./taxonomy";

export type SprintOrderParams = {
  specKey: SpecKey | string;
  windowDays?: number;
  useSnapshots?: boolean;
  top?: number;
  minEnquiries?: number;
  weights?: string;
};

/**
 * Fetch sprint order markdown as blob and trigger download.
 * @returns { source: "SNAPSHOT" | "LIVE" } from X-SprintOrder-Source header
 */
export async function getSprintOrderMarkdown(params: SprintOrderParams): Promise<{ source: string }> {
  const res = await api.get<string>("/sprint-order", {
    params: {
      specKey: params.specKey,
      windowDays: params.windowDays ?? 14,
      useSnapshots: params.useSnapshots !== false,
      top: params.top ?? 200,
      minEnquiries: params.minEnquiries ?? 3,
      weights: params.weights ?? "coverage=0.65,weak=0.35",
    },
    responseType: "text",
  });

  const source = (res.headers["x-sprintorder-source"] || res.headers["X-SprintOrder-Source"] || "LIVE") as string;
  const contentDisposition = res.headers["content-disposition"] || res.headers["Content-Disposition"] || "";
  let filename = "SPRINT_ORDER.md";
  const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
  if (match && match[1]) filename = match[1].trim();

  const blob = new Blob([res.data], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { source };
}
