/**
 * Regression: green Continue learning footer removed; fresh practice gated by Revision practice.
 * @jest-environment node
 */
import * as fs from "fs";
import * as path from "path";

const lessonViewPath = path.join(__dirname, "..", "LessonViewPage.tsx");
const practiceSectionSrc = fs.readFileSync(lessonViewPath, "utf8");
const retrievalPath = path.join(
  __dirname,
  "..",
  "..",
  "components",
  "lesson",
  "student",
  "StudentRetrievalSection.tsx"
);

describe("Continue learning footer removal + revision gate", () => {
  const src = practiceSectionSrc;
  const retrieval = fs.readFileSync(retrievalPath, "utf8");

  test("ContinueLearningExit remains deleted and footer absent", () => {
    const continueExitPath = path.join(
      __dirname,
      "..",
      "..",
      "components",
      "lesson",
      "ContinueLearningExit.tsx"
    );
    expect(fs.existsSync(continueExitPath)).toBe(false);
    expect(src).not.toMatch(/ContinueLearningExit/);
    expect(src).not.toMatch(/Continue learning/);
    expect(src).not.toMatch(/Review your practice/);
  });

  test("StudyPlanPanel remains absent from lesson page", () => {
    expect(src).not.toMatch(/StudyPlanPanel/);
  });

  test("fresh-practice CTA is not gated on PracticeSection completion", () => {
    // PracticeSection call sites should not pass enableFreshPractice
    const practiceBlocks = src.split("<PracticeSection");
    for (let i = 1; i < practiceBlocks.length; i++) {
      const block = practiceBlocks[i].slice(0, 600);
      expect(block).not.toMatch(/enableFreshPractice/);
      expect(block).not.toMatch(/TryFreshPracticeCta/);
    }
  });

  test("fresh-practice CTA is wired through Revision practice section", () => {
    expect(src).toMatch(/StudentRetrievalSection/);
    expect(src).toMatch(/enableFreshPractice=\{isStudent\}/);
    expect(retrieval).toMatch(/TryFreshPracticeCta/);
    expect(retrieval).toMatch(/onQuizComplete/);
    expect(retrieval).toMatch(/quizComplete/);
  });
});
