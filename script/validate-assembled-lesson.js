#!/usr/bin/env node

/**
 * validate-assembled-lesson.js
 *
 * Runs the deterministic lesson assembly and validates the output JSON
 * against the lesson structure schema.
 *
 * No DB. No AI. No side effects (only reads files; prints result).
 */

const { spawnSync } = require("child_process");
const path = require("path");

function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" });
  return res;
}

function main() {
  const ROOT = process.cwd();

  const assemblePath = path.join(ROOT, "scripts", "assemble-lesson-structure.js");
  const validatePath = path.join(ROOT, "scripts", "validate-json.js");
  const schemaPath = path.join(ROOT, "docs", "curriculum", "engine", "lesson-structure.v1.schema.json");

  // Optional passthrough: allow the caller to provide the same args as assemble-lesson-structure.js
  // e.g. --contract ... --statutory ... --board ... --rules ...
  const assembleArgs = [assemblePath, ...process.argv.slice(2)];

  // 1) Assemble lesson (stdout = JSON)
  const assembled = run("node", assembleArgs);
  if (assembled.status !== 0) {
    process.stderr.write(assembled.stderr || "Error: assemble-lesson-structure failed.\n");
    process.exit(1);
  }

  // 2) Validate assembled JSON via stdin
  const validator = spawnSync(
    "node",
    [validatePath, "-", schemaPath],
    {
      input: assembled.stdout,
      encoding: "utf8",
      shell: process.platform === "win32",
    }
  );

  if (validator.status !== 0) {
    process.stderr.write(validator.stdout || "");
    process.stderr.write(validator.stderr || "Error: validation failed.\n");
    process.exit(1);
  }

  // Success: print the assembled JSON (so you can pipe it to a file if desired)
  process.stdout.write(assembled.stdout);
}

main();
