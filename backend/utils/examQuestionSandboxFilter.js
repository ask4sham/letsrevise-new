/** Exclude disposable browser-test masters from teacher Question Bank listings and auto-select. */
const EXCLUDE_SANDBOX_MANUAL_TEST = { "metadata.sandboxManualTest": { $ne: true } };

module.exports = { EXCLUDE_SANDBOX_MANUAL_TEST };
