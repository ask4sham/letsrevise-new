/** Jest config for backend tests only (Phase 9). Run: npm run test:backend */
if (!process.env.JWT_SECRET_KEY) {
  process.env.JWT_SECRET_KEY = "test-secret-for-backend-tests";
}
if (!process.env.OPENAI_API_KEY || !String(process.env.OPENAI_API_KEY).trim()) {
  process.env.OPENAI_API_KEY = "sk-test-ci-dummy";
}
process.env.NODE_ENV = process.env.NODE_ENV || "test";
module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  verbose: true,

  // Only backend tests (explicit paths for cross-platform / Windows + Linux)
  testMatch: [
    "<rootDir>/backend/tests/**/*.test.js",
    "<rootDir>/backend/tests/**/*.integration.test.js",
    "<rootDir>/backend/utils/contentCanonicalKey.test.js",
    "<rootDir>/backend/services/contentCoverageService.test.js",
    "<rootDir>/backend/services/contentGraphService.test.js",
    "<rootDir>/backend/services/curriculumGapDetectionService.test.js",
  ],

  testPathIgnorePatterns: [
    "/node_modules/",
    // Node assert script — run via: node backend/tests/visualPackRegistry.unit.test.js
    "visualPackRegistry\\.unit\\.test\\.js",
  ],

  setupFilesAfterEnv: ["<rootDir>/backend/tests/setup.js"],
  forceExit: true,
  testTimeout: 30000,
};
