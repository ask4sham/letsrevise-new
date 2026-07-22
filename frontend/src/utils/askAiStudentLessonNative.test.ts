import {
  ASK_SHAM_HEADING,
  ASK_SHAM_SUBCOPY,
  buildLessonNativeStarterChips,
  buildStudentTutorHeading,
  buildStudentTutorPlaceholder,
  buildStudentTutorSubcopy,
} from "./askAiStudentLessonNative";

describe("askAiStudentLessonNative", () => {
  test("heading is always Ask Sham", () => {
    expect(buildStudentTutorHeading("Learn", "Gametes and Fertilisation")).toBe(ASK_SHAM_HEADING);
    expect(buildStudentTutorHeading("", "Gametes and Fertilisation")).toBe("Ask Sham");
    expect(buildStudentTutorHeading()).toBe("Ask Sham");
  });

  test("subcopy is fixed Ask Sham AI-tutor line (no lesson/page repetition)", () => {
    const copy = buildStudentTutorSubcopy("Practise", "Gametes and Fertilisation");
    expect(copy).toBe(ASK_SHAM_SUBCOPY);
    expect(copy).not.toContain("Gametes and Fertilisation");
    expect(copy).not.toContain("Practise");
    expect(copy).not.toMatch(/thread|latest exchange/i);
    expect(copy).toMatch(/AI tutor/i);
  });

  test("placeholder includes truncated title", () => {
    expect(buildStudentTutorPlaceholder("Learn", "Gametes and Fertilisation")).toContain("Learn");
    expect(buildStudentTutorPlaceholder()).toMatch(/What do I need to know/);
  });

  test("starter chips include page/lesson titles in prompts only", () => {
    const chips = buildLessonNativeStarterChips("Learn", "Gametes and Fertilisation");
    expect(chips).toHaveLength(2);
    expect(chips[0].label).toBe("Explain this page");
    expect(chips[0].prompt).toContain('"Learn"');
    expect(chips[1].prompt).toContain('"Gametes and Fertilisation"');
  });

  test("no chips when titles missing", () => {
    expect(buildLessonNativeStarterChips()).toEqual([]);
  });
});
