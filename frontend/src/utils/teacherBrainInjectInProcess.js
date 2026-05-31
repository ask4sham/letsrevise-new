/**
 * In-process Teacher Brain injection (same logic as POST /ai/inject-teacher-brain-briefs).
 * Self-contained for CRA bundle — does not require .ts modules at runtime.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const {
  runTeacherBrain,
  injectDiagramAndActivityBriefs,
  resolveDragDropActivityLayout,
} = require("letsrevise-teacher-brain");

const BRIEF_MARKER = "--- TEACHER BRAIN DESIGN BRIEF ---";

function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function compactTypeKey(raw) {
  return String(raw || "")
    .trim()
    .replace(/[\s_\-]/g, "")
    .toLowerCase();
}

function normalizeBlockType(raw) {
  const compact = compactTypeKey(raw);
  if (compact === "dragdropmatch") return "dragDropMatch";
  if (compact === "interactivediagram") return "interactiveDiagram";
  if (compact === "interactivesequence") return "interactiveSequence";
  return String(raw || "text").trim() || "text";
}

function copyStrField(b, out, key, altKey) {
  const v = b[key] ?? (altKey ? b[altKey] : undefined);
  if (typeof v === "string" && v.trim()) out[key] = v.trim();
}

function appendDragDropLayoutFieldsForInjection(b, out) {
  copyStrField(b, out, "matchMode", "match_mode");
  copyStrField(b, out, "dragDropLayout", "drag_drop_layout");
  copyStrField(b, out, "activityLayout", "activity_layout");
  copyStrField(b, out, "imageUrl", "image_url");
  if (Array.isArray(b.dropZones)) out.dropZones = b.dropZones;
}

function pagesForTeacherBrainInjectionApi(pages) {
  return (Array.isArray(pages) ? pages : []).map((page) => ({
    title: page?.title,
    blocks: (page?.blocks || []).map((raw) => {
      const b = raw && typeof raw === "object" ? raw : {};
      const type = normalizeBlockType(b.type);
      const out = { type };
      if (typeof b.role === "string" && b.role.trim()) out.role = b.role.trim();
      if (typeof b.title === "string" && b.title.trim()) out.title = b.title.trim();
      if (typeof b.mode === "string" && b.mode.trim()) out.mode = b.mode.trim();
      if (typeof b.note === "string" && b.note.trim()) out.note = b.note.trim();
      if (Array.isArray(b.pairs)) out.pairs = b.pairs;
      if (Array.isArray(b.sequenceSteps)) out.sequenceSteps = b.sequenceSteps;
      if (Array.isArray(b.hotspots)) out.hotspots = b.hotspots;
      if (type === "dragDropMatch") {
        appendDragDropLayoutFieldsForInjection(b, out);
      }
      return out;
    }),
  }));
}

function extractInjectedNote(raw) {
  if (!raw || typeof raw !== "object") return "";
  const top = safeStr(raw.note);
  if (top.includes(BRIEF_MARKER)) return top;
  const payload = raw.payload;
  if (payload && typeof payload === "object") {
    const pn = safeStr(payload.note);
    if (pn.includes(BRIEF_MARKER)) return pn;
  }
  return top;
}

function mergeTeacherBrainNotesIntoPages(targetPages, injectedPages, injections) {
  const noteAt = new Map();

  (injectedPages || []).forEach((injPage, pageIndex) => {
    (injPage?.blocks || []).forEach((injBlock, blockIndex) => {
      const note = extractInjectedNote(injBlock);
      if (note) noteAt.set(`${pageIndex}:${blockIndex}`, note);
    });
  });

  if (Array.isArray(injections)) {
    for (const row of injections) {
      const pi = row?.pageIndex;
      const bi = row?.blockIndex;
      if (typeof pi !== "number" || typeof bi !== "number") continue;
      const injBlock = injectedPages[pi]?.blocks?.[bi];
      const note = extractInjectedNote(injBlock);
      if (note) noteAt.set(`${pi}:${bi}`, note);
    }
  }

  return (targetPages || []).map((page, pageIndex) => {
    if (!Array.isArray(page?.blocks)) return page;
    const blocks = page.blocks.map((block, blockIndex) => {
      const note = noteAt.get(`${pageIndex}:${blockIndex}`);
      if (!note || typeof block !== "object" || block === null) return block;
      return { ...block, note };
    });
    return { ...page, blocks };
  });
}

function cloneLessonPagesForState(pages) {
  return (pages || []).map((page) => ({
    ...page,
    blocks: Array.isArray(page.blocks)
      ? page.blocks.map((block) =>
          block != null && typeof block === "object" ? { ...block } : block
        )
      : page.blocks,
  }));
}

/**
 * @param {Array<{ title?: string, blocks?: unknown[] }>} editorPages
 * @param {{ topic: string, subject?: string, examBoard?: string, tier?: string }} meta
 */
function injectTeacherBrainBriefsInProcess(editorPages, meta) {
  const topic = safeStr(meta?.topic);
  const brain = runTeacherBrain({
    topic,
    subject: meta?.subject || "Biology",
    examBoard: meta?.examBoard || "AQA",
    tier: meta?.tier || "Higher",
  });

  const apiShape = pagesForTeacherBrainInjectionApi(editorPages);
  if (process.env.NODE_ENV !== "production") {
    for (const page of apiShape) {
      for (const block of page.blocks || []) {
        if (normalizeBlockType(block.type) !== "dragDropMatch") continue;
        console.log("[TeacherBrainLayout] before injection", {
          matchMode: block.matchMode,
          dragDropLayout: block.dragDropLayout,
          activityLayout: block.activityLayout,
          resolved: resolveDragDropActivityLayout(block),
        });
      }
    }
  }
  const { pages: injectedPages, injections } = injectDiagramAndActivityBriefs(apiShape, brain);
  const merged = mergeTeacherBrainNotesIntoPages(editorPages, injectedPages, injections);

  return {
    pages: cloneLessonPagesForState(merged),
    teacherBrainInjection: {
      injectionCount: injections?.length ?? 0,
      injections: injections ?? [],
    },
  };
}

module.exports = {
  injectTeacherBrainBriefsInProcess,
  mergeTeacherBrainNotesIntoPages,
  pagesForTeacherBrainInjectionApi,
  resolveDragDropActivityLayout,
};
