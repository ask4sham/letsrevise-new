const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Detect these boards if they exist as folders
const BOARD_NAMES = ["AQA", "OCR", "EDEXCEL", "WJEC"];

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

function existsDir(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function hasIndexHtml(p) {
  return fs.existsSync(path.join(p, "index.html"));
}

function listTopicDirs(topicsPath, baseUrlPath) {
  // topicsPath: .../topics
  if (!existsDir(topicsPath)) return [];

  const topicDirs = safeReadDir(topicsPath)
    .filter(isDir)
    // ✅ ignore accidental nested "topics" folder (fixes /topics/topics/)
    .filter((d) => String(d.name).toLowerCase() !== "topics")
    // optional: ignore hidden/system folders
    .filter((d) => !String(d.name).startsWith("."));

  return topicDirs.map((t) => {
    const topicName = t.name;
    const topicFolderPath = path.join(topicsPath, topicName);

    return {
      topic: topicName,
      path: `${baseUrlPath}/${encodeURIComponent(topicName)}/`,
      hasIndex: hasIndexHtml(topicFolderPath),
    };
  });
}

function detectBoards(stageRoot) {
  const entries = safeReadDir(stageRoot).filter(isDir);
  const found = entries
    .map((e) => e.name)
    .filter((name) => BOARD_NAMES.includes(String(name).toUpperCase()));
  return found.sort((a, b) => a.localeCompare(b));
}

/**
 * KS3 expected:
 * /ks3/year7/<subject>/topics/<topic>/index.html (or subject index)
 */
function buildKs3Tree(contentRoot) {
  const stage = "ks3";
  const stageRoot = path.join(contentRoot, stage);

  const out = { stage, exists: existsDir(stageRoot), years: [] };
  if (!out.exists) return out;

  const yearDirs = safeReadDir(stageRoot)
    .filter(isDir)
    .map((d) => d.name)
    .filter((n) => /^year\d+$/i.test(n))
    .sort(
      (a, b) =>
        parseInt(a.replace(/\D/g, ""), 10) - parseInt(b.replace(/\D/g, ""), 10)
    );

  for (const year of yearDirs) {
    const yearPath = path.join(stageRoot, year);

    const subjects = safeReadDir(yearPath)
      .filter(isDir)
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));

    const yearObj = {
      year,
      path: `/content/${stage}/${year}/`,
      hasIndex: hasIndexHtml(yearPath),
      subjects: [],
    };

    for (const subject of subjects) {
      const subjectPath = path.join(yearPath, subject);
      const topicsPath = path.join(subjectPath, "topics");

      yearObj.subjects.push({
        subject,
        path: `/content/${stage}/${year}/${encodeURIComponent(subject)}/`,
        hasIndex: hasIndexHtml(subjectPath),
        topicsPath: `/content/${stage}/${year}/${encodeURIComponent(
          subject
        )}/topics/`,
        topics: listTopicDirs(
          topicsPath,
          `/content/${stage}/${year}/${encodeURIComponent(subject)}/topics`
        ),
      });
    }

    out.years.push(yearObj);
  }

  return out;
}

/**
 * GCSE expected:
 * /gcse/<Board>/<Subject>/...
 * Tier may exist as:
 *   /foundation/  and /higher/
 * OR:
 *   /foundation tier/ and /higher tier/
 * Topics may exist under:
 *   /topics/
 * OR:
 *   /<tier>/topics/
 */
function buildGcseTree(contentRoot) {
  const stage = "gcse";
  const stageRoot = path.join(contentRoot, stage);

  const out = { stage, exists: existsDir(stageRoot), boards: [] };
  if (!out.exists) return out;

  const boards = detectBoards(stageRoot);

  if (boards.length > 0) {
    for (const board of boards) {
      const boardPath = path.join(stageRoot, board);

      const subjects = safeReadDir(boardPath)
        .filter(isDir)
        .map((d) => d.name)
        .sort((a, b) => a.localeCompare(b));

      const boardObj = { board, subjects: [] };

      for (const subject of subjects) {
        const subjectPath = path.join(boardPath, subject);

        // detect tier folders (optional)
        const foundationNames = ["foundation", "foundation tier"];
        const higherNames = ["higher", "higher tier"];

        const foundationDir = foundationNames.find((n) =>
          existsDir(path.join(subjectPath, n))
        );
        const higherDir = higherNames.find((n) =>
          existsDir(path.join(subjectPath, n))
        );

        const tiers = [];

        if (foundationDir || higherDir) {
          if (foundationDir) {
            const tPath = path.join(subjectPath, foundationDir, "topics");
            tiers.push({
              tier: "foundation",
              path: `/content/${stage}/${encodeURIComponent(
                board
              )}/${encodeURIComponent(subject)}/${encodeURIComponent(
                foundationDir
              )}/`,
              topicsPath: `/content/${stage}/${encodeURIComponent(
                board
              )}/${encodeURIComponent(subject)}/${encodeURIComponent(
                foundationDir
              )}/topics/`,
              topics: listTopicDirs(
                tPath,
                `/content/${stage}/${encodeURIComponent(
                  board
                )}/${encodeURIComponent(subject)}/${encodeURIComponent(
                  foundationDir
                )}/topics`
              ),
            });
          }

          if (higherDir) {
            const tPath = path.join(subjectPath, higherDir, "topics");
            tiers.push({
              tier: "higher",
              path: `/content/${stage}/${encodeURIComponent(
                board
              )}/${encodeURIComponent(subject)}/${encodeURIComponent(higherDir)}/`,
              topicsPath: `/content/${stage}/${encodeURIComponent(
                board
              )}/${encodeURIComponent(subject)}/${encodeURIComponent(
                higherDir
              )}/topics/`,
              topics: listTopicDirs(
                tPath,
                `/content/${stage}/${encodeURIComponent(
                  board
                )}/${encodeURIComponent(subject)}/${encodeURIComponent(
                  higherDir
                )}/topics`
              ),
            });
          }
        }

        // topics without tier
        const directTopicsPath = path.join(subjectPath, "topics");

        boardObj.subjects.push({
          subject,
          path: `/content/${stage}/${encodeURIComponent(
            board
          )}/${encodeURIComponent(subject)}/`,
          hasIndex: hasIndexHtml(subjectPath),
          topicsPath: `/content/${stage}/${encodeURIComponent(
            board
          )}/${encodeURIComponent(subject)}/topics/`,
          topics: listTopicDirs(
            directTopicsPath,
            `/content/${stage}/${encodeURIComponent(
              board
            )}/${encodeURIComponent(subject)}/topics`
          ),
          tiers,
        });
      }

      out.boards.push(boardObj);
    }
  } else {
    // Fallback: no board folders found
    const subjects = safeReadDir(stageRoot)
      .filter(isDir)
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));

    out.subjects = subjects.map((subject) => {
      const subjectPath = path.join(stageRoot, subject);
      const topicsPath = path.join(subjectPath, "topics");

      return {
        subject,
        path: `/content/${stage}/${encodeURIComponent(subject)}/`,
        hasIndex: hasIndexHtml(subjectPath),
        topicsPath: `/content/${stage}/${encodeURIComponent(subject)}/topics/`,
        topics: listTopicDirs(
          topicsPath,
          `/content/${stage}/${encodeURIComponent(subject)}/topics`
        ),
        tiers: [],
      };
    });
  }

  return out;
}

/**
 * A-Level expected:
 * current: /a-level/<Subject>/topics/...
 * future:  /a-level/<Board>/<Subject>/topics/...
 */
function buildALevelTree(contentRoot) {
  const stage = "a-level";
  const stageRoot = path.join(contentRoot, stage);

  const out = { stage, exists: existsDir(stageRoot), boards: [], subjects: [] };
  if (!out.exists) return out;

  const boards = detectBoards(stageRoot);

  if (boards.length > 0) {
    for (const board of boards) {
      const boardPath = path.join(stageRoot, board);

      const subjects = safeReadDir(boardPath)
        .filter(isDir)
        .map((d) => d.name)
        .sort((a, b) => a.localeCompare(b));

      const boardObj = { board, subjects: [] };

      for (const subject of subjects) {
        const subjectPath = path.join(boardPath, subject);
        const topicsPath = path.join(subjectPath, "topics");

        boardObj.subjects.push({
          subject,
          path: `/content/${stage}/${encodeURIComponent(
            board
          )}/${encodeURIComponent(subject)}/`,
          hasIndex: hasIndexHtml(subjectPath),
          topicsPath: `/content/${stage}/${encodeURIComponent(
            board
          )}/${encodeURIComponent(subject)}/topics/`,
          topics: listTopicDirs(
            topicsPath,
            `/content/${stage}/${encodeURIComponent(
              board
            )}/${encodeURIComponent(subject)}/topics`
          ),
        });
      }

      out.boards.push(boardObj);
    }
  } else {
    // current reality: a-level/<subject>/topics
    const subjects = safeReadDir(stageRoot)
      .filter(isDir)
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));

    out.subjects = subjects.map((subject) => {
      const subjectPath = path.join(stageRoot, subject);
      const topicsPath = path.join(subjectPath, "topics");

      return {
        subject,
        path: `/content/${stage}/${encodeURIComponent(subject)}/`,
        hasIndex: hasIndexHtml(subjectPath),
        topicsPath: `/content/${stage}/${encodeURIComponent(subject)}/topics/`,
        topics: listTopicDirs(
          topicsPath,
          `/content/${stage}/${encodeURIComponent(subject)}/topics`
        ),
      };
    });
  }

  return out;
}

// GET /api/content-tree?stage=ks3|gcse|a-level
router.get("/", (req, res) => {
  const stage = String(req.query.stage || "ks3").trim().toLowerCase();
  const allowed = new Set(["ks3", "gcse", "a-level"]);

  if (!allowed.has(stage)) {
    return res
      .status(400)
      .json({ error: "Invalid stage", allowed: Array.from(allowed) });
  }

  const contentRoot = path.join(__dirname, "../../static-site/content");

  let tree;
  if (stage === "ks3") tree = buildKs3Tree(contentRoot);
  if (stage === "gcse") tree = buildGcseTree(contentRoot);
  if (stage === "a-level") tree = buildALevelTree(contentRoot);

  return res.json(tree);
});

module.exports = router;
