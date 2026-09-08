/**
 * Block 28 Phase 2 — protected lesson exact-set regression (bulk orchestration).
 */
const { buildLessonReviewPack } = require("../services/block28Phase2/batchReviewPack");
const {
  assertGoldenPackMatchesApproved,
  assertNoGenericRepairLeak,
  idsEqual,
  resolveExecutableRepairProposal,
} = require("../services/block28Phase2/goldenBulkReview");
const { getGoldenCaptureForLesson, PROTECTED_LESSON_IDS } = require("../services/block28Phase2/goldenRegistry");
const { APPROVED_MASTER_IDS: RF_APPROVED } = require("../services/block28Phase2/randomFertilisationGoldenCapture");
const { APPROVED_MASTER_IDS: ALLELES_APPROVED } = require("../services/block28Phase2/allelesGoldenCapture");
const { APPROVED_MASTER_IDS: VARIATION_APPROVED } = require("../services/block28Phase2/variationGoldenCapture");
const { REPAIR_ACTION } = require("../services/block28Phase2/repairProposals");

function makeUsage(ids) {
  return new Map(ids.map((id) => [id, 1]));
}

describe("Block 28 protected lesson bulk regression", () => {
  test("registry lists all six protected lessons", () => {
    expect(PROTECTED_LESSON_IDS).toHaveLength(6);
    for (const id of PROTECTED_LESSON_IDS) {
      expect(getGoldenCaptureForLesson(id)).toBeTruthy();
    }
  });

  test("Random Fertilisation bulk pack uses golden authoritative IDs", () => {
    const lessonId = "6a80d5e049f694aca0c94bf1";
    const candidates = RF_APPROVED.map((id, i) => ({
      id,
      question: `Approved RF question ${i + 1} about random fertilisation and genetic variation?`,
      marks: 2,
      markScheme: ["Point A", "Point B"],
    }));
    const deprioritised = [
      "6a81a3a949f694aca0cb5b8c",
      "6a81a3a849f694aca0cb5b86",
      "6a81a3a949f694aca0cb5b89",
    ];
    for (const id of deprioritised) {
      candidates.push({
        id,
        question: `Deprioritised evolution duplicate ${id}`,
        marks: 4,
        markScheme: ["x", "y", "z", "w"],
      });
    }
    const lesson = {
      _id: lessonId,
      title: "Random Fertilisation & Genetic Variation",
      topicKey: "edexcel-igcse-biology:random-fertilisation",
      pages: [{ blocks: [{ text: "Random fertilisation combines gametes unpredictably to increase genetic variation." }] }],
      examQuestions: candidates.map((c) => ({ questionId: c.id })),
    };
    const masters = new Map(
      candidates.map((c) => [
        c.id,
        {
          _id: c.id,
          type: "short",
          question: c.question,
          marks: c.marks,
          markScheme: c.markScheme,
        },
      ])
    );
    const pack = buildLessonReviewPack(lesson, masters, makeUsage(candidates.map((c) => c.id)));
    const golden = getGoldenCaptureForLesson(lessonId);
    const assert = assertGoldenPackMatchesApproved(pack, golden);
    expect(assert.ok).toBe(true);
    expect(pack.goldenEnforced).toBe(true);
    expect(pack.goldenGuard.genericDisagreement).toBe(true);
    expect(pack.goldenGuard.failClosed).toBe(true);
    expect(pack.repairProposalStatus).toBe("GOLDEN_AUTHORITATIVE");
    expect(pack.bulkGenericRepairBlocked).toBe(true);
    expect(pack._audit?.genericDisagreementArchive?.authoritativeForWrite).toBe(false);
    expect(assertNoGenericRepairLeak(pack).ok).toBe(true);
    const exec = resolveExecutableRepairProposal(pack);
    expect(exec.ok).toBe(true);
    expect(exec.genericBlocked).toBe(true);
    expect(exec.proposedFinalSet.map((r) => r.questionId)).toEqual([...RF_APPROVED]);
    expect(exec.proposedFinalSet.map((r) => r.questionId)).not.toEqual(pack.goldenGuard.genericProposedIds);
    expect(pack.proposedFinalSet.map((r) => r.questionId)).toEqual([...RF_APPROVED]);
    expect(pack.proposedFinalSet.every((r) => r.invariantPass)).toBe(true);
    const approvedSet = new Set(RF_APPROVED);
    expect(pack.proposedDetachments.every((d) => !approvedSet.has(d.questionId))).toBe(true);
  });

  test("Alleles bulk pack enforces five approved IDs", () => {
    const lessonId = "6a70fcaeffc00db240652548";
    const lesson = {
      _id: lessonId,
      title: "Alleles",
      topicKey: "edexcel-igcse-biology:alleles",
      pages: [{ blocks: [{ text: "Alleles are alternative forms of a gene causing variation." }] }],
      examQuestions: ALLELES_APPROVED.map((id) => ({ questionId: id })),
    };
    const masters = new Map(
      ALLELES_APPROVED.map((id) => [
        id,
        {
          _id: id,
          type: "short",
          question: "Placeholder",
          marks: 3,
          markScheme: ["a", "b", "c"],
        },
      ])
    );
    const pack = buildLessonReviewPack(lesson, masters, makeUsage(ALLELES_APPROVED));
    const golden = getGoldenCaptureForLesson(lessonId);
    expect(assertGoldenPackMatchesApproved(pack, golden).ok).toBe(true);
    expect(pack.proposedFinalSet).toHaveLength(5);
    expect(idsEqual(pack.proposedFinalSet.map((r) => r.questionId), ALLELES_APPROVED)).toBe(true);
    expect(pack.proposedFinalSet.every((r) => r.goldenAuthoritative)).toBe(true);
  });

  test("Variation bulk pack enforces ten approved IDs", () => {
    const lessonId = "6a859bcebac845d194489029";
    const golden = getGoldenCaptureForLesson(lessonId);
    const lesson = {
      _id: lessonId,
      title: "Variation within a Species",
      topicKey: "edexcel-igcse-biology:variation-within-a-species",
      pages: [{ blocks: [{ text: "Variation within a species includes genetic and environmental causes." }] }],
      examQuestions: VARIATION_APPROVED.map((id) => ({ questionId: id })),
    };
    const masters = new Map(
      VARIATION_APPROVED.map((id) => [
        id,
        { _id: id, type: "short", question: "Variation Q", marks: 2, markScheme: ["a", "b"] },
      ])
    );
    const pack = buildLessonReviewPack(lesson, masters, makeUsage(VARIATION_APPROVED));
    expect(assertGoldenPackMatchesApproved(pack, golden).ok).toBe(true);
    expect(pack.proposedFinalSet).toHaveLength(10);
  });

  test("golden repairs do not propose NEW_MASTER_REQUIRED for protected authoritative lessons", () => {
    const lessonId = "6a6db174826272226c7798fd";
    const golden = getGoldenCaptureForLesson(lessonId);
    const lesson = {
      _id: lessonId,
      title: "DNA Structure",
      topicKey: "edexcel-igcse-biology:dna-structure",
      pages: [{ blocks: [{ text: "DNA is a double helix with complementary base pairing." }] }],
      examQuestions: golden.APPROVED_MASTER_IDS.map((id) => ({ questionId: id })),
    };
    const masters = new Map(
      golden.APPROVED_MASTER_IDS.map((id) => [
        id,
        { _id: id, type: "short", question: "Q", marks: 2, markScheme: ["a", "b"] },
      ])
    );
    const pack = buildLessonReviewPack(lesson, masters, makeUsage(golden.APPROVED_MASTER_IDS));
    expect(pack.newMasterProposals).toHaveLength(0);
    expect(pack.proposedFinalSet.every((r) => r.action !== REPAIR_ACTION.NEW_MASTER_REQUIRED)).toBe(true);
  });
});
