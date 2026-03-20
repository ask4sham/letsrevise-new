#!/usr/bin/env node
/**
 * Migrate lesson images from local/Render storage to Supabase Storage.
 *
 * Scans: lesson.content, pages[].blocks[].content, blocks[].imageUrl, pages[].hero.src
 * Extracts: /uploads/... or https://...onrender.com/uploads/...
 * Downloads each image, uploads to Supabase, replaces URL in lesson.
 *
 * Dry run:  node backend/scripts/migrate-uploads-to-supabase.js
 * Apply:    node backend/scripts/migrate-uploads-to-supabase.js --apply
 *
 * Env: MONGO_URI or MONGODB_URI, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *      BACKEND_PUBLIC_URL (default https://letsrevise-new.onrender.com)
 */
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
}

const mongoose = require("mongoose");
const axios = require("axios");
const { uploadToSupabase, isSupabaseStorageEnabled, BUCKET } = require("../services/supabaseStorage");

const DEFAULT_BACKEND =
  (process.env.BACKEND_PUBLIC_URL || "https://letsrevise-new.onrender.com")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/?$/, "");

const apply = process.argv.includes("--apply");

/** Check if URL is a legacy upload (needs migration) */
function isLegacyUploadUrl(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.trim();
  if (u.startsWith("javascript:") || u.startsWith("data:") || u.startsWith("vbscript:")) return false;
  if (u.includes("supabase.co/storage/") || u.includes("supabase.in/storage/")) return false;
  if (u.startsWith("/uploads/") || u.startsWith("uploads/")) return true;
  if (u.toLowerCase().includes("onrender.com/uploads")) return true;
  return false;
}

/** Convert to absolute URL for download */
function toAbsoluteDownloadUrl(url) {
  if (!url || typeof url !== "string") return url;
  const u = url.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const path = u.startsWith("/") ? u : `/${u}`;
  return `${DEFAULT_BACKEND}${path}`;
}

/** Extract path for Supabase storage (e.g. lesson-media/lesson_xxx/.../file.png) */
function urlToStoragePath(url) {
  if (!url || typeof url !== "string") return null;
  let path = url.trim();
  try {
    if (path.includes("%")) path = decodeURIComponent(path);
  } catch {}
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const parsed = new URL(path);
      path = parsed.pathname;
    } catch {
      return null;
    }
  }
  path = path.replace(/^\/+/, "").replace(/\\/g, "/");
  if (path.startsWith("uploads/")) path = path.slice(8);
  else if (path.startsWith("/uploads/")) path = path.slice(9);
  return path || null;
}

/** Extract all image URLs from a string (markdown) */
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

/** Infer content type from filename */
function inferContentType(filename) {
  const ext = (filename || "").toLowerCase().split(".").pop();
  const map = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
  return map[ext] || "image/png";
}

/** Download image and return buffer */
async function downloadImage(url) {
  try {
    const res = await axios.get(toAbsoluteDownloadUrl(url), {
      responseType: "arraybuffer",
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (s) => s === 200,
    });
    return Buffer.from(res.data);
  } catch (err) {
    throw new Error(err.response?.status ? `HTTP ${err.response.status}` : err.message);
  }
}

/** Collect all legacy URLs from a lesson */
function collectLegacyUrls(lesson) {
  const entries = [];
  const seen = new Set();

  function add(url, location) {
    if (!url || !isLegacyUploadUrl(url) || seen.has(url)) return;
    seen.add(url);
    entries.push({ url, location });
  }

  if (lesson.content) {
    for (const url of extractUrlsFromMarkdown(lesson.content)) add(url, "content");
  }

  if (lesson.pages && Array.isArray(lesson.pages)) {
    for (let pi = 0; pi < lesson.pages.length; pi++) {
      const page = lesson.pages[pi];
      if (page.hero?.src) {
        const src = typeof page.hero.src === "string" ? page.hero.src : page.hero.src?.url;
        if (src) add(src, `pages[${pi}].hero.src`);
      }
      if (page.blocks && Array.isArray(page.blocks)) {
        for (let bi = 0; bi < page.blocks.length; bi++) {
          const block = page.blocks[bi];
          if (block.content) {
            for (const url of extractUrlsFromMarkdown(block.content)) add(url, `pages[${pi}].blocks[${bi}].content`);
          }
          if (block.imageUrl) add(block.imageUrl, `pages[${pi}].blocks[${bi}].imageUrl`);
        }
      }
    }
  }

  return entries;
}

/** Replace URL in string (markdown or plain) */
function replaceUrlInText(text, oldUrl, newUrl) {
  if (!text || typeof text !== "string") return text;
  const escaped = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "g"), newUrl);
}

async function run() {
  const uri = (process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
  if (!uri) {
    console.error("ERROR: MONGO_URI or MONGODB_URI required.");
    process.exit(1);
  }

  if (!isSupabaseStorageEnabled()) {
    console.error("ERROR: Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  console.log("=== Migrate Lesson Images to Supabase ===");
  console.log("BACKEND_PUBLIC_URL:", DEFAULT_BACKEND);
  console.log("Supabase bucket:", BUCKET);
  console.log("Mode:", apply ? "--apply (will write to DB)" : "dry-run (no writes)");
  console.log("");

  await mongoose.connect(uri);
  const Lesson = require("../models/Lesson");

  const lessons = await Lesson.find({}).lean();
  console.log("Scanned", lessons.length, "lessons");

  let totalMigrated = 0;
  let totalFailed = 0;
  const urlMap = new Map();
  const failures = [];

  for (const lesson of lessons) {
    const entries = collectLegacyUrls(lesson);
    if (entries.length === 0) continue;

    for (const { url, location } of entries) {
      if (urlMap.has(url)) {
        continue;
      }

      const storagePath = urlToStoragePath(url);
      if (!storagePath) {
        failures.push({ url, location, lessonId: lesson._id, error: "Could not parse path" });
        totalFailed++;
        continue;
      }

      if (apply) {
        try {
          const buffer = await downloadImage(url);
          const contentType = inferContentType(storagePath);
          const newUrl = await uploadToSupabase(buffer, storagePath, contentType);
          if (newUrl) {
            urlMap.set(url, newUrl);
            totalMigrated++;
            console.log("  Migrated:", url.slice(-60), "->", newUrl.slice(-50) + "...");
          } else {
            failures.push({ url, location, lessonId: lesson._id, error: "Supabase upload returned null" });
            totalFailed++;
          }
        } catch (err) {
          failures.push({ url, location, lessonId: lesson._id, error: err.message });
          totalFailed++;
          console.error("  FAIL:", url.slice(-60), "|", err.message);
        }
      } else {
        console.log("  [dry-run] Would migrate:", url.slice(-70));
        totalMigrated++;
      }
    }
  }

  if (apply && urlMap.size > 0) {
    console.log("\n--- Updating lessons ---");
    for (const lesson of lessons) {
      let docChanged = false;
      const updates = {};

      if (lesson.content) {
        let content = lesson.content;
        for (const [oldUrl, newUrl] of urlMap) {
          if (content.includes(oldUrl)) {
            content = replaceUrlInText(content, oldUrl, newUrl);
            docChanged = true;
          }
        }
        if (docChanged) updates.content = content;
      }

      if (lesson.pages && Array.isArray(lesson.pages)) {
        const newPages = lesson.pages.map((page, pi) => {
          const newPage = { ...page };
          let pageChanged = false;

          if (page.hero?.src) {
            const src = typeof page.hero.src === "string" ? page.hero.src : page.hero.src?.url;
            const newUrl = urlMap.get(src);
            if (newUrl) {
              newPage.hero = { ...page.hero, src: newUrl };
              pageChanged = true;
            }
          }

          if (page.blocks && Array.isArray(page.blocks)) {
            newPage.blocks = page.blocks.map((block) => {
              const newBlock = { ...block };
              if (block.content) {
                let content = block.content;
                for (const [oldUrl, newUrl] of urlMap) {
                  if (content.includes(oldUrl)) {
                    content = replaceUrlInText(content, oldUrl, newUrl);
                    pageChanged = true;
                  }
                }
                newBlock.content = content;
              }
              if (block.imageUrl && urlMap.has(block.imageUrl)) {
                newBlock.imageUrl = urlMap.get(block.imageUrl);
                pageChanged = true;
              }
              return newBlock;
            });
          }

          if (pageChanged) docChanged = true;
          return newPage;
        });
        if (docChanged) updates.pages = newPages;
      }

      if (docChanged) {
        await Lesson.updateOne({ _id: lesson._id }, { $set: updates });
        console.log("  Updated lesson:", lesson._id, lesson.title?.slice(0, 40) || "");
      }
    }
  }

  console.log("\n=== Summary ===");
  console.log("Migrated:", totalMigrated);
  console.log("Failed:", totalFailed);
  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.slice(0, 20).forEach((f) => console.log("  ", f.url?.slice(-50), "|", f.error));
    if (failures.length > 20) console.log("  ... and", failures.length - 20, "more");
  }

  await mongoose.disconnect();
  process.exit(totalFailed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
