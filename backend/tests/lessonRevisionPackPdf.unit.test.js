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
  sanitizePdfText,
  renderLessonRevisionPackPdf,
  addSegments,
  collectFollowingLinesForHeading,
  collectFollowingContentForHeading,
  CONTENT_BOTTOM,
  MARGIN,
} = require("../services/pdf/lessonRevisionPackPdf");
const {
  resolveLessonImageForPdf,
  resolveLocalLessonImagePath,
  isAllowlistedRemoteImageUrl,
  safeJoinUnderRoot,
} = require("../services/pdf/resolveLessonImageForPdf");

const FIXTURE_PNG = path.join(__dirname, "fixtures", "revision-pack-diagram.png");
const FIXTURE_BUF = () => fs.readFileSync(FIXTURE_PNG);

const SUPABASE_PNG_URL =
  "https://dyjiwezataxahbpuxjhz.supabase.co/storage/v1/object/public/lesson-media/lesson_x/page_p/block_9_diagram/demo.display.png";

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

function mockFetchOkPng() {
  return jest.fn().mockResolvedValue({
    ok: true,
    headers: {
      get: (h) => {
        const k = String(h || "").toLowerCase();
        if (k === "content-type") return "image/png";
        if (k === "content-length") return String(FIXTURE_BUF().length);
        return null;
      },
    },
    arrayBuffer: async () => FIXTURE_BUF(),
  });
}

describe("resolveLessonImageForPdf", () => {
  it("resolves absolute local PNG paths", async () => {
    expect(fs.existsSync(FIXTURE_PNG)).toBe(true);
    const local = resolveLocalLessonImagePath(FIXTURE_PNG);
    expect(local).toBe(path.resolve(FIXTURE_PNG));
    const resolved = await resolveLessonImageForPdf(FIXTURE_PNG);
    expect(resolved).toEqual({ kind: "path", path: path.resolve(FIXTURE_PNG) });
  });

  it("rejects path traversal", async () => {
    expect(safeJoinUnderRoot(path.join(__dirname, "fixtures"), "../fixtures/revision-pack-diagram.png")).toBeNull();
    expect(await resolveLessonImageForPdf("/visuals/../../etc/passwd.png")).toBeNull();
  });

  it("returns null for missing / unsupported / non-allowlisted remote URLs", async () => {
    expect(await resolveLessonImageForPdf("/visuals/does-not-exist.png")).toBeNull();
    expect(await resolveLessonImageForPdf("/visuals/foo.svg")).toBeNull();
    expect(isAllowlistedRemoteImageUrl("https://example.com/a.png")).toBe(false);
    expect(await resolveLessonImageForPdf("https://example.com/a.png")).toBeNull();
    expect(await resolveLessonImageForPdf("")).toBeNull();
  });

  it("allowlists Supabase lesson-media PNG URLs and fetches buffer", async () => {
    expect(isAllowlistedRemoteImageUrl(SUPABASE_PNG_URL)).toBe(true);
    const fetchImpl = mockFetchOkPng();
    const resolved = await resolveLessonImageForPdf(SUPABASE_PNG_URL, { fetchImpl });
    expect(resolved?.kind).toBe("buffer");
    expect(Buffer.isBuffer(resolved.buffer)).toBe(true);
    expect(resolved.buffer.length).toBeGreaterThan(0);
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("falls back when allowlisted fetch returns 404", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    expect(await resolveLessonImageForPdf(SUPABASE_PNG_URL, { fetchImpl })).toBeNull();
  });

  it("falls back when allowlisted fetch times out / rejects", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("aborted"));
    expect(await resolveLessonImageForPdf(SUPABASE_PNG_URL, { fetchImpl })).toBeNull();
  });
});

describe("sanitizePdfText", () => {
  it("removes emoji sentence starters without leaving garbage", () => {
    expect(sanitizePdfText("👉 The key idea is cushioning.")).toBe("The key idea is cushioning.");
    expect(sanitizePdfText("✅ Correct response")).toBe("Correct response");
    expect(sanitizePdfText("🔥 Exam tip: name the structure")).toBe("Exam tip: name the structure");
    expect(sanitizePdfText("⭐ Important")).toBe("Important");
    expect(sanitizePdfText("🌍 Why this matters")).toBe("Why this matters");
    expect(sanitizePdfText("💡 Always link structure to function")).toBe(
      "Always link structure to function"
    );
    expect(sanitizePdfText("🎯 amniotic fluid")).toBe("amniotic fluid");
    const cleaned = sanitizePdfText("• 👉 State what amniotic fluid is");
    expect(cleaned).toMatch(/State what amniotic fluid is/i);
    expect(cleaned).not.toMatch(/Ø|ß|�|👉/);
  });

  it("preserves GCSE science symbols and units", () => {
    // Subscript digits normalised to ASCII for Helvetica; Latin-1 ²/³/° kept.
    expect(sanitizePdfText("CO₂ and O₂ form H₂O")).toBe("CO2 and O2 form H2O");
    expect(sanitizePdfText("Heat to 37°C")).toBe("Heat to 37°C");
    expect(sanitizePdfText("Volume is 25 cm³")).toBe("Volume is 25 cm³");
    expect(sanitizePdfText("Rate = 2.5 cm³/min")).toBe("Rate = 2.5 cm³/min");
  });

  it("replaces decorative arrows and strips surrogate junk", () => {
    expect(sanitizePdfText("Structure → function")).toBe("Structure - function");
    expect(sanitizePdfText("Bad\uFFFDtext")).toBe("Badtext");
  });

  it("cleans emoji from keyIdea segments used in the pack", () => {
    const lesson = {
      title: "Amniotic Fluid",
      pages: [
        {
          pageId: "p1",
          blocks: [
            {
              type: "keyIdea",
              content:
                "<ul><li><strong>👉</strong> State what <strong>amniotic fluid</strong> is</li><li><strong>👉</strong> Describe cushioning</li></ul>",
            },
          ],
        },
      ],
    };
    const s = buildRevisionPackSections(lesson, { includeAnswers: false });
    const blob = JSON.stringify(s.keyLearning);
    expect(blob).not.toMatch(/👉|✅|Ø|ß|�/);
    expect(keyLearningPlain(s)).toMatch(/State what amniotic fluid is/i);
    expect(keyLearningPlain(s)).not.toMatch(/whatamniotic/i);
    expect(keyLearningPlain(s)).toMatch(/Describe cushioning/i);
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

  it("embeds allowlisted Supabase PNG via mocked fetch", async () => {
    const lesson = {
      title: "Remote Diagram",
      pages: [
        {
          pageId: "p1",
          blocks: [
            { type: "keyIdea", content: "Amniotic fluid cushions the fetus." },
            {
              type: "diagram",
              caption: "Fetus structure",
              imageUrl: SUPABASE_PNG_URL,
            },
          ],
        },
      ],
    };
    const fetchImpl = mockFetchOkPng();
    const withRemote = await renderLessonRevisionPackPdf(lesson, {
      includeAnswers: false,
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalled();
    expect(pdfHasImageXObject(withRemote)).toBe(true);

    const blockedFetch = mockFetchOkPng();
    const blocked = await renderLessonRevisionPackPdf(
      {
        title: "Blocked Host",
        pages: [
          {
            pageId: "p1",
            blocks: [
              {
                type: "diagram",
                caption: "Evil",
                imageUrl: "https://evil.example.com/x.png",
              },
            ],
          },
        ],
      },
      { includeAnswers: false, fetchImpl: blockedFetch }
    );
    expect(blockedFetch).not.toHaveBeenCalled();
    expect(blocked.slice(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("collects dragDropMatch pairs[].imageUrl into diagram entries", () => {
    const lesson = {
      title: "TTI",
      pages: [
        {
          pageId: "p1",
          blocks: [
            {
              type: "dragDropMatch",
              title: "Match",
              matchMode: "textToImage",
              pairs: [
                {
                  prompt: "AMNIOTIC SAC",
                  imageUrl: SUPABASE_PNG_URL,
                },
                {
                  prompt: "CUSHIONING",
                  imageUrl:
                    "https://dyjiwezataxahbpuxjhz.supabase.co/storage/v1/object/public/lesson-media/lesson_x/p2.png",
                },
              ],
            },
          ],
        },
      ],
    };
    const s = buildRevisionPackSections(lesson, { includeAnswers: false });
    expect(s.diagrams.length).toBeGreaterThanOrEqual(2);
    expect(s.diagrams.some((d) => /Matching image: AMNIOTIC SAC/i.test(d.caption))).toBe(true);
    expect(s.diagrams.every((d) => d.imageUrl)).toBe(true);
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

describe("heading keep-with-content (orphan prevention)", () => {
  const PDFDocument = require("pdfkit");

  it("collectFollowingContentForHeading includes intro paragraph then first bullets", () => {
    const segs = [
      { type: "heading", text: "The Male Reproductive System" },
      { type: "paragraph", text: "The key structures and their functions are outlined below:" },
      { type: "bullet", text: "Sperm duct carries sperm from the testis" },
      { type: "bullet", text: "Urethra carries urine and sperm" },
      { type: "bullet", text: "Testis produces sperm and testosterone" },
      { type: "bullet", text: "Scrotum holds the testes" },
      { type: "heading", text: "The Female Reproductive System" },
      { type: "bullet", text: "Ovaries produce eggs" },
    ];
    const items = collectFollowingContentForHeading(segs, 0);
    expect(items[0].kind).toBe("paragraph");
    expect(items[0].text).toMatch(/key structures/i);
    expect(items.filter((x) => x.kind === "bullet").length).toBe(3);
    expect(items.map((x) => x.text).join("\n")).not.toMatch(/Female|Ovaries|Scrotum/);
  });

  it("collectFollowingLinesForHeading gathers bullets and stops at next heading", () => {
    const segs = [
      { type: "heading", text: "The Male Reproductive System" },
      { type: "bullet", text: "Testes produce sperm" },
      { type: "bullet", text: "Sperm ducts carry sperm" },
      { type: "bullet", text: "Glands add fluid" },
      { type: "heading", text: "The Female Reproductive System" },
      { type: "bullet", text: "Ovaries produce eggs" },
    ];
    const lines = collectFollowingLinesForHeading(segs, 0);
    expect(lines.length).toBe(3);
    expect(lines[0]).toMatch(/Testes produce sperm/);
    expect(lines.join("\n")).not.toMatch(/Female|Ovaries/);
  });

  it("moves heading+intro+bullets together when only heading+intro would fit", async () => {
    const doc = new PDFDocument({ size: "LETTER", margin: MARGIN, autoFirstPage: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    const done = new Promise((resolve) => doc.on("end", resolve));
    let pagesAdded = 0;
    doc.on("pageAdded", () => {
      pagesAdded += 1;
    });

    // Room for heading + short intro only — not for intro + 3 bullets.
    doc.y = CONTENT_BOTTOM - 70;

    addSegments(doc, [
      { type: "heading", text: "The Male Reproductive System" },
      {
        type: "paragraph",
        text: "The key structures and their functions are outlined below:",
      },
      { type: "bullet", text: "Sperm duct carries sperm from the testis to the urethra." },
      { type: "bullet", text: "Urethra carries urine and sperm out of the body." },
      { type: "bullet", text: "Testis produces sperm and testosterone." },
    ]);

    expect(pagesAdded).toBeGreaterThan(0);
    // Whole group rendered on the new page (heading + intro + bullets).
    expect(doc.y).toBeGreaterThan(MARGIN + 80);
    expect(doc.y).toBeLessThan(MARGIN + 280);

    doc.end();
    await done;
    expect(Buffer.concat(chunks).slice(0, 4).toString()).toBe("%PDF");
  });

  it("moves an orphaned heading to the next page with following bullets", async () => {
    const doc = new PDFDocument({ size: "LETTER", margin: MARGIN, autoFirstPage: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    const done = new Promise((resolve) => doc.on("end", resolve));
    let pagesAdded = 0;
    doc.on("pageAdded", () => {
      pagesAdded += 1;
    });

    // Leave only enough room for a lone heading (~28px), not heading + bullets.
    doc.y = CONTENT_BOTTOM - 36;

    addSegments(doc, [
      { type: "heading", text: "The Male Reproductive System" },
      { type: "bullet", text: "Testes produce sperm and testosterone." },
      { type: "bullet", text: "Sperm ducts transport sperm." },
      { type: "bullet", text: "Glands add seminal fluid." },
      { type: "bullet", text: "The penis delivers sperm." },
    ]);

    expect(pagesAdded).toBeGreaterThan(0);
    // Heading + bullets rendered near the top of the new page.
    expect(doc.y).toBeLessThan(MARGIN + 200);

    doc.end();
    await done;
    const buf = Buffer.concat(chunks);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });

  it("does not force a page break when heading + content already fit", async () => {
    const doc = new PDFDocument({ size: "LETTER", margin: MARGIN, autoFirstPage: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    const done = new Promise((resolve) => doc.on("end", resolve));
    let pagesAdded = 0;
    doc.on("pageAdded", () => {
      pagesAdded += 1;
    });

    doc.y = MARGIN + 40;

    addSegments(doc, [
      { type: "heading", text: "The Male Reproductive System" },
      { type: "paragraph", text: "The key structures and their functions are outlined below:" },
      { type: "bullet", text: "Testes produce sperm." },
      { type: "bullet", text: "Sperm ducts transport sperm." },
      { type: "bullet", text: "Glands add fluid." },
    ]);

    expect(pagesAdded).toBe(0);

    doc.end();
    await done;
    expect(Buffer.concat(chunks).slice(0, 4).toString()).toBe("%PDF");
  });

  it("full pack with near-bottom heading does not explode page count", async () => {
    const filler = Array.from({ length: 18 }, (_, i) => `<p>Filler paragraph ${i + 1} about puberty and hormones for layout.</p>`).join(
      ""
    );
    const lesson = {
      title: "Secondary Sexual Characteristics",
      subject: "Biology",
      pages: [
        {
          pageId: "p1",
          blocks: [
            {
              type: "keyIdea",
              content:
                `${filler}<h2>The Male Reproductive System</h2>` +
                `<p>The key structures and their functions are outlined below:</p>` +
                `<ul><li>Sperm duct carries sperm from the testis</li>` +
                `<li>Urethra carries urine and sperm</li>` +
                `<li>Testis produces sperm and testosterone</li></ul>`,
            },
          ],
        },
      ],
    };
    const buf = await renderLessonRevisionPackPdf(lesson, { includeAnswers: false });
    const pages = countPdfPages(buf);
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(pages).toBeLessThan(12);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });
});
