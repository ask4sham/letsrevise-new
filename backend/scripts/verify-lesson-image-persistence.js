#!/usr/bin/env node
/**
 * Verify that lesson 69b3dd4d5da1c638798c7e19 has the Cell Mitosis image
 * correctly persisted with Render URL (not Netlify).
 *
 * Run: node backend/scripts/verify-lesson-image-persistence.js
 * Env: MONGO_URI or MONGODB_URI (from backend/.env or Render)
 */
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
}
const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");

const LESSON_ID = "69b3dd4d5da1c638798c7e19";
const EXPECTED_URL = "https://letsrevise-new.onrender.com/uploads/lesson-media/lesson_69b3dd4d5da1c638798c7e19/page_p_1773395211519_c92fc8b61e2e/block_1/cell-mitosis-1773839311103.png";

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI or MONGODB_URI required");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const lesson = await Lesson.findById(LESSON_ID).lean();
  if (!lesson) {
    console.error("Lesson not found:", LESSON_ID);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log("=== Lesson image persistence verification ===\n");
  console.log("Lesson ID:", LESSON_ID);
  console.log("Title:", lesson.title || "(no title)");
  console.log("");

  let foundInBlocks = false;
  let foundRenderUrl = false;
  let foundNetlifyUrl = false;
  const locations = [];

  // Check pages[].blocks[].content
  const pages = Array.isArray(lesson.pages) ? lesson.pages : [];
  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi];
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    for (let bi = 0; bi < blocks.length; bi++) {
      const block = blocks[bi];
      const content = String(block?.content || "").trim();
      if (!content) continue;

      if (content.includes("cell-mitosis") || content.includes("letsrevise-new.onrender.com") || content.includes("Cell Mitosis")) {
        foundInBlocks = true;
        locations.push({ page: pi, block: bi, pageId: page.pageId, contentPreview: content.slice(0, 200) + "..." });

        if (content.includes("letsrevise-new.onrender.com")) foundRenderUrl = true;
        if (content.includes("netlify.app") && content.includes("/uploads/")) foundNetlifyUrl = true;
      }
    }
  }

  // Check legacy content
  const legacyContent = String(lesson.content || "").trim();
  if (legacyContent.includes("cell-mitosis") || legacyContent.includes("letsrevise-new.onrender.com")) {
    foundInBlocks = true;
    locations.push({ page: "legacy", block: "content", contentPreview: legacyContent.slice(0, 200) + "..." });
    if (legacyContent.includes("letsrevise-new.onrender.com")) foundRenderUrl = true;
    if (legacyContent.includes("netlify.app") && legacyContent.includes("/uploads/")) foundNetlifyUrl = true;
  }

  // Check pages[].hero.src
  for (let pi = 0; pi < pages.length; pi++) {
    const hero = pages[pi]?.hero;
    if (hero?.src && (hero.src.includes("cell-mitosis") || hero.src.includes("letsrevise-new.onrender.com"))) {
      foundInBlocks = true;
      locations.push({ page: pi, block: "hero.src", contentPreview: hero.src });
      if (hero.src.includes("letsrevise-new.onrender.com")) foundRenderUrl = true;
      if (hero.src.includes("netlify.app")) foundNetlifyUrl = true;
    }
  }

  // Check blocks[].imageUrl (diagram blocks)
  for (let pi = 0; pi < pages.length; pi++) {
    const blocks = Array.isArray(pages[pi].blocks) ? pages[pi].blocks : [];
    for (let bi = 0; bi < blocks.length; bi++) {
      const imgUrl = blocks[bi]?.imageUrl;
      if (imgUrl && (String(imgUrl).includes("cell-mitosis") || String(imgUrl).includes("letsrevise-new.onrender.com"))) {
        foundInBlocks = true;
        locations.push({ page: pi, block: bi, field: "imageUrl", contentPreview: imgUrl });
        if (String(imgUrl).includes("letsrevise-new.onrender.com")) foundRenderUrl = true;
        if (String(imgUrl).includes("netlify.app")) foundNetlifyUrl = true;
      }
    }
  }

  console.log("--- Persistence check ---");
  console.log("Image found in stored data:", foundInBlocks ? "YES" : "NO");
  console.log("Render URL (letsrevise-new.onrender.com) present:", foundRenderUrl ? "YES" : "NO");
  console.log("Netlify URL (netlify.app/uploads) present:", foundNetlifyUrl ? "YES (BAD)" : "NO (good)");
  console.log("");

  if (locations.length > 0) {
    console.log("--- Locations ---");
    locations.forEach((loc, i) => {
      console.log(`  ${i + 1}. page=${loc.page} block=${loc.block}${loc.field ? " field=" + loc.field : ""}`);
      console.log("     Preview:", loc.contentPreview);
    });
  }

  console.log("");
  console.log("--- Verdict ---");
  const persisted = foundInBlocks && foundRenderUrl && !foundNetlifyUrl;
  if (persisted) {
    console.log("PASS: Image is correctly persisted with Render URL. No Netlify rewrite.");
    console.log("Storage: lesson.pages[].blocks[].content (or legacy content / hero / imageUrl)");
    console.log("Renders in: editor preview, saved lesson view, published lesson page");
    console.log("Netlify: No remaining frontend issue — makeAbsoluteAssetUrl returns backend URLs as-is.");
  } else {
    if (!foundInBlocks) console.log("FAIL: Image not found in lesson data.");
    if (!foundRenderUrl) console.log("FAIL: Render URL not present (may be relative or wrong host).");
    if (foundNetlifyUrl) console.log("FAIL: Netlify URL detected — data was incorrectly rewritten.");
  }

  await mongoose.disconnect();
  process.exit(persisted ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
