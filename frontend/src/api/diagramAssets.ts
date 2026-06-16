/**
 * P2.2 — Diagram Asset Library API (ChatGPT-first upload pipeline).
 */
import api from "../services/api";
import { filterDiagramAssets as filterDiagramAssetsUtil } from "../utils/diagramAssetLibrary";

export type DiagramAssetActivityType = "view" | "hotspot" | "dragdrop" | "tti";

export type DiagramAssetRecord = {
  id: string;
  title: string;
  subject: string;
  topic: string;
  examBoard: string;
  tier: string;
  keywords: string[];
  imageUrl: string;
  mimeType?: string;
  storage?: string;
  activityTypes: DiagramAssetActivityType[];
  source?: string;
  usageCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type DiagramAssetUploadInput = {
  file: File;
  title: string;
  subject?: string;
  topic?: string;
  examBoard?: string;
  tier?: string;
  keywords?: string | string[];
  source?: string;
};

export async function listDiagramAssets(params?: {
  subject?: string;
  topic?: string;
  limit?: number;
}): Promise<DiagramAssetRecord[]> {
  const res = await api.get<{ assets: DiagramAssetRecord[] }>("/diagram-assets", { params });
  return Array.isArray(res.data?.assets) ? res.data.assets : [];
}

export async function uploadDiagramAsset(input: DiagramAssetUploadInput): Promise<DiagramAssetRecord> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("title", input.title.trim());
  if (input.subject) form.append("subject", input.subject);
  if (input.topic) form.append("topic", input.topic);
  if (input.examBoard) form.append("examBoard", input.examBoard);
  if (input.tier) form.append("tier", input.tier);
  if (input.keywords) {
    const kw = Array.isArray(input.keywords) ? input.keywords.join(", ") : input.keywords;
    form.append("keywords", kw);
  }
  form.append("source", input.source || "chatgpt");
  form.append("activityTypes", "view");
  const res = await api.post<{ asset: DiagramAssetRecord }>("/diagram-assets/upload", form);
  if (!res.data?.asset?.id) throw new Error("Upload succeeded but no asset returned");
  return res.data.asset;
}

export const filterDiagramAssets = filterDiagramAssetsUtil;
