/**
 * One-off repair: find lessons whose topicKey slug is not valid (static + admin registry),
 * optionally map known bad slugs to canonical topics.
 *
 * Usage:
 *   DRY_RUN=1 node scripts/repairInvalidLessonTopicKeys.js
 *   node scripts/repairInvalidLessonTopicKeys.js
 *
 * Requires MONGODB_URI. Does not create custom taxonomy rows — only fixes lessons.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const Lesson = require("../models/Lesson");
const { refreshSpecTopicRegistryCache, isValidTopicSlugForSpec } = require("../utils/specTopicRegistry");
const { parseTopicKey, buildTopicKey, DEFAULT_SPEC_LEGACY } = require("../utils/topicKey");
const { assertValidNamespacedTopicKey } = require("../utils/specTopicValidation");

/** Known bad slug → canonical namespaced topicKey (least disruptive: point to official topic). */
const KNOWN_SLUG_FIXES = {
  stomach: "aqa-gcse-biology:digestive-system",
};

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

async function main() {
  await connectDB();
  await refreshSpecTopicRegistryCache();

  const lessons = await Lesson.find({
    $or: [{ topicKey: { $exists: true, $ne: null, $ne: "" } }, { topic: { $exists: true } }],
  })
    .select("_id topic topicKey specKey")
    .lean();

  const rows = [];
  for (const l of lessons) {
    const raw = (l.topicKey && String(l.topicKey).trim()) || "";
    const specKey =
      (l.specKey && String(l.specKey).trim()) || parseTopicKey(raw).specKey || DEFAULT_SPEC_LEGACY;
    const slug = raw.includes(":") ? parseTopicKey(raw).topicKey : raw.trim().toLowerCase();
    if (!slug) continue;
    let valid = false;
    try {
      assertValidNamespacedTopicKey(specKey, raw.includes(":") ? raw : buildTopicKey(specKey, slug));
      valid = true;
    } catch (_) {
      valid = isValidTopicSlugForSpec(specKey, slug);
    }
    if (valid) continue;

    const fixNs = KNOWN_SLUG_FIXES[slug] || null;
    rows.push({ id: String(l._id), oldTopicKey: raw || "(empty)", specKey, slug, fixNs });
  }

  console.log(`Found ${rows.length} lesson(s) with invalid topicKey (approx).`);
  for (const r of rows) {
    console.log(JSON.stringify(r));
    if (!DRY_RUN && r.fixNs) {
      const spec = parseTopicKey(r.fixNs).specKey || r.specKey;
      await Lesson.updateOne(
        { _id: r.id },
        { $set: { topicKey: r.fixNs, specKey: spec } }
      );
      console.log(`  → updated ${r.id} to ${r.fixNs}`);
    }
  }
  if (DRY_RUN) {
    console.log("DRY_RUN: no writes performed.");
  }
  await mongoose.disconnect().catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
