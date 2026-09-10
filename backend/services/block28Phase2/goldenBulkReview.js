/**
 * Block 28 Phase 2 — golden-authoritative bulk review override (read-only).
 * When a lesson has approved golden capture, bulk review MUST use approved IDs/metadata.
 * Generic selector disagreement is surfaced and fail-closed for writes.
 */
const { validateShortMarksMarkSchemeInvariant } = require("../../../lib/block28PracticePolicy");
const { REPAIR_ACTION } = require("./repairProposals");
const { SCHEME_STATUS, SEMANTIC_READINESS, assessSemanticReadiness } = require("./schemeQuality");
const { SELECTION } = require("./selectionEngine");
const { getGoldenCaptureForLesson, GOLDEN_MODE, isProtectedLessonId } = require("./goldenRegistry");
const { REPAIR_PROPOSAL_STATUS } = require("../../utils/block28PublishedMutationGuard");

const REPAIR_WRITE_POLICY = Object.freeze({
  GENERIC: "GENERIC",
  GOLDEN_AUTHORITATIVE: "GOLDEN_AUTHORITATIVE",
  GOLDEN_ALIGNED: "GOLDEN_ALIGNED",
  BLOCKED: "BLOCKED",
});

function sortedIds(ids) {
  return [...ids].map(String).sort();
}

function idsEqual(a, b) {
  return JSON.stringify(sortedIds(a)) === JSON.stringify(sortedIds(b));
}

function buildGoldenRepairRow(meta, genericPack, mastersById, studentPosition) {
  const questionId = String(meta.questionId);
  const classifiedRow = (genericPack.classified || []).find((c) => c.questionId === questionId);
  const master = mastersById.get(questionId);
  const att = (genericPack.audit?.attachments || []).find((a) => a.questionId === questionId);
  const currentScheme = meta.proposedScheme;
  const inv = validateShortMarksMarkSchemeInvariant(meta.proposedMarks, currentScheme);
  const semantic = assessSemanticReadiness({
    marks: meta.proposedMarks,
    markScheme: currentScheme,
    stem: meta.proposedQuestion,
    question: meta.proposedQuestion,
    markDemand: { verdict: "NATURAL" },
    overlapRisk: "LOW",
    schemeStatus: SCHEME_STATUS.READY,
  });

  const masterQuestion = master?.question != null ? String(master.question) : "";
  const unchanged =
    masterQuestion === meta.proposedQuestion &&
    Number(master?.marks) === meta.proposedMarks &&
    JSON.stringify(currentScheme) === JSON.stringify(meta.proposedScheme || []);

  return {
    questionId,
    action: unchanged ? REPAIR_ACTION.KEEP_QUESTION_KEEP_MARKS : REPAIR_ACTION.CHANGE_MARKS,
    repairNote: unchanged
      ? "Golden-approved content matches master — no write required."
      : "Golden-approved metadata differs from master — guarded MASTER_UPDATE only.",
    originalQuestion: att?.question || masterQuestion,
    proposedQuestion: meta.proposedQuestion,
    originalMarks: att?.marks ?? master?.marks ?? meta.proposedMarks,
    proposedMarks: meta.proposedMarks,
    currentScheme: att?.markScheme || master?.markScheme || [],
    proposedScheme: currentScheme,
    schemeStatus: SCHEME_STATUS.READY,
    markDemand: { verdict: "NATURAL", note: null, naturalMarks: meta.proposedMarks },
    semanticReadiness: semantic.semanticReadiness,
    semanticReadinessReasons: semantic.reasons,
    qualityGates: null,
    invariantPass: inv.ok,
    confidence: "HIGH",
    overlapRisk: "LOW",
    proposedStudentPosition: studentPosition,
    usageCount: classifiedRow?.usageCount || 0,
    goldenAuthoritative: true,
  };
}

function buildGoldenProposedFinalSet(golden, genericPack, mastersById) {
  const metaById = new Map((golden.APPROVED_REPAIR_METADATA || []).map((m) => [String(m.questionId), m]));
  return golden.APPROVED_MASTER_IDS.map((questionId, index) => {
    const meta = metaById.get(String(questionId));
    if (!meta) {
      throw new Error(`Golden capture missing APPROVED_REPAIR_METADATA for ${questionId}`);
    }
    return buildGoldenRepairRow(meta, genericPack, mastersById, index + 1);
  });
}

function buildGoldenDetachments(genericPack, approvedIdSet) {
  return (genericPack.classified || []).filter((row) => {
    if (!approvedIdSet.has(String(row.questionId))) return true;
    return row.selection === SELECTION.DETACH_UNSUPPORTED || !row.supported;
  });
}

/**
 * @param {object} lesson
 * @param {object} genericPack
 * @param {Map<string, object>} mastersById
 */
function applyGoldenAuthoritativeOverride(lesson, genericPack, mastersById) {
  const lessonId = String(lesson._id || lesson.lessonId || "");
  const golden = getGoldenCaptureForLesson(lessonId);
  if (!golden) {
    return { pack: genericPack, goldenEnforced: false, genericDisagreement: false };
  }

  if (golden.mode === GOLDEN_MODE.CANONICAL_READONLY) {
    return {
      pack: {
        ...genericPack,
        goldenEnforced: true,
        goldenGuard: {
          lessonId,
          lessonTitle: golden.title,
          mode: golden.mode,
          failClosed: false,
          note: "Canonical marking-clean lesson — selection not overridden; served-set drift checks only.",
        },
      },
      goldenEnforced: true,
      genericDisagreement: false,
    };
  }

  if (!golden.APPROVED_MASTER_IDS?.length) {
    return { pack: genericPack, goldenEnforced: false, genericDisagreement: false };
  }

  const genericIds = (genericPack.proposedFinalSet || []).map((r) => r.questionId);
  const approvedIds = [...golden.APPROVED_MASTER_IDS];
  const genericDisagreement = !idsEqual(genericIds, approvedIds);
  const approvedSet = new Set(approvedIds.map(String));

  const proposedFinalSet = buildGoldenProposedFinalSet(golden, genericPack, mastersById);
  const proposedDetachments = buildGoldenDetachments(genericPack, approvedSet);

  const pack = finalizeGoldenAuthoritativePack(
    {
      ...genericPack,
      proposedFinalSet,
      proposedDetachments,
      goldenEnforced: true,
      goldenGuard: {
        lessonId,
        lessonTitle: golden.title,
        mode: golden.mode,
        approvedMasterIds: approvedIds,
        genericProposedIds: genericIds,
        genericDisagreement,
        failClosed: genericDisagreement,
        disagreementRecorded: genericDisagreement,
      },
      selectionNote: genericDisagreement
        ? `Golden authoritative override applied — generic selector disagreed (FAIL CLOSED for writes).`
        : "Golden authoritative selection matches generic selector.",
      futureWritePlan: {
        ...genericPack.futureWritePlan,
        detachCount: proposedDetachments.length,
        finalAttachmentCount: proposedFinalSet.length,
        goldenAuthoritative: true,
        genericDisagreement,
        genericExecutable: false,
      },
    },
    genericPack,
    golden
  );

  return { pack, goldenEnforced: true, genericDisagreement };
}

/**
 * Seal golden packs so generic selector output cannot be mistaken for executable repair data.
 */
function finalizeGoldenAuthoritativePack(pack, genericPack, golden = null) {
  const guard = pack.goldenGuard || {};
  const genericProposedFinalSet = genericPack?.proposedFinalSet || [];

  if (guard.mode === GOLDEN_MODE.CANONICAL_READONLY) {
    pack.repairProposalStatus = REPAIR_PROPOSAL_STATUS.CANONICAL_READONLY;
    pack.repairWritePolicy = REPAIR_WRITE_POLICY.GOLDEN_ALIGNED;
    pack.executableRepairProposal = {
      source: REPAIR_PROPOSAL_STATUS.CANONICAL_READONLY,
      proposedFinalSet: pack.proposedFinalSet || [],
      proposedDetachments: pack.proposedDetachments || [],
      genericBlocked: true,
    };
    return pack;
  }

  if (guard.genericDisagreement) {
    pack.repairProposalStatus = REPAIR_PROPOSAL_STATUS.GOLDEN_AUTHORITATIVE;
    pack.repairWritePolicy = REPAIR_WRITE_POLICY.GOLDEN_AUTHORITATIVE;
    pack.bulkGenericRepairBlocked = true;
    pack._audit = {
      ...(pack._audit || {}),
      genericDisagreementArchive: {
        authoritativeForWrite: false,
        recordedAt: new Date().toISOString(),
        genericProposedIds: (guard.genericProposedIds || []).map(String),
        genericProposedFinalSet,
        note: "Generic selector output archived for audit only — never executable when failClosed.",
      },
    };
    pack.newMasterProposals = (pack.newMasterProposals || []).map((proposal) => ({
      ...proposal,
      executable: false,
      blockedReason: "GOLDEN_FAIL_CLOSED",
    }));
    if (pack.futureWritePlan) {
      pack.futureWritePlan.genericExecutable = false;
      pack.futureWritePlan.goldenAuthoritative = true;
    }
  } else {
    pack.repairProposalStatus = REPAIR_PROPOSAL_STATUS.GOLDEN_ALIGNED;
    pack.repairWritePolicy = REPAIR_WRITE_POLICY.GOLDEN_ALIGNED;
    pack.bulkGenericRepairBlocked = false;
  }

  if (golden && isProtectedLessonId(guard.lessonId)) {
    pack.protectedLesson = true;
    pack.protectedBulkGenericRepairBlocked = Boolean(guard.genericDisagreement);
  }

  pack.executableRepairProposal = {
    source: pack.repairProposalStatus,
    proposedFinalSet: pack.proposedFinalSet || [],
    proposedDetachments: pack.proposedDetachments || [],
    genericBlocked: Boolean(guard.genericDisagreement),
  };

  return pack;
}

/**
 * Resolve the only repair proposal that may drive production writes.
 * Generic proposals are blocked when golden failClosed is active.
 */
function resolveExecutableRepairProposal(pack) {
  if (!pack?.goldenEnforced) {
    return {
      ok: true,
      blocked: false,
      source: REPAIR_PROPOSAL_STATUS.GENERIC,
      proposedFinalSet: pack?.proposedFinalSet || [],
      proposedDetachments: pack?.proposedDetachments || [],
    };
  }

  const guard = pack.goldenGuard || {};
  const proposedIds = (pack.proposedFinalSet || []).map((r) => String(r.questionId));
  const approvedIds = (guard.approvedMasterIds || []).map(String);
  const genericIds = (guard.genericProposedIds || []).map(String);

  if (guard.failClosed && guard.genericDisagreement) {
    if (!idsEqual(proposedIds, approvedIds)) {
      return {
        ok: false,
        blocked: true,
        source: REPAIR_PROPOSAL_STATUS.BLOCKED,
        msg: "Golden fail-closed: executable repair must match approved golden IDs exactly",
      };
    }
    if (idsEqual(proposedIds, genericIds) && !idsEqual(proposedIds, approvedIds)) {
      return {
        ok: false,
        blocked: true,
        source: REPAIR_PROPOSAL_STATUS.BLOCKED,
        msg: "Generic repair proposal blocked — golden IDs are authoritative",
      };
    }
    return {
      ok: true,
      blocked: false,
      source: REPAIR_PROPOSAL_STATUS.GOLDEN_AUTHORITATIVE,
      genericBlocked: true,
      disagreement: {
        genericProposedIds: genericIds,
        approvedMasterIds: approvedIds,
        recorded: Boolean(guard.disagreementRecorded),
      },
      proposedFinalSet: pack.proposedFinalSet,
      proposedDetachments: pack.proposedDetachments,
    };
  }

  return {
    ok: true,
    blocked: false,
    source: pack.repairProposalStatus || REPAIR_PROPOSAL_STATUS.GOLDEN_ALIGNED,
    proposedFinalSet: pack.proposedFinalSet || [],
    proposedDetachments: pack.proposedDetachments || [],
  };
}

/**
 * Assert generic repair IDs never appear in an executable proposal when failClosed.
 */
function assertNoGenericRepairLeak(pack) {
  const exec = resolveExecutableRepairProposal(pack);
  if (!pack?.goldenGuard?.failClosed) {
    return { ok: true };
  }
  if (!exec.ok) {
    return { ok: true, blocked: true };
  }
  const execIds = (exec.proposedFinalSet || []).map((r) => String(r.questionId)).sort();
  const genericIds = (pack.goldenGuard.genericProposedIds || []).map(String).sort();
  const approvedIds = (pack.goldenGuard.approvedMasterIds || []).map(String).sort();
  if (JSON.stringify(execIds) === JSON.stringify(genericIds) && JSON.stringify(execIds) !== JSON.stringify(approvedIds)) {
    return {
      ok: false,
      msg: "Executable repair leaked generic IDs under golden fail-closed",
      execIds,
      genericIds,
      approvedIds,
    };
  }
  if (JSON.stringify(execIds) !== JSON.stringify(approvedIds)) {
    return {
      ok: false,
      msg: "Executable repair does not match approved golden IDs",
      execIds,
      approvedIds,
    };
  }
  return { ok: true };
}

/**
 * Assert golden pack matches approved IDs exactly (for protected regression).
 */
function assertGoldenPackMatchesApproved(pack, golden) {
  const proposedIds = (pack.proposedFinalSet || []).map((r) => String(r.questionId));
  const approvedIds = golden.APPROVED_MASTER_IDS.map(String);
  if (!idsEqual(proposedIds, approvedIds)) {
    return {
      ok: false,
      msg: `Golden ID mismatch: proposed [${proposedIds.join(",")}] vs approved [${approvedIds.join(",")}]`,
    };
  }
  if (proposedIds.length !== approvedIds.length) {
    return { ok: false, msg: `Golden count mismatch: ${proposedIds.length} vs ${approvedIds.length}` };
  }
  return { ok: true };
}

module.exports = {
  REPAIR_WRITE_POLICY,
  applyGoldenAuthoritativeOverride,
  assertGoldenPackMatchesApproved,
  assertNoGenericRepairLeak,
  finalizeGoldenAuthoritativePack,
  resolveExecutableRepairProposal,
  idsEqual,
  sortedIds,
};
