/**
 * Teacher-first export pipeline regression tests.
 * Runs the generator repo integration test (export order, summary, keywords).
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const generatorRoot = path.join(__dirname, "../../letsrevise-generator");
const generatorTest = path.join(generatorRoot, "lib/teacherFirstExportPipeline.test.js");
const scopeTest = path.join(generatorRoot, "lib/scopeAuthorityLite.test.js");
const polishTest = path.join(generatorRoot, "lib/presentationPolishExport.test.js");

const exchangePath = path.join(
  __dirname,
  "../frontend/src/constants/lessonGeneratorExchange.v1.ts"
);

describe("Teacher-first export pipeline", () => {
  test("generator export pipeline test passes (sibling repo)", () => {
    if (!fs.existsSync(generatorTest)) {
      console.warn("Generator repo not available — skipping export pipeline integration");
      return;
    }
    const out = execSync(`node "${generatorTest}"`, {
      cwd: generatorRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
    expect(out).toMatch(/all passed/);
  });

  test("presentation polish export test passes (Q5 formatting, self-check explanation dedupe)", () => {
    if (!fs.existsSync(polishTest)) {
      console.warn("Generator presentation polish test not available — skipping");
      return;
    }
    const out = execSync(`node "${polishTest}"`, {
      cwd: generatorRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
    expect(out).toMatch(/all passed/);
  });

  test("scope authority lite test passes (objectives, summary, exam technique, worked example)", () => {
    if (!fs.existsSync(scopeTest)) {
      console.warn("Generator scope test not available — skipping");
      return;
    }
    const out = execSync(`node "${scopeTest}"`, {
      cwd: generatorRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
    expect(out).toMatch(/all passed/);
  });

  test("editor exchange map includes teacher-first block kinds", () => {
    const src = fs.readFileSync(exchangePath, "utf8");
    expect(src).toMatch(/definition:\s*\{\s*editorType:\s*"text",\s*role:\s*"definition"/);
    expect(src).toMatch(/"core-model":\s*\{\s*editorType:\s*"keyIdeas",\s*role:\s*"coreModel"/);
    expect(src).toMatch(/"key-examples":\s*\{\s*editorType:\s*"text",\s*role:\s*"keyExamples"/);
    expect(src).toMatch(/"exam-vocabulary":\s*\{\s*editorType:\s*"text",\s*role:\s*"examVocabulary"/);
    expect(src).toMatch(/role:\s*"whyItMatters"/);
  });
});
