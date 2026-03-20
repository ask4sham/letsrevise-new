#!/usr/bin/env node
/**
 * Audit lesson images: classify URLs as Supabase vs legacy Render/local.
 *
 * Scans: lesson.content, pages[].blocks[].content, blocks[].imageUrl, pages[].hero.src
 * Outputs: report by lesson, shortlist of lessons needing manual re-upload.
 *
 * Usage: node backend/scripts/audit-lesson-images.js
 *
 * Env: MONGO_URI or MONGODB_URI
 */
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
}

const mongoose = require("mongoose");

const URL_TYPE = {
  SUPABASE: "supabase",
  LEGACY_RENDER: "legacy_render",
  LOCAL_UPLOADS: "local_uploads",
};

/** Classify image URL */
function classifyUrl(url) {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  if (u.startsWith("javascript:") || u.startsWith("data:") || u.startsWith("vbscript:")) return null;
  if (u.includes("supabase.co/storage/") || u.includes("supabase.in/storage/")) return URL_TYPE.SUPABASE;
  if (u.toLowerCase().includes("onrender.com/uploads")) return URL_TYPE.LEGACY_RENDER;
  if (u.startsWith("/uploads/") || u.startsWith("uploads/")) return URL_TYPE.LOCAL_UPLOADS;
  return null; // other URLs (external, etc.)
}

/** Extract image URLs from markdown */
function extractUrlsFromMarkdown(text) {
  if (!text || typeof text !== "string") return [];
  const urls = [];
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let m;
  while ((m = imgRegex.exec(text)) !== null) {
    const url = (m[2] || "").trim();
    if (url && !url.toLowerCase().startsWith("video:")) urls.push(url);
  }
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  while ((m = linkRegex.exec(text)) !== null) {
    const url = (m[2] || "").trim();
    if (url && /\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(url)) urls.push(url);
  }
  return urls;
}

/** Collect all image references from a lesson with location */
function collectImageRefs(lesson) {
  const refs = [];
  const seen = new Set();

  function add(url, location) {
    if (!url || typeof url !== "string") return;
    const type = classifyUrl(url);
    if (!type) return;
    const key = `${url}::${location}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push({ url, type, location });
  }

  if (lesson.content) {
    for (const url of extractUrlsFromMarkdown(lesson.content)) add(url, "lesson.content");
  }

  if (lesson.pages && Array.isArray(lesson.pages)) {
    for (let pi = 0; pi < lesson.pages.length; pi++) {
      const page = lesson.pages[pi];
      const pageId = page.pageId || `page_${pi}`;
      if (page.hero?.src) {
        const src = typeof page.hero.src === "string" ? page.hero.src : page.hero.src?.url;
        if (src) add(src, `pages[${pi}](${pageId}).hero.src`);
      }
      if (page.blocks && Array.isArray(page.blocks)) {
        for (let bi = 0; bi < page.blocks.length; bi++) {
          const block = page.blocks[bi];
          const blockId = block.id || `block_${bi}`;
          if (block.content) {
            for (const url of extractUrlsFromMarkdown(block.content)) {
              add(url, `pages[${pi}](${pageId}).blocks[${bi}](${blockId}).content`);
            }
          }
          if (block.imageUrl) add(block.imageUrl, `pages[${pi}](${pageId}).blocks[${bi}](${blockId}).imageUrl`);
        }
      }
    }
  }

  return refs;
}

async function run() {
  const uri = (process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
  if (!uri) {
    console.error("ERROR: MONGO_URI or MONGODB_URI required.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const Lesson = require("../models/Lesson");

  const lessons = await Lesson.find({}).lean();
  console.log("=== Lesson Image Audit ===\n");
  console.log("Scanned", lessons.length, "lessons\n");

  const report = [];
  const needsManualReupload = [];

  for (const lesson of lessons) {
    const refs = collectImageRefs(lesson);
    if (refs.length === 0) {
      report.push({
        id: lesson._id.toString(),
        title: lesson.title || "(no title)",
        supabase: 0,
        legacy: 0,
        legacyRefs: [],
      });
      continue;
    }

    const supabase = refs.filter((r) => r.type === URL_TYPE.SUPABASE).length;
    const legacy = refs.filter((r) => r.type === URL_TYPE.LEGACY_RENDER || r.type === URL_TYPE.LOCAL_UPLOADS).length;
    const legacyRefs = refs
      .filter((r) => r.type === URL_TYPE.LEGACY_RENDER || r.type === URL_TYPE.LOCAL_UPLOADS)
      .map((r) => ({ url: r.url, location: r.location }));

    report.push({
      id: lesson._id.toString(),
      title: lesson.title || "(no title)",
      supabase,
      legacy,
      legacyRefs,
    });

    if (legacy > 0) {
      needsManualReupload.push({
        id: lesson._id.toString(),
        title: lesson.title || "(no title)",
        legacyCount: legacy,
        refs: legacyRefs,
      });
    }
  }

  // Summary table
  console.log("--- Report by lesson ---\n");
  console.log("Lesson ID".padEnd(26), "Title".padEnd(45), "Supabase".padEnd(10), "Legacy");
  console.log("-".repeat(95));

  for (const r of report) {
    const title = (r.title || "").slice(0, 43) + (r.title?.length > 43 ? ".." : "");
    console.log(r.id.padEnd(26), title.padEnd(45), String(r.supabase).padEnd(10), r.legacy);
  }

  const totalSupabase = report.reduce((s, r) => s + r.supabase, 0);
  const totalLegacy = report.reduce((s, r) => s + r.legacy, 0);
  console.log("-".repeat(95));
  console.log("TOTAL".padEnd(26), "".padEnd(45), String(totalSupabase).padEnd(10), totalLegacy);

  // Shortlist of lessons needing manual re-upload
  if (needsManualReupload.length > 0) {
    console.log("\n--- Lessons needing manual re-upload (old sources gone) ---\n");
    for (const l of needsManualReupload) {
      console.log(`Lesson: ${l.title}`);
      console.log(`  ID: ${l.id}`);
      console.log(`  Legacy URLs: ${l.legacyCount}`);
      for (const ref of l.refs) {
        console.log(`    - ${ref.location}`);
        console.log(`      ${ref.url}`);
      }
      console.log("");
    }
  } else {
    console.log("\n--- All lesson images use Supabase URLs ---");
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
