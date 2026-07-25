jest.mock("../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

/* eslint-disable import/first -- jest.mock must run before modules under test */
import {
  inferSpecKeyFromExport,
  lessonMetaFromExport,
  topicKeyFromGeneratorExport,
  topicSlugCandidatesFromExportKey,
  type GeneratorExportV1Document,
} from "./lessonGeneratorImport";
import { applyCreateLessonTaxonomyPayloadFields } from "./createLessonTaxonomyPayloadFields";
import { LESSON_GENERATOR_EXPORT_FORMAT_V1 } from "../constants/lessonGeneratorExchange.v1";
/* eslint-enable import/first */

function edexcelPollinationExport(
  overrides: Partial<NonNullable<GeneratorExportV1Document["lesson"]>> = {}
): GeneratorExportV1Document {
  return {
    formatVersion: LESSON_GENERATOR_EXPORT_FORMAT_V1,
    exportedAt: new Date().toISOString(),
    source: "letsrevise-lesson-synthesiser",
    lesson: {
      title: "Adaptations for Pollination",
      subject: "Biology",
      keyStage: "IGCSE",
      level: "IGCSE",
      examBoard: "Edexcel",
      topic: "Adaptations for Pollination",
      tier: "Higher",
      specKey: "edexcel-igcse-biology",
      topicKey: "reproduction/adaptations-for-pollination",
      canonicalTopicKey: "reproduction/adaptations-for-pollination",
      ...overrides,
    },
    pages: [],
  };
}

describe("lessonGeneratorImport taxonomy preservation", () => {
  test("authoritative Edexcel export maps board/level/tier/spec/topic correctly", () => {
    const meta = lessonMetaFromExport(edexcelPollinationExport());
    expect(meta.board).toBe("Edexcel");
    expect(meta.level).toBe("IGCSE");
    expect(meta.tier).toBe("higher");
    expect(meta.specKey).toBe("edexcel-igcse-biology");
    expect(meta.topicKey).toBe("edexcel-igcse-biology:adaptations-for-pollination");
    expect(meta.canonicalTopicKey).toBe("adaptations-for-pollination");
  });

  test("IGCSE does not enter the AQA GCSE inference branch via substring", () => {
    expect(
      inferSpecKeyFromExport({
        subject: "Biology",
        keyStage: "IGCSE",
        examBoard: "AQA",
      })
    ).toBeUndefined();
    expect(
      inferSpecKeyFromExport({
        subject: "Biology",
        keyStage: "IGCSE",
        examBoard: "Edexcel",
      })
    ).toBe("edexcel-igcse-biology");
  });

  test("valid export specKey wins over fallback inference", () => {
    expect(
      inferSpecKeyFromExport({
        subject: "Biology",
        keyStage: "KS4 - GCSE",
        examBoard: "AQA",
        specKey: "edexcel-igcse-biology",
      })
    ).toBe("edexcel-igcse-biology");
  });

  test("path-style topic key maps to taxonomy leaf under Edexcel spec", () => {
    const resolved = topicKeyFromGeneratorExport(edexcelPollinationExport({ specKey: undefined }));
    expect(resolved?.specKey).toBe("edexcel-igcse-biology");
    expect(resolved?.canonicalTopicKey).toBe("adaptations-for-pollination");
    expect(resolved?.topicKey).toBe("edexcel-igcse-biology:adaptations-for-pollination");
    expect(topicSlugCandidatesFromExportKey("reproduction/adaptations-for-pollination")).toEqual(
      expect.arrayContaining(["adaptations-for-pollination", "reproduction/adaptations-for-pollination"])
    );
  });

  test("missing board but valid Edexcel specKey still produces Edexcel board", () => {
    const meta = lessonMetaFromExport(edexcelPollinationExport({ examBoard: undefined }));
    expect(meta.specKey).toBe("edexcel-igcse-biology");
    expect(meta.board).toBe("Edexcel");
    expect(meta.level).toBe("IGCSE");
  });

  test("existing valid AQA GCSE imports remain AQA GCSE", () => {
    const meta = lessonMetaFromExport({
      formatVersion: LESSON_GENERATOR_EXPORT_FORMAT_V1,
      exportedAt: new Date().toISOString(),
      source: "test",
      lesson: {
        title: "Cell structure",
        subject: "Biology",
        keyStage: "KS4 - GCSE",
        level: "GCSE",
        examBoard: "AQA",
        tier: "Higher Tier",
        topicKey: "cell-structure",
        topic: "Cell structure",
      },
      pages: [],
    });
    expect(meta.board).toBe("AQA");
    expect(meta.level).toBe("GCSE");
    expect(meta.specKey).toBe("aqa-gcse-biology");
    expect(meta.tier).toBe("higher");
  });

  test("IGCSE Higher tier is included in create payload fields", () => {
    const meta = lessonMetaFromExport(edexcelPollinationExport());
    const payload = applyCreateLessonTaxonomyPayloadFields(
      { title: meta.title, board: meta.board, level: meta.level },
      {
        level: meta.level!,
        tier: meta.tier,
        topicKey: meta.topicKey,
        canonicalTopicKey: meta.canonicalTopicKey,
        specKey: meta.specKey,
      }
    );
    expect(payload.board).toBe("Edexcel");
    expect(payload.level).toBe("IGCSE");
    expect(payload.tier).toBe("higher");
    expect(payload.specKey).toBe("edexcel-igcse-biology");
    expect(payload.topicKey).toBe("edexcel-igcse-biology:adaptations-for-pollination");
    expect(payload.canonicalTopicKey).toBe("adaptations-for-pollination");
    expect(payload.examCode).toBe("4BI1");
  });

  test("unknown topic does not silently change Edexcel identity to AQA", () => {
    const meta = lessonMetaFromExport(
      edexcelPollinationExport({
        topicKey: "not-a-real-topic-zzzz",
        canonicalTopicKey: "not-a-real-topic-zzzz",
        title: "Mystery topic",
        topic: "Mystery topic",
      })
    );
    expect(meta.board).toBe("Edexcel");
    expect(meta.level).toBe("IGCSE");
    expect(meta.specKey).toBe("edexcel-igcse-biology");
    expect(meta.board).not.toBe("AQA");
    expect(meta.specKey).not.toBe("aqa-gcse-biology");
  });
});
