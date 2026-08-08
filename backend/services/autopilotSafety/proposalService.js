/**
 * Autopilot Safety Foundation — S1.2 admin proposal service.
 * Mutates safety-control-plane records only. No execution.
 */
const mongoose = require("mongoose");
const {
  POLICY_VERSION,
  PROPOSED_PAYLOAD_ENVELOPE_TYPE,
} = require("../../contracts/autopilotSafetyPolicy.v1");
const {
  isProposalsMutationEnabled,
  isApprovalsMutationEnabled,
  isExecutionEnabled,
} = require("../../config/autopilotSafetyRuntime");
const { AutopilotSafetyError } = require("./proposalValidation");
const {
  ACTION_TYPE,
  buildTargetSnapshot,
  deriveIdempotencyKey,
  buildCanonicalAcceptedCreateContent,
  canonicalContentMatches,
} = require("./idempotencyKey");
const AutopilotActionProposal = require("../../models/AutopilotActionProposal");
const AutopilotActionEvent = require("../../models/AutopilotActionEvent");
const { defaultExpiresAt } = require("../../models/AutopilotActionProposal");

const TERMINAL_STATUSES = new Set(["APPROVED", "REJECTED", "EXPIRED"]);

function isDuplicateKeyError(err) {
  return (
    err &&
    (err.code === 11000 ||
      err.codeName === "DuplicateKey" ||
      (Array.isArray(err.writeErrors) && err.writeErrors.some((e) => e.code === 11000)))
  );
}

async function assertTransactionsAvailable() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new AutopilotSafetyError(
      "TRANSACTIONS_UNAVAILABLE",
      "MongoDB transactions unavailable",
      503
    );
  }
  try {
    const hello = await db.admin().command({ hello: 1 });
    if (!hello || !hello.setName) {
      throw new AutopilotSafetyError(
        "TRANSACTIONS_UNAVAILABLE",
        "MongoDB transactions unavailable",
        503
      );
    }
  } catch (err) {
    if (err instanceof AutopilotSafetyError) {
      throw err;
    }
    throw new AutopilotSafetyError(
      "TRANSACTIONS_UNAVAILABLE",
      "MongoDB transactions unavailable",
      503
    );
  }
}

function buildReadMeta(proposal) {
  const plain =
    proposal && typeof proposal.toObject === "function"
      ? proposal.toObject({ flattenMaps: false })
      : proposal;
  const now = Date.now();
  const expiresAt = plain.expiresAt ? new Date(plain.expiresAt).getTime() : null;
  const isPastApprovalDeadline =
    plain.status === "PROPOSED" && expiresAt != null && expiresAt <= now;
  return {
    executionAuthorized: false,
    executionEnabled: isExecutionEnabled(),
    approvalEligible: plain.status === "PROPOSED" && !isPastApprovalDeadline,
    isPastApprovalDeadline,
  };
}

function serializeProposal(proposal) {
  const plain =
    proposal && typeof proposal.toObject === "function"
      ? proposal.toObject({ flattenMaps: false })
      : proposal;
  return {
    ...plain,
    meta: buildReadMeta(plain),
  };
}

async function appendEvent(session, { actionId, eventType, actorId, details = {} }) {
  await AutopilotActionEvent.create(
    [
      {
        actionId,
        eventType,
        actorId,
        actorRole: "admin",
        policyVersion: POLICY_VERSION,
        timestamp: new Date(),
        details,
      },
    ],
    { session }
  );
}

async function findByIdempotencyKey(idempotencyKey) {
  return AutopilotActionProposal.findOne({ idempotencyKey }).lean();
}

async function resolveIdempotentCreate(input, idempotencyKey) {
  const existing = await findByIdempotencyKey(idempotencyKey);
  if (!existing) {
    return null;
  }

  if (!canonicalContentMatches(input, existing)) {
    throw new AutopilotSafetyError(
      "IDEMPOTENCY_CONFLICT",
      "Idempotency identity conflicts with existing proposal content",
      409
    );
  }

  if (existing.status === "REJECTED" || existing.status === "EXPIRED") {
    throw new AutopilotSafetyError(
      "IDEMPOTENCY_CONFLICT",
      "Proposal identity already exists in a terminal non-replayable state",
      409
    );
  }

  return existing;
}

function buildProposalDocument(input, idempotencyKey) {
  const canonical = buildCanonicalAcceptedCreateContent(input);
  const targetSnapshot = buildTargetSnapshot({
    specKey: input.specKey,
    topicKey: input.topicKey,
    advisoryAction: input.advisoryAction,
    advisorySourceRef: input.advisorySourceRef,
    evidenceCutoffAt: input.evidenceCutoffAt,
  });

  return {
    idempotencyKey,
    actionType: ACTION_TYPE,
    policyVersion: POLICY_VERSION,
    autopilotObserverVersion: input.autopilotObserverVersion,
    advisorySource: canonical.advisorySource,
    specKey: input.specKey,
    topicKey: input.topicKey,
    minimumPermissionLevel: input.minimumPermissionLevel,
    status: "PROPOSED",
    targetSnapshot,
    proposedPayload: canonical.proposedPayload,
    expiresAt: defaultExpiresAt(),
  };
}

async function createProposal(input, actorId) {
  if (!isProposalsMutationEnabled()) {
    throw new AutopilotSafetyError(
      "AUTOPILOT_PROPOSALS_DISABLED",
      "Autopilot learning proposals are disabled",
      403
    );
  }

  await assertTransactionsAvailable();

  const targetSnapshot = buildTargetSnapshot({
    specKey: input.specKey,
    topicKey: input.topicKey,
    advisoryAction: input.advisoryAction,
    advisorySourceRef: input.advisorySourceRef,
    evidenceCutoffAt: input.evidenceCutoffAt,
  });

  const idempotencyKey = deriveIdempotencyKey({
    specKey: input.specKey,
    topicKey: input.topicKey,
    advisoryAction: input.advisoryAction,
    targetSnapshotHash: targetSnapshot.targetSnapshotHash,
    evidenceCutoffAt: input.evidenceCutoffAt,
  });

  const replay = await resolveIdempotentCreate(input, idempotencyKey);
  if (replay) {
    return { proposal: replay, idempotentReplay: true };
  }

  const doc = buildProposalDocument(input, idempotencyKey);
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const [created] = await AutopilotActionProposal.create([doc], { session });
    await appendEvent(session, {
      actionId: created.actionId,
      eventType: "PROPOSED",
      actorId,
      details: {
        note: "proposal created",
        previousStatus: null,
        newStatus: "PROPOSED",
      },
    });
    await session.commitTransaction();
    const plain = created.toObject({ flattenMaps: false });
    return { proposal: plain, idempotentReplay: false };
  } catch (err) {
    await session.abortTransaction();
    if (isDuplicateKeyError(err)) {
      const existing = await findByIdempotencyKey(idempotencyKey);
      if (!existing) {
        throw err;
      }
      const replayAfterRace = await resolveIdempotentCreate(input, idempotencyKey);
      if (replayAfterRace) {
        return { proposal: replayAfterRace, idempotentReplay: true };
      }
    }
    throw err;
  } finally {
    session.endSession();
  }
}

function parseListFilters(query = {}) {
  const filters = {};
  if (query.status) {
    filters.status = String(query.status).trim();
  }
  if (query.specKey) {
    filters.specKey = String(query.specKey).trim();
  }
  if (query.topicKey) {
    filters.topicKey = String(query.topicKey).trim();
  }
  if (query.advisoryAction) {
    filters["advisorySource.advisoryAction"] = String(query.advisoryAction).trim();
  }
  if (query.createdAfter) {
    const createdAfter = new Date(query.createdAfter);
    if (!Number.isNaN(createdAfter.getTime())) {
      filters.createdAt = { ...(filters.createdAt || {}), $gte: createdAfter };
    }
  }
  if (query.createdBefore) {
    const createdBefore = new Date(query.createdBefore);
    if (!Number.isNaN(createdBefore.getTime())) {
      filters.createdAt = { ...(filters.createdAt || {}), $lte: createdBefore };
    }
  }
  const limit = Math.min(Math.max(parseInt(String(query.limit || "20"), 10) || 20, 1), 50);
  const offset = Math.max(parseInt(String(query.offset || "0"), 10) || 0, 0);
  return { filters, limit, offset };
}

async function listProposals(query = {}) {
  const { filters, limit, offset } = parseListFilters(query);
  const [items, total] = await Promise.all([
    AutopilotActionProposal.find(filters)
      .sort({ createdAt: -1, actionId: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    AutopilotActionProposal.countDocuments(filters),
  ]);
  return {
    proposals: items.map((item) => serializeProposal(item)),
    pagination: { limit, offset, total },
  };
}

async function getProposal(actionId, options = {}) {
  const proposal = await AutopilotActionProposal.findOne({ actionId }).lean();
  if (!proposal) {
    throw new AutopilotSafetyError("PROPOSAL_NOT_FOUND", "Proposal not found", 404);
  }

  const result = {
    proposal: serializeProposal(proposal),
  };

  if (options.includeEvents) {
    const eventLimit = Math.min(
      Math.max(parseInt(String(options.eventLimit || "20"), 10) || 20, 1),
      50
    );
    result.events = await AutopilotActionEvent.find({ actionId })
      .sort({ timestamp: -1 })
      .limit(eventLimit)
      .lean();
  }

  return result;
}

function buildApprovalSnapshot(proposal, actorId) {
  const plain = proposal.toObject({ flattenMaps: false });
  return {
    targetSnapshot: plain.targetSnapshot,
    proposedPayload: plain.proposedPayload,
    policyVersion: plain.policyVersion,
    minimumPermissionLevel: plain.minimumPermissionLevel,
    advisorySource: plain.advisorySource,
    evidenceCutoffAt: plain.targetSnapshot.evidenceCutoffAt,
    idempotencyKey: plain.idempotencyKey,
    approvedAt: new Date(),
    approverId: actorId,
    approverRole: "admin",
    expiresAt: plain.expiresAt,
  };
}

async function approveProposal(actionId, actorId) {
  if (!isApprovalsMutationEnabled()) {
    throw new AutopilotSafetyError(
      "AUTOPILOT_APPROVALS_DISABLED",
      "Autopilot learning approvals are disabled",
      403
    );
  }

  await assertTransactionsAvailable();
  const now = new Date();
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const current = await AutopilotActionProposal.findOne({
      actionId,
      status: "PROPOSED",
      expiresAt: { $gt: now },
    }).session(session);

    if (!current) {
      const existing = await AutopilotActionProposal.findOne({ actionId }).session(session).lean();
      if (!existing) {
        throw new AutopilotSafetyError("PROPOSAL_NOT_FOUND", "Proposal not found", 404);
      }
      if (
        existing.status === "PROPOSED" &&
        new Date(existing.expiresAt).getTime() <= now.getTime()
      ) {
        throw new AutopilotSafetyError(
          "PROPOSAL_EXPIRED",
          "Proposal approval deadline has passed",
          409
        );
      }
      throw new AutopilotSafetyError(
        "INVALID_STATE_TRANSITION",
        `Cannot approve proposal in status ${existing.status}`,
        409
      );
    }

    const approvalSnapshot = buildApprovalSnapshot(current, actorId);
    const reviewedAt = new Date();
    current.status = "APPROVED";
    current.reviewedBy = actorId;
    current.reviewedAt = reviewedAt;
    current.approvalSnapshot = approvalSnapshot;
    await current.save({ session, validateBeforeSave: true });

    await appendEvent(session, {
      actionId,
      eventType: "APPROVED",
      actorId,
      details: {
        previousStatus: "PROPOSED",
        newStatus: "APPROVED",
      },
    });

    await session.commitTransaction();
    return current.toObject({ flattenMaps: false });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function rejectProposal(actionId, actorId, rejectionReason) {
  if (!isApprovalsMutationEnabled()) {
    throw new AutopilotSafetyError(
      "AUTOPILOT_APPROVALS_DISABLED",
      "Autopilot learning approvals are disabled",
      403
    );
  }

  await assertTransactionsAvailable();
  const now = new Date();
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const updated = await AutopilotActionProposal.findOneAndUpdate(
      { actionId, status: "PROPOSED" },
      {
        $set: {
          status: "REJECTED",
          reviewedBy: actorId,
          reviewedAt: now,
          rejectionReason,
        },
      },
      { session, new: true }
    );

    if (!updated) {
      const current = await AutopilotActionProposal.findOne({ actionId }).session(session).lean();
      if (!current) {
        throw new AutopilotSafetyError("PROPOSAL_NOT_FOUND", "Proposal not found", 404);
      }
      throw new AutopilotSafetyError(
        "INVALID_STATE_TRANSITION",
        `Cannot reject proposal in status ${current.status}`,
        409
      );
    }

    await appendEvent(session, {
      actionId,
      eventType: "REJECTED",
      actorId,
      details: {
        previousStatus: "PROPOSED",
        newStatus: "REJECTED",
      },
    });

    await session.commitTransaction();
    return updated.toObject({ flattenMaps: false });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function expireProposal(actionId, actorId) {
  if (!isApprovalsMutationEnabled()) {
    throw new AutopilotSafetyError(
      "AUTOPILOT_APPROVALS_DISABLED",
      "Autopilot learning approvals are disabled",
      403
    );
  }

  await assertTransactionsAvailable();
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const updated = await AutopilotActionProposal.findOneAndUpdate(
      { actionId, status: "PROPOSED" },
      { $set: { status: "EXPIRED" } },
      { session, new: true }
    );

    if (!updated) {
      const current = await AutopilotActionProposal.findOne({ actionId }).session(session).lean();
      if (!current) {
        throw new AutopilotSafetyError("PROPOSAL_NOT_FOUND", "Proposal not found", 404);
      }
      throw new AutopilotSafetyError(
        "INVALID_STATE_TRANSITION",
        `Cannot expire proposal in status ${current.status}`,
        409
      );
    }

    await appendEvent(session, {
      actionId,
      eventType: "EXPIRED",
      actorId,
      details: {
        previousStatus: "PROPOSED",
        newStatus: "EXPIRED",
      },
    });

    await session.commitTransaction();
    return updated.toObject({ flattenMaps: false });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = {
  AutopilotSafetyError,
  assertTransactionsAvailable,
  buildReadMeta,
  serializeProposal,
  createProposal,
  listProposals,
  getProposal,
  approveProposal,
  rejectProposal,
  expireProposal,
  TERMINAL_STATUSES,
};
