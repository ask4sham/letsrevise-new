/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: [
    "**/__tests__/**/*.ts",
    "**/__tests__/**/*.js",
    "**/?(*.)+(spec|test).ts",
    "**/?(*.)+(spec|test).js",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  transformIgnorePatterns: ["/node_modules/"],
  testPathIgnorePatterns: ["/node_modules/", "\\.old\\.js$"],
  // Avoid running forever when async handles remain (e.g. DB in integration tests)
  forceExit: true,
};
