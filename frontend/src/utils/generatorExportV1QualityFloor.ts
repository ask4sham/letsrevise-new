/**
 * Slice 1 — Quality floor for letsrevise.generator.export.v1
 * Fail closed: bad drafts must not enter Create Lesson.
 * Mirror of synthesiser generatorExportV1QualityFloor.js
 */

export type QualityFloorError = {
  code: string;
  path: string;
  message: string;
};

export type QualityFloorResult = {
  ok: boolean;
  errors: QualityFloorError[];
};

const PLACEHOLDER_OPTION_RE = /^\[?Option\s*\d+\]?$/i;
const GENERIC_PROMPT_RE = /^which statement is correct\??$/i;
const OPEN_MARK_SCHEME_RE =
  /<h3>\s*<strong>\s*Mark scheme:\s*<\/strong>\s*<\/h3>\s*<ul>[\s\S]*?<\/ul>/i;

function safeStr(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

export function isPlaceholderOptions(options: unknown): boolean {
  const arr = Array.isArray(options) ? options : [];
  const trimmed = arr.map((o) => safeStr(o)).filter(Boolean);
  if (trimmed.length === 0) return true;
  return trimmed.every((o) => PLACEHOLDER_OPTION_RE.test(o));
}

function nonEmptyOptions(options: unknown): string[] {
  return (Array.isArray(options) ? options : [])
    .map((o) => safeStr(o))
    .filter(Boolean);
}

function isLearnPage(page: Record<string, unknown>): boolean {
  const title = safeStr(page?.title).toLowerCase();
  const pageType = safeStr(page?.pageType).toLowerCase();
  if (pageType === "learn" || pageType === "teaching") return true;
  if (title === "learn" || /^learn\b/.test(title)) return true;
  return /page-1-learn|page\s*1\s*\(learn\)/.test(title);
}

function isPractisePage(page: Record<string, unknown>): boolean {
  const title = safeStr(page?.title).toLowerCase();
  const pageType = safeStr(page?.pageType).toLowerCase();
  if (pageType === "practise" || pageType === "practice") return true;
  return /\bpractise\b|\bpractice\b/.test(title);
}

function blockKind(block: Record<string, unknown>): string {
  return safeStr(
    block?.editorType ?? block?.generatorBlockKind ?? block?.type
  );
}

function payloadOf(block: Record<string, unknown>): Record<string, unknown> {
  return block?.payload && typeof block.payload === "object"
    ? (block.payload as Record<string, unknown>)
    : {};
}

export function markSchemeIsConcealed(html: string): boolean {
  const content = String(html || "");
  if (!OPEN_MARK_SCHEME_RE.test(content)) return true;
  const firstMs = content.search(OPEN_MARK_SCHEME_RE);
  if (firstMs < 0) return true;
  const before = content.slice(0, firstMs);
  const openDetails = (before.match(/<details\b/gi) || []).length;
  const closeDetails = (before.match(/<\/details>/gi) || []).length;
  return openDetails > closeDetails;
}

function usableMcqQuestion(
  q: Record<string, unknown>,
  path: string,
  errors: QualityFloorError[]
): boolean {
  const prompt = safeStr(q?.prompt ?? q?.question ?? q?.stem);
  const correct = safeStr(q?.correctAnswer ?? q?.answer);
  const opts = nonEmptyOptions(q?.options);
  const qType = safeStr(q?.questionType ?? q?.type).toLowerCase() || "mcq";

  if (!prompt) {
    errors.push({
      code: "QF_EMPTY_PROMPT",
      path,
      message: "Question is missing a stem/prompt.",
    });
    return false;
  }
  if (GENERIC_PROMPT_RE.test(prompt) && isPlaceholderOptions(q?.options)) {
    errors.push({
      code: "QF_PLACEHOLDER_CHECKPOINT",
      path,
      message:
        'Forbidden filler: "Which statement is correct?" with Option 1–4.',
    });
    return false;
  }
  if (!correct) {
    errors.push({
      code: "QF_EMPTY_ANSWER",
      path,
      message: "Question is missing a correct answer.",
    });
    return false;
  }
  if (qType !== "short") {
    if (opts.length < 2) {
      errors.push({
        code: "QF_MCQ_OPTIONS",
        path,
        message: "MCQ needs at least 2 real options (not empty pads).",
      });
      return false;
    }
    if (isPlaceholderOptions(opts)) {
      errors.push({
        code: "QF_OPTION_FILLERS",
        path,
        message: "Option 1–4 filler labels are forbidden.",
      });
      return false;
    }
  }
  return true;
}

/**
 * Structural quality floor for generator export v1 documents.
 * Reject — do not silently repair.
 */
export function assertGeneratorExportV1QualityFloor(
  doc: unknown
): QualityFloorResult {
  const errors: QualityFloorError[] = [];
  if (!doc || typeof doc !== "object") {
    return {
      ok: false,
      errors: [
        {
          code: "QF_NOT_OBJECT",
          path: "export.generatorExport",
          message: "Generator export is missing or invalid.",
        },
      ],
    };
  }

  const root = doc as Record<string, unknown>;
  const pages = Array.isArray(root.pages) ? root.pages : [];
  if (pages.length < 1) {
    errors.push({
      code: "QF_NO_PAGES",
      path: "pages",
      message: "Export has no pages.",
    });
    return { ok: false, errors };
  }

  let pageQuizUsableCount = 0;
  let practisePageFound = false;

  pages.forEach((pageRaw, pi) => {
    const page = (pageRaw || {}) as Record<string, unknown>;
    const pagePath = `pages[${pi}]`;
    const learn = isLearnPage(page);
    const practise = isPractisePage(page);
    if (practise) practisePageFound = true;
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];

    blocks.forEach((blockRaw, bi) => {
      const block = (blockRaw || {}) as Record<string, unknown>;
      const kind = blockKind(block).toLowerCase().replace(/_/g, "-");
      const path = `${pagePath}.blocks[${bi}]`;
      const payload = payloadOf(block);
      const isTesting =
        kind === "selfcheck" ||
        kind === "self-check" ||
        kind === "self-check-question" ||
        kind === "checkpoint" ||
        kind === "pagequiz" ||
        kind === "page-quiz";

      if (learn && isTesting) {
        errors.push({
          code: "QF_LEARN_TESTING",
          path,
          message:
            "Learn page must not include selfCheck / checkpoint / pageQuiz.",
        });
        return;
      }

      if (kind === "pagequiz" || kind === "page-quiz") {
        const bank = Array.isArray(payload.questions) ? payload.questions : [];
        if (bank.length === 0) {
          errors.push({
            code: "QF_EMPTY_PAGE_QUIZ",
            path,
            message:
              "pageQuiz has an empty questions bank (would render as an empty Quiz Page shell).",
          });
          return;
        }
        let okCount = 0;
        bank.forEach((q, qi) => {
          if (
            usableMcqQuestion(
              (q || {}) as Record<string, unknown>,
              `${path}.questions[${qi}]`,
              errors
            )
          ) {
            okCount += 1;
          }
        });
        pageQuizUsableCount += okCount;
      }

      if (
        kind === "selfcheck" ||
        kind === "self-check" ||
        kind === "self-check-question" ||
        kind === "checkpoint"
      ) {
        const bank = Array.isArray(payload.questions) ? payload.questions : [];
        if (bank.length > 0) {
          bank.forEach((q, qi) =>
            usableMcqQuestion(
              (q || {}) as Record<string, unknown>,
              `${path}.questions[${qi}]`,
              errors
            )
          );
        } else {
          usableMcqQuestion(payload, path, errors);
        }
      }

      const role = safeStr(block?.role || payload?.role).toLowerCase();
      const content = safeStr(payload.content);
      if (
        (kind === "exam-practice" ||
          role === "exampractice" ||
          /practice\s*questions/i.test(safeStr(block?.title))) &&
        content &&
        !markSchemeIsConcealed(content)
      ) {
        errors.push({
          code: "QF_OPEN_MARK_SCHEME",
          path,
          message:
            "Practice Questions mark scheme must be inside Reveal Model Answer <details> (not open on the page).",
        });
      }
    });
  });

  if (pages.length >= 2 || practisePageFound) {
    if (pageQuizUsableCount < 1) {
      errors.push({
        code: "QF_NO_USABLE_PAGE_QUIZ",
        path: "pages",
        message:
          "Practise export needs at least one usable pageQuiz question (prevents empty Quiz Page).",
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

export function formatQualityFloorErrorMessage(
  result: QualityFloorResult
): string {
  if (!result || result.ok) return "";
  const lines = (result.errors || []).slice(0, 8).map((e) => e.message || e.code);
  const more =
    (result.errors || []).length > 8
      ? ` (+${result.errors.length - 8} more)`
      : "";
  return `Import blocked by quality floor: ${lines.join(" ")}${more}`;
}
