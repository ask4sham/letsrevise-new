/**
 * Central catalogue availability — public approved tree + per-user admin-grant overlay.
 *
 * Public layer: published + teacherLibrary.status === "approved" only.
 * Overlay: LessonUnlock with source === "admin" (never mutates public nodes).
 */
const Lesson = require("../models/Lesson");
const LessonUnlock = require("../models/LessonUnlock");
const User = require("../models/User");
const {
  isApprovedCatalogueLesson,
  buildApprovedLessonsQuery,
} = require("./approvedLessonsService");
const { getSpecMetadata, resolveSpecIdentity, normalizeLevelLabel } = require("../config/specRegistry");
const { getTaxonomyBySpecKey } = require("../utils/topicTaxonomy");
const { parseTopicKey } = require("../utils/topicKey");

const SPEC_KEYS = [
  "aqa-gcse-biology",
  "aqa-gcse-chemistry",
  "aqa-gcse-physics",
  "aqa-gcse-maths-foundation",
  "aqa-gcse-maths-higher",
  "aqa-l2-further-maths",
  "aqa-gcse-english-literature",
  "aqa-gcse-english-language",
  "edexcel-igcse-biology",
];

const PUBLIC_STATUS = {
  AVAILABLE: "available",
  COMING_SOON: "coming_soon",
};

const VISIBILITY_REASON = {
  PUBLIC_CATALOGUE: "public_catalogue",
  ADMIN_GRANT: "admin_grant",
};

const USER_ACCESS = {
  NONE: "none",
  PREVIEW: "preview",
  ENTITLED: "entitled",
};

function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function normalizeForCompare(s) {
  return safeStr(s).toLowerCase();
}

/**
 * Profile stage key from User.stageKey or yearGroup derivation mirror.
 */
function normalizeProfileStage(stageKey, yearGroup) {
  const fromKey = normalizeForCompare(stageKey);
  if (fromKey.includes("ks3")) return "ks3";
  if (fromKey.includes("gcse")) return "gcse";
  if (fromKey.includes("a-level") || fromKey.includes("alevel") || fromKey.includes("a level")) {
    return "a-level";
  }
  const n = Number(yearGroup);
  if (Number.isFinite(n)) {
    if (n >= 7 && n <= 9) return "ks3";
    if (n >= 10 && n <= 11) return "gcse";
    if (n >= 12 && n <= 13) return "a-level";
  }
  return fromKey || "";
}

/**
 * Group IGCSE under GCSE for public tree level nodes (matches student stage gating).
 */
function stageKeyFromLevelLabel(levelLabel) {
  const l = normalizeForCompare(levelLabel);
  if (!l) return "";
  if (l.includes("ks3")) return "ks3";
  if (l.includes("a-level") || l.includes("alevel") || l.includes("a level")) return "a-level";
  if (l.includes("gcse") || l.includes("igcse")) return "gcse";
  return l;
}

function stageDisplayLabel(stageKey) {
  if (stageKey === "ks3") return "KS3";
  if (stageKey === "gcse") return "GCSE";
  if (stageKey === "a-level") return "A-Level";
  return stageKey || "";
}

function courseLabelForSpec(specKey, meta) {
  if (!meta) return specKey;
  const parts = [meta.board, meta.level, meta.subject].filter(Boolean);
  const base = parts.join(" ");
  return meta.examCode ? `${base} (${meta.examCode})` : base;
}

function collectTaxonomyTopics(taxonomy, specKey) {
  const topics = [];
  for (const unit of taxonomy?.units || []) {
    for (const t of unit.topics || []) {
      const slug = safeStr(t.key);
      const title = safeStr(t.topic) || slug;
      if (!slug && !title) continue;
      topics.push({
        topicSlug: slug || normalizeForCompare(title).replace(/\s+/g, "-"),
        topicLabel: title,
        topicKey: t.topicKey || (slug ? `${specKey}:${slug}` : ""),
      });
    }
    for (const sec of unit.sections || []) {
      for (const t of sec.topics || []) {
        const slug = safeStr(t.key);
        const title = safeStr(t.topic) || slug;
        if (!slug && !title) continue;
        topics.push({
          topicSlug: slug || normalizeForCompare(title).replace(/\s+/g, "-"),
          topicLabel: title,
          topicKey: t.topicKey || (slug ? `${specKey}:${slug}` : ""),
        });
      }
    }
  }
  return topics;
}

/**
 * Build canonical curriculum skeleton (all nodes start coming_soon).
 */
function buildCatalogueSkeleton() {
  const levelMap = new Map();

  for (const specKey of SPEC_KEYS) {
    const meta = getSpecMetadata(specKey);
    const taxonomy = getTaxonomyBySpecKey(specKey);
    if (!meta && !taxonomy) continue;

    const subject = safeStr(meta?.subject || taxonomy?.subject) || "Unknown";
    const levelLabel = normalizeLevelLabel(meta?.level || taxonomy?.level || "");
    const stageKey = stageKeyFromLevelLabel(levelLabel);
    if (!stageKey) continue;

    if (!levelMap.has(stageKey)) {
      levelMap.set(stageKey, {
        id: `level:${stageKey}`,
        kind: "level",
        label: stageDisplayLabel(stageKey),
        stageKey,
        publicStatus: PUBLIC_STATUS.COMING_SOON,
        children: new Map(),
      });
    }
    const levelNode = levelMap.get(stageKey);

    const subjectKey = normalizeForCompare(subject);
    if (!levelNode.children.has(subjectKey)) {
      levelNode.children.set(subjectKey, {
        id: `${levelNode.id}:subject:${subjectKey}`,
        kind: "subject",
        label: subject,
        subject,
        publicStatus: PUBLIC_STATUS.COMING_SOON,
        children: new Map(),
      });
    }
    const subjectNode = levelNode.children.get(subjectKey);

    if (!subjectNode.children.has(specKey)) {
      subjectNode.children.set(specKey, {
        id: `${subjectNode.id}:course:${specKey}`,
        kind: "course",
        label: courseLabelForSpec(specKey, meta),
        specKey,
        examCode: meta?.examCode || null,
        publicStatus: PUBLIC_STATUS.COMING_SOON,
        children: new Map(),
      });
    }
    const courseNode = subjectNode.children.get(specKey);

    const topics = collectTaxonomyTopics(taxonomy, specKey);
    for (const t of topics) {
      const topicId = `${courseNode.id}:topic:${t.topicSlug}`;
      if (!courseNode.children.has(t.topicSlug)) {
        courseNode.children.set(t.topicSlug, {
          id: topicId,
          kind: "topic",
          label: t.topicLabel,
          topicSlug: t.topicSlug,
          topicKey: t.topicKey,
          publicStatus: PUBLIC_STATUS.COMING_SOON,
        });
      }
    }
  }

  return levelMap;
}

function mapToChildrenArray(nodeMap) {
  return Array.from(nodeMap.values()).map((node) => {
    if (node.children instanceof Map) {
      const { children, ...rest } = node;
      return { ...rest, children: mapToChildrenArray(children) };
    }
    return node;
  });
}

function resolveLessonSpecKey(lesson) {
  const identity = resolveSpecIdentity({
    specKey: lesson.specKey,
    board: lesson.board,
    subject: lesson.subject,
    level: lesson.level,
    topicKey: lesson.topicKey,
    title: lesson.title,
    topic: lesson.topic,
    subTopic: lesson.subTopic,
  });
  return identity.specKey || null;
}

function resolveLessonTopicSlug(lesson, specKey) {
  const parsed = parseTopicKey(safeStr(lesson.topicKey));
  if (parsed.topicKey) return parsed.topicKey.toLowerCase();
  if (parsed.isNamespaced && parsed.specKey === specKey && parsed.topicKey) {
    return parsed.topicKey.toLowerCase();
  }
  const topic = normalizeForCompare(lesson.topic);
  if (!topic) return "";
  return topic.replace(/\s+/g, "-");
}

function findTopicNode(courseNode, lesson, specKey) {
  if (!courseNode?.children) return null;
  const slug = resolveLessonTopicSlug(lesson, specKey);
  if (slug && courseNode.children.has(slug)) {
    return courseNode.children.get(slug);
  }
  const lessonTopic = normalizeForCompare(lesson.topic);
  for (const [, topicNode] of courseNode.children) {
    if (normalizeForCompare(topicNode.label) === lessonTopic) {
      return topicNode;
    }
  }
  return null;
}

function markNodeAvailable(node) {
  if (!node) return;
  node.publicStatus = PUBLIC_STATUS.AVAILABLE;
}

function bubbleAvailability(node) {
  if (!node?.children) {
    return node?.publicStatus === PUBLIC_STATUS.AVAILABLE;
  }
  let anyAvailable = node.publicStatus === PUBLIC_STATUS.AVAILABLE;
  if (node.children instanceof Map) {
    for (const [, child] of node.children) {
      if (bubbleAvailability(child)) {
        anyAvailable = true;
      }
    }
  } else if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (bubbleAvailability(child)) {
        anyAvailable = true;
      }
    }
  }
  if (anyAvailable) {
    node.publicStatus = PUBLIC_STATUS.AVAILABLE;
  }
  return anyAvailable;
}

/**
 * Apply approved public lessons to skeleton. Admin grants must not call this.
 */
function applyPublicLessonActivations(levelMap, lessons) {
  for (const lesson of lessons || []) {
    if (!isApprovedCatalogueLesson(lesson)) continue;

    const specKey = resolveLessonSpecKey(lesson);
    if (!specKey) continue;

    const meta = getSpecMetadata(specKey);
    const stageKey = stageKeyFromLevelLabel(
      normalizeLevelLabel(meta?.level || lesson.level || "")
    );
    if (!stageKey || !levelMap.has(stageKey)) continue;

    const subject = safeStr(meta?.subject || lesson.subject);
    const subjectKey = normalizeForCompare(subject);
    const levelNode = levelMap.get(stageKey);
    const subjectNode = levelNode.children.get(subjectKey);
    if (!subjectNode) continue;

    const courseNode = subjectNode.children.get(specKey);
    if (!courseNode) continue;

    const topicNode = findTopicNode(courseNode, lesson, specKey);
    if (topicNode) {
      markNodeAvailable(topicNode);
    }
  }

  for (const [, levelNode] of levelMap) {
    bubbleAvailability(levelNode);
  }
}

function buildPublicCatalogueTree(approvedLessons) {
  const levelMap = buildCatalogueSkeleton();
  applyPublicLessonActivations(levelMap, approvedLessons);
  const stageOrder = ["ks3", "gcse", "a-level"];
  const levels = stageOrder
    .filter((k) => levelMap.has(k))
    .map((k) => {
      const node = levelMap.get(k);
      return {
        ...node,
        children: mapToChildrenArray(node.children),
      };
    });
  return { levels };
}

function lessonStageKey(lesson) {
  const fromLessonLevel = stageKeyFromLevelLabel(normalizeLevelLabel(lesson.level || ""));
  if (fromLessonLevel) return fromLessonLevel;

  const specKey = resolveLessonSpecKey(lesson);
  const meta = specKey ? getSpecMetadata(specKey) : null;
  return stageKeyFromLevelLabel(normalizeLevelLabel(meta?.level || ""));
}

/**
 * Admin-grant overlay only (source === "admin"). Never mutates publicTree.
 */
function buildAdminGrantOverlay(grantedLessons, profileStage) {
  const items = [];
  for (const lesson of grantedLessons || []) {
    if (lesson.isTemplate === true) continue;

    const status = String(lesson.status || (lesson.isPublished ? "published" : "draft")).toLowerCase();
    if (status !== "published" || !lesson.isPublished) continue;

    const specKey = resolveLessonSpecKey(lesson);
    const lessonStage = lessonStageKey(lesson);
    const stageMismatch = Boolean(
      profileStage && lessonStage && profileStage !== lessonStage
    );

    items.push({
      lessonId: String(lesson._id || lesson.id),
      title: lesson.title || "Untitled",
      subject: lesson.subject || "",
      level: normalizeLevelLabel(lesson.level || ""),
      board: lesson.board || "",
      topic: lesson.topic || "",
      specKey: specKey || null,
      topicKey: lesson.topicKey || null,
      publicStatus: PUBLIC_STATUS.COMING_SOON,
      userAccess: USER_ACCESS.ENTITLED,
      visibilityReason: VISIBILITY_REASON.ADMIN_GRANT,
      stageMismatch,
    });
  }
  return items;
}

async function loadApprovedCatalogueLessons() {
  return Lesson.find(buildApprovedLessonsQuery())
    .select(
      "_id title subject level board tier topic topicKey specKey status isPublished teacherLibrary"
    )
    .lean();
}

async function loadAdminGrantedLessons(userId) {
  const unlocks = await LessonUnlock.find({ userId, source: "admin" })
    .select("lessonId source")
    .lean();
  if (!unlocks.length) return [];

  const lessonIds = unlocks.map((u) => u.lessonId).filter(Boolean);
  return Lesson.find({
    _id: { $in: lessonIds },
    status: "published",
    isPublished: true,
    isTemplate: { $ne: true },
  })
    .select(
      "_id title subject level board tier topic topicKey specKey status isPublished isTemplate teacherLibrary"
    )
    .lean();
}

async function getCatalogueAvailabilityForUser(userId) {
  const user = await User.findById(userId).select("stageKey yearGroup").lean();
  const profileStage = normalizeProfileStage(user?.stageKey, user?.yearGroup);

  const [approvedLessons, grantedLessons] = await Promise.all([
    loadApprovedCatalogueLessons(),
    loadAdminGrantedLessons(userId),
  ]);

  const publicTree = buildPublicCatalogueTree(approvedLessons);
  const grantedToYou = buildAdminGrantOverlay(grantedLessons, profileStage);

  return {
    ok: true,
    profileStage,
    publicTree,
    grantedToYou,
    generatedAt: new Date().toISOString(),
  };
}

/** Public browse/explore — approved catalogue tree only (no auth, no grants). */
async function getPublicCatalogueAvailability() {
  const approvedLessons = await loadApprovedCatalogueLessons();
  const publicTree = buildPublicCatalogueTree(approvedLessons);
  return {
    ok: true,
    publicTree,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  PUBLIC_STATUS,
  VISIBILITY_REASON,
  USER_ACCESS,
  normalizeProfileStage,
  stageKeyFromLevelLabel,
  buildCatalogueSkeleton,
  buildPublicCatalogueTree,
  applyPublicLessonActivations,
  buildAdminGrantOverlay,
  getCatalogueAvailabilityForUser,
  getPublicCatalogueAvailability,
  resolveLessonSpecKey,
  isApprovedCatalogueLesson,
};
