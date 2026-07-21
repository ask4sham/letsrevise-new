import {
  buildLessonNativeStarterChips,
  buildStudentTutorHeading,
  buildStudentTutorPlaceholder,
  buildStudentTutorSubcopy,
} from "./askAiStudentLessonNative";

describe("askAiStudentLessonNative", () => {
  test("prefers page title in heading, then lesson, then generic", () => {
    expect(buildStudentTutorHeading("Learn", "Gametes and Fertilisation")).toBe(
      "Ask about Learn"
    );
    expect(buildStudentTutorHeading("", "Gametes and Fertilisation")).toBe(
      "Ask about Gametes and Fertilisation"
    );
    expect(buildStudentTutorHeading()).toBe("Ask for help on this topic");
  });

  test("subcopy names lesson and page when both present", () => {
    const copy = buildStudentTutorSubcopy("Practise", "Gametes and Fertilisation");
    expect(copy).toContain("Gametes and Fertilisation");
    expect(copy).toContain("Practise");
    expect(copy).toMatch(/grounded/i);
  });

  test("placeholder includes truncated title", () => {
    expect(
      buildStudentTutorPlaceholder("Learn", "Gametes and Fertilisation")
    ).toContain("Learn");
    expect(buildStudentTutorPlaceholder()).toMatch(/What do I need to know/);
  });

  test("starter chips include page/lesson titles in prompts", () => {
    const chips = buildLessonNativeStarterChips(
      "Learn",
      "Gametes and Fertilisation"
    );
    expect(chips).toHaveLength(2);
    expect(chips[0].label).toBe("Explain this page");
    expect(chips[0].prompt).toContain('"Learn"');
    expect(chips[1].prompt).toContain('"Gametes and Fertilisation"');
  });

  test("no chips when titles missing", () => {
    expect(buildLessonNativeStarterChips()).toEqual([]);
  });
});
