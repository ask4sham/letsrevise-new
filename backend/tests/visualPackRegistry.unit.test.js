/**
 * Cross-subject visual pack registry
 * Run: node backend/tests/visualPackRegistry.unit.test.js
 */

const assert = require("assert");
const {
  resolvePackFromTaxonomy,
  resolveVisualPackFromLessonMeta,
  listPacks,
  getPackRegistry,
} = require("../../visual-templates/lib/visualPackRegistry");

const registry = getPackRegistry();
assert.ok(registry.packCount >= 900, `expected 900+ packs, got ${registry.packCount}`);
assert.equal(registry.packs.filter((p) => p.status === "active").length, 1);

const bySpec = {};
for (const p of listPacks()) {
  const sk = p.specKeys[0];
  bySpec[sk] = (bySpec[sk] || 0) + 1;
}
assert.equal(bySpec["aqa-gcse-biology"], 107);
assert.equal(bySpec["aqa-gcse-chemistry"], 32);
assert.equal(bySpec["aqa-gcse-physics"], 198);
assert.ok(bySpec["aqa-gcse-english-language"] >= 70);
assert.ok(bySpec["aqa-gcse-maths-higher"] >= 200);

const photoTax = resolvePackFromTaxonomy("aqa-gcse-biology", "photosynthesis");
assert.equal(photoTax.packId, "biology.photosynthesis.process.v1");

const electrolysisTax = resolvePackFromTaxonomy("aqa-gcse-chemistry", "electrolysis");
assert.equal(electrolysisTax.packId, "chemistry.electrolysis.process.v1");
assert.equal(electrolysisTax.status, "planned");

const glucose = resolveVisualPackFromLessonMeta({
  title: "Uses of Glucose from Photosynthesis (AQA GCSE Biology)",
  specKey: "aqa-gcse-biology",
  topicSlug: "photosynthesis",
});
assert.equal(glucose.packId, null, "glucose subtopic excluded");

const chemElectro = resolveVisualPackFromLessonMeta({
  title: "Electrolysis",
  specKey: "aqa-gcse-chemistry",
  topicSlug: "electrolysis",
});
assert.equal(chemElectro.packId, null, "planned packs do not inject");

const englishPack = resolvePackFromTaxonomy(
  "aqa-gcse-english-language",
  "paper-1-overview"
);
assert.equal(englishPack.packKind, "taxonomy-slot");
assert.equal(englishPack.templateId, null);

console.log("visualPackRegistry.unit.test.js: all passed");
