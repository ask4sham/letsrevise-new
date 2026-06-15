/**
 * P2.1 — Diagram Asset Library service (prototype).
 * ChatGPT-first: teachers upload external diagrams; assets are referenced by lessons.
 */
const mongoose = require("mongoose");
const DiagramAsset = require("../models/DiagramAsset");

const ALLOWED_ACTIVITY_TYPES = new Set(["view", "hotspot", "dragdrop", "tti"]);

function safeStr(v, fallback = "") {
  const s = v === undefined || v === null ? "" : String(v);
  return s.trim() ? s.trim() : fallback;
}

function parseKeywords(raw) {
  if (Array.isArray(raw)) {
    return raw.map((k) => safeStr(k)).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,;]+/)
      .map((k) => k.trim())
      .filter(Boolean);
  }
  return [];
}

function parseActivityTypes(raw) {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : ["view"];
  const normalized = list.map((t) => safeStr(t).toLowerCase()).filter((t) => ALLOWED_ACTIVITY_TYPES.has(t));
  return normalized.length ? [...new Set(normalized)] : ["view"];
}

function toPublicAsset(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    title: o.title,
    subject: o.subject,
    topic: o.topic,
    examBoard: o.examBoard,
    tier: o.tier,
    keywords: o.keywords || [],
    imageUrl: o.imageUrl,
    originalImageUrl: o.originalImageUrl || null,
    mimeType: o.mimeType,
    storage: o.storage,
    activityTypes: o.activityTypes || ["view"],
    hotspots: o.hotspots || [],
    dragDropTargets: o.dragDropTargets || [],
    ttiGeometryVersion: o.ttiGeometryVersion || "tti-box-geometry-v1",
    source: o.source,
    isShared: Boolean(o.isShared),
    usageCount: o.usageCount || 0,
    metadata: o.metadata || {},
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

/**
 * @param {object} input
 * @param {string} ownerId
 */
async function createDiagramAsset(input, ownerId) {
  const title = safeStr(input.title);
  if (!title) throw Object.assign(new Error("title is required"), { statusCode: 422 });
  const imageUrl = safeStr(input.imageUrl);
  if (!imageUrl) throw Object.assign(new Error("imageUrl is required"), { statusCode: 422 });

  const doc = await DiagramAsset.create({
    title,
    subject: safeStr(input.subject, "Biology"),
    topic: safeStr(input.topic),
    examBoard: safeStr(input.examBoard, "AQA"),
    tier: safeStr(input.tier, "Higher"),
    keywords: parseKeywords(input.keywords),
    imageUrl,
    originalImageUrl: safeStr(input.originalImageUrl) || undefined,
    mimeType: safeStr(input.mimeType, "image/png"),
    storage: safeStr(input.storage, "supabase"),
    activityTypes: parseActivityTypes(input.activityTypes),
    hotspots: Array.isArray(input.hotspots) ? input.hotspots : [],
    dragDropTargets: Array.isArray(input.dragDropTargets) ? input.dragDropTargets : [],
    ttiGeometryVersion: safeStr(input.ttiGeometryVersion, "tti-box-geometry-v1"),
    source: safeStr(input.source, "upload") || "upload",
    ownerId,
    isShared: Boolean(input.isShared),
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  });

  return toPublicAsset(doc);
}

async function getDiagramAssetById(assetId, ownerId = null) {
  if (!mongoose.Types.ObjectId.isValid(assetId)) return null;
  const doc = await DiagramAsset.findById(assetId).lean();
  if (!doc) return null;
  if (ownerId && !doc.isShared && String(doc.ownerId) !== String(ownerId)) {
    return null;
  }
  return toPublicAsset(doc);
}

async function listDiagramAssets({ ownerId, subject, topic, limit = 50 } = {}) {
  const q = {};
  if (ownerId) {
    q.$or = [{ ownerId }, { isShared: true }];
  }
  if (subject) q.subject = new RegExp(safeStr(subject), "i");
  if (topic) q.topic = new RegExp(safeStr(topic), "i");

  const docs = await DiagramAsset.find(q)
    .sort({ updatedAt: -1 })
    .limit(Math.min(Number(limit) || 50, 100))
    .lean();

  return docs.map(toPublicAsset);
}

/**
 * Resolve diagramAssetId on lesson pages — merges canonical imageUrl from library.
 * Safe no-op when flag off or no references.
 */
async function hydrateDiagramAssetsOnPages(pages = []) {
  if (!Array.isArray(pages) || !pages.length) return pages;

  const assetIds = new Set();
  for (const page of pages) {
    for (const block of page.blocks || []) {
      if (block?.diagramAssetId && mongoose.Types.ObjectId.isValid(block.diagramAssetId)) {
        assetIds.add(String(block.diagramAssetId));
      }
    }
  }
  if (!assetIds.size) return pages;

  const assets = await DiagramAsset.find({ _id: { $in: [...assetIds] } }).lean();
  const byId = new Map(assets.map((a) => [String(a._id), a]));

  return pages.map((page) => ({
    ...page,
    blocks: (page.blocks || []).map((block) => {
      if (!block?.diagramAssetId) return block;
      const asset = byId.get(String(block.diagramAssetId));
      if (!asset) return block;
      return {
        ...block,
        imageUrl: asset.imageUrl,
        imageSource: block.imageSource || "diagram-asset",
        alt: block.alt || asset.title,
        _diagramAssetResolved: {
          title: asset.title,
          activityTypes: asset.activityTypes,
        },
      };
    }),
  }));
}

/**
 * Attach asset to a lesson diagram block (prototype).
 */
async function attachDiagramAssetToLessonBlock({
  lesson,
  pageIndex,
  blockIndex,
  assetId,
  ownerId,
}) {
  const asset = await getDiagramAssetById(assetId, ownerId);
  if (!asset) throw Object.assign(new Error("Diagram asset not found"), { statusCode: 404 });

  const pages = JSON.parse(JSON.stringify(lesson.pages || []));
  const page = pages[pageIndex];
  if (!page) throw Object.assign(new Error("Invalid pageIndex"), { statusCode: 400 });
  const block = page.blocks?.[blockIndex];
  if (!block) throw Object.assign(new Error("Invalid blockIndex"), { statusCode: 400 });
  if (String(block.type) !== "diagram") {
    throw Object.assign(new Error("Target block must be type diagram"), { statusCode: 400 });
  }

  block.diagramAssetId = asset.id;
  block.imageUrl = asset.imageUrl;
  block.imageSource = "diagram-asset";
  block.alt = block.alt || asset.title;
  if (!block.caption) block.caption = asset.title;

  await DiagramAsset.updateOne({ _id: asset.id }, { $inc: { usageCount: 1 } });

  return { pages, asset };
}

module.exports = {
  createDiagramAsset,
  getDiagramAssetById,
  listDiagramAssets,
  hydrateDiagramAssetsOnPages,
  attachDiagramAssetToLessonBlock,
  toPublicAsset,
  parseActivityTypes,
};
