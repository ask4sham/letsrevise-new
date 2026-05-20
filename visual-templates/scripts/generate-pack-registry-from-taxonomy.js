#!/usr/bin/env node
/**
 * Build pack-registry.json from backend/config/*_topics.json
 * Run: node visual-templates/scripts/generate-pack-registry-from-taxonomy.js
 */
const fs = require("fs");
const path = require("path");

const CONFIG_DIR = path.join(__dirname, "../../backend/config");
const OUT_PATH = path.join(__dirname, "../registry/pack-registry.json");
const GEN_OUT_CANDIDATES = [
  path.join(__dirname, "../../../Users/ask4s/letsrevise-generator/lib/visualTemplates/registry/pack-registry.json"),
  path.join(__dirname, "../../../../Users/ask4s/letsrevise-generator/lib/visualTemplates/registry/pack-registry.json"),
];

/** Manual overrides — merged by packId after generation */
const MANUAL_PACKS = {
  "biology.photosynthesis.process.v1": {
    packId: "biology.photosynthesis.process.v1",
    legacyVisualPackKey: "photosynthesis",
    status: "active",
    packKind: "process-linear",
    specKeys: ["aqa-gcse-biology"],
    topicSlugs: ["photosynthesis", "photosynthetic-reaction", "rp-photosynthesis"],
    topicAliases: [
      "photosynthesis",
      "photosynthetic reaction",
      "photosynthetic-reaction",
      "bioenergetics photosynthesis",
      "aqa gcse biology photosynthesis",
      "aqa-gcse-biology:bioenergetics:photosynthesis",
      "aqa-gcse-biology:bioenergetics:photosynthesis:photosynthetic-reaction",
    ],
    templateId: "lr.process.linear.v1",
    publicBasePrefix: "/visuals/biology/aqa-gcse",
    publicPathSegment: "bioenergetics/photosynthesis/lr-process-linear-v1",
    urlFragment: "/bioenergetics/photosynthesis/lr-process-linear-v1/",
    eligibilityProfile: "photosynthesis-process-v1",
    overviewCaption: "Photosynthesis — overview",
    dataFile: "photosynthesis.process.json",
  },
};

const SPEC_META = {
  "aqa-gcse-biology": {
    shortPrefix: "biology",
    publicBasePrefix: "/visuals/biology/aqa-gcse",
    packKind: "process-linear",
    eligibilityProfile: "taxonomy-slug-only-v1",
  },
  "aqa-gcse-chemistry": {
    shortPrefix: "chemistry",
    publicBasePrefix: "/visuals/chemistry/aqa-gcse",
    packKind: "process-linear",
    eligibilityProfile: "taxonomy-slug-only-v1",
  },
  "aqa-gcse-physics": {
    shortPrefix: "physics",
    publicBasePrefix: "/visuals/physics/aqa-gcse",
    packKind: "process-linear",
    eligibilityProfile: "taxonomy-slug-only-v1",
  },
  "aqa-gcse-maths-foundation": {
    shortPrefix: "maths-foundation",
    publicBasePrefix: "/visuals/maths/aqa-gcse/foundation",
    packKind: "taxonomy-slot",
    eligibilityProfile: "non-process-v1",
  },
  "aqa-gcse-maths-higher": {
    shortPrefix: "maths-higher",
    publicBasePrefix: "/visuals/maths/aqa-gcse/higher",
    packKind: "taxonomy-slot",
    eligibilityProfile: "non-process-v1",
  },
  "aqa-l2-further-maths": {
    shortPrefix: "further-maths",
    publicBasePrefix: "/visuals/maths/aqa-l2-further",
    packKind: "taxonomy-slot",
    eligibilityProfile: "non-process-v1",
  },
  "aqa-gcse-english-language": {
    shortPrefix: "english-language",
    publicBasePrefix: "/visuals/english/aqa-gcse/language",
    packKind: "taxonomy-slot",
    eligibilityProfile: "non-process-v1",
  },
  "aqa-gcse-english-literature": {
    shortPrefix: "english-literature",
    publicBasePrefix: "/visuals/english/aqa-gcse/literature",
    packKind: "taxonomy-slot",
    eligibilityProfile: "non-process-v1",
  },
};

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function specKeyFromFilename(filePath) {
  const base = path.basename(filePath, ".json");
  return base.replace(/_topics$/, "").replace(/_/g, "-").toLowerCase();
}

function collectRows(filePath, data) {
  const specKey =
    (typeof data.specKey === "string" && data.specKey.trim()) ||
    specKeyFromFilename(filePath);
  const meta = SPEC_META[specKey];
  if (!meta) {
    console.warn(`No SPEC_META for ${specKey} — skipping ${filePath}`);
    return [];
  }

  const rows = [];
  for (const unit of data.units || []) {
    const unitSlug = slugify(unit.key || unit.unit);
    for (const t of unit.topics || []) {
      const topicSlug = typeof t.key === "string" ? t.key.trim() : "";
      const leafTitle = typeof t.topic === "string" ? t.topic.trim() : "";
      if (!topicSlug || !leafTitle) continue;

      const packId = `${meta.shortPrefix}.${topicSlug}.process.v1`;
      const publicPathSegment = `${unitSlug}/${topicSlug}/lr-process-linear-v1`;
      const urlFragment = `/${publicPathSegment}/`;

      rows.push({
        packId,
        legacyVisualPackKey: topicSlug,
        status: "planned",
        packKind: meta.packKind,
        specKeys: [specKey],
        topicSlugs: [topicSlug],
        topicAliases: [
          topicSlug,
          leafTitle.toLowerCase(),
          `${specKey}:${topicSlug}`,
          `${specKey}:${unitSlug}:${topicSlug}`,
        ],
        templateId: meta.packKind === "process-linear" ? "lr.process.linear.v1" : null,
        publicBasePrefix: meta.publicBasePrefix,
        publicPathSegment,
        urlFragment,
        eligibilityProfile: meta.eligibilityProfile,
        overviewCaption: `${leafTitle} — overview`,
        dataFile: null,
        _generated: true,
        _pathTitles: unit.unit ? `${unit.unit} > ${leafTitle}` : leafTitle,
      });
    }
  }
  return rows;
}

function main() {
  const files = fs
    .readdirSync(CONFIG_DIR)
    .filter((f) => f.endsWith("_topics.json"))
    .sort();

  const byPackId = new Map();

  for (const file of files) {
    const filePath = path.join(CONFIG_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    for (const row of collectRows(filePath, data)) {
      byPackId.set(row.packId, row);
    }
  }

  for (const [packId, manual] of Object.entries(MANUAL_PACKS)) {
    byPackId.set(packId, { ...byPackId.get(packId), ...manual });
  }

  const packs = Array.from(byPackId.values()).sort((a, b) =>
    a.packId.localeCompare(b.packId)
  );

  const doc = {
    version: 2,
    description:
      "Generated from backend/config/*_topics.json. Regenerate: node visual-templates/scripts/generate-pack-registry-from-taxonomy.js",
    generatedAt: new Date().toISOString(),
    packCount: packs.length,
    packs: packs.map(({ _generated, _pathTitles, ...p }) => p),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(doc, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUT_PATH} (${packs.length} packs)`);

  const active = packs.filter((p) => p.status === "active").length;
  const planned = packs.filter((p) => p.status === "planned").length;
  const bySpec = {};
  for (const p of packs) {
    const sk = p.specKeys[0];
    bySpec[sk] = (bySpec[sk] || 0) + 1;
  }
  console.log(`  active: ${active}, planned: ${planned}`);
  console.log("  per spec:", bySpec);

  for (const genOut of GEN_OUT_CANDIDATES) {
    if (fs.existsSync(path.dirname(genOut))) {
      fs.writeFileSync(genOut, JSON.stringify(doc, null, 2) + "\n", "utf8");
      console.log(`Synced generator copy: ${genOut}`);
      break;
    }
  }
}

main();
