import { hasRenderableLessonImageSrc } from "../../../constants/lessonImageDisplay";
import type { IndexedLessonBlock } from "./chunkLessonSegments";
import { isVisualTeachingBlock } from "./visualTeachingBlocks";

function isDiagramType(type: unknown): boolean {
  return String(type ?? "").trim().toLowerCase() === "diagram";
}

/** Diagram blocks using a direct raster URL (upload / AI) need full teaching width — not the 210px split-column slot. */
function diagramBlockUsesRasterImageUrl(block: { type?: string; imageUrl?: unknown }): boolean {
  if (!isDiagramType(block.type)) return false;
  const raw = block.imageUrl;
  if (raw == null || typeof raw !== "string") return false;
  return hasRenderableLessonImageSrc(raw);
}

/**
 * V12 rule-based teaching layout for section chunks (presentation only).
 * Chunk **boundaries** come from `chunkBlocksForTeachingLayout` (diagram closes a unit;
 * key idea / key words / exam tip start a new band when content already exists).
 *
 * - **split** — explanatory blocks + exactly one **strict** `diagram` block → text left / image right (catalogue diagrams only).
 * - **text-only** — no visual-teaching blocks (`isVisualTeachingBlock`) → centered readable column.
 * - **image-only** — chunk is **only** visual-teaching blocks (e.g. lone `interactiveDiagram`, diagram-only) → full-width figures.
 * - **stack** — multiple strict diagrams, raster (`imageUrl`) diagram + text, **or** prose mixed with visual-teaching blocks that are not eligible for split → full-width vertical flow.
 */
export type ChunkTeachingLayout<T extends { type?: string }> =
  | {
      mode: "split";
      before: IndexedLessonBlock<T>[];
      diagram: IndexedLessonBlock<T>;
      after: IndexedLessonBlock<T>[];
    }
  | { mode: "text-only"; blocks: IndexedLessonBlock<T>[] }
  | { mode: "image-only"; blocks: IndexedLessonBlock<T>[] }
  | { mode: "stack"; blocks: IndexedLessonBlock<T>[] };

export function classifyChunkTeachingLayout<T extends { type?: string }>(
  chunk: IndexedLessonBlock<T>[]
): ChunkTeachingLayout<T> {
  if (chunk.length === 0) {
    return { mode: "text-only", blocks: [] };
  }

  const diagramIndices: number[] = [];
  const visualTeachingIndices: number[] = [];
  chunk.forEach((item, i) => {
    if (isDiagramType(item.block.type)) diagramIndices.push(i);
    if (isVisualTeachingBlock(item.block.type, item.block)) visualTeachingIndices.push(i);
  });

  const diagramCount = diagramIndices.length;
  const visualTeachingCount = visualTeachingIndices.length;
  const nonDiagramBlocks = chunk.filter((item) => !isDiagramType(item.block.type));

  if (diagramCount === 0) {
    if (visualTeachingCount === 0) {
      return { mode: "text-only", blocks: chunk };
    }
    const allVisual = chunk.every((item) =>
      isVisualTeachingBlock(item.block.type, item.block)
    );
    if (allVisual) {
      return { mode: "image-only", blocks: chunk };
    }
    return { mode: "stack", blocks: chunk };
  }

  if (nonDiagramBlocks.length === 0) {
    return { mode: "image-only", blocks: chunk };
  }

  if (diagramCount === 1) {
    const d = diagramIndices[0];
    const beforeSource = chunk.slice(0, d);
    const afterSource = chunk.slice(d + 1);
    const diagram = chunk[d];
    if (diagramBlockUsesRasterImageUrl(diagram.block as { type?: string; imageUrl?: unknown })) {
      return { mode: "stack", blocks: chunk };
    }
    if (beforeSource.length === 0 && afterSource.length > 0) {
      return { mode: "split", before: afterSource, diagram, after: [] };
    }
    return { mode: "split", before: beforeSource, diagram, after: afterSource };
  }

  return { mode: "stack", blocks: chunk };
}
