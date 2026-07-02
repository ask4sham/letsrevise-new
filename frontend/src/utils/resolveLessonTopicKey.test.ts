jest.mock("../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

/**
 * Regression tests for topicKeyForBank resolution.
 * Ensures: Biology GCSE with/without board enables attach; invalid mapping disables.
 */
import {
  getSpecKeyFromLesson,
  resolveLessonTopicKeyForBank,
  resolveLessonTopicKeyForBankFromLesson,
} from "./resolveLessonTopicKey";

describe("resolveLessonTopicKey", () => {
  describe("getSpecKeyFromLesson", () => {
    it("returns aqa-gcse-biology for Biology GCSE AQA", () => {
      expect(
        getSpecKeyFromLesson({
          subject: "Biology",
          level: "GCSE",
          examBoardName: "AQA",
        })
      ).toBe("aqa-gcse-biology");
    });

    it("returns aqa-gcse-biology for Biology GCSE with empty board (derive AQA)", () => {
      expect(
        getSpecKeyFromLesson({
          subject: "Biology",
          level: "GCSE",
          examBoardName: "",
        })
      ).toBe("aqa-gcse-biology");
    });

    it("returns null for Biology GCSE with non-AQA board", () => {
      expect(
        getSpecKeyFromLesson({
          subject: "Biology",
          level: "GCSE",
          examBoardName: "OCR",
        })
      ).toBe(null);
    });

    it("returns null when level is not GCSE", () => {
      expect(
        getSpecKeyFromLesson({
          subject: "Biology",
          level: "A-Level",
          examBoardName: "AQA",
        })
      ).toBe(null);
    });

    it("returns null when subject does not match", () => {
      expect(
        getSpecKeyFromLesson({
          subject: "History",
          level: "GCSE",
          examBoardName: "AQA",
        })
      ).toBe(null);
    });

    it("returns edexcel-igcse-biology for Biology IGCSE Edexcel", () => {
      expect(
        getSpecKeyFromLesson({
          subject: "Biology",
          level: "IGCSE",
          examBoardName: "Edexcel",
        })
      ).toBe("edexcel-igcse-biology");
    });

    it("returns null for Edexcel IGCSE non-Biology subjects", () => {
      expect(
        getSpecKeyFromLesson({
          subject: "Chemistry",
          level: "IGCSE",
          examBoardName: "Edexcel",
        })
      ).toBe(null);
    });
  });

  describe("resolveLessonTopicKeyForBankFromLesson", () => {
    it("returns namespaced topicKey for Biology GCSE with topic and empty board", () => {
      const result = resolveLessonTopicKeyForBankFromLesson({
        subject: "Biology",
        level: "GCSE",
        topic: "Cell structure",
        examBoardName: "",
      });
      expect(result).toBe("aqa-gcse-biology:cell-structure");
    });

    it("returns namespaced topicKey when lesson has topicKey", () => {
      const result = resolveLessonTopicKeyForBankFromLesson({
        subject: "Biology",
        level: "GCSE",
        topic: "Cell structure",
        topicKey: "aqa-gcse-biology:cell-structure",
        examBoardName: "AQA",
      });
      expect(result).toBe("aqa-gcse-biology:cell-structure");
    });

    it("returns null when lesson has no valid mapping", () => {
      expect(
        resolveLessonTopicKeyForBankFromLesson({
          subject: "Biology",
          level: "GCSE",
          topic: "Cell structure",
          examBoardName: "OCR",
        })
      ).toBe(null);
      expect(
        resolveLessonTopicKeyForBankFromLesson({
          subject: "Biology",
          level: "A-Level",
          topic: "Cell structure",
          examBoardName: "AQA",
        })
      ).toBe(null);
    });

    it("returns null when topic is empty and no topicKey", () => {
      expect(
        resolveLessonTopicKeyForBankFromLesson({
          subject: "Biology",
          level: "GCSE",
          topic: "",
          examBoardName: "AQA",
        })
      ).toBe(null);
    });

    it("returns namespaced topicKey for Edexcel IGCSE Biology with stored topicKey", () => {
      const result = resolveLessonTopicKeyForBankFromLesson({
        subject: "Biology",
        level: "IGCSE",
        examBoardName: "Edexcel",
        specKey: "edexcel-igcse-biology",
        topicKey: "edexcel-igcse-biology:human-male-and-female-reproductive-systems",
      });
      expect(result).toBe("edexcel-igcse-biology:human-male-and-female-reproductive-systems");
    });

    it("derives specKey for Edexcel IGCSE Biology when only board/level/subject are set", () => {
      const result = resolveLessonTopicKeyForBankFromLesson({
        subject: "Biology",
        level: "IGCSE",
        examBoardName: "Edexcel",
        topicKey: "edexcel-igcse-biology:human-male-and-female-reproductive-systems",
      });
      expect(result).toBe("edexcel-igcse-biology:human-male-and-female-reproductive-systems");
    });
  });
});
