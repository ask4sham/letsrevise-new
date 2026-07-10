/**
 * Unit tests: lesson revision pack section builder + layout smoke.
 */
const {
  buildRevisionPackSections,
  slugify,
  splitIntoReadableChunks,
  renderLessonRevisionPackPdf,
} = require("../services/pdf/lessonRevisionPackPdf");

function countPdfPages(buf) {
  const raw = Buffer.isBuffer(buf) ? buf.toString("latin1") : String(buf);
  return (raw.match(/\/Type\s*\/Page(?!\s*s)/g) || []).length;
}

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

  it("splitIntoReadableChunks preserves multi-line structure", () => {
    const chunks = splitIntoReadableChunks("Point one.\n\nPoint two.\n• Point three");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((c) => /Point one/i.test(c))).toBe(true);
    expect(chunks.some((c) => /Point two/i.test(c))).toBe(true);
  });

  it("splits multi-line keyIdea blocks into multiple learning bullets", () => {
    const lesson = {
      title: "Cells",
      pages: [
        {
          pageId: "p1",
          blocks: [
            {
              type: "keyIdea",
              content: "Cells are the basic unit of life.\n\nOrganelles carry out specialised jobs.",
            },
          ],
        },
      ],
    };
    const s = buildRevisionPackSections(lesson, { includeAnswers: false });
    expect(s.keyLearning.length).toBeGreaterThanOrEqual(2);
  });
});

describe("renderLessonRevisionPackPdf layout", () => {
  jest.setTimeout(15000);

  it("does not create an excessive blank-page cascade for a short lesson", async () => {
    const lesson = {
      title: "Amniotic Fluid",
      subject: "Biology",
      examBoardName: "Edexcel",
      topic: "Human Reproductive Systems",
      level: "IGCSE",
      pages: [
        {
          pageId: "p1",
          blocks: [
            {
              type: "keyIdea",
              content:
                "Amniotic fluid cushions the fetus.\nIt allows free movement.\nIt helps maintain a constant temperature.",
            },
            { type: "keyWords", content: "amnion, amniotic fluid, fetus" },
            { type: "examTip", content: "Always link structure to function." },
            { type: "commonMistake", content: "Do not say the fluid provides nutrients." },
            {
              type: "checkpoint",
              prompt: "Give one role of amniotic fluid.",
              correctAnswer: "Cushions the fetus",
              markScheme: "1 mark",
            },
          ],
        },
      ],
      flashcards: [
        { front: "What is amniotic fluid?", back: "Fluid around the fetus" },
        { front: "Name the membrane.", back: "Amnion" },
      ],
      quiz: {
        questions: [
          {
            question: "Amniotic fluid mainly helps by?",
            options: ["Cushioning", "Photosynthesis"],
            correctAnswer: "Cushioning",
          },
        ],
      },
    };

    const buf = await renderLessonRevisionPackPdf(lesson, { includeAnswers: false });
    expect(buf.slice(0, 4).toString("utf8")).toBe("%PDF");
    const pages = countPdfPages(buf);
    // Short pack should fit on a small number of pages; cascade bug produced many empties.
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(pages).toBeLessThanOrEqual(6);

    const studentSections = buildRevisionPackSections(lesson, { includeAnswers: false });
    expect(studentSections.answerAppendix).toEqual([]);
    const appendixBlob = JSON.stringify(studentSections.answerAppendix);
    expect(appendixBlob).not.toMatch(/1 mark/);
    expect(JSON.stringify(studentSections.practiceQuestions)).not.toMatch(/markScheme|correctAnswer/i);
  });
});
