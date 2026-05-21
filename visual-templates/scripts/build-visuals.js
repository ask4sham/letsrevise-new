#!/usr/bin/env node
/**
 * Build branded visual assets from template data + engines.
 * Usage: node visual-templates/scripts/build-visuals.js [--topic photosynthesis]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(ROOT, "..");

const {
  renderPhotosynthesisOverview,
  renderPhotosynthesisStep,
  buildOverviewHotspots,
  buildStepManifest,
} = require("../engines/process-diagram/photosynthesisEducationalDiagram");

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), "utf8"));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function normTopicArg(arg) {
  const a = String(arg || "photosynthesis").trim().toLowerCase();
  return a;
}

function findBinding(bindingsDoc, topicArg) {
  const hit = bindingsDoc.bindings.find((b) =>
    b.topicKeys.some((k) => {
      const kn = String(k).trim().toLowerCase();
      return kn === topicArg || kn.includes(topicArg) || topicArg.includes(kn);
    })
  );
  if (!hit) throw new Error(`No binding for topic: ${topicArg}`);
  return hit;
}

function mergeManifestFragments(manifestPath, fragments) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.items)) manifest.items = [];

  const existingKeys = new Set(manifest.items.map((i) => i.key));
  let added = 0;
  for (const item of fragments) {
    if (existingKeys.has(item.key)) continue;
    manifest.items.push(item);
    existingKeys.add(item.key);
    added++;
  }
  manifest.visualTemplatesVersion = manifest.visualTemplatesVersion || 1;
  manifest.lastTemplateBuild = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return added;
}

function buildPhotosynthesis(binding, brand) {
  const processData = readJson(`data/aqa-gcse-biology/${binding.dataFile}`);
  const publicSeg = binding.publicPathSegment;
  const publicBase = `/visuals/biology/aqa-gcse/${publicSeg}`;
  const publicDir = path.join(
    REPO_ROOT,
    "backend/public/visuals/biology/aqa-gcse",
    ...publicSeg.split("/")
  );
  const outputDir = path.join(ROOT, "output/aqa-gcse-biology/photosynthesis");
  const stepsDirPublic = path.join(publicDir, "steps");
  const stepsDirOut = path.join(outputDir, "steps");

  ensureDir(stepsDirPublic);
  ensureDir(stepsDirOut);

  const overviewSvg = renderPhotosynthesisOverview(brand, processData);
  writeFile(path.join(publicDir, "overview.svg"), overviewSvg);
  writeFile(path.join(outputDir, "overview.svg"), overviewSvg);

  for (const stage of processData.stages) {
    const svg = renderPhotosynthesisStep(brand, processData, stage.id);
    const filename = `${stage.slug}.svg`;
    writeFile(path.join(stepsDirPublic, filename), svg);
    writeFile(path.join(stepsDirOut, filename), svg);
  }

  const hotspots = buildOverviewHotspots(brand, processData);
  const meta = {
    ...buildStepManifest(processData, publicBase),
    hotspots,
    builtAt: new Date().toISOString(),
  };
  writeFile(path.join(publicDir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  writeFile(path.join(outputDir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");

  const fragments = [
    {
      key: "aqa-gcse-biology:bioenergetics:photosynthesis:lr-process-linear-overview",
      subject: "Biology",
      examBoard: "AQA",
      level: "GCSE",
      topic: "Bioenergetics",
      topicSlug: "bioenergetics",
      section: "Photosynthesis",
      sectionSlug: "photosynthesis",
      subtopic: "Photosynthesis process (template)",
      subtopicSlug: "lr-process-linear-overview",
      type: "process-template",
      templateId: processData.templateId,
      templateRole: "overview",
      url: `${publicBase}/overview.svg`,
    },
    ...processData.stages.map((s) => ({
      key: `aqa-gcse-biology:bioenergetics:photosynthesis:lr-process-linear-${s.id}`,
      subject: "Biology",
      examBoard: "AQA",
      level: "GCSE",
      topic: "Bioenergetics",
      topicSlug: "bioenergetics",
      section: "Photosynthesis",
      sectionSlug: "photosynthesis",
      subtopic: s.title,
      subtopicSlug: s.slug,
      type: "process-template",
      templateId: processData.templateId,
      templateRole: "step",
      stageNumber: s.number,
      url: `${publicBase}/steps/${s.slug}.svg`,
    })),
  ];

  writeFile(
    path.join(ROOT, "registry/manifest-fragments/photosynthesis-process-linear.json"),
    JSON.stringify({ items: fragments }, null, 2) + "\n"
  );

  const manifestPath = path.join(
    REPO_ROOT,
    "backend/public/visuals/biology/aqa-gcse/manifest.json"
  );
  const added = mergeManifestFragments(manifestPath, fragments);

  return {
    publicDir,
    outputDir,
    publicBase,
    meta,
    manifestItemsAdded: added,
  };
}

function main() {
  const topicArg = normTopicArg(process.argv[2] === "--topic" ? process.argv[3] : "photosynthesis");
  const brand = readJson("tokens/letsrevise-brand.json");
  const bindingsDoc = readJson("registry/aqa-gcse-biology.bindings.json");
  const binding = findBinding(bindingsDoc, topicArg);

  if (binding.dataFile !== "photosynthesis.process.json") {
    throw new Error(`Only photosynthesis.process.json is implemented in this PR (${binding.dataFile})`);
  }

  const result = buildPhotosynthesis(binding, brand);
  console.log("✅ Visual template build complete");
  console.log("   Public assets:", result.publicDir);
  console.log("   Output mirror:", result.outputDir);
  console.log("   Overview:", `${result.publicBase}/overview.svg`);
  console.log("   Steps:", result.meta.steps.map((s) => s.url).join(", "));
  console.log("   Manifest items added:", result.manifestItemsAdded);
}

main();
