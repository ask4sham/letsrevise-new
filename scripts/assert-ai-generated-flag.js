// scripts/assert-ai-generated-flag.js
// CI guard: ensure all generated lesson bundles declare aiGenerated: true at the root.
// Fails the build if any violation is found.

const fs = require("fs");
const path = require("path");

function findGeneratedBundles(rootDir) {
  const results = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        entry.isFile() &&
        entry.name.startsWith("generated-") &&
        entry.name.endsWith(".json")
      ) {
        results.push(full);
      }
    }
  }

  if (fs.existsSync(rootDir)) {
    walk(rootDir);
  }

  return results;
}

function main() {
  const baseDir = process.cwd();
  const generatedDir = path.join(baseDir, "docs", "ai", "examples");
  const files = findGeneratedBundles(generatedDir);

  if (files.length === 0) {
    // No generated bundles present; treat as pass.
    console.log("No generated lesson bundles found; skipping aiGenerated check.");
    return;
  }

  const violations = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(file, "utf8");
      const json = JSON.parse(raw);

      if (json.aiGenerated !== true) {
        violations.push({
          file,
          value: json.aiGenerated
        });
      }
    } catch (err) {
      violations.push({
        file,
        error: `Failed to read/parse JSON: ${err && err.message ? err.message : String(
          err
        )}`
      });
    }
  }

  if (violations.length > 0) {
    console.error("❌ aiGenerated flag violations detected in generated lesson bundles:");
    for (const v of violations) {
      if (v.error) {
        console.error(`- ${v.file}: ${v.error}`);
      } else {
        console.error(
          `- ${v.file}: aiGenerated is ${JSON.stringify(
            v.value
          )} (expected: true)`
        );
      }
    }
    process.exit(1);
  }

  console.log("✅ All generated lesson bundles have aiGenerated: true at the root.");
}

main();

