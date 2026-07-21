"use strict";

const {
  INSUFFICIENT_TRUSTED_SOURCES_WARNING,
  LESSON_LOCAL_STRONG_THRESHOLD,
  groundingCacheSegment,
  isWeakEvidence,
  shouldUseGeneralKnowledgeFallback,
  shouldShortCircuitUngroundedStudentAnswer,
  buildUngroundedStudentAnswer,
  isFallbackAiCachedResponse,
} = require("../services/enquiry/enquiryGroundingGate");
const { buildCacheKey } = require("../services/enquiry/enquiryCache");

describe("enquiryGroundingGate (Slice 2)", () => {
  test("student never gets general-knowledge fallback", () => {
    expect(
      shouldUseGeneralKnowledgeFallback({
        isStudentUser: true,
        strictCurriculumOnly: false,
        weakEvidence: true,
      })
    ).toBe(false);
  });

  test("teacher gets GK fallback when weak and not strict", () => {
    expect(
      shouldUseGeneralKnowledgeFallback({
        isStudentUser: false,
        strictCurriculumOnly: false,
        weakEvidence: true,
      })
    ).toBe(true);
  });

  test("teacher GK blocked when STRICT_CURRICULUM_ONLY", () => {
    expect(
      shouldUseGeneralKnowledgeFallback({
        isStudentUser: false,
        strictCurriculumOnly: true,
        weakEvidence: true,
      })
    ).toBe(false);
  });

  test("strong lesson-local evidence is not weak", () => {
    expect(
      isWeakEvidence({
        retrievalResults: [{ score: 0.1 }],
        lessonLocalStrong: true,
      })
    ).toBe(false);
  });

  test("empty retrieval is weak", () => {
    expect(isWeakEvidence({ retrievalResults: [], lessonLocalStrong: false })).toBe(
      true
    );
  });

  test("thin vector score without lesson-local is weak", () => {
    expect(
      isWeakEvidence({
        retrievalResults: [{ score: 0.2 }],
        lessonLocalStrong: false,
      })
    ).toBe(true);
  });

  test("student weak evidence short-circuits to safe answer", () => {
    expect(
      shouldShortCircuitUngroundedStudentAnswer({
        isStudentUser: true,
        weakEvidence: true,
      })
    ).toBe(true);
    const answer = buildUngroundedStudentAnswer({
      nearestTopicKey: "reproduction/gametes-fertilisation",
    });
    expect(answer.warnings).toContain(INSUFFICIENT_TRUSTED_SOURCES_WARNING);
    expect(answer.citations).toEqual([]);
    expect(answer.explanation).toMatch(/trusted curriculum/i);
    expect(answer.keyPoints[0]).toMatch(/gametes-fertilisation/);
  });

  test("Gametes-shaped lesson-local score clears strong threshold", () => {
    // Mirrors controller: lessonLocalStrong when top lesson-local score >= threshold.
    const gametesOnTopicScore = 0.42; // typical phrase/token hit on Learn content
    const offTopicScore = 0.05;
    expect(gametesOnTopicScore >= LESSON_LOCAL_STRONG_THRESHOLD).toBe(true);
    expect(offTopicScore >= LESSON_LOCAL_STRONG_THRESHOLD).toBe(false);
    expect(
      isWeakEvidence({
        retrievalResults: [{ score: gametesOnTopicScore }],
        lessonLocalStrong: gametesOnTopicScore >= LESSON_LOCAL_STRONG_THRESHOLD,
      })
    ).toBe(false);
    expect(
      isWeakEvidence({
        retrievalResults: [{ score: offTopicScore }],
        lessonLocalStrong: offTopicScore >= LESSON_LOCAL_STRONG_THRESHOLD,
      })
    ).toBe(true);
  });

  test("detects cached fallback_ai responses", () => {
    expect(
      isFallbackAiCachedResponse({
        usedSources: [
          {
            knowledgeDocumentId: "__fallback_ai__",
            sourceType: "fallback_ai",
          },
        ],
      })
    ).toBe(true);
    expect(
      isFallbackAiCachedResponse({
        usedSources: [{ knowledgeDocumentId: "lessonlocal:abc:0" }],
      })
    ).toBe(false);
  });

  test("student and teacher grounding policies use different cache keys", () => {
    const base = [
      "edexcel-igcse-biology",
      "reproduction/gametes-fertilisation",
      "lesson",
      "What is a gamete?",
      null,
      "explain",
      false,
      "507f1f77bcf86cd799439011",
    ];
    const studentKey = buildCacheKey(
      ...base,
      groundingCacheSegment({ isStudentUser: true, strictCurriculumOnly: false })
    );
    const teacherKey = buildCacheKey(
      ...base,
      groundingCacheSegment({ isStudentUser: false, strictCurriculumOnly: false })
    );
    expect(studentKey).not.toBe(teacherKey);
    expect(
      groundingCacheSegment({ isStudentUser: true, strictCurriculumOnly: false })
    ).toBe("s2-student");
  });
});
