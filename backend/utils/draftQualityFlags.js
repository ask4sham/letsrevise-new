/**
 * Draft quality heuristics for autopilot quality pass — reuses review flags (no duplicate rules).
 * @see ../utils/reviewQualityFlags.js (teacher UI)
 */
const reviewQualityFlags = require("./reviewQualityFlags");

module.exports = {
  ...reviewQualityFlags,
};
