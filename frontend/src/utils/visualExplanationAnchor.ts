/**
 * P1.3A — Visual Explanation anchor selection and teaching context for image prompts.
 * Teacher/admin only; does not touch lesson generation or Teacher Brain.
 */
import { resolveLessonDisplayBlockType } from "../types/lessonBlocks";
import { normalizeLegacyBlockLabel, stripSs1PrefixFromTitle } from "./formatBlockHeading";
import { mergeLessonBlockIntroFields } from "./lessonRichText";
import { hasTeacherBrainDesignBrief, TEACHER_BRAIN_DESIGN_BRIEF_MARKER } from "./teacherBrainDesignBrief";

export const VISUAL_EXPLANATION_CONTEXT_MAX_CHARS = 600;
export const VISUAL_EXPLANATION_CONTEXT_TARGET_CHARS = 580;

export type VisualExplanationPage = {
  pageId?: string;
  title?: string;
  blocks?: VisualExplanationBlock[];
};

export type VisualExplanationBlock = {
  type?: string;
  role?: string;
  title?: string;
  content?: string;
  intro?: string;
  caption?: string;
  subtitle?: string;
  studentTask?: string;
  alt?: string;
  note?: string;
  instructions?: string;
};

export type VisualExplanationLessonMeta = {
  title?: string;
  topic?: string;
  subject?: string;
  level?: string;
  examBoardName?: string | null;
};

export type VisualExplanationAnchorResult = {
  /** Raw index in `page.blocks` — matches LessonViewPage `blockRenderList` `idx` (preserved through filter). */
  anchorIndex: number;
  anchorTitle: string;
  blockKey: string;
  /** 1 = diagram … 7 = fallback before assessment */
  priorityTier: number;
};

/** Mirrors LessonViewPage block visibility when building anchor selection. */
export type VisualExplanationRenderOptions = {
  showDeeperKnowledge?: boolean;
  showPageKicker?: boolean;
};

const DEFAULT_RENDER_OPTIONS: Required<VisualExplanationRenderOptions> = {
  showDeeperKnowledge: false,
  showPageKicker: false,
};

const OBJECTIVES_RE =
  /\b(?:revision\s+objectives?|lesson\s+objectives?|learning\s+objectives?)\b/i;
const PRIOR_KNOWLEDGE_RE = /\b(?:prior\s+knowledge|what\s+you\s+already\s+know)\b/i;
const CORE_TEACHING_RE = /\b(?:core\s+teaching|core\s+learning)\b/i;
const DEFINITION_RE = /\bdefinition\b/i;
const CORE_MODEL_RE = /\bcore\s+model\b/i;
const KEY_IDEA_RE = /\b(?:key\s+idea|what\s+to\s+notice)\b/i;

const ASSESSMENT_TYPES = new Set(["checkpoint", "selfcheck", "pagequiz"]);

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

/** Same heuristic as LessonViewPage `isKickerLikeBlock` (page topic line hidden when kicker off). */
export function isKickerLikeBlock(block: VisualExplanationBlock): boolean {
  const t = safeStr(block.type).toLowerCase();
  if (t !== "text" && t !== "keyidea" && t !== "keyideas") return false;
  const raw = block.content != null ? String(block.content) : "";
  const content = raw.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
  if (content.length > 100) return false;
  return (
    /^.+\s*\((GCSE|A-Level)\)\s*$/i.test(content) ||
    /^.+\s*\((?:Foundation|Higher)\)\s*$/i.test(content)
  );
}

function resolveRenderOptions(
  options?: VisualExplanationRenderOptions
): Required<VisualExplanationRenderOptions> {
  return { ...DEFAULT_RENDER_OPTIONS, ...options };
}

/** True when LessonViewPage would include this block in `blockRenderList`. */
export function isBlockRenderedInLessonView(
  block: VisualExplanationBlock,
  options?: VisualExplanationRenderOptions
): boolean {
  const opts = resolveRenderOptions(options);
  const t = safeStr(block.type).toLowerCase();
  if (t === "stretch" && !opts.showDeeperKnowledge) return false;
  if (!opts.showPageKicker && isKickerLikeBlock(block)) return false;
  return true;
}

function blockRole(block: VisualExplanationBlock): string {
  return safeStr(block.role).toLowerCase();
}

function blockDisplayType(block: VisualExplanationBlock): string {
  return resolveLessonDisplayBlockType(block).toLowerCase();
}

function blockTitleLabel(block: VisualExplanationBlock): string {
  const raw = safeStr(block.title);
  if (!raw) return "";
  return normalizeLegacyBlockLabel(stripSs1PrefixFromTitle(raw));
}

function blockCombinedText(block: VisualExplanationBlock): string {
  const parts = [
    block.title,
    block.caption,
    block.subtitle,
    block.intro,
    block.content,
    block.instructions,
    block.studentTask,
    block.alt,
  ]
    .map((p) => safeStr(p))
    .filter(Boolean);
  return parts.join("\n");
}

function contentMatchesObjectives(text: string): boolean {
  return OBJECTIVES_RE.test(text);
}

function contentMatchesPriorKnowledge(text: string): boolean {
  return PRIOR_KNOWLEDGE_RE.test(text);
}

function isAssessmentBlock(block: VisualExplanationBlock): boolean {
  const t = blockDisplayType(block);
  if (ASSESSMENT_TYPES.has(t)) return true;
  const role = blockRole(block);
  return role === "quickcheck" || role === "workedexample" || role === "selfcheck";
}

function isSkippedAnchorBlock(block: VisualExplanationBlock): boolean {
  const role = blockRole(block);
  if (role === "lessonobjectives" || role === "priorknowledge" || role === "hook") return true;

  const t = blockDisplayType(block);
  if (t === "stretch" || t === "keywords" || isAssessmentBlock(block)) return true;

  const label = blockTitleLabel(block);
  const combined = blockCombinedText(block);
  if (contentMatchesObjectives(label) || contentMatchesObjectives(combined)) return true;
  if (contentMatchesPriorKnowledge(label) || contentMatchesPriorKnowledge(combined)) return true;

  return false;
}

function isSubstantialTeachingText(block: VisualExplanationBlock): boolean {
  const t = blockDisplayType(block);
  if (t !== "text" && t !== "keyideas" && t !== "examtips" && t !== "misconceptions") {
    return false;
  }
  const text = stripTeacherScaffolding(extractTeachingBody(block));
  return text.length >= 80;
}

function extractTeachingBody(block: VisualExplanationBlock): string {
  return mergeLessonBlockIntroFields(block.intro, block.content);
}

/** Remove HTML tags; preserve logical line breaks for scaffolding filters. */
function htmlToPlainLines(html: string): string[] {
  const withBreaks = String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  return withBreaks
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Remove HTML tags to plain text. */
export function htmlToPlainText(html: string): string {
  return htmlToPlainLines(html).join(" ").replace(/\s+/g, " ").trim();
}

/** Strip teacher-facing scaffolding from lesson text before sending to the image API. */
export function stripTeacherScaffolding(text: string): string {
  let out = String(text ?? "");

  if (hasTeacherBrainDesignBrief(out)) {
    const markerIdx = out.indexOf(TEACHER_BRAIN_DESIGN_BRIEF_MARKER);
    if (markerIdx >= 0) {
      out = out.slice(0, markerIdx);
    }
  }

  out = htmlToPlainLines(out).join("\n");

  const lineDropPatterns = [
    /^report issue\b/i,
    /^design brief\b/i,
    /^diagram brief\b/i,
    /^text\s*→\s*image\b/i,
    /^teacher[- ]only\b/i,
    /^placeholder\b/i,
    /^todo\b/i,
    /^lorem ipsum\b/i,
  ];

  out = out
    .split(/\n+/)
    .map((line) => line.replace(/^[\s👉🎯🧠📘💡🌍🔑]+/u, "").trim())
    .filter((line) => line.length > 0 && !lineDropPatterns.some((re) => re.test(line)))
    .join(" ");

  return out.replace(/\s+/g, " ").trim();
}

function getAnchorPriorityTier(block: VisualExplanationBlock): number | null {
  if (isSkippedAnchorBlock(block)) return null;

  const displayType = blockDisplayType(block);
  const title = blockTitleLabel(block);
  const role = blockRole(block);

  if (displayType === "diagram" || displayType === "interactivediagram") {
    return 1;
  }
  if (CORE_TEACHING_RE.test(title)) return 2;
  if (DEFINITION_RE.test(title)) return 3;
  if (CORE_MODEL_RE.test(title)) return 4;
  if (
    displayType === "keyideas" &&
    (role === "corerule" || role === "whattonotice" || KEY_IDEA_RE.test(title))
  ) {
    return 5;
  }
  if (isSubstantialTeachingText(block)) return 6;
  return null;
}

function firstAssessmentIndex(blocks: VisualExplanationBlock[]): number {
  const idx = blocks.findIndex((b) => isAssessmentBlock(b));
  return idx === -1 ? blocks.length : idx;
}

function fallbackAnchorIndex(
  blocks: VisualExplanationBlock[],
  renderOptions?: VisualExplanationRenderOptions
): number {
  const beforeAssessment = firstAssessmentIndex(blocks);
  for (let i = beforeAssessment - 1; i >= 0; i -= 1) {
    if (!isBlockRenderedInLessonView(blocks[i], renderOptions)) continue;
    if (!isSkippedAnchorBlock(blocks[i])) return i;
  }
  return -1;
}

/**
 * Select the best teaching anchor block on a lesson page.
 * Skips Revision Objectives and Prior Knowledge; prefers diagram / Core Teaching.
 */
export function findVisualExplanationAnchor(
  page: VisualExplanationPage,
  lesson: VisualExplanationLessonMeta,
  renderOptions?: VisualExplanationRenderOptions
): VisualExplanationAnchorResult | null {
  const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
  if (blocks.length === 0) return null;

  let bestTier = Number.POSITIVE_INFINITY;
  let bestIndex = -1;

  for (let i = 0; i < blocks.length; i += 1) {
    if (!isBlockRenderedInLessonView(blocks[i], renderOptions)) continue;
    const tier = getAnchorPriorityTier(blocks[i]);
    if (tier == null) continue;
    if (tier < bestTier) {
      bestTier = tier;
      bestIndex = i;
    }
  }

  if (bestIndex === -1) {
    bestIndex = fallbackAnchorIndex(blocks, renderOptions);
    bestTier = 7;
  }

  if (bestIndex === -1) return null;

  const anchorBlock = blocks[bestIndex];
  const anchorTitle = getVisualExplanationTopic(page, lesson, anchorBlock);
  const pageId = safeStr(page.pageId) || "page";
  const blockKey = `${pageId}:${bestIndex}`;

  return {
    anchorIndex: bestIndex,
    anchorTitle,
    blockKey,
    priorityTier: bestTier,
  };
}

export function getVisualExplanationTopic(
  page: VisualExplanationPage,
  lesson: VisualExplanationLessonMeta,
  anchorBlock: VisualExplanationBlock
): string {
  const title = blockTitleLabel(anchorBlock);
  if (title) return title;
  const caption = safeStr(anchorBlock.caption);
  if (caption) return stripTeacherScaffolding(caption).slice(0, 120);
  return safeStr(page?.title) || safeStr(lesson?.topic) || safeStr(lesson?.title) || "Lesson topic";
}

function isTeachingContextBlock(block: VisualExplanationBlock): boolean {
  return !isSkippedAnchorBlock(block) && !isAssessmentBlock(block);
}

function nearbyTeachingBlock(
  blocks: VisualExplanationBlock[],
  anchorIndex: number
): VisualExplanationBlock | null {
  for (let i = anchorIndex - 1; i >= 0; i -= 1) {
    if (isTeachingContextBlock(blocks[i]) && extractTeachingBody(blocks[i]).length > 40) {
      return blocks[i];
    }
  }
  for (let i = anchorIndex + 1; i < blocks.length; i += 1) {
    if (isTeachingContextBlock(blocks[i]) && extractTeachingBody(blocks[i]).length > 40) {
      return blocks[i];
    }
  }
  return null;
}

function blockContextSnippet(block: VisualExplanationBlock, maxLen: number): string {
  const title = blockTitleLabel(block);
  const body = stripTeacherScaffolding(extractTeachingBody(block));
  const caption = stripTeacherScaffolding(safeStr(block.caption));
  const subtitle = stripTeacherScaffolding(safeStr(block.subtitle));
  const parts = [title, caption, subtitle, body].filter(Boolean);
  const combined = parts.join(". ");
  if (combined.length <= maxLen) return combined;
  return trimContextToMaxLength(combined, maxLen);
}

/** Trim context without breaking words when possible. */
export function trimContextToMaxLength(text: string, maxLen = VISUAL_EXPLANATION_CONTEXT_TARGET_CHARS): string {
  const raw = String(text ?? "").trim();
  if (raw.length <= maxLen) return raw;

  const slice = raw.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > Math.floor(maxLen * 0.6)) {
    return slice.slice(0, lastSpace).trim();
  }
  return slice.trim();
}

/**
 * Build teaching context for the visual explanation API (max 600 chars).
 */
export function buildVisualExplanationContext(
  page: VisualExplanationPage,
  anchorIndex: number,
  lesson: VisualExplanationLessonMeta
): string {
  const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
  const anchor = blocks[anchorIndex];
  if (!anchor) return "";

  const pageTitle = safeStr(page?.title);
  const topicTitle = safeStr(lesson?.topic) || safeStr(lesson?.title);
  const subject = safeStr(lesson?.subject) || "Biology";
  const level = safeStr(lesson?.level) || "GCSE";
  const board = safeStr(lesson?.examBoardName) || "AQA";

  const headerParts = [
    pageTitle ? `Page: ${pageTitle}` : "",
    topicTitle ? `Topic: ${topicTitle}` : "",
    `Subject: ${level} ${subject} | ${board}`,
    `Anchor: ${getVisualExplanationTopic(page, lesson, anchor)}`,
  ].filter(Boolean);

  const headerBudget = 160;
  const header = trimContextToMaxLength(headerParts.join(". "), headerBudget);
  const bodyBudget = VISUAL_EXPLANATION_CONTEXT_TARGET_CHARS - header.length - 4;

  const anchorSnippet = blockContextSnippet(anchor, bodyBudget);
  const nearby = nearbyTeachingBlock(blocks, anchorIndex);
  let body = anchorSnippet;

  if (nearby && nearby !== anchor) {
    const nearbySnippet = blockContextSnippet(nearby, Math.floor(bodyBudget * 0.45));
    if (nearbySnippet) {
      const nearbyTitle = blockTitleLabel(nearby) || "Nearby";
      body = `${anchorSnippet} Nearby (${nearbyTitle}): ${nearbySnippet}`;
    }
  }

  const full = `${header}. ${body}`.trim();
  return trimContextToMaxLength(full, VISUAL_EXPLANATION_CONTEXT_MAX_CHARS);
}
