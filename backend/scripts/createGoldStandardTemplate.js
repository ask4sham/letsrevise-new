/**
 * One-off seed: inserts the single Gold Standard Master Template.
 *
 * Must match Lesson schema requirements:
 * Required top-level: title, description, topic, subject, level, teacherId, content
 * status enum: draft | published | archived | flagged
 * pages[] requires pageId
 * blocks[].type enum: text | keyIdea | examTip | commonMistake | stretch
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const Lesson = require("../models/Lesson");

function getMongoUri() {
  return process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || "";
}

// Deterministic pageIds so your UI can rely on stable identifiers
function makePageId(n) {
  return `gold-${String(n).padStart(2, "0")}`;
}

function makePages() {
  // 7 pages EXACTLY in the agreed order.
  // Using allowed block types only.
  return [
    {
      pageId: makePageId(1),
      order: 1,
      title: "Overview",
      pageType: "overview",
      blocks: [
        { type: "text", content: "Lesson overview: what you'll learn and why it matters." },
        { type: "keyIdea", content: "Key idea: Summarise the lesson in one sentence." },
      ],
    },
    {
      pageId: makePageId(2),
      order: 2,
      title: "Core Concept 1",
      pageType: "coreConcept",
      blocks: [
        { type: "text", content: "Explain Core Concept 1 with a clear definition and a simple example." },
        { type: "commonMistake", content: "Common mistake: note a typical misconception for Core Concept 1." },
      ],
    },
    {
      pageId: makePageId(3),
      order: 3,
      title: "Core Concept 2",
      pageType: "coreConcept",
      blocks: [
        { type: "text", content: "Explain Core Concept 2 with a clear definition and a simple example." },
        { type: "commonMistake", content: "Common mistake: note a typical misconception for Core Concept 2." },
      ],
    },
    {
      pageId: makePageId(4),
      order: 4,
      title: "Comparison / Examples",
      pageType: "examples",
      blocks: [
        { type: "text", content: "Optional: compare concepts and show worked examples or contrasts." },
        { type: "examTip", content: "Exam tip: how to pick the right method/idea in questions." },
      ],
    },
    {
      pageId: makePageId(5),
      order: 5,
      title: "Check Understanding",
      pageType: "checkpoint",
      // There is also a `checkpoint` field on the page schema; leave it null/undefined unless your UI expects it.
      blocks: [
        { type: "text", content: "Add a short self-check: 3–6 quick questions or prompts." },
        { type: "keyIdea", content: "If you can explain X in your own words, you've got it." },
      ],
    },
    {
      pageId: makePageId(6),
      order: 6,
      title: "Exam Tips",
      pageType: "examTips",
      blocks: [
        { type: "examTip", content: "Exam tip: common command words and what they require." },
        { type: "examTip", content: "Exam tip: structure your answer to match the mark scheme." },
      ],
    },
    {
      pageId: makePageId(7),
      order: 7,
      title: "Stretch: Deeper Knowledge",
      pageType: "stretch",
      blocks: [
        { type: "stretch", content: "Optional: extension ideas for deeper understanding or higher-tier links." },
      ],
    },
  ];
}

async function main() {
  const uri = getMongoUri();
  if (!uri) {
    console.error("❌ No MongoDB connection string found. Set MONGO_URI (or MONGODB_URI) and re-run.");
    process.exit(1);
  }

  await mongoose.connect(uri);

  // Guardrail: enforce clean slate for master templates
  const existingTemplates = await Lesson.countDocuments({ isTemplate: true });
  if (existingTemplates > 0) {
    console.error(`❌ Refusing to insert: found ${existingTemplates} existing master template(s) (isTemplate:true).`);
    console.error("   Clean slate requires 0 before seeding the single gold template.");
    process.exit(1);
  }

  const doc = {
    // REQUIRED FIELDS (per your schema output)
    title: "Gold Standard Master Template",
    description: "Platform master template (single source of truth).",
    topic: "Gold Template",
    subject: "Platform",
    level: "All",
    teacherId: new mongoose.Types.ObjectId(),
    teacherName: "Admin",
    content: "Gold Standard Master Template content scaffold.",

    // Enumerations
    status: "draft",

    // Template flags (agreed)
    isTemplate: true,
    createdFromTemplate: false,
    templateSource: null,

    // Pages (7 exactly)
    pages: makePages(),

    // Optional but safe
    isPublished: false,
    tags: ["gold-standard", "master-template"],
  };

  let created;
  try {
    created = await Lesson.create(doc);
  } catch (err) {
    console.error("❌ Insert failed.");
    console.error("   Error:", err?.message || err);
    process.exit(1);
  }

  console.log("✅ Inserted Gold Standard Master Template:");
  console.log("   _id:", created._id.toString());

  const total = await Lesson.countDocuments({});
  const templates = await Lesson.countDocuments({ isTemplate: true });
  const clones = await Lesson.countDocuments({ createdFromTemplate: true, isTemplate: { $ne: true } });

  console.log("📌 Counts after insert:");
  console.log("   total lessons:", total);
  console.log("   master templates (isTemplate:true):", templates);
  console.log("   template clones:", clones);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("❌ Script crashed:", e);
  process.exit(1);
});