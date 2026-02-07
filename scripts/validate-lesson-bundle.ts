/**
 * scripts/validate-lesson-bundle.ts
 *
 * Internal CLI utility. Not imported by runtime code.
 *
 * Validates a Lesson Plan Bundle JSON file against the canonical schema:
 *   docs/curriculum/lesson-plan-bundle.schema.json
 *
 * Usage:
 *   npx ts-node scripts/validate-lesson-bundle.ts docs/ai/examples/sample-lesson-plan-bundle.v1.json
 */

import fs from "fs";
import path from "path";
import Ajv, { DefinedError } from "ajv";
import addFormats from "ajv-formats";

function loadJson<T = unknown>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

function buildValidator() {
  const schemaPath = path.join(
    __dirname,
    "..",
    "docs",
    "curriculum",
    "lesson-plan-bundle.schema.json"
  );
  const schema = loadJson<Record<string, unknown>>(schemaPath);

  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  return { validate };
}

function main() {
  const file = process.argv[2];
  if (!file) {
    // eslint-disable-next-line no-console
    console.error("Usage: ts-node scripts/validate-lesson-bundle.ts <bundle.json>");
    process.exit(2);
  }

  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);

  let data: unknown;
  try {
    data = loadJson(abs);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("❌ Failed to read or parse JSON file:", abs);
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  }

  const { validate } = buildValidator();
  const ok = validate(data);

  if (!ok) {
    // eslint-disable-next-line no-console
    console.error("❌ Bundle is INVALID");
    const errors = (validate.errors || []) as DefinedError[];
    // eslint-disable-next-line no-console
    console.error(errors);
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log("✅ Bundle is valid:", file);
}

if (require.main === module) {
  main();
}

