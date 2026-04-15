/** Isolated Jest config for pure unit tests (no Mongo memory server). */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/keywordBankMark.test.js"],
  setupFilesAfterEnv: [],
};
