/**
 * Taxonomy validator — ensures all *_topics.json files pass schema + slug + uniqueness rules.
 * Fails CI if any taxonomy is invalid.
 */
const { execSync } = require("child_process");
const path = require("path");

describe("Taxonomy validator", () => {
  it("passes validation for all *_topics.json files", () => {
    const cmd = "node scripts/validateTaxonomies.js";
    execSync(cmd, {
      cwd: path.join(__dirname, ".."), // backend/
      stdio: "pipe",
    });
  });
});
