/**
 * One-off migration: convert legacy relative markdown asset URLs to absolute backend URLs.
 *
 * Touches:
 *   Lesson: content, uploadedImages[], pages[].hero.src, pages[].blocks[].content,
 *           pages[].blocks[].imageUrl, pages[].blocks[].source,
 *           flashcards[].front, flashcards[].back,
 *           quiz.questions[].question, quiz.questions[].explanation,
 *           assessment.questions[].question, assessment.questions[].explanation
 *   Template: pages[].blocks[].content
 *
 * Safe paths: /uploads/, /visuals/, /content/ (and variants without leading slash)
 * Rejects: javascript:, data:, vbscript:
 * Idempotent: already-absolute URLs (http/https) are left unchanged.
 *
 * Dry run:  node scripts/migrate-legacy-image-urls.js
 * Write:    node scripts/migrate-legacy-image-urls.js --apply
 *
 * Env: MONGO_URI or MONGODB_URI (required; Render sets MONGO_URI)
 *      BACKEND_PUBLIC_URL (default https://letsrevise-new.onrender.com)
 *
 * Verify no legacy paths remain (MongoDB shell):
 *   db.lessons.find({ $or: [
 *     { content: /\]\(\s*\/?(uploads|visuals|content)\// },
 *     { uploadedImages: /^\/(uploads|visuals|content)\// },
 *     { "pages.blocks.content": /\]\(\s*\/?(uploads|visuals|content)\// },
 *     { "pages.blocks.imageUrl": /^\/(uploads|visuals|content)\// },
 *     { "pages.hero.src": /^\/(uploads|visuals|content)\// }
 *   ] }).count()
 *   Expect 0 after successful migration.
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

/** Mask credentials: mongodb+srv://user:pass@host/db -> host */
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

/** Returns true only for legacy relative asset paths. Already-absolute URLs return false. */
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
  const path = u.startsWith("/") ? u : `/${u}`;
  const normalized = path.startsWith("/api/") ? path.slice(4) : path;
  return `${DEFAULT_BACKEND_URL}${normalized}`;
}

/**
 * Transform markdown: ![alt](/uploads/...) -> ![alt](https://...)
 * Idempotent: absolute URLs are left unchanged.
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
 * Transform a bare URL field (imageUrl, hero.src, uploadedImages entry, block.source)
 * Idempotent: absolute URLs are left unchanged.
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

  console.log("=== Legacy Image URL Migration ===");
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

  let totalScanned = 0;
  let totalWouldUpdate = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let urlsRewritten = 0;
  const matchedUrls = [];

  // --- Lessons ---
  const lessons = await Lesson.find({});
  totalScanned += lessons.length;
  let lessonsUpdatedCount = 0;
  const lessonUpdates = [];

  for (const lesson of lessons) {
    let docChanged = false;
    let urlCount = 0;

    // Legacy content
    if (lesson.content) {
      const { transformed, changed, count } = transformMarkdownImageUrls(lesson.content);
      if (changed) {
        lesson.content = transformed;
        lesson.markModified("content");
        docChanged = true;
        urlCount += count;
      }
    }

    // uploadedImages array
    if (lesson.uploadedImages && Array.isArray(lesson.uploadedImages)) {
      let arrChanged = false;
      const newArr = lesson.uploadedImages.map((entry) => {
        const { transformed, changed, count } = transformBareUrl(entry);
        if (changed) {
          arrChanged = true;
          urlCount += count;
          if (matchedUrls.length < 20) matchedUrls.push({ type: "uploadedImages", from: entry, to: transformed });
          return transformed;
        }
        return entry;
      });
      if (arrChanged) {
        lesson.uploadedImages = newArr;
        lesson.markModified("uploadedImages");
        docChanged = true;
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
            urlCount += count;
            if (matchedUrls.length < 20) matchedUrls.push({ type: "hero.src", from: page.hero.src, to: transformed });
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
                urlCount += count;
              }
            }

            if (block.imageUrl) {
              const { transformed, changed, count } = transformBareUrl(block.imageUrl);
              if (changed) {
                newBlock.imageUrl = transformed;
                pagesChanged = true;
                urlCount += count;
                if (matchedUrls.length < 20) matchedUrls.push({ type: "block.imageUrl", from: block.imageUrl, to: transformed });
              }
            }

            if (block.source) {
              const { transformed, changed, count } = transformBareUrl(block.source);
              if (changed) {
                newBlock.source = transformed;
                pagesChanged = true;
                urlCount += count;
              }
            }

            return newBlock;
          });
        }

        return newPage;
      });

      if (pagesChanged) {
        lesson.pages = [...newPages];
        lesson.markModified("pages");
        docChanged = true;
      }
    }

    // Flashcards
    if (lesson.flashcards && Array.isArray(lesson.flashcards)) {
      let fcChanged = false;
      const newFc = lesson.flashcards.map((fc) => {
        const n = { ...fc };
        if (fc.front) {
          const { transformed, changed, count } = transformMarkdownImageUrls(fc.front);
          if (changed) {
            n.front = transformed;
            fcChanged = true;
            urlCount += count;
          }
        }
        if (fc.back) {
          const { transformed, changed, count } = transformMarkdownImageUrls(fc.back);
          if (changed) {
            n.back = transformed;
            fcChanged = true;
            urlCount += count;
          }
        }
        return n;
      });
      if (fcChanged) {
        lesson.flashcards = newFc;
        lesson.markModified("flashcards");
        docChanged = true;
      }
    }

    // Quiz questions
    if (lesson.quiz && lesson.quiz.questions && Array.isArray(lesson.quiz.questions)) {
      let qChanged = false;
      const newQuestions = lesson.quiz.questions.map((q) => {
        const n = { ...q };
        if (q.question) {
          const { transformed, changed, count } = transformMarkdownImageUrls(q.question);
          if (changed) {
            n.question = transformed;
            qChanged = true;
            urlCount += count;
          }
        }
        if (q.explanation) {
          const { transformed, changed, count } = transformMarkdownImageUrls(q.explanation);
          if (changed) {
            n.explanation = transformed;
            qChanged = true;
            urlCount += count;
          }
        }
        return n;
      });
      if (qChanged) {
        lesson.quiz.questions = newQuestions;
        lesson.markModified("quiz");
        docChanged = true;
      }
    }

    // Assessment questions
    if (lesson.assessment && lesson.assessment.questions && Array.isArray(lesson.assessment.questions)) {
      let aChanged = false;
      const newQuestions = lesson.assessment.questions.map((q) => {
        const n = { ...q };
        if (q.question) {
          const { transformed, changed, count } = transformMarkdownImageUrls(q.question);
          if (changed) {
            n.question = transformed;
            aChanged = true;
            urlCount += count;
          }
        }
        if (q.explanation) {
          const { transformed, changed, count } = transformMarkdownImageUrls(q.explanation);
          if (changed) {
            n.explanation = transformed;
            aChanged = true;
            urlCount += count;
          }
        }
        return n;
      });
      if (aChanged) {
        lesson.assessment.questions = newQuestions;
        lesson.markModified("assessment");
        docChanged = true;
      }
    }

    if (docChanged) {
      totalWouldUpdate += 1;
      urlsRewritten += urlCount;
      lessonUpdates.push({ id: lesson._id, title: lesson.title, urlCount });
      if (apply) {
        await lesson.save();
        lessonsUpdatedCount += 1;
        if (lessonsUpdatedCount <= 10) {
          console.log(`  [lesson] ${lesson._id} "${lesson.title}" (${urlCount} URL(s))`);
        }
      }
    } else {
      totalSkipped += 1;
    }
  }

  console.log(`[lessons] Scanned: ${lessons.length}, would update: ${lessonUpdates.length}, skipped: ${lessons.length - lessonUpdates.length}`);
  if (apply && lessonsUpdatedCount > 0) {
    console.log(`[lessons] Updated ${lessonsUpdatedCount} document(s).`);
  }

  // --- Templates ---
  const templates = await Template.find({});
  totalScanned += templates.length;
  let templatesUpdatedCount = 0;
  let templateWouldUpdate = 0;
  const templateUpdates = [];

  for (const template of templates) {
    let docChanged = false;
    let urlCount = 0;

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
                urlCount += count;
              }
            }
            return newBlock;
          });
        }

        return newPage;
      });

      const pagesChanged = JSON.stringify(newPages) !== JSON.stringify(template.pages);
      if (pagesChanged) {
        template.pages = [...newPages];
        template.markModified("pages");
        docChanged = true;
      }
    }

    if (docChanged) {
      totalWouldUpdate += 1;
      templateWouldUpdate += 1;
      urlsRewritten += urlCount;
      templateUpdates.push({ id: template._id, name: template.name, urlCount });
      if (apply) {
        await template.save();
        templatesUpdatedCount += 1;
        if (templatesUpdatedCount <= 10) {
          console.log(`  [template] ${template._id} "${template.name}" (${urlCount} URL(s))`);
        }
      }
    } else {
      totalSkipped += 1;
    }
  }

  console.log(`[templates] Scanned: ${templates.length}, would update: ${templateWouldUpdate}, skipped: ${templates.length - templateWouldUpdate}`);
  if (templateWouldUpdate > 0 && templateUpdates.length <= 5) {
    templateUpdates.forEach((u) => console.log(`  - ${u.id} "${u.name}" (${u.urlCount} URL(s))`));
  } else if (templateUpdates.length > 5) {
    templateUpdates.slice(0, 3).forEach((u) => console.log(`  - ${u.id} "${u.name}" (${u.urlCount} URL(s))`));
    console.log(`  ... and ${templateUpdates.length - 3} more`);
  }
  if (apply && templatesUpdatedCount > 0) {
    console.log(`[templates] Updated ${templatesUpdatedCount} document(s).`);
  }

  // --- Matched URLs sample ---
  if (matchedUrls.length > 0) {
    console.log("");
    console.log("--- Sample matched URLs (first 10) ---");
    matchedUrls.slice(0, 10).forEach((m, i) => {
      console.log(`  ${i + 1}. [${m.type}] ${m.from} -> ${m.to}`);
    });
  }

  console.log("");
  console.log("--- Summary ---");
  console.log(`Documents scanned: ${totalScanned} (${lessons.length} lessons, ${templates.length} templates)`);
  console.log(`Documents skipped (no legacy URLs): ${totalSkipped}`);
  if (!apply) {
    console.log(`Documents that would be updated: ${totalWouldUpdate}`);
    console.log(`URLs that would be rewritten: ${urlsRewritten}`);
    console.log("Run with --apply to perform updates.");
  } else {
    console.log(`Lessons updated: ${lessonsUpdatedCount}`);
    console.log(`Templates updated: ${templatesUpdatedCount}`);
    console.log(`URLs rewritten: ${urlsRewritten}`);
  }

  await mongoose.disconnect();
  console.log("");
  console.log("Disconnected.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
