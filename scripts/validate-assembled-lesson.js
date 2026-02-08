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
const fs = require("fs");
const path = require("path");

function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" });
  return res;
}

function main() {
  const ROOT = process.cwd();
  const argv = process.argv.slice(2);

  // Pipeline mode: single arg = schema path, read JSON from stdin
  if (argv.length === 1 && !argv[0].startsWith("-")) {
    const schemaPath = path.isAbsolute(argv[0]) ? argv[0] : path.join(ROOT, argv[0]);
    if (!fs.existsSync(schemaPath)) {
      process.stderr.write("Error: schema file not found: " + schemaPath + "\n");
      process.exit(1);
    }
    const stdin = fs.readFileSync(0, "utf8");
    const validatePath = path.join(ROOT, "scripts", "validate-json.js");
    const validator = spawnSync(
      "node",
      [validatePath, "-", schemaPath],
      { input: stdin, encoding: "utf8", shell: process.platform === "win32" }
    );
    if (validator.status !== 0) {
      process.stderr.write(validator.stdout || "");
      process.stderr.write(validator.stderr || "Error: validation failed.\n");
      process.exit(1);
    }
    process.stdout.write(stdin);
    return;
  }

  const assemblePath = path.join(ROOT, "scripts", "assemble-lesson-structure.js");
  const validatePath = path.join(ROOT, "scripts", "validate-json.js");
  const schemaPath = path.join(ROOT, "docs", "curriculum", "engine", "lesson-structure.v1.schema.json");

  const assembleArgs = [assemblePath, ...argv];

  const assembled = run("node", assembleArgs);
  if (assembled.status !== 0) {
    process.stderr.write(assembled.stderr || "Error: assemble-lesson-structure failed.\n");
    process.exit(1);
  }

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

  process.stdout.write(assembled.stdout);
}

main();
