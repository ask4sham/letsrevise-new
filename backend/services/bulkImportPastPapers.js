/**
 * PR-BULK-INGEST-4: Bulk import past papers — taxonomy specKey validation, per-owner dedupe, insert/update.
 */
const { assertValidSpecKey } = require("../utils/specTopicValidation");
const { pastPaperFingerprint } = require("../utils/pastPaperDedupe");
const PastPaper = require("../models/PastPaper");

async function bulkImportPastPapers({ specKey, items, dryRun = false, actorId = null }) {
  if (!specKey || typeof specKey !== "string") throw new Error("specKey is required");
  assertValidSpecKey(specKey);

  if (!Array.isArray(items) || items.length === 0) throw new Error("items must be a non-empty array");

  const report = {
    specKey,
    dryRun,
    total: items.length,
    valid: 0,
    invalid: 0,
    inserted: 0,
    updated: 0,
    skippedDuplicates: 0,
    errors: [],
    preview: [],
  };

  const prepared = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    try {
      if (!it || typeof it !== "object") throw new Error("item must be an object");
      if (!it.examBoard) throw new Error("examBoard is required");
      if (!it.level) throw new Error("level is required");
      if (!it.year) throw new Error("year is required");
      if (!it.paperCode) throw new Error("paperCode is required");

      const fingerprint = pastPaperFingerprint({
        specKey,
        examBoard: it.examBoard,
        level: it.level,
        year: it.year,
        series: it.series,
        paperCode: it.paperCode,
        tier: it.tier,
      });

      prepared.push({ index: i, raw: it, fingerprint });
      report.valid++;
    } catch (e) {
      report.invalid++;
      report.errors.push({ index: i, code: e.code || "INVALID_ITEM", message: e.message });
    }
  }

  if (prepared.length === 0) return report;

  const fps = prepared.map((p) => p.fingerprint);
  const existing = await PastPaper.find(
    { ownerId: actorId, fingerprint: { $in: fps } },
    { _id: 1, fingerprint: 1 }
  ).lean();
  const map = new Map(existing.map((d) => [d.fingerprint, d._id]));

  const toInsert = [];
  const toUpdate = [];

  for (const p of prepared) {
    const existingId = map.get(p.fingerprint);
    const doc = {
      ownerId: actorId || null,
      specKey,
      subject: p.raw.subject || null,
      examBoard: p.raw.examBoard,
      level: p.raw.level,
      year: String(p.raw.year),
      series: p.raw.series || null,
      paperCode: p.raw.paperCode,
      tier: p.raw.tier || null,
      title: p.raw.title || null,
      notes: p.raw.notes || null,
      pdf: {
        mediaId: p.raw.pdf?.mediaId || null,
        url: p.raw.pdf?.url || null,
        mimeType: p.raw.pdf?.mimeType || "application/pdf",
      },
      fingerprint: p.fingerprint,
    };

    if (!existingId) {
      toInsert.push(doc);
      if (report.preview.length < 25)
        report.preview.push({ index: p.index, action: dryRun ? "would_insert" : "insert" });
    } else {
      toUpdate.push({ _id: existingId, doc });
      if (report.preview.length < 25)
        report.preview.push({ index: p.index, action: dryRun ? "would_update" : "update" });
    }
  }

  if (dryRun) {
    report.inserted = toInsert.length;
    report.updated = toUpdate.length;
    return report;
  }

  if (!actorId) throw new Error("actorId is required for non-dryRun imports");

  if (toInsert.length) {
    await PastPaper.insertMany(toInsert, { ordered: false });
    report.inserted = toInsert.length;
  }

  for (const u of toUpdate) {
    await PastPaper.updateOne({ _id: u._id, ownerId: actorId }, { $set: u.doc });
  }
  report.updated = toUpdate.length;

  return report;
}

module.exports = { bulkImportPastPapers };
