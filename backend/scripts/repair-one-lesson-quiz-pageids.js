#!/usr/bin/env node
/**
 * One-lesson data repair: reassign lesson.quiz.questions[].pageId so the last page
 * (or "END") shows quiz in LessonViewPage's page-aware filter.
 *
 * Default lesson: 69eb5617f4503aa9e240a741 (transpiration / page-quiz mismatch).
 * Dry-run by default. Writes only with --apply.
 *
 * Usage:
 *   node backend/scripts/repair-one-lesson-quiz-pageids.js
 *   node backend/scripts/repair-one-lesson-quiz-pageids.js --apply
 *   node backend/scripts/repair-one-lesson-quiz-pageids.js --apply --end
 *   node backend/scripts/repair-one-lesson-quiz-pageids.js --lesson=OTHER_ID --apply --force
 *
 * Env: MONGO_URI or MONGODB_URI (from backend/.env)
 */
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
}

const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");

const DEFAULT_LESSON_ID = "69eb5617f4503aa9e240a741";

function parseArgs(argv) {
  const out = {
    apply: false,
    end: false,
    force: false,
    lessonId: DEFAULT_LESSON_ID,
  };
  for (const a of argv) {
    if (a === "--apply") out.apply = true;
    else if (a === "--end") out.end = true;
    else if (a === "--force") out.force = true;
    else if (a.startsWith("--lesson=")) out.lessonId = a.split("=")[1].trim();
  }
  return out;
}

function pageIdDistribution(questions) {
  const dist = Object.create(null);
  for (const q of questions) {
    const raw = q?.pageId;
    const key = raw == null || String(raw).trim() === "" ? "(empty)" : String(raw);
    dist[key] = (dist[key] || 0) + 1;
  }
  return dist;
}

/**
 * @returns {{ eligible: boolean, reason: string, singleWrongId: string | null }}
 */
function assessSingleNonLastPage(questions, lastPageId) {
  const n = questions.length;
  if (n === 0) {
    return { eligible: false, reason: "no quiz questions", singleWrongId: null };
  }
  const ids = questions.map((q) => (q?.pageId == null || String(q.pageId).trim() === "" ? "" : String(q.pageId).trim()));
  const unique = [...new Set(ids)];
  if (unique.length !== 1) {
    return {
      eligible: false,
      reason: `expect single shared pageId for strict mode; found ${unique.length} distinct: ${JSON.stringify(unique)}`,
      singleWrongId: null,
    };
  }
  const only = unique[0];
  if (only === "" || only === "END") {
    return {
      eligible: false,
      reason: 'all questions are empty/END; use --force to set target explicitly',
      singleWrongId: only || null,
    };
  }
  if (only === String(lastPageId)) {
    return { eligible: false, reason: "already on last pageId", singleWrongId: only };
  }
  return { eligible: true, reason: "all questions on one pageId, not last", singleWrongId: only };
}

async function main() {
  const { apply, end, force, lessonId } = parseArgs(process.argv.slice(2));
  if (!mongoose.Types.ObjectId.isValid(lessonId)) {
    console.error("Invalid lesson ObjectId:", lessonId);
    process.exit(1);
  }

  const uri = (process.env.MONGODB_URI || process.env.MONGO_URI || "").trim();
  if (!uri) {
    console.error("MONGO_URI or MONGODB_URI required");
    process.exit(1);
  }

  const targetLabel = end ? '"END" (end-of-lesson bucket)' : "last page id";
  console.log("=== repair-one-lesson-quiz-pageids ===\n");
  console.log("Lesson ID:", lessonId);
  console.log("Mode:", apply ? "APPLY (will write)" : "DRY-RUN (no write)");
  console.log("Target pageId for updated questions:", targetLabel);
  if (apply && !force) {
    console.log("Strict single-wrong-page rule: ON (use --force to override)\n");
  } else if (force) {
    console.log("Force: will update any question not matching target\n");
  } else {
    console.log("Strict single-wrong-page rule (for --apply without --force): only when all non-last share one id\n");
  }

  await mongoose.connect(uri);
  const lesson = await Lesson.findById(lessonId).lean();
  if (!lesson) {
    console.error("Lesson not found:", lessonId);
    await mongoose.disconnect();
    process.exit(1);
  }

  const title = lesson.title || "(no title)";
  const pages = Array.isArray(lesson.pages) ? lesson.pages : [];
  const questions = Array.isArray(lesson.quiz?.questions) ? lesson.quiz.questions : [];

  console.log("Title:", title);
  console.log("Number of pages:", pages.length);
  console.log("lesson.quiz.questions.length:", questions.length);
  console.log("");

  if (pages.length === 0) {
    console.log("No structured pages; nothing to do for last-page repair.");
    await mongoose.disconnect();
    process.exit(0);
  }

  const pageList = pages.map((p, i) => ({
    index: i,
    pageId: p?.pageId != null ? String(p.pageId) : "(missing)",
    title: p?.title != null ? String(p.title) : "(no title)",
  }));
  console.log("Pages (order = lesson order):");
  for (const row of pageList) {
    console.log(`  [${row.index}] pageId=${row.pageId}  title=${JSON.stringify(row.title).slice(0, 60)}`);
  }
  const last = pages[pages.length - 1];
  const lastPageId = last?.pageId != null ? String(last.pageId).trim() : "";
  console.log("");
  console.log("Last page index:", pages.length - 1);
  console.log("Last pageId:", lastPageId || "(missing — abort apply)");
  console.log("");

  const dist = pageIdDistribution(questions);
  console.log("Quiz question pageId distribution:");
  for (const k of Object.keys(dist).sort()) {
    console.log(`  ${k}: ${dist[k]}`);
  }
  console.log("");

  const targetPageId = end ? "END" : lastPageId;
  if (!end && !lastPageId) {
    console.error("Cannot set target to last page: last page has no pageId.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const strict = assessSingleNonLastPage(questions, lastPageId);
  console.log("Strict single-non-last-page check:", strict.eligible ? "ELIGIBLE" : "not eligible");
  console.log("  reason:", strict.reason);
  if (strict.singleWrongId) console.log("  single pageId value:", strict.singleWrongId);
  console.log("");

  const wouldChange = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const cur = q?.pageId == null || String(q.pageId).trim() === "" ? "" : String(q.pageId).trim();
    const next = targetPageId;
    if (cur === next) continue;
    if (force) {
      wouldChange.push({ index: i, from: cur || "(empty)", to: next });
    } else if (strict.eligible) {
      if (cur === strict.singleWrongId) {
        wouldChange.push({ index: i, from: cur, to: next });
      }
    }
  }

  console.log("Questions to update:", wouldChange.length);
  for (const w of wouldChange.slice(0, 20)) {
    console.log(`  [${w.index}] pageId: ${w.from} -> ${w.to}`);
  }
  if (wouldChange.length > 20) console.log(`  ... and ${wouldChange.length - 20} more`);
  console.log("");

  if (!apply) {
    console.log("DRY-RUN: no changes written. Re-run with --apply to save.");
    await mongoose.disconnect();
    process.exit(0);
  }

  if (wouldChange.length === 0) {
    console.log("Nothing to update; exiting.");
    await mongoose.disconnect();
    process.exit(0);
  }

  if (!force && !strict.eligible) {
    console.error("ABORT: strict mode and not eligible. Use --force to apply anyway, or fix data by hand.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const doc = await Lesson.findById(lessonId);
  if (!doc) {
    console.error("Lesson disappeared?");
    await mongoose.disconnect();
    process.exit(1);
  }
  const qArr = doc.quiz && Array.isArray(doc.quiz.questions) ? doc.quiz.questions : null;
  if (!qArr) {
    console.error("No doc.quiz.questions");
    await mongoose.disconnect();
    process.exit(1);
  }

  for (const w of wouldChange) {
    if (!qArr[w.index]) continue;
    qArr[w.index].pageId = w.to;
  }
  doc.markModified("quiz");
  await doc.save();

  console.log("Saved. Updated", wouldChange.length, "question(s).");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
