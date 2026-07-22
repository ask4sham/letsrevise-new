/**
 * Regression: green Continue learning footer removed; fresh practice lives in PracticeSection.
 * @jest-environment node
 */
import * as fs from "fs";
import * as path from "path";

const lessonViewPath = path.join(__dirname, "..", "LessonViewPage.tsx");
const continueExitPath = path.join(
  __dirname,
  "..",
  "..",
  "components",
  "lesson",
  "ContinueLearningExit.tsx"
);

describe("Continue learning footer removal", () => {
  const src = fs.readFileSync(lessonViewPath, "utf8");

  test("ContinueLearningExit component file is deleted", () => {
    expect(fs.existsSync(continueExitPath)).toBe(false);
  });

  test("LessonViewPage does not render Continue learning footer card", () => {
    expect(src).not.toMatch(/ContinueLearningExit/);
    expect(src).not.toMatch(/Continue learning/);
    expect(src).not.toMatch(/Review your practice/);
    // Footer card used a dedicated green exit panel; do not reintroduce it.
    expect(src).not.toMatch(/Based on this lesson's dedicated practice/);
  });

  test("StudyPlanPanel remains absent from lesson page", () => {
    expect(src).not.toMatch(/StudyPlanPanel/);
  });

  test("fresh-practice CTA is gated on dedicated practice completion", () => {
    expect(src).toMatch(/TryFreshPracticeCta/);
    expect(src).toMatch(/enableFreshPractice/);
    expect(src).toMatch(/practiceState === "completed"/);
    expect(src).toMatch(/showFreshPracticeCta/);
  });
});
