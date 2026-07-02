/**
 * One-off: convert the existing sperm-cell ExamQuestion to Composite V1 in place.
 * Preserves _id and imageUrl so lesson examQuestionId references stay valid.
 *
 * Usage: node backend/scripts/migrateSpermCellToComposite.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const Lesson = require("../models/Lesson");
const { buildCompositeFields } = require("../utils/compositeExamQuestion");
const { collectExamQuestionIdsFromLesson } = require("../utils/collectExamQuestionIdsFromLesson");

const TARGET_ID = "6a464ac1fd03fb5bbedb579a";

const COMPOSITE_BODY = {
  questionMode: "composite",
  title: "Human sperm cell structure and fertilisation",
  sharedStem: "The diagram shows a human sperm cell.",
  parts: [
    {
      label: "a",
      type: "mcq",
      marks: 1,
      questionText:
        "What is the maximum number of X chromosomes found in the nucleus of a sperm cell?",
      options: ["0", "1", "2", "23"],
      correctIndex: 1,
      markScheme: ["Correct answer: B — 1"],
    },
    {
      label: "b",
      type: "short",
      marks: 2,
      questionText:
        "The middle piece of the sperm cell contains mitochondria. Explain the function of these mitochondria.",
      markScheme: [
        "Mitochondria release energy by respiration / produce ATP.",
        "This energy is used for movement of the tail so the sperm can swim towards the egg.",
      ],
    },
    {
      label: "c",
      type: "short",
      marks: 2,
      questionText:
        "The acrosome contains digestive enzymes. Suggest the function of the acrosome.",
      markScheme: [
        "Digestive enzymes break down/digest the outer layer or membrane of the egg.",
        "This allows the sperm nucleus to enter the egg for fertilisation.",
      ],
    },
    {
      label: "d",
      type: "short",
      marks: 2,
      questionText:
        "Describe the route taken by a sperm cell from when it enters the woman's body to the site of fertilisation of the egg.",
      markScheme: [
        "Vagina → cervix → uterus → oviduct / fallopian tube.",
        "Fertilisation occurs in the oviduct / fallopian tube.",
      ],
    },
  ],
};

async function run() {
  const uri = (process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
  if (!uri) throw new Error("MONGO_URI not set");
  await mongoose.connect(uri);

  const existing = await ExamQuestion.findById(TARGET_ID).lean();
  if (!existing) {
    console.error("Target question not found:", TARGET_ID);
    process.exit(1);
  }

  console.log("Before:", {
    _id: existing._id,
    type: existing.type,
    questionMode: existing.questionMode,
    marks: existing.marks,
    imageUrl: existing.imageUrl ? "present" : null,
    status: existing.status,
  });

  const imageUrl = existing.imageUrl;
  const composite = buildCompositeFields({
    ...COMPOSITE_BODY,
    imageUrl,
  });

  const updated = await ExamQuestion.findByIdAndUpdate(
    TARGET_ID,
    {
      ...composite,
      imageUrl,
      // Clear single-question fields that no longer apply
      options: [],
      correctIndex: null,
      correctAnswer: null,
      markScheme: [],
    },
    { new: true }
  ).lean();

  console.log("After:", {
    _id: updated._id,
    type: updated.type,
    questionMode: updated.questionMode,
    title: updated.title,
    totalMarks: updated.totalMarks,
    marks: updated.marks,
    partsCount: updated.parts?.length,
    imageUrl: updated.imageUrl,
    status: updated.status,
  });

  const lessons = await Lesson.find({
    "pages.blocks.examQuestionId": new mongoose.Types.ObjectId(TARGET_ID),
  })
    .select("_id title status")
    .lean();

  console.log("\nLessons referencing this question:", lessons.length);
  for (const l of lessons) {
  const full = await Lesson.findById(l._id).select("pages").lean();
    const ids = [...collectExamQuestionIdsFromLesson(full)];
    console.log(`  - ${l._id} "${l.title}" (${l.status}) examQuestionIds: ${ids.join(", ")}`);
    const stillRefs = ids.includes(TARGET_ID);
    console.log(`    still references target: ${stillRefs}`);
  }

  await mongoose.disconnect();
  console.log("\nMigration complete (in-place, same _id).");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
