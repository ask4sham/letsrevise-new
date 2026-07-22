/**
 * Unit: fresh-practice V1 identity mapping + filter (no DB).
 */
const {
  contentKey,
  isObjectIdString,
  collectExclusionsFromLessonDoc,
  filterFreshCandidates,
  addQuizSourceKeys,
  stemFingerprint,
} = require("../services/freshPracticeExclusions");
const mongoose = require("mongoose");

describe("freshPracticeExclusions", () => {
  const oid = () => new mongoose.Types.ObjectId();

  test("contentKey is contentType + contentId", () => {
    const id = oid();
    expect(contentKey("quiz_mcq", id)).toBe(`quiz_mcq:${id}`);
  });

  test("raw page/derived ids are not ObjectIds", () => {
    expect(isObjectIdString("derived-rev-1")).toBe(false);
    expect(isObjectIdString("page-abc")).toBe(false);
    expect(isObjectIdString(String(oid()))).toBe(true);
  });

  test("examQuestionId maps to exam_question content key", () => {
    const examId = oid();
    const { keys } = collectExclusionsFromLessonDoc({
      pages: [{ blocks: [{ type: "examQuestion", examQuestionId: examId }] }],
      examQuestions: [{ questionId: examId }],
    });
    expect(keys.has(contentKey("exam_question", examId))).toBe(true);
  });

  test("sourceQuestionId maps; raw lesson question id does not", () => {
    const bankId = oid();
    const { keys } = collectExclusionsFromLessonDoc({
      quiz: {
        questions: [
          { id: "lesson-local-q1", question: "What is mitosis?", sourceQuestionId: String(bankId), sourceType: "quiz_mcq" },
          { id: "lesson-local-q2", question: "Unlinked local only" },
        ],
      },
    });
    expect(keys.has(contentKey("quiz_mcq", bankId))).toBe(true);
    expect(keys.has("quiz_mcq:lesson-local-q1")).toBe(false);
    expect(keys.has("quiz_mcq:lesson-local-q2")).toBe(false);
  });

  test("addQuizSourceKeys does not accept derived ids", () => {
    const keys = new Set();
    addQuizSourceKeys(keys, "derived-q-3", "mcq");
    expect(keys.size).toBe(0);
  });

  test("filterFreshCandidates excludes by key and fingerprint; no padding", () => {
    const a = oid();
    const b = oid();
    const c = oid();
    const raw = [
      { contentType: "quiz_mcq", contentId: a, row: { questionText: "Alpha question stem here" } },
      { contentType: "quiz_mcq", contentId: b, row: { questionText: "Beta question stem here" } },
      { contentType: "quiz_mcq", contentId: c, row: { questionText: "Gamma question stem here" } },
    ];
    const excludeKeys = new Set([contentKey("quiz_mcq", a)]);
    const excludeFingerprints = new Set([stemFingerprint("Beta question stem here")]);
    const fresh = filterFreshCandidates(raw, { excludeKeys, excludeFingerprints });
    expect(fresh.map((x) => String(x.contentId))).toEqual([String(c)]);
  });
});
