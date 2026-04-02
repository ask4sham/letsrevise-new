import type { IndexedLessonBlock } from "./chunkLessonSegments";

function isDiagramType(type: unknown): boolean {
  return String(type ?? "").trim().toLowerCase() === "diagram";
}

/**
 * V12 rule-based teaching layout for section chunks (presentation only).
 * Chunk **boundaries** come from `chunkBlocksForTeachingLayout` (diagram closes a unit;
 * key idea / key words / exam tip start a new band when content already exists).
 *
 * - **split** — explanatory blocks + exactly one diagram → text left / image right.
 * - **text-only** — no diagrams → centered readable column.
 * - **image-only** — only diagram blocks → full-width figures in section.
 * - **stack** — multiple diagrams with text, or other mixed cases → vertical stack (legacy-safe).
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
  chunk.forEach((item, i) => {
    if (isDiagramType(item.block.type)) diagramIndices.push(i);
  });

  const diagramCount = diagramIndices.length;
  const nonDiagramBlocks = chunk.filter((item) => !isDiagramType(item.block.type));

  if (diagramCount === 0) {
    return { mode: "text-only", blocks: chunk };
  }

  if (nonDiagramBlocks.length === 0) {
    return { mode: "image-only", blocks: chunk };
  }

  if (diagramCount === 1) {
    const d = diagramIndices[0];
    const beforeSource = chunk.slice(0, d);
    const afterSource = chunk.slice(d + 1);
    const diagram = chunk[d];
    if (beforeSource.length === 0 && afterSource.length > 0) {
      return { mode: "split", before: afterSource, diagram, after: [] };
    }
    return { mode: "split", before: beforeSource, diagram, after: afterSource };
  }

  return { mode: "stack", blocks: chunk };
}
