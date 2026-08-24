/**
 * Autopilot Preparation Programme — P1.2 gated preparation record persistence service.
 * Service-only. No API routes. No proposal mutation. No content/execution.
 */
const mongoose = require("mongoose");
const { isPreparationRecordPersistenceEnabled } = require("../../config/autopilotPreparationRuntime");
const {
  PreparationRecordPersistenceError,
  PREPARATION_RECORD_PERSISTENCE_POLICY_VERSION,
  PREPARATION_RECORD_EVENT_CREATED,
} = require("../../contracts/autopilotPreparationRecordPersistence.v1");
const {
  PreparationRecordCandidateError,
  buildPreparationRecordCandidate,
} = require("./buildPreparationRecordCandidate");
const AutopilotActionProposal = require("../../models/AutopilotActionProposal");
const AutopilotPreparationRecord = require("../../models/AutopilotPreparationRecord");
const AutopilotPreparationRecordEvent = require("../../models/AutopilotPreparationRecordEvent");

function isDuplicateKeyError(err) {
  return (
    err &&
    (err.code === 11000 ||
      err.codeName === "DuplicateKey" ||
      (Array.isArray(err.writeErrors) && err.writeErrors.some((e) => e.code === 11000)))
  );
}

function getDuplicateKeyPattern(err) {
  if (err?.keyPattern) {
    return err.keyPattern;
  }
  const writeError = Array.isArray(err?.writeErrors)
    ? err.writeErrors.find((entry) => entry.code === 11000)
    : null;
  if (writeError?.keyPattern) {
    return writeError.keyPattern;
  }
  if (writeError?.err?.keyPattern) {
    return writeError.err.keyPattern;
  }
  if (err?.errorResponse?.keyPattern) {
    return err.errorResponse.keyPattern;
  }
  return null;
}

function isActionIdDuplicateKeyError(err) {
  if (!isDuplicateKeyError(err)) {
    return false;
  }
  const pattern = getDuplicateKeyPattern(err);
  if (!pattern) {
    return false;
  }
  const keys = Object.keys(pattern);
  return keys.length === 1 && keys[0] === "actionId" && pattern.actionId === 1;
}

function toPlainRecord(record) {
  if (!record) {
    return null;
  }
  if (typeof record.toObject === "function") {
    return record.toObject({ flattenMaps: false });
  }
  return record;
}

async function assertTransactionsAvailable() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new PreparationRecordPersistenceError(
      "TRANSACTIONS_UNAVAILABLE",
      "MongoDB transactions unavailable",
      503
    );
  }
  try {
    const hello = await db.admin().command({ hello: 1 });
    if (!hello || !hello.setName) {
      throw new PreparationRecordPersistenceError(
        "TRANSACTIONS_UNAVAILABLE",
        "MongoDB transactions unavailable",
        503
      );
    }
  } catch (err) {
    if (err instanceof PreparationRecordPersistenceError) {
      throw err;
    }
    throw new PreparationRecordPersistenceError(
      "TRANSACTIONS_UNAVAILABLE",
      "MongoDB transactions unavailable",
      503
    );
  }
}

function mapCandidateError(err) {
  if (err instanceof PreparationRecordCandidateError) {
    const statusCode = err.code === "NOT_ELIGIBLE" ? 422 : 422;
    throw new PreparationRecordPersistenceError(err.code, err.message, statusCode, err.details || {});
  }
  throw err;
}

function buildCandidate(proposalPlain, evaluatedAt) {
  try {
    return buildPreparationRecordCandidate(proposalPlain, { evaluatedAt });
  } catch (err) {
    mapCandidateError(err);
  }
}

function buildRecordDocument(candidate, actorId, actorRole) {
  return {
    actionId: candidate.actionId,
    preparationRecordSemanticIdentityHash: candidate.preparationRecordSemanticIdentityHash,
    recordCandidate: candidate,
    actorId: actorId || null,
    actorRole: String(actorRole).trim(),
  };
}

function buildCreationEventDocument(recordDoc, candidate, actorId, actorRole) {
  return {
    actionId: candidate.actionId,
    eventType: PREPARATION_RECORD_EVENT_CREATED,
    policyVersion: PREPARATION_RECORD_PERSISTENCE_POLICY_VERSION,
    preparationRecordId: recordDoc._id,
    preparationRecordSemanticIdentityHash: candidate.preparationRecordSemanticIdentityHash,
    actorId: actorId || null,
    actorRole: String(actorRole).trim(),
    timestamp: new Date(),
    details: {
      preparationAuthoritySnapshotHash: candidate.preparationAuthoritySnapshotHash,
      eligibilityAuditHash: candidate.eligibilityAuditHash,
      eligibilitySemanticHash: candidate.eligibilitySemanticHash,
    },
  };
}

function resolveReplay(existing, candidate) {
  const existingHash = String(existing.preparationRecordSemanticIdentityHash).trim();
  const candidateHash = String(candidate.preparationRecordSemanticIdentityHash).trim();
  if (existingHash === candidateHash) {
    return { record: toPlainRecord(existing), idempotentReplay: true };
  }
  throw new PreparationRecordPersistenceError(
    "PREPARATION_IDENTITY_CONFLICT",
    "Preparation record identity conflicts with existing persisted record for this action",
    409,
    {
      actionId: candidate.actionId,
      existingPreparationRecordSemanticIdentityHash: existingHash,
      requestedPreparationRecordSemanticIdentityHash: candidateHash,
    }
  );
}

async function findExistingRecordByActionId(actionId) {
  return AutopilotPreparationRecord.findOne({ actionId: String(actionId).trim() }).lean();
}

async function persistPreparationRecord(actionId, { actorId, actorRole } = {}) {
  if (!isPreparationRecordPersistenceEnabled()) {
    throw new PreparationRecordPersistenceError(
      "PREPARATION_RECORD_PERSISTENCE_DISABLED",
      "Autopilot preparation record persistence is disabled",
      403
    );
  }

  if (!actorRole || String(actorRole).trim().length === 0) {
    throw new PreparationRecordPersistenceError(
      "INVALID_PERSISTENCE_REQUEST",
      "actorRole is required for preparation record persistence",
      400
    );
  }

  await assertTransactionsAvailable();

  const normalizedActionId = String(actionId).trim();
  const proposal = await AutopilotActionProposal.findOne({ actionId: normalizedActionId }).lean();
  if (!proposal) {
    throw new PreparationRecordPersistenceError("PROPOSAL_NOT_FOUND", "Proposal not found", 404, {
      actionId: normalizedActionId,
    });
  }

  if (proposal.status !== "APPROVED") {
    throw new PreparationRecordPersistenceError(
      "PROPOSAL_NOT_APPROVED",
      `Cannot persist preparation record for proposal in status ${proposal.status}`,
      409,
      { actionId: normalizedActionId, status: proposal.status }
    );
  }

  const evaluatedAt = new Date().toISOString();
  const candidate = buildCandidate(proposal, evaluatedAt);

  const existing = await findExistingRecordByActionId(normalizedActionId);
  if (existing) {
    return resolveReplay(existing, candidate);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const lockedProposal = await AutopilotActionProposal.findOne({
      actionId: normalizedActionId,
      status: "APPROVED",
    })
      .session(session)
      .lean();

    if (!lockedProposal) {
      throw new PreparationRecordPersistenceError(
        "PROPOSAL_NOT_APPROVED",
        "Proposal is no longer approved for preparation record persistence",
        409,
        { actionId: normalizedActionId }
      );
    }

    const lockedCandidate = buildCandidate(lockedProposal, evaluatedAt);
    if (
      lockedCandidate.preparationRecordSemanticIdentityHash !==
      candidate.preparationRecordSemanticIdentityHash
    ) {
      throw new PreparationRecordPersistenceError(
        "STALE_PROPOSAL_AUTHORITY",
        "Proposal authority changed during preparation record persistence",
        409,
        {
          actionId: normalizedActionId,
          expectedPreparationRecordSemanticIdentityHash: candidate.preparationRecordSemanticIdentityHash,
          observedPreparationRecordSemanticIdentityHash:
            lockedCandidate.preparationRecordSemanticIdentityHash,
        }
      );
    }

    const existingInTxn = await AutopilotPreparationRecord.findOne({ actionId: normalizedActionId })
      .session(session)
      .lean();
    if (existingInTxn) {
      await session.abortTransaction();
      return resolveReplay(existingInTxn, candidate);
    }

    const [createdRecord] = await AutopilotPreparationRecord.create(
      [buildRecordDocument(candidate, actorId, actorRole)],
      { session }
    );

    await AutopilotPreparationRecordEvent.create(
      [buildCreationEventDocument(createdRecord, candidate, actorId, actorRole)],
      { session }
    );

    await session.commitTransaction();
    return { record: toPlainRecord(createdRecord), idempotentReplay: false };
  } catch (err) {
    await session.abortTransaction();
    if (isActionIdDuplicateKeyError(err)) {
      const raced = await findExistingRecordByActionId(normalizedActionId);
      if (raced) {
        return resolveReplay(raced, candidate);
      }
    }
    if (err instanceof PreparationRecordPersistenceError) {
      throw err;
    }
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = {
  persistPreparationRecord,
  PreparationRecordPersistenceError,
  assertTransactionsAvailable,
  buildRecordDocument,
  buildCreationEventDocument,
  resolveReplay,
  isActionIdDuplicateKeyError,
  getDuplicateKeyPattern,
};
