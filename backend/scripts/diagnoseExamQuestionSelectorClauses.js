/**
 * READ-ONLY. Reproduce the EXACT `GET /api/exam-questions` query that
 * SelectExamQuestionModal triggers, then test it CLAUSE-BY-CLAUSE against one
 * specific question so we can see the single filter that excludes it.
 *
 * It uses the real route helpers (buildExamQuestionLevelQuery,
 * buildTopicSelectorQueryClause) so the query matches production exactly.
 *
 * Usage (PowerShell) — load lesson context straight from the lesson doc:
 *   $env:MONGO_URI="<uri>"; node backend/scripts/diagnoseExamQuestionSelectorClauses.js --lesson=<lessonId> --term=sperm
 *
 * Or pass the target question id directly:
 *   ... --lesson=<lessonId> --id=<examQuestionId>
 *
 * Or supply modal params manually (mirrors what the modal sends):
 *   ... --subject=Biology --examBoard=Edexcel --level=IGCSE \
 *       --specKey=edexcel-igcse-biology \
 *       --topicKey=edexcel-igcse-biology:human-male-and-female-reproductive-systems \
 *       --teacherId=<ownerId> --term=sperm
 *
 * Does NOT modify any data.
 */
const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const Lesson = require("../models/Lesson");
const { buildExamQuestionLevelQuery } = require("../utils/examQuestionLevelFilter");
const { buildTopicSelectorQueryClause } = require("../utils/examQuestionTopicSelectorMatch");

function arg(name, fallback = undefined) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const SELECTOR_FIELDS = [
  "_id",
  "teacherId",
  "status",
  "subject",
  "examBoard",
  "level",
  "topic",
  "topicKey",
  "specKey",
  "type",
  "marks",
  "imageUrl",
];

function pick(q) {
  const out = {};
  for (const f of SELECTOR_FIELDS) out[f] = q[f];
  out.assetsCount = Array.isArray(q.assets) ? q.assets.length : 0;
  out.hasImage = Boolean(q.imageUrl || out.assetsCount > 0);
  out.metadataSource = q.metadata && q.metadata.source ? q.metadata.source : null;
  return out;
}

async function run() {
  const uri = (process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
  if (!uri) {
    console.error("ERROR: set MONGO_URI (or MONGODB_URI) first.");
    process.exit(1);
  }
  await mongoose.connect(uri);

  // 1) Resolve the modal params exactly as the frontend supplies them.
  let ctx = {
    subject: arg("subject"),
    examBoard: arg("examBoard"),
    level: arg("level"),
    topicKey: arg("topicKey"),
    specKey: arg("specKey"),
    teacherId: arg("teacherId"),
  };
  const lessonId = arg("lesson");
  if (lessonId && mongoose.Types.ObjectId.isValid(lessonId)) {
    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) {
      console.error(`Lesson ${lessonId} not found.`);
      process.exit(1);
    }
    // Mirror EditLessonPage → SelectExamQuestionModal default props:
    //   defaultSubject   = lesson.subject
    //   defaultExamBoard = lesson.examBoardName  (falls back to board/examBoard virtual)
    //   defaultLevel     = lesson.level
    //   defaultTopicKey  = topicKeyForBank (lesson.topicKey)
    //   defaultSpecKey   = lesson.specKey || topicKey prefix
    const lessonBoard =
      lesson.examBoardName || lesson.examBoard || lesson.board || "";
    const lessonTopicKey = lesson.topicKey || "";
    ctx = {
      subject: ctx.subject ?? lesson.subject ?? "",
      examBoard: ctx.examBoard ?? lessonBoard,
      level: ctx.level ?? lesson.level ?? "",
      topicKey: ctx.topicKey ?? lessonTopicKey,
      specKey:
        ctx.specKey ??
        (lesson.specKey ||
          (lessonTopicKey.includes(":") ? lessonTopicKey.split(":")[0] : "")),
      teacherId: ctx.teacherId ?? String(lesson.teacherId || lesson.createdBy || ""),
    };
    console.log("\n=== Lesson context (from lesson doc) ===");
    console.log(
      JSON.stringify(
        {
          lessonId,
          subject: lesson.subject,
          examBoardName: lesson.examBoardName,
          board: lesson.board,
          level: lesson.level,
          topicKey: lesson.topicKey,
          specKey: lesson.specKey,
          teacherId: String(lesson.teacherId || lesson.createdBy || ""),
        },
        null,
        2
      )
    );
  }

  // The modal always sends mineOnly=1 and an empty status (=> draft+published).
  const subject = (ctx.subject || "").trim();
  const examBoard = (ctx.examBoard || "").trim();
  const level = (ctx.level || "").trim();
  const topicKey = (ctx.topicKey || "").trim();
  const specKey = (ctx.specKey || "").trim();
  const teacherId = (ctx.teacherId || "").trim();

  // 2) Build the SAME server-side query the route builds (route lines ~274-313).
  const query = {};
  query.status = { $in: ["draft", "published"] }; // status param empty in modal
  if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) {
    query.teacherId = new mongoose.Types.ObjectId(teacherId); // mineOnly=1
  }
  if (subject) query.subject = subject;
  if (examBoard) query.examBoard = examBoard;
  const levelFilter = buildExamQuestionLevelQuery(level, { specKey, topicKey, examBoard, subject });
  if (levelFilter) query.level = levelFilter;
  if (topicKey) {
    const { clause } = buildTopicSelectorQueryClause({ specKey, topicKey });
    if (clause.$or) {
      query.$and = query.$and || [];
      query.$and.push({ $or: clause.$or });
    } else if (clause.topicKey !== undefined) {
      query.topicKey = clause.topicKey;
    }
  }

  console.log("\n=== Modal request → server query params ===");
  console.log(
    JSON.stringify(
      { subject, examBoard, level, topicKey, specKey, mineOnly: "1", status: "(empty→draft+published)", limit: 100 },
      null,
      2
    )
  );
  console.log("\n=== Exact Mongo query built by GET /api/exam-questions ===");
  console.log(JSON.stringify(query, null, 2));

  // 3) Locate the target ("sperm-cell") question.
  const idArg = arg("id");
  const term = arg("term", "sperm");
  let target = null;
  if (idArg && mongoose.Types.ObjectId.isValid(idArg)) {
    target = await ExamQuestion.findById(idArg).lean();
  } else {
    const rx = new RegExp(term, "i");
    const matches = await ExamQuestion.find({ $or: [{ question: rx }, { topic: rx }] })
      .sort({ updatedAt: -1 })
      .lean();
    console.log(`\n=== Questions matching /${term}/i (${matches.length}) ===`);
    matches.forEach((q) => console.log(JSON.stringify(pick(q), null, 2)));
    target = matches[0] || null;
  }
  if (!target) {
    console.log("\nNo target question found — pass --id=<examQuestionId> explicitly.");
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log("\n=== TARGET (sperm-cell) question fields ===");
  console.log(JSON.stringify(pick(target), null, 2));

  // 4) CLAUSE-BY-CLAUSE: does the target survive each individual filter?
  //    Uses real Mongo semantics via countDocuments({ _id, <clause> }).
  const clauses = [];
  for (const [key, value] of Object.entries(query)) {
    if (key === "$and") {
      (value || []).forEach((sub, i) => clauses.push([`$and[${i}] ${JSON.stringify(sub)}`, sub]));
    } else {
      clauses.push([`${key}: ${JSON.stringify(value)}`, { [key]: value }]);
    }
  }

  console.log("\n=== Clause-by-clause test against the target question ===");
  const excluding = [];
  for (const [label, clause] of clauses) {
    const n = await ExamQuestion.countDocuments({ _id: target._id, ...clause });
    const pass = n === 1;
    if (!pass) excluding.push(label);
    console.log(`  [${pass ? "PASS" : "FAIL"}] ${label}`);
  }

  const fullN = await ExamQuestion.countDocuments({ _id: target._id, ...query });
  console.log(`\nFull query returns target: ${fullN === 1 ? "YES" : "NO"}`);
  if (excluding.length) {
    console.log("\n>>> EXCLUDING FILTER(S):");
    excluding.forEach((e) => console.log(`    - ${e}`));
  } else {
    console.log("\nTarget is NOT excluded by the query — look at pagination/text-search/`q` client filter instead.");
  }

  // 5) A working comparison row that DOES pass the full query.
  const working = await ExamQuestion.findOne({ ...query, _id: { $ne: target._id } })
    .sort({ updatedAt: -1 })
    .lean();
  console.log("\n=== A question that DOES pass this exact query (comparison) ===");
  console.log(working ? JSON.stringify(pick(working), null, 2) : "(none — the whole query returns nothing)");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
