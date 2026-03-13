/** Jest config for backend tests only (Phase 9). Run: npm run test:backend */
if (!process.env.JWT_SECRET_KEY) {
  process.env.JWT_SECRET_KEY = "test-secret-for-backend-tests";
}
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
  ],

  testPathIgnorePatterns: ["/node_modules/"],

  setupFilesAfterEnv: ["<rootDir>/backend/tests/setup.js"],
  forceExit: true,
  testTimeout: 30000,
};
