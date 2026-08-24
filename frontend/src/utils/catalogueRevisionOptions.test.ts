import {
  buildGroupedRevisionTopicOptions,
  buildRevisionCourseOptions,
  buildRevisionSubjectOptions,
  buildRevisionTopicOptions,
  computeRevisionPublicActionsEnabled,
  filterAdminGrants,
  findProfileLevelNode,
  formatCatalogueCourseDisplayLabel,
  formatComingSoonLabel,
  getSelectedRevisionStatus,
  lessonMatchesCatalogueTopic,
  matchingAdminGrants,
  deriveStageKeyFromYearGroup,
  resolveProfileStageKey,
  revisionCourseToSpecKey,
  shouldShowGrantedSection,
} from "./catalogueRevisionOptions";
import type { CatalogueTreeNode, CatalogueGrantedItem } from "../api/catalogueAvailability";

const gcseLevel: CatalogueTreeNode = {
  id: "level:gcse",
  kind: "level",
  label: "GCSE",
  stageKey: "gcse",
  publicStatus: "available",
  children: [
    {
      id: "level:gcse:subject:biology",
      kind: "subject",
      label: "Biology",
      subject: "Biology",
      publicStatus: "available",
      children: [
        {
          id: "level:gcse:subject:biology:course:aqa-gcse-biology",
          kind: "course",
          label: "AQA GCSE Biology (8461)",
          specKey: "aqa-gcse-biology",
          publicStatus: "available",
          children: [
            {
              id: "topic:cell-structure",
              kind: "topic",
              label: "Cell structure",
              topicSlug: "cell-structure",
              topicKey: "aqa-gcse-biology:cell-structure",
              groupLabel: "Cell biology",
              publicStatus: "available",
            },
          ],
        },
      ],
    },
    {
      id: "level:gcse:subject:chemistry",
      kind: "subject",
      label: "Chemistry",
      subject: "Chemistry",
      publicStatus: "coming_soon",
      children: [
        {
          id: "level:gcse:subject:chemistry:course:aqa-gcse-chemistry",
          kind: "course",
          label: "AQA GCSE Chemistry (8462)",
          specKey: "aqa-gcse-chemistry",
          publicStatus: "coming_soon",
          children: [
            {
              id: "topic:atomic-structure",
              kind: "topic",
              label: "Atomic structure",
              topicSlug: "atomic-structure",
              topicKey: "aqa-gcse-chemistry:atomic-structure",
              groupLabel: "Atomic structure and the periodic table",
              publicStatus: "coming_soon",
            },
          ],
        },
      ],
    },
  ],
};

describe("catalogueRevisionOptions", () => {
  test("includes coming-soon Chemistry in subject options with label suffix", () => {
    const subjects = buildRevisionSubjectOptions(gcseLevel);
    const chemistry = subjects.find((s) => s.value === "Chemistry");
    expect(chemistry).toBeDefined();
    expect(chemistry?.label).toBe("Chemistry — Coming soon");
    expect(chemistry?.publicStatus).toBe("coming_soon");
  });

  test("coming-soon courses remain selectable options", () => {
    const courses = buildRevisionCourseOptions(gcseLevel, "Chemistry");
    expect(courses).toHaveLength(1);
    expect(courses[0].value).toBe("aqa-gcse-chemistry");
    expect(courses[0].label).toContain("Coming soon");
    expect(courses[0].publicStatus).toBe("coming_soon");
  });

  test("coming-soon topics remain selectable options with topicKey value", () => {
    const topics = buildRevisionTopicOptions(gcseLevel, "Chemistry", "aqa-gcse-chemistry");
    expect(topics).toHaveLength(1);
    expect(topics[0].value).toBe("aqa-gcse-chemistry:atomic-structure");
    expect(topics[0].publicStatus).toBe("coming_soon");
    expect(topics[0].label).toContain("Coming soon");
  });

  test("grouped topic options preserve canonical group order and labels", () => {
    const groups = buildGroupedRevisionTopicOptions(gcseLevel, "Biology", "aqa-gcse-biology");
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Cell biology");
    expect(groups[0].options[0].label).toBe("Cell structure");
    expect(groups[0].options[0].value).toBe("aqa-gcse-biology:cell-structure");
  });

  test("lessonMatchesCatalogueTopic prefers topicKey over verbose lesson.topic", () => {
    expect(
      lessonMatchesCatalogueTopic(
        { topicKey: "aqa-gcse-biology:cell-structure", topic: "Cell structure (AQA GCSE Biology) (Higher Tier)" },
        "aqa-gcse-biology:cell-structure",
        "Cell structure"
      )
    ).toBe(true);
  });

  test("lessonMatchesCatalogueTopic matches AQA legacy verbose lesson.topic without topicKey", () => {
    expect(
      lessonMatchesCatalogueTopic(
        { topic: "Cell structure (AQA GCSE Biology) (Higher Tier)" },
        "aqa-gcse-biology:cell-structure",
        "Cell structure"
      )
    ).toBe(true);
  });

  test("lessonMatchesCatalogueTopic matches Edexcel legacy verbose lesson.topic without topicKey", () => {
    expect(
      lessonMatchesCatalogueTopic(
        { topic: "Gametes & Fertilisation (Edexcel IGCSE Biology) (Higher Tier)" },
        "edexcel-igcse-biology:gametes-and-fertilisation",
        "Gametes & Fertilisation"
      )
    ).toBe(true);
  });

  test("status headline names Chemistry explicitly when coming soon", () => {
    const status = getSelectedRevisionStatus(
      gcseLevel,
      "Chemistry",
      "aqa-gcse-chemistry",
      "aqa-gcse-chemistry:atomic-structure"
    );
    expect(status.isComingSoon).toBe(true);
    expect(status.statusHeadline).toBe("Chemistry — Coming soon");
  });

  test("revisionCourseToSpecKey uses specKey directly from catalogue", () => {
    expect(
      revisionCourseToSpecKey("aqa-gcse-chemistry", "Chemistry", () => null)
    ).toBe("aqa-gcse-chemistry");
  });

  test("matchingAdminGrants returns only scoped admin grants", () => {
    const grants: CatalogueGrantedItem[] = [
      {
        lessonId: "grant-1",
        title: "Private Chem",
        subject: "Chemistry",
        level: "GCSE",
        board: "AQA",
        topic: "Atomic structure",
        specKey: "aqa-gcse-chemistry",
        topicKey: "aqa-gcse-chemistry:atomic-structure",
        publicStatus: "coming_soon",
        userAccess: "entitled",
        visibilityReason: "admin_grant",
      },
      {
        lessonId: "grant-2",
        title: "Other user grant",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        topic: "Cell structure",
        specKey: "aqa-gcse-biology",
        topicKey: "aqa-gcse-biology:cell-structure",
        publicStatus: "coming_soon",
        userAccess: "entitled",
        visibilityReason: "admin_grant",
      },
    ];

    const matched = matchingAdminGrants(
      grants,
      "Chemistry",
      "aqa-gcse-chemistry",
      "aqa-gcse-chemistry:atomic-structure"
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].lessonId).toBe("grant-1");
  });

  test("findProfileLevelNode selects stage node", () => {
    const node = findProfileLevelNode([gcseLevel], "gcse");
    expect(node?.stageKey).toBe("gcse");
  });

  test("formatComingSoonLabel appends suffix only for coming_soon", () => {
    expect(formatComingSoonLabel("Biology", "available")).toBe("Biology");
    expect(formatComingSoonLabel("Chemistry", "coming_soon")).toBe("Chemistry — Coming soon");
  });

  test("computeRevisionPublicActionsEnabled ignores admin grants and coming_soon", () => {
    expect(computeRevisionPublicActionsEnabled("coming_soon", 0)).toBe(false);
    expect(computeRevisionPublicActionsEnabled("coming_soon", 1)).toBe(false);
    expect(computeRevisionPublicActionsEnabled("available", 1)).toBe(true);
    expect(computeRevisionPublicActionsEnabled("available", 0)).toBe(false);
  });

  test("resolveProfileStageKey prefers catalogue profile over user fallback", () => {
    expect(resolveProfileStageKey("gcse", "a-level")).toBe("gcse");
    expect(resolveProfileStageKey("", "gcse")).toBe("gcse");
  });

  test("resolveProfileStageKey derives gcse from yearGroup when catalogue and stageKey missing", () => {
    expect(resolveProfileStageKey("", "", 11)).toBe("gcse");
    expect(resolveProfileStageKey(undefined, undefined, 10)).toBe("gcse");
  });

  test("deriveStageKeyFromYearGroup mirrors backend profile stage bands", () => {
    expect(deriveStageKeyFromYearGroup(8)).toBe("ks3");
    expect(deriveStageKeyFromYearGroup(11)).toBe("gcse");
    expect(deriveStageKeyFromYearGroup(12)).toBe("a-level");
    expect(deriveStageKeyFromYearGroup(null)).toBe("");
  });

  test("shouldShowGrantedSection is false when empty", () => {
    expect(shouldShowGrantedSection([])).toBe(false);
    expect(shouldShowGrantedSection(undefined)).toBe(false);
  });

  test("formatCatalogueCourseDisplayLabel strips tier for Edexcel IGCSE Biology", () => {
    expect(
      formatCatalogueCourseDisplayLabel("Edexcel IGCSE Biology · Foundation (4BI1)", "edexcel-igcse-biology")
    ).toBe("Edexcel IGCSE Biology (4BI1)");
    expect(formatCatalogueCourseDisplayLabel("AQA GCSE Biology (8461)", "aqa-gcse-biology")).toBe(
      "AQA GCSE Biology (8461)"
    );
  });
});
