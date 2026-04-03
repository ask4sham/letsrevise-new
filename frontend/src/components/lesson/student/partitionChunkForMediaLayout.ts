import type { IndexedLessonBlock } from "./chunkLessonSegments";
import { classifyChunkTeachingLayout } from "./chunkTeachingLayout";

export type MediaPartition<T extends { type?: string }> =
  | { mode: "stack" }
  | {
      mode: "split";
      before: IndexedLessonBlock<T>[];
      diagram: IndexedLessonBlock<T>;
      after: IndexedLessonBlock<T>[];
    };

/**
 * @deprecated Prefer {@link classifyChunkTeachingLayout} for split / text-only / image-only.
 * Kept for any legacy callers expecting only split vs stack.
 */
export function partitionChunkForMediaLayout<T extends { type?: string }>(
  chunk: IndexedLessonBlock<T>[]
): MediaPartition<T> {
  const layout = classifyChunkTeachingLayout(chunk);
  if (layout.mode === "split") {
    return {
      mode: "split",
      before: layout.before,
      diagram: layout.diagram,
      after: layout.after,
    };
  }
  return { mode: "stack" };
}
