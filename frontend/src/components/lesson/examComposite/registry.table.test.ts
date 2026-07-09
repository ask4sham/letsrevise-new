import type { ExamQuestionPart } from "../../../api/examQuestions";
import { resolveCompositeInteraction, shortInteraction } from "./registry";

const TABLE_PART: ExamQuestionPart = {
  label: "b",
  type: "table",
  marks: 2,
  questionText: "Complete the table.",
  partData: {
    headers: ["Hormone", "Role"],
    rows: [{ cells: [{ value: "FSH", blank: false }, { blank: true, correctAnswer: "x" }] }],
  },
};

const TABLE_PART_TYPED_SHORT: ExamQuestionPart = {
  ...TABLE_PART,
  type: "short",
};

describe("resolveCompositeInteraction table routing", () => {
  test("flag OFF: table part uses fallback renderer, not short answer lines", () => {
    const interaction = resolveCompositeInteraction(TABLE_PART);
    expect(shortInteraction.matchesPart(TABLE_PART)).toBe(false);
    expect(interaction).not.toBe(shortInteraction);
  });

  test("flag ON: table part resolves to table interaction", () => {
    jest.isolateModules(() => {
      jest.doMock("./featureFlags", () => ({
        isCompositePartTypeEnabled: (partType: string) => partType === "table",
      }));
      const { resolveCompositeInteraction: resolveOn } = require("./registry");
      const interaction = resolveOn(TABLE_PART);
      expect(interaction.partType).toBe("table");
    });
  });

  test("flag ON: partData table is not downgraded to short when type is short", () => {
    jest.isolateModules(() => {
      jest.doMock("./featureFlags", () => ({
        isCompositePartTypeEnabled: (partType: string) => partType === "table",
      }));
      const { resolveCompositeInteraction, shortInteraction } = require("./registry");
      const { isCompositeTablePart } = require("./compositeUtils");
      expect(shortInteraction.matchesPart(TABLE_PART_TYPED_SHORT)).toBe(false);
      expect(isCompositeTablePart(TABLE_PART_TYPED_SHORT)).toBe(true);
      expect(resolveCompositeInteraction(TABLE_PART_TYPED_SHORT).partType).toBe("table");
    });
  });
});
