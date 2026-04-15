/** Isolated Jest config for checkpoint generation unit tests (no Mongo memory server). */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/checkpointGeneration.unit.test.js", "**/tests/checkpointQualityValidation.unit.test.js"],
  setupFilesAfterEnv: [],
};
