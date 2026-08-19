/**
 * Central catalogue availability — public approved tree + per-user admin-grant overlay.
 */
import api from "../services/api";

export type CataloguePublicStatus = "available" | "coming_soon";

export type CatalogueTreeNode = {
  id: string;
  kind: "level" | "subject" | "course" | "topic";
  label: string;
  publicStatus: CataloguePublicStatus;
  stageKey?: string;
  subject?: string;
  specKey?: string;
  examCode?: string | null;
  topicSlug?: string;
  topicKey?: string;
  children?: CatalogueTreeNode[];
};

export type CatalogueGrantedItem = {
  lessonId: string;
  title: string;
  subject: string;
  level: string;
  board: string;
  topic: string;
  specKey: string | null;
  topicKey: string | null;
  publicStatus: CataloguePublicStatus;
  userAccess: "none" | "preview" | "entitled";
  visibilityReason: "public_catalogue" | "admin_grant";
  stageMismatch?: boolean;
};

export type CatalogueAvailabilityResponse = {
  ok: boolean;
  profileStage: string;
  publicTree: { levels: CatalogueTreeNode[] };
  grantedToYou: CatalogueGrantedItem[];
  generatedAt: string;
};

export async function getCatalogueAvailability(): Promise<CatalogueAvailabilityResponse> {
  const res = await api.get<CatalogueAvailabilityResponse>("/catalogue/availability");
  return res.data;
}
