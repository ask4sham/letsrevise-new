/**
 * Unit tests: lesson revision pack section builder (no Mongo / PDFKit required).
 */
const {
  buildRevisionPackSections,
  slugify,
} = require("../services/pdf/lessonRevisionPackPdf");

describe("buildRevisionPackSections", () => {
  const sampleLesson = {
    title: "Human Reproductive Systems",
    subject: "Biology",
    examBoardName: "Edexcel",
    topic: "Human Reproductive Systems",
    level: "IGCSE",
    tier: "higher",
    pages: [
      {
        pageId: "p1",
        title: "Page 1",
        blocks: [
          { type: "keyIdea", content: "The placenta exchanges nutrients and gases." },
          { type: "keyWords", content: "placenta, amnion, FSH" },
          { type: "examTip", content: "Always name the structure and its function." },
          { type: "commonMistake", content: "Do not say blood mixes across the placenta." },
          { type: "diagram", caption: "Placental barrier diagram" },
          {
            type: "checkpoint",
            prompt: "What does FSH do?",
            correctAnswer: "Stimulates follicle growth",
            markScheme: "1 mark for follicle / ovary",
          },
        ],
        checkpoint: {
          question: "Name one role of amniotic fluid.",
          answer: "Cushions the fetus",
          markScheme: "Accept protection / shock absorption",
        },
      },
    ],
    flashcards: [{ front: "What is FSH?", back: "Follicle-stimulating hormone" }],
    quiz: {
      questions: [
        {
          question: "Where does fertilisation usually occur?",
          options: ["Oviduct", "Uterus", "Ovary"],
          correctAnswer: "Oviduct",
          markScheme: "Oviduct / fallopian tube",
        },
      ],
    },
    examQuestions: [{ question: "Explain how the placenta is adapted for exchange.", marks: 4 }],
  };

  it("includes learning content and practice questions for students without answers", () => {
    const s = buildRevisionPackSections(sampleLesson, { includeAnswers: false });
    expect(s.title).toMatch(/Human Reproductive/);
    expect(s.keyLearning.some((x) => /placenta/i.test(x))).toBe(true);
    expect(s.keywords.length).toBeGreaterThan(0);
    expect(s.examTips.length).toBeGreaterThan(0);
    expect(s.commonMistakes.length).toBeGreaterThan(0);
    expect(s.diagrams.some((d) => /Placental/i.test(d))).toBe(true);
    expect(s.flashcards[0].front).toMatch(/FSH/);
    expect(s.flashcards[0].back).toMatch(/Follicle/);
    expect(s.practiceQuestions.length).toBeGreaterThanOrEqual(3);
    expect(s.answerAppendix).toEqual([]);
    const blob = JSON.stringify(s);
    expect(blob).not.toMatch(/Stimulates follicle growth/);
    expect(blob).not.toMatch(/1 mark for follicle/);
    expect(blob).not.toMatch(/Cushions the fetus/);
    expect(blob).not.toMatch(/Oviduct \/ fallopian/);
  });

  it("includes answer appendix when includeAnswers is true", () => {
    const s = buildRevisionPackSections(sampleLesson, { includeAnswers: true });
    expect(s.answerAppendix.length).toBeGreaterThan(0);
    const blob = JSON.stringify(s.answerAppendix);
    expect(blob).toMatch(/Stimulates follicle growth|Cushions the fetus|Oviduct/i);
  });

  it("slugify produces safe filename fragment", () => {
    expect(slugify("Biology — Human Reproductive Systems!")).toMatch(/^[a-z0-9-]+$/);
  });
});
