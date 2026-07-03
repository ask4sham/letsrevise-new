import { normalizeBlockType } from "../types/lessonBlocks";
import {
  hasTeacherBrainDesignBrief,
  isTeacherBrainBriefEditorBlock,
  TEACHER_BRAIN_DESIGN_BRIEF_MARKER,
} from "./teacherBrainDesignBrief";

export type TeacherBrainInjectionMeta = {
  injectionCount?: number;
  injections?: unknown[];
};

export function countTeacherBrainBriefsInPages(
  pages: Array<{ blocks?: Array<{ type?: string; note?: string }> }>
): number {
  let n = 0;
  for (const page of pages) {
    for (const block of page.blocks || []) {
      if (hasTeacherBrainDesignBrief(block.note)) n += 1;
    }
  }
  return n;
}

export function countTeacherBrainEligibleActivityBlocks(
  pages: Array<{ blocks?: Array<{ type?: string; note?: string; mode?: string; role?: string }> }>
): number {
  let n = 0;
  for (const page of pages) {
    for (const block of page.blocks || []) {
      if (isTeacherBrainBriefEditorBlock(block)) n += 1;
    }
  }
  return n;
}

function extractInjectedNote(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const rec = raw as Record<string, unknown>;
  const top = String(rec.note ?? "").trim();
  if (top.includes(TEACHER_BRAIN_DESIGN_BRIEF_MARKER)) return top;
  const payload = rec.payload;
  if (payload && typeof payload === "object") {
    const pn = String((payload as { note?: string }).note ?? "").trim();
    if (pn.includes(TEACHER_BRAIN_DESIGN_BRIEF_MARKER)) return pn;
  }
  return top;
}

/** Copy injected `note` values onto editor pages (page/block order + injection metadata). */
export function mergeTeacherBrainNotesIntoPages<T extends { blocks?: unknown[] }>(
  targetPages: T[],
  injectedPages: Array<{ blocks?: unknown[] }>,
  injections?: Array<{ pageIndex?: number; blockIndex?: number; blockType?: string }>
): T[] {
  const noteAt = new Map<string, string>();

  injectedPages.forEach((injPage, pageIndex) => {
    (injPage.blocks || []).forEach((injBlock, blockIndex) => {
      const note = extractInjectedNote(injBlock);
      if (note) noteAt.set(`${pageIndex}:${blockIndex}`, note);
    });
  });

  if (Array.isArray(injections)) {
    for (const row of injections) {
      const pi = row.pageIndex;
      const bi = row.blockIndex;
      if (typeof pi !== "number" || typeof bi !== "number") continue;
      const injBlock = injectedPages[pi]?.blocks?.[bi];
      const note = extractInjectedNote(injBlock);
      if (note) noteAt.set(`${pi}:${bi}`, note);
    }
  }

  return targetPages.map((page, pageIndex) => {
    if (!Array.isArray(page.blocks)) return page;
    const blocks = page.blocks.map((block, blockIndex) => {
      const note = noteAt.get(`${pageIndex}:${blockIndex}`);
      if (!note || typeof block !== "object" || block === null) return block;
      return { ...(block as Record<string, unknown>), note };
    });
    return { ...page, blocks };
  });
}

/** Shallow-clone pages/blocks so React sees new references after inject. */
export function cloneLessonPagesForState<T extends { blocks?: unknown[] }>(pages: T[]): T[] {
  return pages.map((page) => ({
    ...page,
    blocks: Array.isArray(page.blocks)
      ? page.blocks.map((block) =>
          block != null && typeof block === "object" ? { ...(block as object) } : block
        )
      : page.blocks,
  }));
}

/** Minimal pages payload for POST /ai/inject-teacher-brain-briefs. */
export function pagesForTeacherBrainInjectionApi(
  pages: Array<{ title?: string; blocks?: unknown[] }>
): Array<{ title?: string; blocks: Record<string, unknown>[] }> {
  return pages.map((page) => ({
    title: page.title,
    blocks: (page.blocks || []).map((raw) => {
      const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const type = normalizeBlockType(String(b.type ?? ""));
      const out: Record<string, unknown> = { type };
      if (typeof b.role === "string" && b.role.trim()) out.role = b.role.trim();
      if (typeof b.title === "string" && b.title.trim()) out.title = b.title.trim();
      if (typeof b.mode === "string" && b.mode.trim()) out.mode = b.mode.trim();
      if (typeof b.note === "string" && b.note.trim()) out.note = b.note.trim();
      const contentKeys = [
        "content",
        "text",
        "body",
        "summary",
        "keyIdea",
        "explanation",
        "caption",
        "prompt",
        "question",
        "instructions",
        "correctAnswer",
        "questionType",
        "marks",
        "totalMarks",
        "skill",
        "questionText",
      ];
      for (const key of contentKeys) {
        const v = b[key];
        if (typeof v === "string" && v.trim()) out[key] = v.trim();
      }
      if (Array.isArray(b.items)) out.items = b.items;
      if (Array.isArray(b.options)) out.options = b.options;
      if (Array.isArray(b.keywords)) out.keywords = b.keywords;
      if (Array.isArray(b.keyWords)) out.keyWords = b.keyWords;
      if (Array.isArray(b.pairs)) out.pairs = b.pairs;
      if (Array.isArray(b.sequenceSteps)) out.sequenceSteps = b.sequenceSteps;
      if (Array.isArray(b.hotspots)) out.hotspots = b.hotspots;
      if (type === "dragDropMatch") {
        const layoutKeys = [
          ["matchMode", "match_mode"],
          ["dragDropLayout", "drag_drop_layout"],
          ["activityLayout", "activity_layout"],
          ["imageUrl", "image_url"],
        ] as const;
        for (const [key, alt] of layoutKeys) {
          const v = b[key] ?? b[alt];
          if (typeof v === "string" && v.trim()) out[key] = v.trim();
        }
        if (Array.isArray(b.dropZones)) out.dropZones = b.dropZones;
      }
      return out;
    }),
  }));
}
