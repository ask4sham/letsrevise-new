const {
  buildExamQuestionLevelQuery,
  isEdexcelIgcseBiologyContext,
  resolveExamQuestionLevelForSave,
} = require("../utils/examQuestionLevelFilter");

describe("examQuestionLevelFilter", () => {
  test("Edexcel IGCSE context detected from specKey", () => {
    expect(isEdexcelIgcseBiologyContext({ specKey: "edexcel-igcse-biology" })).toBe(true);
  });

  test("Edexcel IGCSE context detected from namespaced topicKey", () => {
    expect(
      isEdexcelIgcseBiologyContext({ topicKey: "edexcel-igcse-biology:human-reproductive-systems" })
    ).toBe(true);
  });

  test("AQA GCSE is not Edexcel IGCSE context", () => {
    expect(isEdexcelIgcseBiologyContext({ specKey: "aqa-gcse-biology", level: "GCSE" })).toBe(false);
  });

  test("IGCSE filter expands to GCSE for Edexcel IGCSE Biology", () => {
    expect(
      buildExamQuestionLevelQuery("IGCSE", {
        specKey: "edexcel-igcse-biology",
      })
    ).toEqual({ $in: ["IGCSE", "GCSE"] });
  });

  test("GCSE filter expands to IGCSE for Edexcel IGCSE Biology", () => {
    expect(
      buildExamQuestionLevelQuery("GCSE", {
        specKey: "edexcel-igcse-biology",
        topicKey: "edexcel-igcse-biology:roles-of-oestrogen-and-progesterone-in-the-menstrual-cycle",
      })
    ).toEqual({ $in: ["IGCSE", "GCSE"] });
  });

  test("GCSE filter stays exact for AQA", () => {
    expect(
      buildExamQuestionLevelQuery("GCSE", {
        specKey: "aqa-gcse-biology",
        examBoard: "AQA",
      })
    ).toBe("GCSE");
  });

  test("IGCSE filter stays exact for AQA (no false positives)", () => {
    expect(
      buildExamQuestionLevelQuery("IGCSE", {
        specKey: "aqa-gcse-biology",
        examBoard: "AQA",
      })
    ).toBe("IGCSE");
  });

  test("resolveExamQuestionLevelForSave forces IGCSE for Edexcel IGCSE spec", () => {
    expect(
      resolveExamQuestionLevelForSave({
        specKey: "edexcel-igcse-biology",
        level: "GCSE",
      })
    ).toBe("IGCSE");
  });
});
