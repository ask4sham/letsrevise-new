import {
  backToMyStageLessonsLabel,
  buildBrowseGroupedTopicOptions,
  buildBrowsePath,
  buildBrowseBoardOptions,
  buildBrowseTierOptions,
  browseComingSoonHeadline,
  findBrowseLevelNode,
  isBrowseLevelComingSoon,
  isBrowseSubjectComingSoon,
  isTemporaryBrowseStage,
  lessonMatchesBrowseStage,
  parseBrowseStageParam,
  resolveEffectiveBrowseStageKey,
  shouldHideBrowseFilters,
} from "./catalogueBrowseOptions";
import type { CatalogueTreeNode } from "../api/catalogueAvailability";
import { lessonMatchesCatalogueTopic } from "./catalogueRevisionOptions";

const gcseLevel: CatalogueTreeNode = {
  id: "level:gcse",
  kind: "level",
  label: "GCSE",
  stageKey: "gcse",
  publicStatus: "available",
  children: [
    {
      id: "biology",
      kind: "subject",
      label: "Biology",
      subject: "Biology",
      publicStatus: "available",
      children: [],
    },
    {
      id: "chemistry",
      kind: "subject",
      label: "Chemistry",
      subject: "Chemistry",
      publicStatus: "coming_soon",
      children: [],
    },
  ],
};

const alevelLevel: CatalogueTreeNode = {
  id: "level:a-level",
  kind: "level",
  label: "A-Level",
  stageKey: "a-level",
  publicStatus: "coming_soon",
  children: [],
};

describe("catalogueBrowseOptions", () => {
  test("resolveEffectiveBrowseStageKey uses URL override then profile", () => {
    expect(resolveEffectiveBrowseStageKey("gcse", "a-level")).toBe("a-level");
    expect(resolveEffectiveBrowseStageKey("gcse", "")).toBe("gcse");
    expect(resolveEffectiveBrowseStageKey("", "")).toBe("gcse");
  });

  test("parseBrowseStageParam normalizes URL values", () => {
    expect(parseBrowseStageParam("a-level")).toBe("a-level");
    expect(parseBrowseStageParam("A Level")).toBe("a-level");
  });

  test("isTemporaryBrowseStage detects URL-only drift", () => {
    expect(isTemporaryBrowseStage("gcse", "a-level")).toBe(true);
    expect(isTemporaryBrowseStage("gcse", "gcse")).toBe(false);
  });

  test("backToMyStageLessonsLabel is student-friendly", () => {
    expect(backToMyStageLessonsLabel("gcse")).toBe("Back to my GCSE lessons");
  });

  test("buildBrowsePath omits param when browsing profile stage", () => {
    expect(buildBrowsePath("gcse", "gcse")).toBe("/browse-lessons");
    expect(buildBrowsePath("gcse", "a-level")).toBe("/browse-lessons?browseStage=a-level");
  });

  test("A-Level browse stage is coming soon", () => {
    const levelNode = findBrowseLevelNode([gcseLevel, alevelLevel], "a-level");
    expect(isBrowseLevelComingSoon(levelNode)).toBe(true);
    expect(browseComingSoonHeadline("a-level", "", levelNode)).toContain("Coming soon");
  });

  test("GCSE Chemistry subject is coming soon", () => {
    const levelNode = findBrowseLevelNode([gcseLevel], "gcse");
    expect(isBrowseSubjectComingSoon(levelNode, "Chemistry")).toBe(true);
    expect(browseComingSoonHeadline("gcse", "Chemistry", levelNode)).toContain("Coming soon");
  });

  test("shouldHideBrowseFilters for unavailable stage and subject", () => {
    const gcseNode = findBrowseLevelNode([gcseLevel], "gcse");
    const alevelNode = findBrowseLevelNode([alevelLevel], "a-level");
    expect(shouldHideBrowseFilters(alevelNode, "")).toBe(true);
    expect(shouldHideBrowseFilters(gcseNode, "Chemistry")).toBe(true);
    expect(shouldHideBrowseFilters(gcseNode, "Biology")).toBe(false);
  });

  test("board options come from lessons only", () => {
    expect(
      buildBrowseBoardOptions([
        { board: "AQA", examBoard: "AQA" },
        { board: "", examBoard: "" },
      ])
    ).toEqual(["AQA", "Not set"]);
  });

  test("Edexcel 4BI1 tier suppressed in tier options", () => {
    expect(
      buildBrowseTierOptions([
        { specKey: "edexcel-igcse-biology", tier: "foundation" },
        { specKey: "aqa-gcse-biology", tier: "higher" },
      ])
    ).toEqual(["higher"]);
  });

  test("lessonMatchesBrowseStage includes IGCSE under GCSE browse", () => {
    expect(lessonMatchesBrowseStage("IGCSE", "gcse")).toBe(true);
    expect(lessonMatchesBrowseStage("A-Level", "gcse")).toBe(false);
  });

  test("buildBrowseGroupedTopicOptions uses catalogue groups not lesson.topic", () => {
    const gcseLevel: CatalogueTreeNode = {
      id: "level:gcse",
      kind: "level",
      label: "GCSE",
      stageKey: "gcse",
      publicStatus: "available",
      children: [
        {
          id: "biology",
          kind: "subject",
          label: "Biology",
          subject: "Biology",
          publicStatus: "available",
          children: [
            {
              id: "edexcel",
              kind: "course",
              label: "Edexcel IGCSE Biology (4BI1)",
              specKey: "edexcel-igcse-biology",
              publicStatus: "available",
              children: [
                {
                  id: "gametes",
                  kind: "topic",
                  label: "Gametes & Fertilisation",
                  topicKey: "edexcel-igcse-biology:gametes-and-fertilisation",
                  groupLabel: "Reproduction and inheritance",
                  publicStatus: "available",
                },
              ],
            },
          ],
        },
      ],
    };

    const groups = buildBrowseGroupedTopicOptions(gcseLevel, "Biology", "Edexcel");
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Reproduction and inheritance");
    expect(groups[0].options[0].label).toBe("Gametes & Fertilisation");
    expect(groups[0].options[0].value).toBe("edexcel-igcse-biology:gametes-and-fertilisation");
  });

  test("legacy Edexcel verbose lesson.topic still matches canonical browse topicKey", () => {
    const legacyLesson = {
      topic: "Gametes & Fertilisation (Edexcel IGCSE Biology) (Higher Tier)",
    };
    expect(
      lessonMatchesCatalogueTopic(
        legacyLesson,
        "edexcel-igcse-biology:gametes-and-fertilisation",
        "Gametes & Fertilisation"
      )
    ).toBe(true);
  });
});
