/**
 * Groups lesson blocks into teaching segments for V12 layout (presentation only).
 *
 * ## `chunkBlocksForTeachingLayout` (preferred for student view)
 * Builds **teaching units**, not one long run of blocks:
 * - A **diagram** always **ends** a chunk (the diagram stays with the explanatory text
 *   that came before it → `split` when text exists, `image-only` when not).
 * - **Section starts** begin a new chunk when there is already content in the current
 *   segment: `keyIdea`, `keyWords`, `examTip` (optional recap / phrase blocks).
 *
 * Together with `classifyChunkTeachingLayout`, this yields:
 * - text + one related **catalogue** `diagram` → side-by-side (split) when not raster `imageUrl`
 * - text + diagram with raster `imageUrl` → vertical stack (full-width figure)
 * - text + other **visual-teaching** blocks (`isVisualTeachingBlock` in `visualTeachingBlocks.ts`) → stack (full-width), not the narrow text-only column
 * - text only → centered text-only chunk
 * - diagram(s) alone, or chunks that are only visual-teaching blocks → full-width image-style chunk(s)
 *
 * ## `chunkBlocksBeforeEachKeyIdea` (legacy)
 * Splits only before each key idea; long pages with few key ideas stay one giant chunk.
 * @deprecated Use `chunkBlocksForTeachingLayout` for V12.
 */
export type IndexedLessonBlock<T extends { type?: string }> = { block: T; idx: number };

/**
 * Prefer persisted ids for React reconciliation so sibling blocks stay mounted when unrelated
 * interactions update elsewhere. Falls back to block index (`idx`) when no stable id exists.
 */
export function stableStudentBlockReactKey(block: unknown, fallbackIdx: number): string {
  const b = block as { _id?: unknown; id?: unknown };
  const rawId = b._id;
  if (rawId != null) {
    if (typeof rawId === "string" || typeof rawId === "number") {
      const s = String(rawId).trim();
      if (s) return `lid-${s}`;
    }
    if (
      typeof rawId === "object" &&
      rawId !== null &&
      "$oid" in (rawId as Record<string, unknown>) &&
      String((rawId as { $oid?: unknown }).$oid ?? "").trim()
    ) {
      return `lid-${String((rawId as { $oid?: unknown }).$oid).trim()}`;
    }
  }
  const idStr = typeof b.id === "string" ? b.id.trim() : "";
  if (idStr) return `bid-${idStr}`;
  return `idx-${fallbackIdx}`;
}

function normType(type: unknown): string {
  return String(type ?? "").trim().toLowerCase();
}

/** Blocks that start a new teaching band when the current band already has content. */
function isTeachingSectionStart(type: unknown): boolean {
  const t = normType(type);
  return t === "keyidea" || t === "keywords" || t === "examtip";
}

/**
 * Teaching-unit chunking: diagram-boundary + section-start blocks.
 * See module doc above.
 */
export function chunkBlocksForTeachingLayout<T extends { type?: string }>(
  items: IndexedLessonBlock<T>[]
): IndexedLessonBlock<T>[][] {
  if (items.length === 0) return [];
  const groups: IndexedLessonBlock<T>[][] = [];
  let current: IndexedLessonBlock<T>[] = [];

  for (const item of items) {
    const t = normType(item.block.type);

    if (isTeachingSectionStart(item.block.type)) {
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
      current.push(item);
      continue;
    }

    if (t === "diagram" || t === "interactivesequence" || t === "interactivediagram") {
      current.push(item);
      groups.push(current);
      current = [];
      continue;
    }

    current.push(item);
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}

/**
 * @deprecated Prefer {@link chunkBlocksForTeachingLayout} for V12 student layout.
 */
export function chunkBlocksBeforeEachKeyIdea<T extends { type?: string }>(
  items: IndexedLessonBlock<T>[]
): IndexedLessonBlock<T>[][] {
  if (items.length === 0) return [];
  const groups: IndexedLessonBlock<T>[][] = [];
  let current: IndexedLessonBlock<T>[] = [];
  for (const item of items) {
    const isKey = String(item.block.type || "").trim() === "keyIdea";
    if (isKey && current.length > 0) {
      groups.push(current);
      current = [item];
    } else {
      current.push(item);
    }
  }
  if (current.length) groups.push(current);
  return groups;
}
