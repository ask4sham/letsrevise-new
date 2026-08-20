import {
  displayCourseLabel,
  displayKeyStageLabel,
  formatLessonMetadataDisplayLine,
  resolveLessonDescriptionForDisplay,
} from "./lessonMetadataDisplay";

describe("lessonMetadataDisplay", () => {
  const edexcelIgcsePollination = {
    topic: "Adaptations for Pollination",
    level: "IGCSE",
    tier: "higher",
    subject: "Biology",
    specKey: "edexcel-igcse-biology",
    examBoardName: "Edexcel",
  };

  const aqaGcse = {
    topic: "Cell structure",
    level: "GCSE",
    subject: "Biology",
    specKey: "aqa-gcse-biology",
    examBoardName: "AQA",
  };

  const ks3 = {
    topic: "Forces",
    level: "KS3",
    subject: "Science",
    examBoardName: null as string | null,
  };

  it("1. Edexcel IGCSE Biology displays KS4, course, and Higher tier", () => {
    expect(displayKeyStageLabel(edexcelIgcsePollination)).toBe("KS4");
    expect(displayCourseLabel(edexcelIgcsePollination)).toBe(
      "Edexcel IGCSE Biology"
    );
    expect(formatLessonMetadataDisplayLine(edexcelIgcsePollination)).toBe(
      "Topic: Adaptations for Pollination · Key stage: KS4 · Course: Edexcel IGCSE Biology · Tier: Higher"
    );
  });

  it("2. AQA GCSE Biology displays KS4 and course", () => {
    expect(displayKeyStageLabel(aqaGcse)).toBe("KS4");
    expect(displayCourseLabel(aqaGcse)).toBe("AQA GCSE Biology");
    expect(formatLessonMetadataDisplayLine(aqaGcse)).toBe(
      "Topic: Cell structure · Key stage: KS4 · Course: AQA GCSE Biology"
    );
  });

  it("3. KS3 does not display IGCSE/GCSE course text incorrectly", () => {
    expect(displayKeyStageLabel(ks3)).toBe("KS3");
    const line = formatLessonMetadataDisplayLine({
      ...ks3,
      // Mis-tagged GCSE course must not appear for KS3
      specKey: "aqa-gcse-biology",
    });
    expect(line).toContain("Key stage: KS3");
    expect(line).not.toMatch(/Course:.*GCSE/i);
    expect(line).not.toMatch(/Course:.*IGCSE/i);
    expect(line).not.toContain("Key stage: IGCSE");
    expect(line).not.toContain("Key stage: GCSE");
  });

  it("4. title/subtitle fields are not part of the metadata line rewrite", () => {
    const storedDescription =
      "Topic: Adaptations for Pollination · Key stage: IGCSE · Tier: Higher";
    const display = resolveLessonDescriptionForDisplay(storedDescription, {
      ...edexcelIgcsePollination,
      description: storedDescription,
    });
    expect(display).toBe(
      "Topic: Adaptations for Pollination · Key stage: KS4 · Course: Edexcel IGCSE Biology · Tier: Higher"
    );
    // Prose descriptions (real "what you'll learn") stay unchanged
    const prose = "Students learn how insect- and wind-pollinated flowers differ.";
    expect(
      resolveLessonDescriptionForDisplay(prose, edexcelIgcsePollination)
    ).toBe(prose);
  });

  it("suppressTier omits tier from Edexcel IGCSE Biology catalog metadata", () => {
    const stored = "Topic: RNA Structure · Key stage: IGCSE · Tier: Higher";
    expect(
      resolveLessonDescriptionForDisplay(
        stored,
        { ...edexcelIgcsePollination, topic: "RNA Structure" },
        { suppressTier: true }
      )
    ).toBe("Topic: RNA Structure · Key stage: KS4 · Course: Edexcel IGCSE Biology");
  });

  it("5. does not mutate taxonomy input objects", () => {
    const lesson = { ...edexcelIgcsePollination };
    const snapshot = JSON.stringify(lesson);
    resolveLessonDescriptionForDisplay(
      "Topic: Adaptations for Pollination · Key stage: IGCSE · Tier: Higher",
      lesson
    );
    formatLessonMetadataDisplayLine(lesson);
    expect(JSON.stringify(lesson)).toBe(snapshot);
    expect(lesson.level).toBe("IGCSE");
    expect(lesson.specKey).toBe("edexcel-igcse-biology");
    expect(lesson.tier).toBe("higher");
  });

  it("does not use IGCSE/GCSE as the key-stage label", () => {
    expect(displayKeyStageLabel({ level: "IGCSE" })).toBe("KS4");
    expect(displayKeyStageLabel({ level: "GCSE" })).toBe("KS4");
    expect(displayKeyStageLabel({ level: "A-Level" })).toBe("KS5");
  });
});
