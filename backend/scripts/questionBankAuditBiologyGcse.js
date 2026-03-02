/**
 * Question Bank Audit — Biology GCSE AQA (thin wrapper).
 * Uses the shared audit module; writes the same docs via runQuestionBankAudit.
 *
 * Usage: node scripts/questionBankAuditBiologyGcse.js
 * Writes: docs/QUESTION_BANK_AUDIT_aqa-gcse-biology.md, docs/SPRINT_ORDER_aqa-gcse-biology.md
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const { runQuestionBankAudit, safeSpecKeyForFilename } = require("./_audit/questionBankAudit");

const SPEC_KEY = "aqa-gcse-biology";

async function run() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) throw new Error("MONGO_URI not set");

  await mongoose.connect(MONGO_URI);
  try {
    const outDir = path.resolve(__dirname, "..", "..", "docs");
    const result = await runQuestionBankAudit({ specKey: SPEC_KEY, outDir });
    const safe = safeSpecKeyForFilename(SPEC_KEY);
    console.log("Wrote", path.join(outDir, `QUESTION_BANK_AUDIT_${safe}.md`));
    console.log("Wrote", path.join(outDir, `SPRINT_ORDER_${safe}.md`));
    return result;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run()
    .then(() => {
      console.log("Question bank audit complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { run };
