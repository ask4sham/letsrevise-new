/**
 * Block 28 Phase 2 — read-only P1 manifest builder.
 * Derives P1 from current application merge + invariant logic (not hardcoded IDs).
 */
const {
  normalizeMarkSchemeLines,
  validateShortMarksMarkSchemeInvariant,
} = require("../../../lib/block28PracticePolicy");
const { mergeExamQuestionForPractice } = require("../../utils/mergeExamQuestionLessonEdit");
const {
  EXPECTED_P1_CENSUS,
} = require("./constants");
const {
  deriveSpecKey,
  deriveCanonicalTopicKey,
  masterFingerprint,
  lessonEditFingerprint,
  effectivePracticeFingerprint,
} = require("./fingerprints");

function mismatchPattern(marks, schemePointCount) {
  return `${marks}_${schemePointCount}`;
}

function isPublishedLesson(lesson) {
  return String(lesson?.status || "").toLowerCase() === "published";
}

function isBadMasterMaskedByAlignedLessonEdit(master, ref) {
  if (!master || String(master.type || "").toLowerCase() !== "short") return false;
  const masterInv = validateShortMarksMarkSchemeInvariant(master.marks, master.markScheme);
  if (masterInv.ok) return false;
  let effective = null;
  try {
    effective = mergeExamQuestionForPractice(master, ref);
  } catch {
    return false;
  }
  if (!effective) return false;
  const effInv = validateShortMarksMarkSchemeInvariant(effective.marks, effective.markScheme || []);
  return effInv.ok === true;
}

function buildEffectiveState(master, ref) {
  let effective = null;
  try {
    effective = mergeExamQuestionForPractice(master, ref);
  } catch {
    effective = null;
  }
  const scheme = normalizeMarkSchemeLines(effective?.markScheme);
  const inv = effective
    ? validateShortMarksMarkSchemeInvariant(effective.marks, effective.markScheme || [])
    : { ok: false };
  return {
    effectiveMarks: effective?.marks ?? null,
    effectiveMarkScheme: scheme,
    effectiveSchemePointCount: scheme.length,
    effectiveQuestion: effective?.question ?? null,
    effectiveAligned: inv.ok === true,
    effectiveFingerprint: effectivePracticeFingerprint(effective),
  };
}

/**
 * Scan lessons + masters and build P1 manifest.
 * @param {object} opts
 * @param {Function} opts.fetchLessons - async () => lesson[]
 * @param {Function} opts.fetchMastersByIds - async (ids: string[]) => Map<string, object>
 * @param {boolean} [opts.enforceExpectedCensus=true]
 */
async function buildP1Manifest(opts) {
  const { fetchLessons, fetchMastersByIds, enforceExpectedCensus = true } = opts;
  const lessons = await fetchLessons();

  const attachmentInstances = [];
  const masterMap = new Map();

  for (const lesson of lessons) {
    const refs = Array.isArray(lesson.examQuestions) ? lesson.examQuestions : [];
    if (refs.length === 0) continue;

    const questionIds = refs.map((r) => String(r.questionId)).filter(Boolean);
    const mastersById = await fetchMastersByIds(questionIds);

    refs.forEach((ref, index) => {
      const questionId = String(ref.questionId || "");
      const master = mastersById.get(questionId);
      if (!master || String(master.type || "").toLowerCase() !== "short") return;

      const effectiveState = buildEffectiveState(master, ref);
      if (effectiveState.effectiveAligned) return;

      const published = isPublishedLesson(lesson);
      if (!published) return;

      attachmentInstances.push({
        lessonId: String(lesson._id),
        lessonTitle: lesson.title || null,
        lessonStatus: lesson.status || null,
        position: index + 1,
        questionId,
        hasLessonEdit: Boolean(ref.lessonEdit && typeof ref.lessonEdit === "object"),
        lessonEditFingerprint: lessonEditFingerprint(ref.lessonEdit),
        ...effectiveState,
        maskedP2: isBadMasterMaskedByAlignedLessonEdit(master, ref),
      });
    });
  }

  const uniqueMasterIds = [...new Set(attachmentInstances.map((a) => a.questionId))];
  const allMasters = await fetchMastersByIds(uniqueMasterIds);

  for (const questionId of uniqueMasterIds) {
    const master = allMasters.get(questionId);
    if (!master) continue;

    const refsForMaster = attachmentInstances.filter((a) => a.questionId === questionId);
    const scheme = normalizeMarkSchemeLines(master.markScheme);
    const inv = validateShortMarksMarkSchemeInvariant(master.marks, master.markScheme);

    masterMap.set(questionId, {
      questionId,
      question: master.question != null ? String(master.question) : "",
      type: String(master.type || "short"),
      marks: master.marks ?? null,
      markSchemeRaw: Array.isArray(master.markScheme) ? [...master.markScheme] : [],
      markSchemeNormalized: scheme,
      markSchemePointCount: scheme.length,
      mismatchPattern: mismatchPattern(master.marks ?? 0, scheme.length),
      masterAligned: inv.ok === true,
      publishedStatus: master.status || null,
      aiGenerated: master?.metadata?.source === "ai_lesson_assets",
      metadataSource: master?.metadata?.source ?? null,
      createdAt: master.createdAt ? new Date(master.createdAt).toISOString() : null,
      updatedAt: master.updatedAt ? new Date(master.updatedAt).toISOString() : null,
      generatedAt: master?.metadata?.generatedAt
        ? new Date(master.metadata.generatedAt).toISOString()
        : null,
      subject: master.subject ?? null,
      board: master.examBoard ?? null,
      level: master.level ?? null,
      topicKey: master.topicKey ?? null,
      canonicalTopicKey: deriveCanonicalTopicKey(master),
      specKey: deriveSpecKey(master),
      difficulty: master.difficulty ?? null,
      fingerprint: masterFingerprint(master),
      lessonReferenceCount: refsForMaster.length,
      publishedLessonRefs: refsForMaster.map((r) => ({
        lessonId: r.lessonId,
        lessonTitle: r.lessonTitle,
        position: r.position,
        hasLessonEdit: r.hasLessonEdit,
        lessonEditFingerprint: r.lessonEditFingerprint,
        effectiveAligned: r.effectiveAligned,
        effectiveMarks: r.effectiveMarks,
        effectiveSchemePointCount: r.effectiveSchemePointCount,
        effectiveFingerprint: r.effectiveFingerprint,
      })),
      sharedMasterWarning: refsForMaster.length > 1,
      approvalStatus: "pending",
      repairClassification: null,
      proposal: null,
      qualityGates: null,
      simulation: null,
    });
  }

  const lessonIds = new Set(attachmentInstances.map((a) => a.lessonId));
  const draftCount = attachmentInstances.filter((a) => a.lessonStatus !== "published").length;

  const census = {
    effectiveMismatchedAttachments: attachmentInstances.length,
    publishedLessons: lessonIds.size,
    uniqueMasters: masterMap.size,
    draftAttachments: draftCount,
  };

  let censusDrift = null;
  if (enforceExpectedCensus) {
    const driftFields = [];
    for (const [key, expected] of Object.entries(EXPECTED_P1_CENSUS)) {
      if (census[key] !== expected) driftFields.push({ field: key, expected, actual: census[key] });
    }
    if (driftFields.length > 0) {
      censusDrift = {
        driftDetected: true,
        fields: driftFields,
        message: "P1 census drift — manifest finalisation blocked",
      };
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    track: "P1",
    census,
    expectedCensus: EXPECTED_P1_CENSUS,
    censusDrift,
    attachmentInstances,
    masters: [...masterMap.values()],
    finalized: !censusDrift,
  };
}

module.exports = {
  buildP1Manifest,
  buildEffectiveState,
  isBadMasterMaskedByAlignedLessonEdit,
  isPublishedLesson,
  mismatchPattern,
};
