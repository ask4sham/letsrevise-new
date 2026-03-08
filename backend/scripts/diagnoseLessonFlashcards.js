/**
 * Diagnostic script: Compare two lessons (Cell structure vs Animal and plant cells)
 * to find why one has flashcards and the other does not.
 *
 * Run: node backend/scripts/diagnoseLessonFlashcards.js
 * Requires: MONGO_URI in .env
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const Lesson = require("../models/Lesson");
const TopicFlashcard = require("../models/TopicFlashcard");
const FlashcardBank = require("../models/FlashcardBank");
const LessonRevisionDraft = require("../models/LessonRevisionDraft");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");

async function findLessonsByTitle() {
  // Find lessons with titles containing "Cell structure" or "Animal and plant cells"
  const cellStructure = await Lesson.find({
    $or: [
      { title: /cell structure/i },
      { topic: /cell structure/i },
      { subTopic: /cell structure/i },
    ],
  })
    .lean()
    .sort({ updatedAt: -1 })
    .limit(5);

  const animalPlant = await Lesson.find({
    $or: [
      { title: /animal.*plant.*cell/i },
      { topic: /animal.*plant.*cell/i },
      { subTopic: /animal.*plant.*cell/i },
    ],
  })
    .lean()
    .sort({ updatedAt: -1 })
    .limit(5);

  return { cellStructure, animalPlant };
}

async function getBankCounts(topicKey, ownerId) {
  const { queryCandidates } = require("../utils/topicKey");
  const specKey = topicKey && topicKey.includes(":") ? topicKey.split(":")[0] : "aqa-gcse-biology";
  const topicOnly = topicKey && topicKey.includes(":") ? topicKey.split(":")[1] : topicKey;
  const candidates = queryCandidates(specKey, topicOnly || topicKey);
  const topicQuery = candidates.length ? { $in: candidates } : topicKey;

  const tfBase = { topicKey: topicQuery };
  const fbBase = { topicKey: candidates.length ? { $in: candidates } : topicKey };
  if (ownerId) {
    tfBase.ownerId = ownerId;
    fbBase.ownerId = ownerId;
  }

  const [tfPublished, tfDraft, fb] = await Promise.all([
    TopicFlashcard.countDocuments({ ...tfBase, status: "published" }),
    TopicFlashcard.countDocuments({ ...tfBase, status: "draft" }),
    FlashcardBank.findOne(fbBase).lean(),
  ]);

  return {
    TopicFlashcardPublished: tfPublished,
    TopicFlashcardDraft: tfDraft,
    FlashcardBankCards: fb && Array.isArray(fb.cards) ? fb.cards.length : 0,
    FlashcardBankTopicKey: fb?.topicKey,
  };
}

async function getRevisionDraft(lessonId) {
  const draft = await LessonRevisionDraft.findOne({ lessonId }).lean();
  if (!draft) return null;
  const flashCount = Array.isArray(draft.flashcards) ? draft.flashcards.length : 0;
  const quizCount = draft.quiz?.questions?.length || 0;
  return { status: draft.status, flashCount, quizCount };
}

async function run() {
  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI or MONGODB_URI not set in .env");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB\n");
  console.log("=".repeat(80));
  console.log("LESSON FLASHCARD DIAGNOSTIC: Cell structure vs Animal and plant cells");
  console.log("=".repeat(80));

  const { cellStructure, animalPlant } = await findLessonsByTitle();

  // Pick most recent with flashcards for L1, most recent without for L2
  const l1 = cellStructure.find((l) => (l.flashcards?.length || 0) > 0) || cellStructure[0];
  const l2 = animalPlant.find((l) => (l.flashcards?.length || 0) === 0) || animalPlant[0];

  if (!l1) {
    console.log("\nNo 'Cell structure' lessons found.");
  }
  if (!l2) {
    console.log("\nNo 'Animal and plant cells' lessons found.");
  }

  const pick = (l) =>
    l
      ? {
          lessonId: String(l._id),
          title: l.title,
          subject: l.subject,
          specKey: l.specKey,
          topic: l.topic,
          mainTopic: l.mainTopic,
          subTopic: l.subTopic,
          topicKey: l.topicKey,
          flashcardsLength: (l.flashcards || []).length,
          quizQuestionsLength: (l.quiz?.questions || []).length,
          autoGenerateFromBanks: l.autoGenerateFromBanks,
          status: l.status,
          isPublished: l.isPublished,
          metadata: l.metadata,
          teacherId: String(l.teacherId || ""),
        }
      : null;

  const d1 = pick(l1);
  const d2 = pick(l2);

  console.log("\n--- 1) SIDE-BY-SIDE LESSON COMPARISON ---\n");
  const keys = [
    "lessonId",
    "title",
    "subject",
    "specKey",
    "topic",
    "mainTopic",
    "subTopic",
    "topicKey",
    "flashcardsLength",
    "quizQuestionsLength",
    "autoGenerateFromBanks",
    "status",
    "isPublished",
    "metadata",
    "teacherId",
  ];
  console.log("| Field | Lesson 1 (Cell structure) | Lesson 2 (Animal and plant cells) |");
  console.log("|-------|---------------------------|-----------------------------------|");
  for (const k of keys) {
    const v1 = d1 ? JSON.stringify(d1[k] ?? "") : "N/A";
    const v2 = d2 ? JSON.stringify(d2[k] ?? "") : "N/A";
    console.log(`| ${k} | ${String(v1).slice(0, 40)} | ${String(v2).slice(0, 40)} |`);
  }

  console.log("\n--- 2) REVISION DRAFT CHECK ---\n");
  const rd1 = l1 ? await getRevisionDraft(l1._id) : null;
  const rd2 = l2 ? await getRevisionDraft(l2._id) : null;
  console.log("Lesson 1 revision draft:", rd1 || "none");
  console.log("Lesson 2 revision draft:", rd2 || "none");

  console.log("\n--- 3) BANK AVAILABILITY FOR EACH TOPIC ---\n");
  const owner1 = l1?.teacherId;
  const owner2 = l2?.teacherId;
  const tk1 = l1?.topicKey || "aqa-gcse-biology:cell-structure";
  const tk2 = l2?.topicKey || "aqa-gcse-biology:animal-plant-cells";

  const bank1 = await getBankCounts(tk1, owner1 || undefined);
  const bank2 = await getBankCounts(tk2, owner2 || undefined);

  // Also check without ownerId (platform-wide)
  const bank1Platform = await getBankCounts(tk1, undefined);
  const bank2Platform = await getBankCounts(tk2, undefined);

  console.log("Lesson 1 topicKey:", tk1);
  console.log("  (owner-scoped) TopicFlashcard published:", bank1.TopicFlashcardPublished, "draft:", bank1.TopicFlashcardDraft, "FlashcardBank cards:", bank1.FlashcardBankCards);
  console.log("  (platform-wide) TopicFlashcard published:", bank1Platform.TopicFlashcardPublished, "draft:", bank1Platform.TopicFlashcardDraft, "FlashcardBank cards:", bank1Platform.FlashcardBankCards);

  console.log("\nLesson 2 topicKey:", tk2);
  console.log("  (owner-scoped) TopicFlashcard published:", bank2.TopicFlashcardPublished, "draft:", bank2.TopicFlashcardDraft, "FlashcardBank cards:", bank2.FlashcardBankCards);
  console.log("  (platform-wide) TopicFlashcard published:", bank2Platform.TopicFlashcardPublished, "draft:", bank2Platform.TopicFlashcardDraft, "FlashcardBank cards:", bank2Platform.FlashcardBankCards);

  // Check TopicFlashcard without ownerId filter (platform content)
  const tf1Any = await TopicFlashcard.countDocuments({
    topicKey: { $in: ["aqa-gcse-biology:cell-structure", "cell-structure"] },
    status: { $in: ["published", "draft"] },
  });
  const tf2Any = await TopicFlashcard.countDocuments({
    topicKey: { $in: ["aqa-gcse-biology:animal-plant-cells", "animal-plant-cells"] },
    status: { $in: ["published", "draft"] },
  });
  console.log("\nPlatform TopicFlashcard (any owner): cell-structure:", tf1Any, "| animal-plant-cells:", tf2Any);

  const fb1 = await FlashcardBank.countDocuments({
    topicKey: { $in: ["aqa-gcse-biology:cell-structure", "cell-structure"] },
  });
  const fb2 = await FlashcardBank.countDocuments({
    topicKey: { $in: ["aqa-gcse-biology:animal-plant-cells", "animal-plant-cells"] },
  });
  console.log("Platform FlashcardBank (any owner): cell-structure:", fb1, "| animal-plant-cells:", fb2);

  // TopicQuizQuestion counts
  const tqq1 = await TopicQuizQuestion.countDocuments({
    topicKey: { $in: ["aqa-gcse-biology:cell-structure", "cell-structure"] },
    kind: "quiz",
  });
  const tqq2 = await TopicQuizQuestion.countDocuments({
    topicKey: { $in: ["aqa-gcse-biology:animal-plant-cells", "animal-plant-cells"] },
    kind: "quiz",
  });
  console.log("Platform TopicQuizQuestion (quiz): cell-structure:", tqq1, "| animal-plant-cells:", tqq2);

  console.log("\n--- 4) TAXONOMY MAPPING ---\n");
  console.log("Lesson 1 topicKey:", tk1, "| namespaced:", (tk1 || "").includes(":"));
  console.log("Lesson 2 topicKey:", tk2, "| namespaced:", (tk2 || "").includes(":"));

  console.log("\n--- 5) DIAGNOSIS ---\n");
  if (d1?.flashcardsLength > 0 && (d2?.flashcardsLength ?? 0) === 0) {
    const reasons = [];
    if (!d2?.topicKey) reasons.push("Lesson 2 has no topicKey");
    else if (bank2.TopicFlashcardPublished === 0 && bank2.TopicFlashcardDraft === 0 && bank2.FlashcardBankCards === 0)
      reasons.push("No TopicFlashcard or FlashcardBank content for animal-plant-cells");
    if (d2?.autoGenerateFromBanks === false) reasons.push("autoGenerateFromBanks was false on create");
    console.log("Lesson 2 has no flashcards. Possible causes:", reasons.join("; ") || "unknown");
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
