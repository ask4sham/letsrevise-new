#!/usr/bin/env node
/**
 * validate-json.js
 * Usage:
 *   node scripts/validate-json.js <data.json> <schema.json>
 *
 * Validates JSON data against a JSON Schema (Draft 2020-12).
 * Exits 0 on success, 1 on failure.
 */

const fs = require("fs");
const path = require("path");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

function readJson(filePath) {
  if (filePath === "-" || filePath === "/dev/stdin") {
    const raw = fs.readFileSync(0, "utf8");
    const text = raw.replace(/^\uFEFF/, "");
    return JSON.parse(text);
  }
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, "utf8");
  const text = raw.replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

function main() {
  const [, , dataPath, schemaPath] = process.argv;

  if (!dataPath || !schemaPath) {
    console.error("Usage: node scripts/validate-json.js <data.json> <schema.json>");
    process.exit(1);
  }

  const data = readJson(dataPath);
  const schema = readJson(schemaPath);

  const ajv = new Ajv2020({
    allErrors: true,
    strict: true
  });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const ok = validate(data);

  if (!ok) {
    console.error("❌ INVALID");
    console.error(validate.errors);
    process.exit(1);
  }

  console.log("✅ VALID");
  process.exit(0);
}

main();

