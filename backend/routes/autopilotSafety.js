/**
 * Autopilot Safety Foundation — S1.2 admin proposal routes.
 * Safety-control-plane mutations only. No execution.
 */
const express = require("express");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const { sendInternalError } = require("../utils/safeErrorResponse");
const { isExecutionEnabled } = require("../config/autopilotSafetyRuntime");
const {
  validateCreateRequest,
  validateRejectRequest,
  validateExpireRequest,
  AutopilotSafetyError,
} = require("../services/autopilotSafety/proposalValidation");
const proposalService = require("../services/autopilotSafety/proposalService");
const {
  getPreparationRecord,
  PreparationRecordRetrievalError,
} = require("../services/autopilotPreparation/getPreparationRecord");
const {
  listPreparationRecords,
  PreparationRecordListError,
} = require("../services/autopilotPreparation/listPreparationRecords");

const router = express.Router();

const PREPARATION_RECORD_RETRIEVAL_HTTP_STATUS = Object.freeze({
  PREPARATION_RECORD_RETRIEVAL_DISABLED: 503,
  INVALID_RETRIEVAL_REQUEST: 400,
  PREPARATION_RECORD_NOT_FOUND: 404,
});

const PREPARATION_RECORD_LIST_HTTP_STATUS = Object.freeze({
  PREPARATION_RECORD_RETRIEVAL_DISABLED: 503,
  INVALID_LIST_REQUEST: 400,
});

function getActorId(req) {
  return req.user?._id || req.user?.id || req.user?.userId;
}

function handleDomainError(res, err) {
  if (err instanceof AutopilotSafetyError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }
  if (err instanceof proposalService.AutopilotSafetyError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }
  return null;
}

function handlePreparationRecordRetrievalError(res, err) {
  if (err instanceof PreparationRecordRetrievalError) {
    const statusCode = PREPARATION_RECORD_RETRIEVAL_HTTP_STATUS[err.code] || 500;
    return res.status(statusCode).json({ error: err.message, code: err.code });
  }
  return null;
}

function handlePreparationRecordListError(res, err) {
  if (err instanceof PreparationRecordListError) {
    const statusCode = PREPARATION_RECORD_LIST_HTTP_STATUS[err.code] || 500;
    return res.status(statusCode).json({ error: err.message, code: err.code });
  }
  return null;
}

function executionMeta() {
  return {
    executionAuthorized: false,
    executionEnabled: isExecutionEnabled(),
  };
}

router.post("/proposals", auth, requireAdmin, async (req, res) => {
  try {
    const input = validateCreateRequest(req.body || {});
    const actorId = getActorId(req);
    const result = await proposalService.createProposal(input, actorId);
    return res.status(result.idempotentReplay ? 200 : 201).json({
      proposal: proposalService.serializeProposal(result.proposal),
      idempotentReplay: result.idempotentReplay,
      meta: executionMeta(),
    });
  } catch (err) {
    const handled = handleDomainError(res, err);
    if (handled) {
      return handled;
    }
    return sendInternalError("autopilot-safety/proposals:create", err, res);
  }
});

router.get("/proposals", auth, requireAdmin, async (req, res) => {
  try {
    const result = await proposalService.listProposals(req.query || {});
    return res.json({
      ...result,
      meta: executionMeta(),
    });
  } catch (err) {
    const handled = handleDomainError(res, err);
    if (handled) {
      return handled;
    }
    return sendInternalError("autopilot-safety/proposals:list", err, res);
  }
});

router.get("/proposals/:actionId", auth, requireAdmin, async (req, res) => {
  try {
    const includeEvents =
      req.query.includeEvents === "1" || req.query.includeEvents === "true";
    const result = await proposalService.getProposal(req.params.actionId, {
      includeEvents,
      eventLimit: req.query.eventLimit,
    });
    return res.json({
      ...result,
      meta: executionMeta(),
    });
  } catch (err) {
    const handled = handleDomainError(res, err);
    if (handled) {
      return handled;
    }
    return sendInternalError("autopilot-safety/proposals:get", err, res);
  }
});

router.post("/proposals/:actionId/approve", auth, requireAdmin, async (req, res) => {
  try {
    if (req.body && Object.keys(req.body).length > 0) {
      throw new AutopilotSafetyError(
        "INVALID_PROPOSAL",
        "Approve request must not include a body",
        400
      );
    }
    const actorId = getActorId(req);
    const proposal = await proposalService.approveProposal(req.params.actionId, actorId);
    return res.json({
      proposal: proposalService.serializeProposal(proposal),
      meta: {
        ...executionMeta(),
        executionAuthorized: false,
      },
    });
  } catch (err) {
    const handled = handleDomainError(res, err);
    if (handled) {
      return handled;
    }
    return sendInternalError("autopilot-safety/proposals:approve", err, res);
  }
});

router.post("/proposals/:actionId/reject", auth, requireAdmin, async (req, res) => {
  try {
    const { rejectionReason } = validateRejectRequest(req.body || {});
    const actorId = getActorId(req);
    const proposal = await proposalService.rejectProposal(
      req.params.actionId,
      actorId,
      rejectionReason
    );
    return res.json({
      proposal: proposalService.serializeProposal(proposal),
      meta: executionMeta(),
    });
  } catch (err) {
    const handled = handleDomainError(res, err);
    if (handled) {
      return handled;
    }
    return sendInternalError("autopilot-safety/proposals:reject", err, res);
  }
});

router.post("/proposals/:actionId/expire", auth, requireAdmin, async (req, res) => {
  try {
    validateExpireRequest(req.body || {});
    const actorId = getActorId(req);
    const proposal = await proposalService.expireProposal(req.params.actionId, actorId);
    return res.json({
      proposal: proposalService.serializeProposal(proposal),
      meta: executionMeta(),
    });
  } catch (err) {
    const handled = handleDomainError(res, err);
    if (handled) {
      return handled;
    }
    return sendInternalError("autopilot-safety/proposals:expire", err, res);
  }
});

router.get("/preparation-records", auth, requireAdmin, async (req, res) => {
  try {
    const result = await listPreparationRecords(req.query || {});
    return res.json({
      ...result,
      meta: executionMeta(),
    });
  } catch (err) {
    const handled = handlePreparationRecordListError(res, err);
    if (handled) {
      return handled;
    }
    return sendInternalError("autopilot-safety/preparation-records:list", err, res);
  }
});

router.get("/preparation-records/:actionId", auth, requireAdmin, async (req, res) => {
  try {
    const record = await getPreparationRecord(req.params.actionId);
    return res.json({
      record,
      meta: executionMeta(),
    });
  } catch (err) {
    const handled = handlePreparationRecordRetrievalError(res, err);
    if (handled) {
      return handled;
    }
    return sendInternalError("autopilot-safety/preparation-records:get", err, res);
  }
});

module.exports = router;
