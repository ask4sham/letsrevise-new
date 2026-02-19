/**
 * PR-SEED-ALL-1: Shared helpers for AQA GCSE Biology seed scripts.
 *
 * Global policy: all bulk-seeded ExamQuestions use status: "draft" only.
 * Auto-generate then review; publish per unit after review. Keeps trust high
 * and avoids shipping weak questions into live teacher workflows.
 *
 * - Load taxonomy from config/aqa_gcse_biology_topics.json
 * - Resolve topicKey by unit + topic name (no hardcoded keys)
 * - getTeacherId (SEED_TEACHER_ID or first teacher)
 * - seedTopic: topic-level idempotent insert (countDocuments > 0 → skip)
 */
const path = require("path");
const fs = require("fs");

const TAXONOMY_PATH = path.resolve(__dirname, "..", "..", "config", "aqa_gcse_biology_topics.json");

const SUBJECT = "Biology";
const EXAM_BOARD = "AQA";
const LEVEL = "GCSE";
/** Global rule: draft-only for all bulk seeding. Publish per unit after review. */
const STATUS = "draft";

function loadTaxonomy() {
  const raw = fs.readFileSync(TAXONOMY_PATH, "utf8");
  return JSON.parse(raw);
}

/**
 * @param {string} unitName - e.g. "Cell Biology"
 * @param {string} topicName - e.g. "Cell structure" or "Eukaryotes and prokaryotes"
 * @returns {string} topicKey from taxonomy
 */
function resolveTopicKey(unitName, topicName) {
  const taxonomy = loadTaxonomy();
  const unit = taxonomy.units.find((u) => u.unit === unitName);
  if (!unit) throw new Error(`Unit not found in taxonomy: ${unitName}`);
  const topic = unit.topics.find((t) => t.topic === topicName);
  if (!topic) throw new Error(`Topic not found in taxonomy: ${unitName} → ${topicName}`);
  return topic.key;
}

/**
 * @param {object} mongoose - connected mongoose instance
 * @returns {Promise<string>} teacher _id string
 */
async function getTeacherId(mongoose) {
  const User = require("../../models/User");
  if (process.env.SEED_TEACHER_ID) return process.env.SEED_TEACHER_ID;
  const teacher = await User.findOne({ userType: "teacher" }).lean();
  if (teacher) return teacher._id.toString();
  throw new Error("No teacher user found. Run seedUsers.js or set SEED_TEACHER_ID in .env");
}

/**
 * Idempotent seed for one topic. If any questions exist for topicKey, skips.
 * @param {object} mongoose - connected mongoose instance
 * @param {object} opts
 * @param {string} opts.unitName - e.g. "Cell Biology"
 * @param {string} opts.topicName - e.g. "Cell structure"
 * @param {string} opts.unitKey - e.g. "cell-biology"
 * @param {string} opts.topicLabel - display name e.g. "Cell structure"
 * @param {Array<{question:string,options:string[],correctIndex:number,marks:number}>} opts.mcqs - 10 MCQs
 * @param {Array<{question:string,marks:number,markScheme:string[]}>} opts.shortAnswer - 5 short-answer
 * @returns {Promise<{skipped:boolean,inserted?:number}>}
 */
async function seedTopic(mongoose, opts) {
  const ExamQuestion = require("../../models/ExamQuestion");
  const { unitName, topicName, unitKey, topicLabel, mcqs, shortAnswer } = opts;

  const topicKey = resolveTopicKey(unitName, topicName);
  const existingCount = await ExamQuestion.countDocuments({ topicKey });
  if (existingCount > 0) {
    console.log(`  [${topicLabel}] Already ${existingCount} question(s) for topicKey "${topicKey}". Skipping.`);
    return { skipped: true, topic: topicLabel };
  }

  const teacherId = new mongoose.Types.ObjectId(await getTeacherId(mongoose));
  const docs = [];

  for (const row of mcqs) {
    docs.push({
      teacherId,
      subject: SUBJECT,
      examBoard: EXAM_BOARD,
      level: LEVEL,
      topicKey,
      topic: topicLabel,
      unitKey,
      type: "mcq",
      marks: row.marks,
      question: row.question,
      options: row.options,
      correctIndex: row.correctIndex,
      status: STATUS,
    });
  }
  for (const row of shortAnswer) {
    docs.push({
      teacherId,
      subject: SUBJECT,
      examBoard: EXAM_BOARD,
      level: LEVEL,
      topicKey,
      topic: topicLabel,
      unitKey,
      type: "short",
      marks: row.marks,
      question: row.question,
      markScheme: row.markScheme || [],
      status: STATUS,
    });
  }

  await ExamQuestion.insertMany(docs);
  console.log(`  [${topicLabel}] ✔ Seeded 15 questions.`);
  return { skipped: false, inserted: docs.length, topic: topicLabel };
}

module.exports = {
  loadTaxonomy,
  resolveTopicKey,
  getTeacherId,
  seedTopic,
  SUBJECT,
  EXAM_BOARD,
  LEVEL,
  STATUS,
};
