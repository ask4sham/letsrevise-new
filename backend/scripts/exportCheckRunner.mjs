/**
 * Reads lesson JSON from argv[2], runs generator export, prints structure JSON to stdout.
 */
import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node exportCheckRunner.mjs <input.json>");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const generatorRoot = path.resolve(__dirname, "..", "..", "..", "letsrevise-generator");
const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const { buildGeneratorExportPayload } = await import(
  pathToFileURL(path.join(generatorRoot, "lib/buildGeneratorExportJson.js")).href
);

process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";

const doc = buildGeneratorExportPayload({
  ...input,
  title: input.title || input.topic,
});
const blocks = (doc.pages || []).flatMap((p) => p.blocks || []);
const titles = blocks.map((b) => String(b.headingTitle || b.title || "").toUpperCase());

const out = {
  definitionIndex: titles.indexOf("DEFINITION"),
  scenarioIndex: titles.indexOf("SCENARIO"),
  hasKeywords: titles.some((t) => t.includes("KEY WORDS")),
  hasSummary: titles.some((t) => t === "SUMMARY" || t.includes("SUMMARY")),
  hasSelfCheck: titles.some((t) => t.includes("SELF-CHECK")),
  hasWorkedExample: titles.some((t) => t.includes("WORKED")),
  hasExamTechnique: titles.some((t) => t.includes("EXAM TECHNIQUE") || t.includes("EXAM TIP")),
  hasExamPractice: titles.some((t) => t.includes("EXAM PRACTICE")),
  blockCount: blocks.length,
  firstTenTitles: titles.slice(0, 10),
  allTitles: titles,
  selfCheckKinds: blocks
    .filter((b) => String(b.generatorBlockKind || "").includes("self-check"))
    .map((b) => String(b.headingTitle || b.title || "")),
};

console.log(JSON.stringify(out));
