/**
 * Collect server-safe exclusion identities from Revision practice quiz items.
 * Never treat rev-bank-* / derived-* / page display IDs as bank content IDs.
 */

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

const CONTENT_TYPES = ["quiz_mcq", "quiz_short", "exam_question", "past_paper_question"] as const;

export type RevisionQuizSessionExclusions = {
  contentKeys: string[];
  stemTexts: string[];
};

function isObjectIdString(value: unknown): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  return OBJECT_ID_RE.test(s);
}

function isUnsafeDisplayId(value: unknown): boolean {
  const s = String(value ?? "").trim();
  if (!s) return true;
  if (isObjectIdString(s)) return false;
  return /^(rev-bank|quiz-bank|eol-bank|derived|variant|lesson-q|page-)/i.test(s);
}

function addContentKey(keys: Set<string>, contentType: string, contentId: unknown): void {
  if (!CONTENT_TYPES.includes(contentType as (typeof CONTENT_TYPES)[number])) return;
  if (!isObjectIdString(contentId)) return;
  keys.add(`${contentType}:${String(contentId).trim()}`);
}

function addKeysFromSourceQuestion(
  keys: Set<string>,
  sourceQuestionId: unknown,
  sourceType: unknown
): void {
  if (!isObjectIdString(sourceQuestionId)) return;
  const st = String(sourceType || "").toLowerCase();
  if (st.includes("short")) {
    addContentKey(keys, "quiz_short", sourceQuestionId);
  } else if (st.includes("mcq") || st.includes("quiz")) {
    addContentKey(keys, "quiz_mcq", sourceQuestionId);
  } else if (st.includes("exam") || st.includes("past")) {
    addContentKey(keys, "exam_question", sourceQuestionId);
    addContentKey(keys, "past_paper_question", sourceQuestionId);
  } else {
    addContentKey(keys, "quiz_mcq", sourceQuestionId);
    addContentKey(keys, "quiz_short", sourceQuestionId);
    addContentKey(keys, "exam_question", sourceQuestionId);
    addContentKey(keys, "past_paper_question", sourceQuestionId);
  }
}

/**
 * Build exclusion payload for fresh-availability / generate from revision layer questions.
 */
export function collectRevisionQuizSessionExclusions(
  questions: Array<Record<string, unknown>>
): RevisionQuizSessionExclusions {
  const contentKeys = new Set<string>();
  const stemTexts: string[] = [];
  const seenStem = new Set<string>();

  for (const q of questions || []) {
    if (!q || typeof q !== "object") continue;

    addKeysFromSourceQuestion(contentKeys, q.sourceQuestionId, q.sourceType || q.type || q.questionSource);
    addContentKey(contentKeys, "exam_question", q.examQuestionId);

    const idCandidates = [q.sourceQuestionId, q.examQuestionId, q._id, q.id];
    for (const cand of idCandidates) {
      if (!isObjectIdString(cand)) continue;
      // Prefer typed keys above; ObjectId alone → over-exclude across quiz types (safe).
      if (!q.sourceQuestionId && !q.examQuestionId) {
        addContentKey(contentKeys, "quiz_mcq", cand);
        addContentKey(contentKeys, "quiz_short", cand);
        addContentKey(contentKeys, "exam_question", cand);
      }
    }

    // Explicitly ignore unsafe display ids (no-op for keys; documents intent).
    void isUnsafeDisplayId(q.id);

    const stem = String(q.question ?? q.prompt ?? q.stem ?? "").trim();
    if (stem.length >= 12) {
      const key = stem.toLowerCase();
      if (!seenStem.has(key)) {
        seenStem.add(key);
        stemTexts.push(stem);
      }
    }
  }

  return {
    contentKeys: Array.from(contentKeys),
    stemTexts,
  };
}

/** Stable signature of the revision quiz set for completion persistence. */
export function revisionQuizSetSignature(questions: Array<Record<string, unknown>>): string {
  const parts = (questions || [])
    .map((q) => {
      const stem = String(q.question ?? q.prompt ?? "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      const sid = isObjectIdString(q.sourceQuestionId)
        ? String(q.sourceQuestionId)
        : isObjectIdString(q.examQuestionId)
          ? String(q.examQuestionId)
          : "";
      return `${sid}|${stem}`;
    })
    .filter(Boolean)
    .sort();
  let hash = 5381;
  const raw = parts.join("\n");
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 33) ^ raw.charCodeAt(i);
  }
  return `rq_${(hash >>> 0).toString(36)}_${parts.length}`;
}
