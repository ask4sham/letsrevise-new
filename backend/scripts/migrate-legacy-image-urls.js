/**
 * One-off migration: convert legacy relative markdown asset URLs to absolute backend URLs.
 *
 * Touches: Lesson (content, pages[].blocks[].content, pages[].blocks[].imageUrl, pages[].hero.src)
 *          Template (pages[].blocks[].content)
 *
 * Safe paths: /uploads/, /visuals/, /content/
 * Rejects: javascript:, data:, vbscript:
 *
 * Dry run:  node scripts/migrate-legacy-image-urls.js
 * Write:    node scripts/migrate-legacy-image-urls.js --apply
 *
 * Env: MONGO_URI or MONGODB_URI (required; Render sets MONGO_URI)
 *      BACKEND_PUBLIC_URL (default https://letsrevise-new.onrender.com)
 */
// Load .env only if URI not already set (e.g. from Render shell)
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
}
const mongoose = require("mongoose");

const DEFAULT_BACKEND_URL =
  (process.env.BACKEND_PUBLIC_URL || "https://letsrevise-new.onrender.com")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/?$/, "");

/** Mask credentials: mongodb+srv://user:pass@host/db -> host; localhost -> localhost:27017 */
function maskMongoUri(uri) {
  if (!uri || typeof uri !== "string") return "(none)";
  const atMatch = uri.match(/@([^/]+)/);
  if (atMatch) return atMatch[1];
  const localMatch = uri.match(/:\/\/([^/]+)/);
  if (localMatch) return localMatch[1];
  return uri.replace(/:[^:@]+@/, ":****@").slice(0, 60);
}

const ASSET_PREFIXES = ["/uploads/", "/visuals/", "/content/", "uploads/", "visuals/", "content/"];

function isUnsafeUrl(url) {
  if (!url || typeof url !== "string") return true;
  const u = url.trim().toLowerCase();
  return u.startsWith("javascript:") || u.startsWith("data:") || u.startsWith("vbscript:");
}

function isRelativeAssetPath(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return false;
  return ASSET_PREFIXES.some((p) => u.startsWith(p));
}

function toAbsoluteUrl(url) {
  if (!url || typeof url !== "string") return url;
  const u = url.trim();
  if (isUnsafeUrl(u)) return url;
  if (!isRelativeAssetPath(u)) return url;
  if (u.startsWith("http://") || u.startsWith("https://")) return url;
  const path = u.startsWith("/") ? u : `/${u}`;
  const normalized = path.startsWith("/api/") ? path.slice(4) : path;
  return `${DEFAULT_BACKEND_URL}${normalized}`;
}

/**
 * Transform markdown: ![alt](/uploads/...) -> ![alt](https://...)
 */
function transformMarkdownImageUrls(markdown) {
  if (!markdown || typeof markdown !== "string") return { transformed: markdown, changed: false, count: 0 };
  let changed = false;
  let count = 0;
  const result = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const u = (url || "").trim();
    if (!isRelativeAssetPath(u) || isUnsafeUrl(u)) return `![${alt}](${url})`;
    let decoded = u;
    try {
      if (u.includes("%")) decoded = decodeURIComponent(u);
    } catch {
      decoded = u;
    }
    const abs = toAbsoluteUrl(decoded);
    if (abs) {
      changed = true;
      count += 1;
      return `![${alt}](${abs})`;
    }
    return `![${alt}](${url})`;
  });
  return { transformed: result, changed, count };
}

/**
 * Transform a bare URL field (imageUrl, hero.src)
 */
function transformBareUrl(url) {
  if (!url || typeof url !== "string") return { transformed: url, changed: false, count: 0 };
  if (!isRelativeAssetPath(url) || isUnsafeUrl(url)) return { transformed: url, changed: false, count: 0 };
  const abs = toAbsoluteUrl(url);
  return { transformed: abs, changed: abs !== url, count: abs !== url ? 1 : 0 };
}

async function run() {
  const apply = process.argv.includes("--apply");

  // Environment validation
  const uri = (process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
  if (!uri) {
    console.error("ERROR: MONGO_URI or MONGODB_URI is required.");
    console.error("  Render: MONGO_URI is set automatically in shell.");
    console.error("  Local:  Set in backend/.env or pass as env var.");
    process.exit(1);
  }

  console.log("BACKEND_PUBLIC_URL:", DEFAULT_BACKEND_URL);
  console.log("MongoDB host:", maskMongoUri(uri));
  if (apply) {
    console.log("Mode: --apply (will write changes to database)");
  } else {
    console.log("Mode: dry-run (no writes). Use --apply to perform updates.");
  }
  console.log("");

  await mongoose.connect(uri);
  console.log("Connected to MongoDB successfully.");
  console.log("");

  const Lesson = require("../models/Lesson");
  const Template = require("../models/Template");

  let totalWouldUpdate = 0;
  let totalUpdated = 0;
  let urlsRewritten = 0;

  // --- Lessons ---
  const lessons = await Lesson.find({}).lean();
  const lessonUpdates = [];

  for (const lesson of lessons) {
    const updates = {};
    let docChanged = false;

    // Legacy content
    if (lesson.content) {
      const { transformed, changed, count } = transformMarkdownImageUrls(lesson.content);
      if (changed) {
        updates.content = transformed;
        docChanged = true;
        urlsRewritten += count;
      }
    }

    // Pages
    if (lesson.pages && Array.isArray(lesson.pages)) {
      let pagesChanged = false;
      const newPages = lesson.pages.map((page) => {
        const newPage = { ...page };

        // Hero src
        if (page.hero && page.hero.src) {
          const { transformed, changed, count } = transformBareUrl(page.hero.src);
          if (changed) {
            newPage.hero = { ...page.hero, src: transformed };
            pagesChanged = true;
            urlsRewritten += count;
          }
        }

        // Blocks
        if (page.blocks && Array.isArray(page.blocks)) {
          newPage.blocks = page.blocks.map((block) => {
            const newBlock = { ...block };

            if (block.content) {
              const { transformed, changed, count } = transformMarkdownImageUrls(block.content);
              if (changed) {
                newBlock.content = transformed;
                pagesChanged = true;
                urlsRewritten += count;
              }
            }

            if (block.imageUrl) {
              const { transformed, changed, count } = transformBareUrl(block.imageUrl);
              if (changed) {
                newBlock.imageUrl = transformed;
                pagesChanged = true;
                urlsRewritten += count;
              }
            }

            return newBlock;
          });
        }

        return newPage;
      });

      if (pagesChanged) {
        updates.pages = newPages;
        docChanged = true;
      }
    }

    if (docChanged) {
      totalWouldUpdate += 1;
      lessonUpdates.push({ id: lesson._id, title: lesson.title, updates });
    }
  }

  console.log(`[lessons] ${lessonUpdates.length} lesson(s) would be updated.`);
  if (lessonUpdates.length > 0 && lessonUpdates.length <= 5) {
    lessonUpdates.forEach((u) => console.log(`  - ${u.id} "${u.title}"`));
  } else if (lessonUpdates.length > 5) {
    lessonUpdates.slice(0, 3).forEach((u) => console.log(`  - ${u.id} "${u.title}"`));
    console.log(`  ... and ${lessonUpdates.length - 3} more`);
  }

  if (apply && lessonUpdates.length > 0) {
    for (const { id, updates } of lessonUpdates) {
      await Lesson.updateOne({ _id: id }, { $set: updates });
      totalUpdated += 1;
    }
    console.log(`[lessons] Updated ${totalUpdated} document(s).`);
  }

  // --- Templates ---
  const templates = await Template.find({}).lean();
  const templateUpdates = [];

  for (const template of templates) {
    const updates = {};
    let docChanged = false;

    if (template.pages && Array.isArray(template.pages)) {
      const newPages = template.pages.map((page) => {
        const newPage = { ...page };
        let pageChanged = false;

        if (page.blocks && Array.isArray(page.blocks)) {
          newPage.blocks = page.blocks.map((block) => {
            const newBlock = { ...block };
            if (block.content) {
              const { transformed, changed, count } = transformMarkdownImageUrls(block.content);
              if (changed) {
                newBlock.content = transformed;
                pageChanged = true;
                urlsRewritten += count;
              }
            }
            return newBlock;
          });
        }

        return newPage;
      });

      const pagesChanged = JSON.stringify(newPages) !== JSON.stringify(template.pages);
      if (pagesChanged) {
        updates.pages = newPages;
        docChanged = true;
      }
    }

    if (docChanged) {
      totalWouldUpdate += 1;
      templateUpdates.push({ id: template._id, name: template.name, updates });
    }
  }

  console.log(`[templates] ${templateUpdates.length} template(s) would be updated.`);
  if (templateUpdates.length > 0 && templateUpdates.length <= 5) {
    templateUpdates.forEach((u) => console.log(`  - ${u.id} "${u.name}"`));
  } else if (templateUpdates.length > 5) {
    templateUpdates.slice(0, 3).forEach((u) => console.log(`  - ${u.id} "${u.name}"`));
    console.log(`  ... and ${templateUpdates.length - 3} more`);
  }

  if (apply && templateUpdates.length > 0) {
    for (const { id, updates } of templateUpdates) {
      await Template.updateOne({ _id: id }, { $set: updates });
      totalUpdated += 1;
    }
    console.log(`[templates] Updated ${templateUpdates.length} document(s).`);
  }

  console.log("");
  console.log("--- Summary ---");
  if (!apply) {
    console.log(`Documents that would be updated: ${totalWouldUpdate}`);
    console.log(`URLs that would be rewritten: ${urlsRewritten}`);
    console.log("Run with --apply to perform updates.");
  } else {
    console.log(`Lessons updated: ${lessonUpdates.length}`);
    console.log(`Templates updated: ${templateUpdates.length}`);
    console.log(`URLs rewritten: ${urlsRewritten}`);
  }

  await mongoose.disconnect();
  console.log("Disconnected.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
