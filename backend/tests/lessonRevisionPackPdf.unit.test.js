/**
 * Unit tests: lesson revision pack section builder + rich text + diagram embed + layout smoke.
 */
const fs = require("fs");
const path = require("path");
const {
  buildRevisionPackSections,
  slugify,
  splitIntoReadableChunks,
  parseContentToSegments,
  segmentText,
  renderLessonRevisionPackPdf,
} = require("../services/pdf/lessonRevisionPackPdf");
const {
  resolveLessonImageForPdf,
  safeJoinUnderRoot,
} = require("../services/pdf/resolveLessonImageForPdf");

const FIXTURE_PNG = path.join(__dirname, "fixtures", "revision-pack-diagram.png");

function countPdfPages(buf) {
  const raw = Buffer.isBuffer(buf) ? buf.toString("latin1") : String(buf);
  return (raw.match(/\/Type\s*\/Page(?!\s*s)/g) || []).length;
}

function pdfHasImageXObject(buf) {
  const raw = Buffer.isBuffer(buf) ? buf.toString("latin1") : String(buf);
  return /\/XObject|\/Subtype\s*\/Image|\/Image/i.test(raw);
}

function keyLearningPlain(s) {
  return (s.keyLearning || []).map(segmentText).join("\n");
}

describe("resolveLessonImageForPdf", () => {
  it("resolves absolute local PNG paths", () => {
    expect(fs.existsSync(FIXTURE_PNG)).toBe(true);
    expect(resolveLessonImageForPdf(FIXTURE_PNG)).toBe(path.resolve(FIXTURE_PNG));
  });

  it("rejects path traversal", () => {
    expect(safeJoinUnderRoot(path.join(__dirname, "fixtures"), "../fixtures/revision-pack-diagram.png")).toBeNull();
    expect(resolveLessonImageForPdf("/visuals/../../etc/passwd.png")).toBeNull();
  });

  it("returns null for missing / unsupported / remote URLs", () => {
    expect(resolveLessonImageForPdf("/visuals/does-not-exist.png")).toBeNull();
    expect(resolveLessonImageForPdf("/visuals/foo.svg")).toBeNull();
    expect(resolveLessonImageForPdf("https://example.com/a.png")).toBeNull();
    expect(resolveLessonImageForPdf("")).toBeNull();
  });
});

describe("parseContentToSegments", () => {
  it("parses HTML headings and lists without raw tags", () => {
    const html =
      "<h2>Objectives</h2><ul><li>State the definition of puberty</li><li><strong>Explain</strong> secondary sexual characteristics</li></ul><p>Puberty is a developmental stage.</p>";
    const segs = parseContentToSegments(html);
    const blob = JSON.stringify(segs);
    expect(blob).not.toMatch(/<\/?[a-z][^>]*>/i);
    expect(segs.some((s) => s.type === "heading" && /Objectives/i.test(s.text))).toBe(true);
    expect(segs.some((s) => s.type === "bullet" && /State the definition/i.test(s.text))).toBe(true);
    expect(segs.some((s) => s.type === "bullet" && /Explain secondary/i.test(s.text))).toBe(true);
    const boldBullet = segs.find((s) => /Explain secondary/i.test(s.text));
    expect(boldBullet.runs?.some((r) => r.bold && /Explain/i.test(r.text))).toBe(true);
    expect(segs.some((s) => s.type === "paragraph" && /developmental stage/i.test(s.text))).toBe(true);
  });

  it("parses markdown bullets and bold", () => {
    const md = "### Hormones\n- FSH stimulates follicles\n- Always name the **hormone**";
    const segs = parseContentToSegments(md);
    expect(segs.some((s) => s.type === "heading" && /Hormones/i.test(s.text))).toBe(true);
    expect(segs.some((s) => s.type === "bullet" && /FSH stimulates/i.test(s.text))).toBe(true);
    const boldLine = segs.find((s) => /Always name/i.test(s.text));
    expect(boldLine).toBeTruthy();
    expect(JSON.stringify(boldLine)).not.toMatch(/\*\*|<\/?strong>/i);
    expect(boldLine.runs?.some((r) => r.bold && /hormone/i.test(r.text))).toBe(true);
  });

  it("keeps inline strong tags in one paragraph segment", () => {
    const segs = parseContentToSegments(
      "Always name the <strong>hormone</strong> and link it to a clear effect."
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].text).toMatch(/Always name the hormone and link/i);
    expect(JSON.stringify(segs)).not.toMatch(/<\/?strong>/i);
  });
});

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
          { type: "diagram", caption: "Placental barrier diagram", imageUrl: "/visuals/missing.png" },
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
    expect(keyLearningPlain(s)).toMatch(/placenta/i);
    expect(s.keywords.length).toBeGreaterThan(0);
    expect(s.examTips.length).toBeGreaterThan(0);
    expect(s.commonMistakes.length).toBeGreaterThan(0);
    expect(s.diagrams.some((d) => /Placental/i.test(d.caption || d))).toBe(true);
    expect(s.diagrams[0].imageUrl).toMatch(/missing\.png/);
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

  it("converts HTML lists into readable segments without raw tags", () => {
    const html =
      "<h2>Objectives</h2><ul><li>State the definition of puberty</li><li><strong>Explain</strong> secondary sexual characteristics</li></ul>";
    const chunks = splitIntoReadableChunks(html);
    const blob = chunks.join("\n");
    expect(blob).not.toMatch(/<\/?[a-z][^>]*>/i);
    expect(chunks.some((c) => /State the definition of puberty/i.test(c))).toBe(true);
    expect(chunks.some((c) => /Explain secondary sexual characteristics/i.test(c))).toBe(true);

    const lesson = {
      title: "Secondary Sexual Characteristics",
      pages: [{ pageId: "p1", blocks: [{ type: "keyIdea", content: html }] }],
    };
    const s = buildRevisionPackSections(lesson, { includeAnswers: false });
    expect(s.keyLearning.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(s.keyLearning)).not.toMatch(/<ul>|<li>|<strong>|<h2>/i);
    expect(s.keyLearning.some((seg) => seg.type === "heading")).toBe(true);
  });

  it("splits multi-line keyIdea blocks into multiple learning segments", () => {
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

describe("renderLessonRevisionPackPdf layout + diagrams", () => {
  jest.setTimeout(20000);

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
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(pages).toBeLessThanOrEqual(6);

    const studentSections = buildRevisionPackSections(lesson, { includeAnswers: false });
    expect(studentSections.answerAppendix).toEqual([]);
    const appendixBlob = JSON.stringify(studentSections.answerAppendix);
    expect(appendixBlob).not.toMatch(/1 mark/);
    expect(JSON.stringify(studentSections.practiceQuestions)).not.toMatch(/markScheme|correctAnswer/i);
  });

  it("embeds a local fixture diagram image", async () => {
    expect(fs.existsSync(FIXTURE_PNG)).toBe(true);
    const lesson = {
      title: "Diagram Embed Test",
      subject: "Biology",
      pages: [
        {
          pageId: "p1",
          blocks: [
            { type: "keyIdea", content: "<h2>Core idea</h2><p>Always name the <strong>hormone</strong>.</p>" },
            {
              type: "diagram",
              caption: "Test diagram",
              imageUrl: FIXTURE_PNG,
            },
          ],
        },
      ],
    };

    const without = await renderLessonRevisionPackPdf(
      {
        title: "No Diagram",
        pages: [{ pageId: "p1", blocks: [{ type: "keyIdea", content: "Plain only." }] }],
      },
      { includeAnswers: false }
    );
    const withImg = await renderLessonRevisionPackPdf(lesson, { includeAnswers: false });
    expect(withImg.length).toBeGreaterThan(without.length);
    expect(pdfHasImageXObject(withImg)).toBe(true);

    const latin = withImg.toString("latin1");
    expect(latin).not.toMatch(/<ul>|<li>|<strong>|<h2>/i);
  });

  it("falls back when imageUrl is missing or unresolvable without crashing", async () => {
    const lesson = {
      title: "Missing Diagram",
      pages: [
        {
          pageId: "p1",
          blocks: [
            { type: "keyIdea", content: "Learning point." },
            { type: "diagram", caption: "Broken diagram", imageUrl: "/visuals/nope-not-here.png" },
            { type: "diagram", caption: "Caption only" },
          ],
        },
      ],
    };
    const buf = await renderLessonRevisionPackPdf(lesson, { includeAnswers: false });
    expect(buf.slice(0, 4).toString("utf8")).toBe("%PDF");
    // PDFKit may encode text; also check sections builder still has captions
    const s = buildRevisionPackSections(lesson, { includeAnswers: false });
    expect(s.diagrams).toHaveLength(2);
    expect(s.answerAppendix).toEqual([]);
  });

  it("student PDF with includeAnswers true still has empty appendix in sections when false path used by policy tests", async () => {
    const lesson = {
      title: "Leakage Guard",
      pages: [
        {
          pageId: "p1",
          blocks: [
            {
              type: "checkpoint",
              prompt: "Secret Q?",
              correctAnswer: "SECRET-ANSWER-XYZ",
              markScheme: "SECRET-MARKSCHEME-XYZ",
            },
          ],
        },
      ],
    };
    const student = buildRevisionPackSections(lesson, { includeAnswers: false });
    expect(student.answerAppendix).toEqual([]);
    expect(JSON.stringify(student)).not.toMatch(/SECRET-ANSWER-XYZ|SECRET-MARKSCHEME-XYZ/);

    const teacher = buildRevisionPackSections(lesson, { includeAnswers: true });
    expect(JSON.stringify(teacher.answerAppendix)).toMatch(/SECRET-ANSWER-XYZ/);
    expect(JSON.stringify(teacher.answerAppendix)).toMatch(/SECRET-MARKSCHEME-XYZ/);

    const studentPdf = await renderLessonRevisionPackPdf(lesson, { includeAnswers: false });
    const studentRaw = studentPdf.toString("latin1");
    expect(studentRaw).not.toMatch(/SECRET-ANSWER-XYZ/);
    expect(studentRaw).not.toMatch(/SECRET-MARKSCHEME-XYZ/);
    expect(studentRaw).not.toMatch(/Model answers/);
  });
});
