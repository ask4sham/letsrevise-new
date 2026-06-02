/**
 * Upload portrait main image to lesson-media and patch dragDropMatch block.imageUrl.
 * Usage: node scripts/patch-reflex-ddm-portrait-image.js [lessonId]
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const dns = require("dns");
const mongoose = require("mongoose");
const { uploadToSupabase, isSupabaseStorageEnabled } = require("../services/supabaseStorage");

const LESSON_ID = process.argv[2] || "6a1c7b28e2b056a760772243";
const PAGE_ID = "p_1780251423187_f9f32caaee9fc";
const BLOCK_INDEX = 7;

const PORTRAIT_FILE = path.join(
  __dirname,
  "../public/visuals/Metabolism/Nervious system/Nervous-response-drag-drop-portrait.png"
);

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

function blockIsReflexDdm(b) {
  if (!b || b.type !== "dragDropMatch") return false;
  const prompts = (b.pairs || []).map((p) => String(p.prompt || "").toLowerCase());
  return prompts.some((p) => p.includes("sensory neurone"));
}

async function uploadPortrait() {
  if (!isSupabaseStorageEnabled()) throw new Error("Supabase storage not configured");
  if (!fs.existsSync(PORTRAIT_FILE)) throw new Error(`Missing file: ${PORTRAIT_FILE}`);
  const buf = fs.readFileSync(PORTRAIT_FILE);
  const ts = Date.now();
  const folder = `lesson-media/lesson_${LESSON_ID}/page_${PAGE_ID}/block_${BLOCK_INDEX}_dragdropmatch`;
  const filename = `nervous-response-drag-drop-portrait-${ts}.png`;
  const storagePath = `${folder}/${filename}`;
  const url = await uploadToSupabase(buf, storagePath, "image/png");
  if (!url) throw new Error("Supabase upload failed");
  return url;
}

async function patchLesson(imageUrl) {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  const col = mongoose.connection.db.collection("lessons");
  const lesson = await col.findOne({ _id: new mongoose.Types.ObjectId(LESSON_ID) });
  if (!lesson) throw new Error(`Lesson not found: ${LESSON_ID}`);

  let patched = false;
  const pages = (lesson.pages || []).map((page) => {
    if (page.pageId !== PAGE_ID) return page;
    const blocks = (page.blocks || []).map((b, i) => {
      if (i !== BLOCK_INDEX && !blockIsReflexDdm(b)) return b;
      if (!blockIsReflexDdm(b)) return b;
      patched = true;
      const prev = b.imageUrl;
      console.log("Previous imageUrl:", prev);
      return { ...b, imageUrl };
    });
    return { ...page, blocks };
  });

  if (!patched) {
    for (const page of lesson.pages || []) {
      (page.blocks || []).forEach((b, i) => {
        if (blockIsReflexDdm(b)) {
          console.log("Found reflex block on other page:", page.pageId, "index", i);
        }
      });
    }
    throw new Error("Reflex dragDropMatch block not found at expected index");
  }

  const res = await col.updateOne(
    { _id: lesson._id },
    { $set: { pages, updatedAt: new Date() } }
  );
  console.log("Mongo update:", res.modifiedCount === 1 ? "OK" : res);
  await mongoose.disconnect();
}

async function main() {
  console.log("Lesson:", LESSON_ID, "page:", PAGE_ID, "block:", BLOCK_INDEX);
  const imageUrl = await uploadPortrait();
  console.log("Uploaded portrait URL:", imageUrl);
  await patchLesson(imageUrl);
  console.log("Done. Final imageUrl:", imageUrl);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
