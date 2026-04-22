import { pickRelatedFlashcardsForKeyword, type GlossaryFlashcardLite } from "./keywordGlossaryFlashcards";

const lessonDefaults = {
  topicKey: "aqa-gcse-biology:health-disease",
  specKey: "aqa-gcse-biology",
};

describe("pickRelatedFlashcardsForKeyword", () => {
  const cards: GlossaryFlashcardLite[] = [
    { id: "1", front: "Define coronary heart disease.", back: "CHD definition.", tags: ["health-disease"] },
    { id: "2", front: "Unrelated physics formula.", back: "E=mc²", tags: ["energy"] },
    { id: "3", front: "Photosynthesis in plants.", back: "Light dependent.", tags: ["plants"] },
  ];

  it("returns explicit flashcardIds first regardless of scoring", () => {
    const out = pickRelatedFlashcardsForKeyword(
      { term: "anything", flashcardIds: ["3"] },
      cards,
      lessonDefaults,
      3
    );
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("3");
  });

  it("requires phrase or strong token overlap (filters topic-only weak matches)", () => {
    const out = pickRelatedFlashcardsForKeyword({ term: "coronary heart disease" }, cards, lessonDefaults, 3);
    expect(out.map((c) => c.id)).toContain("1");
    expect(out.map((c) => c.id)).not.toContain("2");
  });

  it("does not return unrelated cards that only share a loose topic tag", () => {
    const sparse: GlossaryFlashcardLite[] = [
      { id: "a", front: "Vague mention of risk.", back: "No keyword phrase here.", tags: ["health-disease"] },
    ];
    const out = pickRelatedFlashcardsForKeyword({ term: "non-communicable disease" }, sparse, lessonDefaults, 3);
    expect(out.length).toBe(0);
  });
});
