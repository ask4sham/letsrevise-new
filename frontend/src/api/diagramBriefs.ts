/**
 * P3.0C — Generate Diagram Brief from lesson block.
 */
import api from "../services/api";

export type DiagramBriefFromBlockResponse = {
  brief: string;
  teacherMetadata: string | null;
  warnings: string[];
  metadata: {
    specId?: string;
    diagramType?: string;
    activityPedagogyType?: string | null;
    regionIdAbstracted?: boolean;
    pedagogyDriven?: boolean;
  } | null;
  spec?: Record<string, unknown>;
};

export type GenerateDiagramBriefInput = {
  block: Record<string, unknown>;
  lesson?: Record<string, unknown>;
  page?: Record<string, unknown>;
  options?: Record<string, unknown>;
};

export async function generateDiagramBriefFromBlock(
  input: GenerateDiagramBriefInput
): Promise<DiagramBriefFromBlockResponse> {
  const res = await api.post<DiagramBriefFromBlockResponse>("/diagram-briefs/from-block", input);
  return res.data;
}
