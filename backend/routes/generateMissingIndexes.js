const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();

function safeReadDir(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isDir(d) {
  return d && typeof d.isDirectory === "function" && d.isDirectory();
}

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function hasIndexHtml(folder) {
  return fileExists(path.join(folder, "index.html"));
}

function hasAnyMarkdown(folder) {
  const entries = safeReadDir(folder);
  return entries.some((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"));
}

function hasRevisionNotesMd(folder) {
  return fileExists(path.join(folder, "revision_notes.md"));
}

function writeIndexHtml(folder, targetUrl) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>LetsRevise</title>
  <meta http-equiv="refresh" content="0; url=${targetUrl}" />
  <script>window.location.href = ${JSON.stringify(targetUrl)};</script>
</head>
<body>
  <p>Redirecting…</p>
  <p><a href="${targetUrl}">Click here if not redirected</a></p>
</body>
</html>
`;
  fs.writeFileSync(path.join(folder, "index.html"), html, "utf8");
}

function toWebPath(absPath, contentRootAbs) {
  const rel = path.relative(contentRootAbs, absPath).split(path.sep).join("/");
  return `/content/${rel}/`;
}

/**
 * Rules:
 * - For ANY folder under /static-site/content that:
 *   - does NOT have index.html
 *   - AND contains revision_notes.md OR any .md
 * we create index.html which redirects to the “best” page if it exists:
 *   - If a matching “overview” page exists under /content/<stage>/<subject>/<topic-slug>/ we send there
 *   - Otherwise we just redirect to the folder itself (so later you can add index.html properly)
 */
function slugifyTopic(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

router.post("/", (req, res) => {
  const contentRoot = path.join(__dirname, "../../static-site/content");

  if (!fileExists(contentRoot)) {
    return res.status(404).json({ error: "Content root not found", contentRoot });
  }

  // optional filter: stage=ks3|gcse|a-level
  const stageFilter = String(req.query.stage || "").trim().toLowerCase();
  const allowed = new Set(["", "ks3", "gcse", "a-level"]);
  if (!allowed.has(stageFilter)) {
    return res.status(400).json({ error: "Invalid stage filter", allowed: Array.from(allowed) });
  }

  const created = [];
  const skipped = [];
  const errors = [];

  // walk all folders
  function walk(dir) {
    const entries = safeReadDir(dir).filter(isDir);
    for (const e of entries) {
      const full = path.join(dir, e.name);

      // apply stage filter only at top level of contentRoot
      if (dir === contentRoot && stageFilter && e.name.toLowerCase() !== stageFilter) {
        continue;
      }

      // If folder has no index but looks like a content leaf (md present), create index
      try {
        if (!hasIndexHtml(full) && (hasRevisionNotesMd(full) || hasAnyMarkdown(full))) {
          const webPath = toWebPath(full, contentRoot);

          // If this is a KS3 Year topic folder like:
          // /ks3/year7/biology/topics/Cell structure
          // and there is a prettier “overview” lesson at:
          // /ks3/biology/<slug>/
          // redirect there.
          const rel = path.relative(contentRoot, full).split(path.sep);
          let target = webPath;

          // Try to detect stage + subject + topic name
          // Example rel: ["ks3","year7","biology","topics","Cell structure"]
          if (rel.length >= 5) {
            const stage = rel[0];
            const maybeYear = rel[1];
            const subject = rel[2];
            const maybeTopics = rel[3];
            const topicName = rel.slice(4).join("/");

            if (
              (stage === "ks3" || stage === "gcse" || stage === "a-level") &&
              /^year\d+$/i.test(maybeYear) &&
              maybeTopics.toLowerCase() === "topics"
            ) {
              const slug = slugifyTopic(topicName);
              const prettyAbs = path.join(contentRoot, stage, subject, slug);
              if (fileExists(prettyAbs)) {
                target = `/content/${stage}/${encodeURIComponent(subject)}/${slug}/`;
              }
            }
          }

          writeIndexHtml(full, target);
          created.push({ folder: full, target });
        } else {
          skipped.push(full);
        }
      } catch (err) {
        errors.push({ folder: full, error: String(err?.message || err) });
      }

      walk(full);
    }
  }

  walk(contentRoot);

  return res.json({
    ok: true,
    stageFilter: stageFilter || "ALL",
    createdCount: created.length,
    created,
    errorsCount: errors.length,
    errors,
  });
});

module.exports = router;
