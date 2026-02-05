// scripts/validate-lesson-bundle.js
// Internal CLI utility. Not imported by runtime code.
//
// Validates a Lesson Plan Bundle JSON file against the canonical schema:
//   docs/curriculum/lesson-plan-bundle.schema.json

const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function buildValidator() {
  const schemaPath = path.join(
    __dirname,
    "..",
    "docs",
    "curriculum",
    "lesson-plan-bundle.schema.json"
  );
  const schema = loadJson(schemaPath);

  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  return { validate };
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/validate-lesson-bundle.js <bundle.json>");
    process.exit(2);
  }

  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  const data = loadJson(abs);

  const { validate } = buildValidator();
  const ok = validate(data);

  if (!ok) {
    console.error("❌ Bundle is INVALID");
    console.error(validate.errors);
    process.exit(1);
  }

  console.log("✅ Bundle is valid:", file);
}

if (require.main === module) main();

