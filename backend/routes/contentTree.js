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

function isDir(dirent) {
  return dirent && typeof dirent.isDirectory === "function" && dirent.isDirectory();
}

function hasIndexHtml(dirPath) {
  return fs.existsSync(path.join(dirPath, "index.html"));
}

function hasTopicsJson(dirPath) {
  return fs.existsSync(path.join(dirPath, "topics.json")) || fs.existsSync(path.join(dirPath, "topics.json".toLowerCase()));
}

function buildStageTree(contentRoot, stage) {
  const stageRoot = path.join(contentRoot, stage);
  const out = {
    stage,
    exists: fs.existsSync(stageRoot),
    years: [],
    subjects: [],
  };

  if (!out.exists) return out;

  const stageEntries = safeReadDir(stageRoot);

  // KS3 style: /ks3/year7/... etc
  // GCSE/A-Level style may be different later, but we’ll still list folders.
  const folders = stageEntries.filter(isDir).map(d => d.name);

  // Heuristic: treat folders starting with "year" as years
  const yearFolders = folders
    .filter(name => /^year\d+$/i.test(name))
    .sort((a, b) => {
      const na = parseInt(a.replace(/[^0-9]/g, ""), 10);
      const nb = parseInt(b.replace(/[^0-9]/g, ""), 10);
      return na - nb;
    });

  // Non-year folders (like "biology" overview etc)
  const topLevelSubjects = folders.filter(name => !/^year\d+$/i.test(name)).sort();

  out.subjects = topLevelSubjects;

  // Build years → subjects → topics (best-effort)
  for (const yearName of yearFolders) {
    const yearPath = path.join(stageRoot, yearName);
    const yearEntries = safeReadDir(yearPath).filter(isDir);

    const yearObj = {
      year: yearName,
      path: `/content/${stage}/${yearName}/`,
      hasIndex: hasIndexHtml(yearPath),
      subjects: [],
    };

    for (const subjDir of yearEntries) {
      const subjectName = subjDir.name;
      const subjectPath = path.join(yearPath, subjectName);

      const subjectObj = {
        subject: subjectName,
        path: `/content/${stage}/${yearName}/${encodeURIComponent(subjectName)}/`,
        hasIndex: hasIndexHtml(subjectPath),
        topics: [],
      };

      // If there is a topics folder, list topics inside it
      const topicsPath = path.join(subjectPath, "topics");
      if (fs.existsSync(topicsPath) && fs.statSync(topicsPath).isDirectory()) {
        const topicDirs = safeReadDir(topicsPath).filter(isDir);

        for (const t of topicDirs) {
          const topicName = t.name;
          const topicFolderPath = path.join(topicsPath, topicName);

          subjectObj.topics.push({
            topic: topicName,
            path: `/content/${stage}/${yearName}/${encodeURIComponent(subjectName)}/topics/${encodeURIComponent(topicName)}/`,
            hasIndex: hasIndexHtml(topicFolderPath),
            hasTopicsJson: hasTopicsJson(topicFolderPath),
          });
        }
      }

      yearObj.subjects.push(subjectObj);
    }

    out.years.push(yearObj);
  }

  return out;
}

// GET /api/content-tree?stage=ks3
router.get("/", (req, res) => {
  const stage = String(req.query.stage || "ks3").trim();

  // allow: ks3, gcse, a-level
  const allowed = new Set(["ks3", "gcse", "a-level"]);
  if (!allowed.has(stage)) {
    return res.status(400).json({
      error: "Invalid stage",
      allowed: Array.from(allowed),
    });
  }

  const contentRoot = path.join(__dirname, "../../static-site/content");
  const tree = buildStageTree(contentRoot, stage);

  return res.json(tree);
});

module.exports = router;
