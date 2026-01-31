// backend/utils/curatedVisuals.js
// Curated visuals lookup (Option B)
// Reads: backend/public/visuals/biology/aqa-gcse/manifest.json
// Returns a { type, src, caption } object for Lesson.pages[].hero

const fs = require("fs");
const path = require("path");

let _cache = null;
let _cacheMtimeMs = 0;

function safeStr(v, fallback = "") {
  const s = v === undefined || v === null ? "" : String(v);
  return s.trim() ? s.trim() : fallback;
}

function norm(s) {
  return safeStr(s, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// ✅ Enhanced topic normalization for better matching
function normTopic(s) {
  return safeStr(s, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    // turn brackets/punctuation into spaces
    .replace(/[()[\]{}:;,./\\|'"!?]/g, " ")
    // keep letters/numbers, turn the rest into spaces
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ✅ Step 1: Add helper function to prefer SVG if exists
function preferSvgIfExists(publicUrl) {
  if (!publicUrl || typeof publicUrl !== "string") return publicUrl;

  // Only try to upgrade raster formats
  if (!publicUrl.match(/\.(png|jpg|jpeg|webp)$/i)) {
    return publicUrl;
  }

  const svgUrl = publicUrl.replace(/\.(png|jpg|jpeg|webp)$/i, ".svg");

  const svgFsPath = path.join(
    process.cwd(),
    "backend",
    "public",
    svgUrl.replace(/^\/+/, "")
  );

  if (fs.existsSync(svgFsPath)) {
    return svgUrl;
  }

  return publicUrl;
}

function readManifest() {
  const manifestPath = path.join(
    process.cwd(),
    "backend",
    "public",
    "visuals",
    "biology",
    "aqa-gcse",
    "manifest.json"
  );

  if (!fs.existsSync(manifestPath)) {
    return { manifest: null, manifestPath };
  }

  const stat = fs.statSync(manifestPath);
  const mtimeMs = stat.mtimeMs || 0;

  // cache (reload only if changed)
  if (_cache && _cacheMtimeMs === mtimeMs) {
    return { manifest: _cache, manifestPath };
  }

  const raw = fs.readFileSync(manifestPath, "utf8");
  const json = JSON.parse(raw);

  _cache = json;
  _cacheMtimeMs = mtimeMs;

  return { manifest: json, manifestPath };
}

// ✅ Static curated entries for topics not yet in the manifest
// ✅ Keep file extensions as they are in the visuals folder
const staticCurated = [
  {
    subject: "Biology",
    examBoard: "AQA",
    level: "GCSE",
    topic: "Eukaryotes & Prokaryotes",
    hero: {
      type: "image",
      src: "/visuals/biology/aqa-gcse/cell-biology/cell-structure/eukaryotes-and-prokaryotes.png",
      caption: "Eukaryotic vs prokaryotic cells (GCSE)"
    }
  },
  {
    subject: "Biology",
    examBoard: "AQA",
    level: "GCSE",
    topic: "Cell Structure",
    hero: {
      type: "image",
      src: "/visuals/biology/aqa-gcse/cell-biology/cell-structure/cell-structure.png",
      caption: "Animal and plant cell structure (GCSE)"
    }
  },
  {
    subject: "Biology",
    examBoard: "AQA",
    level: "GCSE",
    topic: "Photosynthesis",
    hero: {
      type: "image",
      src: "/visuals/biology/aqa-gcse/bioenergetics/photosynthesis/photosynthesis.png",
      caption: "Photosynthesis process (GCSE)"
    }
  },
  {
    subject: "Biology",
    examBoard: "AQA",
    level: "GCSE",
    topic: "Respiration",
    hero: {
      type: "image",
      src: "/visuals/biology/aqa-gcse/bioenergetics/respiration/respiration.png",
      caption: "Aerobic and anaerobic respiration (GCSE)"
    }
  },
  {
    subject: "Biology",
    examBoard: "AQA",
    level: "GCSE",
    topic: "Cell Division",
    hero: {
      type: "image",
      src: "/visuals/biology/aqa-gcse/cell-biology/cell-division/cell-division.png",
      caption: "Mitosis and meiosis (GCSE)"
    }
  }
];

/**
 * Best-effort match:
 * - We match lesson.topic against manifest.subtopic first (exact-ish)
 * - If not found, we try substring match
 * - Also filters by subject/examBoard/level where possible
 */
function findCuratedVisual({ subject, examBoard, level, topic }) {
  const { manifest, manifestPath } = readManifest();
  
  // Check static curated entries first
  const subj = norm(subject);
  const board = norm(examBoard);
  const lvl = norm(level);
  // ✅ Use normTopic for lesson topics
  const t = normTopic(topic);

  if (!t) {
    return { hero: null, debug: { reason: "missing_topic" } };
  }

  // First check static curated entries
  for (const item of staticCurated) {
    if (norm(item.subject) === subj &&
        norm(item.examBoard) === board &&
        norm(item.level) === lvl) {
      
      const lessonTopic = t; // already normTopic()
      // ✅ Use normTopic for curated topics too
      const curatedTopic = normTopic(item.topic);
      
      // Step 3: Improved topic matching with "contains" logic
      const topicMatch =
        lessonTopic === curatedTopic ||
        lessonTopic.includes(curatedTopic) ||
        curatedTopic.includes(lessonTopic);
      
      if (topicMatch) {
        // ✅ Step 2: Apply SVG preference to static curated visuals
        return {
          hero: {
            ...item.hero,
            src: preferSvgIfExists(item.hero.src),
          },
          debug: {
            reason: "matched_static",
            topic: item.topic,
            matchedLessonTopic: topic,
            normalizedLessonTopic: t,
            normalizedCuratedTopic: curatedTopic
          }
        };
      }
    }
  }

  // If no static match, proceed with manifest lookup
  if (!manifest || !Array.isArray(manifest.items)) {
    return {
      hero: null,
      debug: {
        reason: "manifest_missing_or_invalid",
        manifestPath,
      },
    };
  }

  // Filter down to likely items first
  let items = manifest.items;

  if (subj) items = items.filter((x) => norm(x.subject) === subj);
  if (board) items = items.filter((x) => norm(x.examBoard) === board);
  if (lvl) items = items.filter((x) => norm(x.level) === lvl);

  // ✅ Use normTopic for subtopic matching too
  // 1) Exact match on subtopic
  let hit =
    items.find((x) => normTopic(x.subtopic) === t) ||
    items.find((x) => normTopic(x.subtopicSlug) === t);

  // 2) Match if lesson.topic equals "Topic: Subtopic" (some UIs do this)
  if (!hit) {
    hit = items.find((x) => {
      const combo = `${normTopic(x.topic)}: ${normTopic(x.subtopic)}`;
      return combo === t;
    });
  }

  // 3) Improved substring match with "contains" logic (Step 3)
  if (!hit) {
    hit = items.find((x) => {
      const curatedTopic = normTopic(x.subtopic);
      const lessonTopic = t;
      
      // Enhanced matching: either contains the other
      return lessonTopic === curatedTopic ||
             lessonTopic.includes(curatedTopic) ||
             curatedTopic.includes(lessonTopic);
    });
  }

  // 4) Try matching with the full topic field from manifest
  if (!hit) {
    hit = items.find((x) => {
      const curatedTopic = normTopic(x.topic || "");
      const lessonTopic = t;
      
      return lessonTopic === curatedTopic ||
             lessonTopic.includes(curatedTopic) ||
             curatedTopic.includes(lessonTopic);
    });
  }

  if (!hit) {
    return {
      hero: null,
      debug: {
        reason: "no_match",
        filters: { subject, examBoard, level, topic },
        normalizedTopic: t,
        itemsConsidered: items.length,
      },
    };
  }

  const caption = `${safeStr(hit.topic)} • ${safeStr(hit.section)} • ${safeStr(hit.subtopic)}`.trim();

  // ✅ Step 3: Apply SVG preference to manifest-based visuals
  const resolvedSrc = preferSvgIfExists(hit.url);

  return {
    hero: {
      type: "image", // matches your enum: none|image|video|animation
      src: resolvedSrc,  // e.g. /visuals/biology/aqa-gcse/cell-biology/...
      caption,
    },
    debug: {
      reason: "matched",
      key: hit.key,
      url: hit.url,
      resolvedSrc,
    },
  };
}

module.exports = {
  findCuratedVisual,
};