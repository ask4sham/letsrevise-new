/** Unit tests for checkpoint attempt helpers (no Mongo memory server). */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/attemptsGranularity.unit.test.js", "**/tests/checkpointPageBreakdown.unit.test.js"],
  setupFilesAfterEnv: [],
};
