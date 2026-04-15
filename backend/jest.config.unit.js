/**
 * Pure unit tests (no DB / tests/setup.js).
 * Filename pattern: .unit.test.js files under tests/.
 */
module.exports = {
  testEnvironment: "node",
  maxWorkers: 1,
  testMatch: ["**/tests/**/*.unit.test.js"],
};
