const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();

/**
 * Utilities
 */
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

function existsDir(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function hasIndexHtml(dirPath) {
  return fs.existsSync(path.join(dirPath, "index.html"));
}

function hasTopicsJson(dirPath) {
  return fs.existsSync(path.join(dirPath, "topics.json"));
}

function encodeSeg(seg) {
  return encodeURIComponent(String(seg));
}

function sortYears(a, b) {
  const na = parseInt(String(a).replace(/[^0-9]/g, ""), 10);
  const nb = parseInt(String(b).replace(/[^0-9]/g, ""), 10);
  return (isNaN(na) ? 999 : na) - (isNaN(nb) ? 999 : nb);
}

function normalizeTierName(name) {
  const n = String(name).trim().toLowerCase();
  if (n.includes("foundation")) return "foundation";
  if (n.includes("higher")) return "higher";
  return n.replace(/\s+/g, "-");
}

/**
 * Build KS3 tree:
 * /ks3/year7/<subject>/topics/<topic>/index.html
 */
function buildKS3Tree(contentRoot) {
  const stage = "ks3";
  const stageRoot = path.join(contentRoot, stage);

  const out = {
    stage,
    exists: fs.existsSync(stageRoot),
    years: [],
  };

  if (!out.exists) return out;

  const yearFolders = safeReadDir(stageRoot)
    .filter(isDir)
    .map((d) => d.name)
    .filter((n) => /^year\d+$/i.test(n))
    .sort(sortYears);

  for (const yearName of yearFolders) {
    const yearPath = path.join(stageRoot, yearName);

    const yearObj = {
      year: yearName,
      path: `/content/${stage}/${encodeSeg(yearName)}/`,
      hasIndex: hasIndexHtml(yearPath),
      subjects: [],
    };

    const subjects = safeReadDir(yearPath)
      .filter(isDir)
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));

    for (const subjectName of subjects) {
      const subjectPath = path.join(yearPath, subjectName);

      const subjectObj = {
        subject: subjectName,
        path: `/content/${stage}/${encodeSeg(yearName)}/${encodeSeg(subjectName)}/`,
        hasIndex: hasIndexHtml(subjectPath),
        topics: [],
      };

      const topicsPath = path.join(subjectPath, "topics");
      if (existsDir(topicsPath)) {
        const topicDirs = safeReadDir(topicsPath).filter(isDir);

        for (const t of topicDirs) {
          const topicName = t.name;
          const topicFolderPath = path.join(topicsPath, topicName);

          subjectObj.topics.push({
            topic: topicName,
            path: `/content/${stage}/${encodeSeg(yearName)}/${encodeSeg(subjectName)}/topics/${encodeSeg(topicName)}/`,
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

/**
 * Build A-Level tree (your current structure):
 * /a-level/<subject>/topics/(topics.json)
 */
function buildALevelTree(contentRoot) {
  const stage = "a-level";
  const stageRoot = path.join(contentRoot, stage);

  const out = {
    stage,
    exists: fs.existsSync(stageRoot),
    subjects: [],
  };

  if (!out.exists) return out;

  const subjectFolders = safeReadDir(stageRoot)
    .filter(isDir)
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));

  for (const subjectName of subjectFolders) {
    const subjectPath = path.join(stageRoot, subjectName);
    const topicsPath = path.join(subjectPath, "topics");

    out.subjects.push({
      subject: subjectName,
      path: `/content/${stage}/${encodeSeg(subjectName)}/`,
      hasIndex: hasIndexHtml(subjectPath),
      topicsPath: existsDir(topicsPath)
        ? `/content/${stage}/${encodeSeg(subjectName)}/topics/`
        : null,
      hasTopicsJson: existsDir(topicsPath) ? hasTopicsJson(topicsPath) : false,
    });
  }

  return out;
}

/**
 * Build GCSE tree (robust to your mixed tree):
 *
 * We support BOTH:
 *  A) Desired: /gcse/<subject>/<board>/<tier>/topics/...
 *  B) Existing: /gcse/<board>/<subject>/(maybe tier)/topics/...
 *
 * Output is always:
 *   subjects[] -> boards[] -> tiers[] -> topicsPath
 */
function buildGCSETree(contentRoot) {
  const stage = "gcse";
  const stageRoot = path.join(contentRoot, stage);

  const out = {
    stage,
    exists: fs.existsSync(stageRoot),
    subjects: [],
    detectedBoardsAtRoot: [],
  };

  if (!out.exists) return out;

  // Detect exam boards at root if present
  const rootDirs = safeReadDir(stageRoot).filter(isDir).map((d) => d.name);
  const knownBoards = ["AQA", "Edexcel", "OCR", "WJEC"];

  const boardsAtRoot = rootDirs.filter((n) =>
    knownBoards.some((b) => b.toLowerCase() === String(n).toLowerCase())
  );

  out.detectedBoardsAtRoot = boardsAtRoot;

  // Build a map subject -> board -> info
  const subjectMap = new Map();

  function ensureSubject(subjectName) {
    const key = subjectName;
    if (!subjectMap.has(key)) {
      subjectMap.set(key, {
        subject: subjectName,
        path: `/content/${stage}/${encodeSeg(subjectName)}/`,
        boards: [],
      });
    }
    return subjectMap.get(key);
  }

  function upsertBoard(subjectObj, boardName) {
    const existing = subjectObj.boards.find(
      (b) => String(b.board).toLowerCase() === String(boardName).toLowerCase()
    );
    if (existing) return existing;

    const boardObj = {
      board: boardName,
      path: `/content/${stage}/${encodeSeg(subjectObj.subject)}/${encodeSeg(boardName)}/`,
      tiers: [],
    };

    subjectObj.boards.push(boardObj);
    return boardObj;
  }

  function addTier(boardObj, tierName, tierPathOnDisk, tierUrlPath) {
    const norm = normalizeTierName(tierName);
    const existing = boardObj.tiers.find((t) => t.tier === norm);
    if (existing) return;

    const topicsPath = path.join(tierPathOnDisk, "topics");

    boardObj.tiers.push({
      tier: norm, // "foundation" | "higher" | etc
      displayName: tierName,
      path: tierUrlPath,
      hasIndex: hasIndexHtml(tierPathOnDisk),
      topicsPath: existsDir(topicsPath) ? `${tierUrlPath.replace(/\/$/, "")}/topics/` : null,
      hasTopicsJson: existsDir(topicsPath) ? hasTopicsJson(topicsPath) : false,
    });
  }

  /**
   * Case B: /gcse/<Board>/<Subject>/...
   */
  for (const boardName of boardsAtRoot) {
    const boardRoot = path.join(stageRoot, boardName);

    const subjectsUnderBoard = safeReadDir(boardRoot)
      .filter(isDir)
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));

    for (const subjectName of subjectsUnderBoard) {
      const subjectObj = ensureSubject(subjectName);
      const boardObj = upsertBoard(subjectObj, boardName);

      const subjectOnDisk = path.join(boardRoot, subjectName);

      // Detect tiers under /Board/Subject (foundation/higher folders)
      const tierDirs = safeReadDir(subjectOnDisk).filter(isDir).map((d) => d.name);

      const tierCandidates = tierDirs.filter((n) => {
        const low = String(n).toLowerCase();
        return low.includes("foundation") || low.includes("higher");
      });

      if (tierCandidates.length > 0) {
        for (const tierFolderName of tierCandidates) {
          const tierOnDisk = path.join(subjectOnDisk, tierFolderName);
          const tierUrl = `/content/${stage}/${encodeSeg(subjectName)}/${encodeSeg(boardName)}/${encodeSeg(tierFolderName)}/`;
          addTier(boardObj, tierFolderName, tierOnDisk, tierUrl);
        }
      } else {
        // No tiers: treat subject folder itself as a single tier "all"
        const tierUrl = `/content/${stage}/${encodeSeg(subjectName)}/${encodeSeg(boardName)}/`;
        addTier(boardObj, "all", subjectOnDisk, tierUrl);
      }
    }
  }

  /**
   * Case A: /gcse/<Subject>/<Board>/<Tier>/...
   * Scan top-level subject folders (excluding known boards)
   */
  const topLevelSubjects = rootDirs
    .filter((n) => !boardsAtRoot.some((b) => b.toLowerCase() === String(n).toLowerCase()))
    .filter((n) => !/^year\d+$/i.test(n)) // ignore any year folders if present
    .sort((a, b) => a.localeCompare(b));

  for (const subjectName of topLevelSubjects) {
    const subjectRoot = path.join(stageRoot, subjectName);
    if (!existsDir(subjectRoot)) continue;

    // Subject may directly contain boards
    const boardDirs = safeReadDir(subjectRoot).filter(isDir).map((d) => d.name);

    const likelyBoards = boardDirs.filter((n) =>
      knownBoards.some((b) => b.toLowerCase() === String(n).toLowerCase())
    );

    if (likelyBoards.length === 0) {
      // If it has /topics, we still include it as a single "all" under a fake board "general"
      const topicsPath = path.join(subjectRoot, "topics");
      if (existsDir(topicsPath)) {
        const subjectObj = ensureSubject(subjectName);
        const boardObj = upsertBoard(subjectObj, "general");
        addTier(boardObj, "all", subjectRoot, `/content/${stage}/${encodeSeg(subjectName)}/`);
      }
      continue;
    }

    for (const boardName of likelyBoards) {
      const subjectObj = ensureSubject(subjectName);
      const boardObj = upsertBoard(subjectObj, boardName);

      const boardOnDisk = path.join(subjectRoot, boardName);

      // tiers under /Subject/Board/
      const tierDirs = safeReadDir(boardOnDisk).filter(isDir).map((d) => d.name);

      const tierCandidates = tierDirs.filter((n) => {
        const low = String(n).toLowerCase();
        return low.includes("foundation") || low.includes("higher") || low.includes("tier");
      });

      if (tierCandidates.length > 0) {
        for (const tierFolderName of tierCandidates) {
          const tierOnDisk = path.join(boardOnDisk, tierFolderName);
          const tierUrl = `/content/${stage}/${encodeSeg(subjectName)}/${encodeSeg(boardName)}/${encodeSeg(tierFolderName)}/`;
          addTier(boardObj, tierFolderName, tierOnDisk, tierUrl);
        }
      } else {
        // No tiers: treat /Subject/Board as one "all"
        const tierUrl = `/content/${stage}/${encodeSeg(subjectName)}/${encodeSeg(boardName)}/`;
        addTier(boardObj, "all", boardOnDisk, tierUrl);
      }
    }
  }

  // Finalize as sorted array
  out.subjects = Array.from(subjectMap.values())
    .sort((a, b) => a.subject.localeCompare(b.subject))
    .map((s) => ({
      ...s,
      boards: s.boards
        .sort((a, b) => a.board.localeCompare(b.board))
        .map((b) => ({
          ...b,
          tiers: b.tiers.sort((x, y) => x.tier.localeCompare(y.tier)),
        })),
    }));

  return out;
}

/**
 * GET /api/ks3?stage=ks3|gcse|a-level
 */
router.get("/", (req, res) => {
  const stage = String(req.query.stage || "ks3").trim();

  const allowed = new Set(["ks3", "gcse", "a-level"]);
  if (!allowed.has(stage)) {
    return res.status(400).json({
      error: "Invalid stage",
      allowed: Array.from(allowed),
    });
  }

  const contentRoot = path.join(__dirname, "../../static-site/content");

  let tree;
  if (stage === "ks3") tree = buildKS3Tree(contentRoot);
  if (stage === "gcse") tree = buildGCSETree(contentRoot);
  if (stage === "a-level") tree = buildALevelTree(contentRoot);

  return res.json(tree);
});

module.exports = router;
