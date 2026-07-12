/** SS1 block heading: `8 — GRAPH / DATA VISUALISATION` (lesson ordinal + clean label). */

/** Matches `3 —`, `7b —`, `12 —` at start of a stored title. */
export const SS1_NUMBERED_TITLE_PREFIX_RE = /^([\d]+[a-zA-Z]?)\s*[\u2014\u2013\-]\s*(.*)$/;

const CORE_TEACHING_LABEL_RE = /\bcore\s+teaching\b/gi;
const SCENARIO_HOOK_LABEL_RE = /\bscenario\s*\/\s*hook\b/gi;
/** Internal type name — never show as the student/lesson SS1 heading. */
const COMPOSITE_QUESTION_LABEL_RE = /\bcomposite\s+question\b/gi;

/** Rename legacy generator SS1 label in stored titles (display + load normalisation). */
export function normalizeLegacyBlockLabel(label: string): string {
  let out = String(label ?? "").replace(CORE_TEACHING_LABEL_RE, (match) => {
    if (match === match.toUpperCase()) return "CORE LEARNING";
    if (match[0] === match[0].toUpperCase()) return "Core Learning";
    return "core learning";
  });
  out = out.replace(SCENARIO_HOOK_LABEL_RE, (match) => {
    if (match === match.toUpperCase()) return "SCENARIO";
    if (match[0] === match[0].toUpperCase()) return "Scenario";
    return "scenario";
  });
  out = out.replace(COMPOSITE_QUESTION_LABEL_RE, (match) => {
    if (match === match.toUpperCase()) return "EXAM QUESTION";
    if (match[0] === match[0].toUpperCase()) return "Exam Question";
    return "exam question";
  });
  return out;
}

export function normalizeLegacySs1Heading(heading: string): string {
  const raw = String(heading ?? "").trim();
  const m = raw.match(SS1_NUMBERED_TITLE_PREFIX_RE);
  if (!m) return normalizeLegacyBlockLabel(raw);
  const num = m[1];
  const label = normalizeLegacyBlockLabel(String(m[2] ?? "").trim());
  return label ? `${num} — ${label}` : raw;
}

export type BlockHeadingSource = {
  title?: unknown;
  number?: unknown;
  /** Optional persisted type — used only for display fallback titles. */
  type?: unknown;
};

/** Strip one or more stacked SS1 prefixes (`8 — 7b — Title` → `Title`). */
export function stripSs1PrefixFromTitle(title: string): string {
  let t = String(title ?? "").trim();
  let prev = "";
  while (prev !== t) {
    prev = t;
    const m = t.match(SS1_NUMBERED_TITLE_PREFIX_RE);
    if (m) t = String(m[2] ?? "").trim();
    else break;
  }
  return normalizeLegacyBlockLabel(t);
}

export function titleAlreadyHasSs1Prefix(title: string): boolean {
  return SS1_NUMBERED_TITLE_PREFIX_RE.test(String(title ?? "").trim());
}

/** Display-only fallback titles for activity / question shells without a stored title. */
export function fallbackActivityTitleFromBlockType(blockType?: string | null): string {
  const type = String(blockType || "")
    .trim()
    .toLowerCase()
    .replace(/[_-\s]/g, "");
  switch (type) {
    case "selfcheck":
      return "SELF-CHECK";
    case "checkpoint":
      return "CHECKPOINT";
    case "examquestion":
      return "EXAM QUESTION";
    case "composite":
    case "compositequestion":
      return "EXAM QUESTION";
    case "dragdropmatch":
      return "DRAG AND DROP MATCH";
    case "interactivesequence":
      return "STEP-BY-STEP PROCESS";
    case "interactivediagram":
      return "INTERACTIVE DIAGRAM";
    case "graph":
      return "GRAPH / DATA";
    case "pagequiz":
      return "QUIZ PAGE";
    case "keywords":
      return "KEY WORDS";
    case "examtip":
    case "examtips":
      return "EXAM TIP";
    case "commonmistake":
    case "misconception":
    case "misconceptions":
      return "COMMON MISTAKE";
    case "stretch":
    case "deeperknowledge":
      return "STRETCH";
    case "hook":
      return "SCENARIO";
    case "workedexample":
      return "KEY EXAMPLES";
    case "keyidea":
    case "keyideas":
      return "KEY IDEA";
    case "diagram":
      return "DIAGRAM";
    default:
      return "";
  }
}

/**
 * Build a display-only SS1 heading: `N — TITLE`.
 * Does not mutate saved lesson data. Avoids double-numbering when title already has a prefix.
 */
export function formatDisplaySectionHeading(
  number: number | null | undefined,
  title: string
): string {
  const raw = String(title || "").trim();
  if (!raw) return "";
  if (titleAlreadyHasSs1Prefix(raw)) return normalizeLegacySs1Heading(raw);
  const label = normalizeLegacyBlockLabel(stripSs1PrefixFromTitle(raw));
  if (!label) return "";
  if (typeof number === "number" && Number.isFinite(number) && number > 0) {
    return `${Math.trunc(number)} — ${label}`;
  }
  return label;
}

/**
 * Canonical student heading: always `block.number — cleanLabel`.
 * Never preserves legacy subsection ids (e.g. `7b`) when `number` is set.
 * Uses a type-based fallback title when the block has a number but no title.
 */
export function formatStudentBlockHeading(block: BlockHeadingSource | null | undefined): string {
  if (!block || typeof block !== "object") return "";

  const fromTitle = normalizeLegacyBlockLabel(stripSs1PrefixFromTitle(String(block.title ?? "")));
  const fallback = fallbackActivityTitleFromBlockType(
    block.type != null ? String(block.type) : undefined
  );
  const label = fromTitle || fallback;
  const n = block.number;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) {
    if (!label) return "";
    return `${Math.trunc(n)} — ${label}`;
  }

  const raw = String(block.title ?? "").trim();
  if (raw && titleAlreadyHasSs1Prefix(raw)) return normalizeLegacySs1Heading(raw);
  return label;
}

/** Normalise persisted block title field (fixes legacy `8 — 7b — …` rows on load). */
export function normalizePersistedBlockTitle<T extends BlockHeadingSource>(block: T): T {
  if (!block || typeof block !== "object") return block;
  const label = normalizeLegacyBlockLabel(stripSs1PrefixFromTitle(String(block.title ?? "")));
  if (!label && !block.number) return block;
  return { ...block, title: label };
}

/** True when markdown/HTML content already opens with the same heading line. */
export function studentContentStartsWithHeading(content: string, heading: string): boolean {
  const h = heading.trim();
  if (!h) return false;
  const first = firstContentHeadingCandidate(content);
  if (!first) return false;
  return isDuplicateBlockTitle(h, first);
}

/**
 * Extract the first visible heading-like line from markdown or HTML lesson content.
 * Used only for display-layer duplicate title detection.
 */
export function firstContentHeadingCandidate(content: string): string {
  const raw = String(content ?? "").trim();
  if (!raw) return "";

  // HTML heading: <h2>…</h2> / <h2><strong>…</strong></h2>
  const htmlHeading = raw.match(/^<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/i);
  if (htmlHeading) {
    return String(htmlHeading[2] ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // HTML emphasis-only opener: <p><strong>Prior knowledge</strong></p>
  const htmlStrong = raw.match(/^<p[^>]*>\s*<strong>([\s\S]*?)<\/strong>\s*<\/p>/i);
  if (htmlStrong) {
    return String(htmlStrong[1] ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const first =
    raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) ?? "";
  if (!first) return "";
  return first.replace(/^#{1,6}\s+/, "").trim();
}

/**
 * Display-only: remove a leading content heading that repeats the outer SS1 title
 * (e.g. outer `2 — PRIOR KNOWLEDGE` + inner `Prior knowledge`).
 * Does not mutate saved lesson data.
 */
export function stripLeadingDuplicateBlockHeading(
  content: string,
  outerHeading: string | null | undefined
): string {
  const src = String(content ?? "");
  const outer = String(outerHeading ?? "").trim();
  if (!src.trim() || !outer) return src;

  const candidate = firstContentHeadingCandidate(src);
  if (!candidate || !isDuplicateBlockTitle(outer, candidate)) return src;

  let next = src.trimStart();

  const htmlHeading = next.match(/^<h([1-6])[^>]*>[\s\S]*?<\/h\1>\s*/i);
  if (htmlHeading) {
    next = next.slice(htmlHeading[0].length);
    return next.trimStart();
  }

  const htmlStrong = next.match(/^<p[^>]*>\s*<strong>[\s\S]*?<\/strong>\s*<\/p>\s*/i);
  if (htmlStrong) {
    next = next.slice(htmlStrong[0].length);
    return next.trimStart();
  }

  // Markdown / plain first line
  const nl = next.search(/\r?\n/);
  if (nl < 0) {
    const only = next.replace(/^#{1,6}\s+/, "").trim();
    return isDuplicateBlockTitle(outer, only) ? "" : src;
  }
  const firstLine = next.slice(0, nl).replace(/^#{1,6}\s+/, "").trim();
  if (!isDuplicateBlockTitle(outer, firstLine)) return src;
  return next.slice(nl).replace(/^\r?\n/, "").trimStart();
}

/** Compare titles after stripping SS1 numbers (case/whitespace insensitive). */
export function normalizeBlockTitleForCompare(title: string): string {
  const base = stripSs1PrefixFromTitle(String(title ?? ""))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  // Synonyms that appear as redundant inner prose headings under numbered SS1 shells.
  if (base === "keywords" || base === "key words" || base === "exam vocabulary") {
    return "key words";
  }
  if (base === "why this matters" || base === "why it matters") {
    return "why it matters";
  }
  return base;
}

/** True when two headings refer to the same label (ignoring `N — ` prefixes). */
export function isDuplicateBlockTitle(outerHeading: string, innerTitle: string): boolean {
  const left = normalizeBlockTitleForCompare(outerHeading);
  const right = normalizeBlockTitleForCompare(innerTitle);
  return Boolean(left && right && left === right);
}

/** Whether the student V12 shell will render the outer `N — TITLE` heading. */
export function isOuterStudentHeadingVisible(
  block: BlockHeadingSource | null | undefined,
  contentForDedup = ""
): boolean {
  const heading = formatStudentBlockHeading(block);
  if (!heading) return false;
  return !studentContentStartsWithHeading(contentForDedup, heading);
}

/**
 * Suppress inner activity chrome titles that repeat the outer numbered heading.
 * Keeps distinct subheads (Step 1, Instructions, Test me, …).
 */
export function shouldSuppressInnerBlockTitle(
  outerHeading: string | null | undefined,
  innerTitle: string | null | undefined,
  outerVisible = true
): boolean {
  if (!outerVisible) return false;
  return isDuplicateBlockTitle(String(outerHeading ?? ""), String(innerTitle ?? ""));
}

/**
 * Infer a border-frame kind from SS1 heading / block type for student V12 colour borders.
 * Returns a stable token used as `data-frame-kind` (CSS maps token → border colour).
 */
export function inferStudentFrameKind(
  headingOrTitle: string,
  blockType?: string | null
): string {
  const label = stripSs1PrefixFromTitle(String(headingOrTitle || "")).toLowerCase();
  const type = String(blockType || "").trim().toLowerCase();

  if (type === "keyidea" || type === "keyideas") return "key";
  if (type === "examtip" || type === "examtips") return "exam-tip";
  if (type === "commonmistake" || type === "misconception" || type === "misconceptions") {
    return "mistake";
  }
  if (type === "stretch" || type === "deeperknowledge") return "stretch";
  if (type === "keywords") return "keywords";
  if (type === "hook") return "scenario";
  if (type === "workedexample") return "examples";
  if (type === "selfcheck") return "self-check";
  if (type === "checkpoint") return "checkpoint";
  if (type === "examquestion" || type === "composite" || type === "compositequestion") {
    return "exam-question";
  }

  if (/objective/.test(label)) return "objectives";
  if (/prior\s*knowledge/.test(label)) return "prior-knowledge";
  if (/exam\s*vocab|key\s*words?|keywords?/.test(label)) return "keywords";
  if (/definition|glossary/.test(label)) return "definition";
  if (/scenario|hook/.test(label)) return "scenario";
  if (/why\s*(it|this)\s*matters/.test(label)) return "why-matters";
  if (/key\s*example|worked\s*example|examples?\b/.test(label)) return "examples";
  if (/core\s*learning|core\s*rule|core\s*concept|core\s*model/.test(label)) {
    return "core-learning";
  }
  if (/instruction/.test(label)) return "instructions";
  if (/\btasks?\b/.test(label)) return "task";
  if (/summar/.test(label)) return "summary";
  if (/common\s*mistake|misconception/.test(label)) return "mistake";
  if (/exam\s*tip|exam\s*technique/.test(label)) return "exam-tip";
  if (/stretch|higher\s*tier|challenge/.test(label)) return "stretch";
  if (/self[\s-]?check/.test(label)) return "self-check";
  if (/checkpoint|quick\s*check/.test(label)) return "checkpoint";

  return "default";
}

/** Assign SS1 display number when legacy rows only have a combined title or no number field. */
export function resolveSs1BlockNumber(
  block: BlockHeadingSource,
  lessonOrdinal: number
): number | undefined {
  const n = block.number;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) return Math.trunc(n);
  if (lessonOrdinal > 0) return lessonOrdinal;
  return undefined;
}

/**
 * Display-only footer ordinals after the last numbered page block.
 * Legacy `page.checkpoint` (outside `pages.blocks`) must consume the next number when present.
 */
export function allocateLessonFlowFooterOrdinals(
  lastBlockOrdinal: number,
  hasPageCheckpoint: boolean
): {
  pageCheckpoint: number | null;
  revisionPractice: number;
  quizPage: number;
  practiceQuestions: number;
} {
  const base =
    typeof lastBlockOrdinal === "number" && Number.isFinite(lastBlockOrdinal) && lastBlockOrdinal > 0
      ? Math.trunc(lastBlockOrdinal)
      : 0;
  let next = base;
  const pageCheckpoint = hasPageCheckpoint ? ++next : null;
  return {
    pageCheckpoint,
    revisionPractice: next + 1,
    quizPage: next + 2,
    practiceQuestions: next + 3,
  };
}
