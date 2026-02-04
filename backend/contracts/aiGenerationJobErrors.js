// Canonical AI generation job error codes (pure data contract, no behavior).

const ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  POLICY_VIOLATION: "POLICY_VIOLATION",
  UNAUTHORIZED: "UNAUTHORIZED",
  RATE_LIMITED: "RATE_LIMITED",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  TIMEOUT: "TIMEOUT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  CANCELLED_BY_USER: "CANCELLED_BY_USER",
};

const ERROR_CODE_DESCRIPTIONS = {
  [ERROR_CODES.INVALID_INPUT]: "The job input was missing required fields or contained invalid values.",
  [ERROR_CODES.POLICY_VIOLATION]:
    "The requested generation could not be completed due to safety or content policy restrictions.",
  [ERROR_CODES.UNAUTHORIZED]:
    "The caller is not authorized to create or view this job based on current ownership/visibility rules.",
  [ERROR_CODES.RATE_LIMITED]: "The job could not be processed due to rate limiting. Try again later.",
  [ERROR_CODES.PROVIDER_ERROR]:
    "The upstream AI provider returned an error while processing this job (non-retryable or opaque).",
  [ERROR_CODES.TIMEOUT]: "The job exceeded the maximum allowed processing time and was aborted.",
  [ERROR_CODES.INTERNAL_ERROR]:
    "An unexpected internal error occurred while processing the job. Check logs for more details.",
  [ERROR_CODES.CANCELLED_BY_USER]: "The job was explicitly cancelled by the user or an admin.",
};

module.exports = {
  ERROR_CODES,
  ERROR_CODE_DESCRIPTIONS,
};

