/**
 * interactiveSequence save sanitisation — progressive-reveal persistence (STEP 28R.4A).
 */
const { describe, it, expect } = require("@jest/globals");
const {
  sanitisePagesInput,
  shapeProgressiveRevealBlocksForStudentLesson,
} = require("../routes/lessons");
const { toLessonFullPayload } = require("../utils/lessonPayload");
const { validateLessonSynthesiserDraftEnvelope } = require("../utils/lessonSynthesiserDraftValidator");
const { adaptSynthesiserDraftToLessonCreate } = require("../utils/lessonSynthesiserDraftAdapter");
const {
  getLessonSynthesiserPr10DraftFixture,
} = require("./fixtures/lessonSynthesiserPr10Draft.fixture");
const Lesson = require("../models/Lesson");
const mongoose = require("mongoose");

const hero = { type: "none", src: "", caption: "" };

const PROHIBITED_KEYS = [
  "caption",
  "testQuestion",
  "testExplanation",
  "note",
  "teacherBrief",
  "modelAnswer",
  "expectedResponse",
  "teacherGuidance",
];

const TEACHER_KEY_MARKER_RE = /teacher-key\s*:/i;
const TEACHER_KEY_KEY_RE = /teacher-key/i;

function progressiveBlock(overrides = {}) {
  return {
    type: "interactiveSequence",
    id: "block-sequence-test",
    role: "sequence",
    title: "Process",
    intro: "Follow each step.",
    presentationMode: "progressiveReveal",
    enableTestMe: false,
    sourceIds: ["spec:topic:point-1"],
    sequenceSteps: [
      {
        id: "step-1",
        title: "Step 1",
        description: "First teaching step.",
        imageUrl: "",
        sourceIds: ["spec:topic:point-1"],
      },
      {
        id: "step-2",
        title: "Step 2",
        description: "Second teaching step.",
        imageUrl: "",
      },
    ],
    ...overrides,
  };
}

function findProgressiveBlock(pages) {
  return (pages || [])
    .flatMap((page) => page.blocks || [])
    .find((block) => block.type === "interactiveSequence" && block.presentationMode === "progressiveReveal");
}

function synthesiserDraftEnvelope() {
  const payload = getLessonSynthesiserPr10DraftFixture();
  payload.draft.pages[0].blocks.push(progressiveBlock());
  return payload;
}

function collectProhibitedKeyHits(value, path = "", hits = []) {
  if (value == null) return hits;
  if (typeof value === "string") {
    if (TEACHER_KEY_MARKER_RE.test(value)) hits.push(`${path}:value`);
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectProhibitedKeyHits(item, `${path}[${index}]`, hits));
    return hits;
  }
  if (typeof value !== "object") return hits;

  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (key.includes("teacher-key") || TEACHER_KEY_KEY_RE.test(key)) hits.push(childPath);
    if (PROHIBITED_KEYS.includes(key)) hits.push(childPath);
    if (key === "metadata" && child && typeof child === "object" && child.teacherBrief !== undefined) {
      hits.push(`${childPath}.teacherBrief`);
    }
    collectProhibitedKeyHits(child, childPath, hits);
  }
  return hits;
}

function buildStudentPayloadThroughProductionPath() {
  const envelope = synthesiserDraftEnvelope();
  const validation = validateLessonSynthesiserDraftEnvelope(envelope);
  expect(validation.ok).toBe(true);

  const adapted = adaptSynthesiserDraftToLessonCreate(envelope.draft, {
    ownerTeacherId: new mongoose.Types.ObjectId(),
  });
  const sanitisedPages = sanitisePagesInput(adapted.pages, true);
  const lesson = new Lesson({
    ...adapted,
    pages: sanitisedPages,
  });

  const mongooseObject = lesson.toObject();
  const mongooseJson = lesson.toJSON();
  const shapedForStudent = shapeProgressiveRevealBlocksForStudentLesson(mongooseObject);
  const studentPayload = toLessonFullPayload(shapedForStudent);

  return {
    mongooseObject,
    mongooseJson,
    studentPayload,
    progressiveBlock: findProgressiveBlock(studentPayload.pages),
    storedProgressiveBlock: findProgressiveBlock(mongooseObject.pages),
  };
}

describe("sanitisePagesInput interactiveSequence progressiveReveal", () => {
  it("preserves approved progressive fields and step order", () => {
    const pages = sanitisePagesInput(
      [
        {
          pageId: "page-1",
          title: "Learn",
          order: 1,
          hero,
          blocks: [progressiveBlock()],
        },
      ],
      true
    );

    const block = pages[0].blocks[0];
    expect(block.type).toBe("interactiveSequence");
    expect(block.id).toBe("block-sequence-test");
    expect(block.presentationMode).toBe("progressiveReveal");
    expect(block.enableTestMe).toBe(false);
    expect(block.sourceIds).toEqual(["spec:topic:point-1"]);
    expect(block.sequenceSteps).toHaveLength(2);
    expect(block.sequenceSteps[0].id).toBe("step-1");
    expect(block.sequenceSteps[1].id).toBe("step-2");
    expect(block.sequenceSteps[0].sourceIds).toEqual(["spec:topic:point-1"]);
    expect(block.sequenceSteps[0].caption).toBeUndefined();
    expect(block.sequenceSteps[0].testQuestion).toBeUndefined();
  });

  it("omits invalid presentationMode and retains legacy carousel fields", () => {
    const pages = sanitisePagesInput(
      [
        {
          pageId: "page-1",
          title: "Learn",
          order: 1,
          hero,
          blocks: [
            {
              type: "interactiveSequence",
              title: "Carousel",
              intro: "",
              presentationMode: "carousel",
              sequenceSteps: [
                {
                  id: "c1",
                  title: "One",
                  description: "Desc",
                  imageUrl: "",
                  caption: "Key",
                  testQuestion: "What?",
                },
              ],
            },
          ],
        },
      ],
      true
    );

    const block = pages[0].blocks[0];
    expect(block.presentationMode).toBeUndefined();
    expect(block.sequenceSteps[0].caption).toBe("Key");
    expect(block.sequenceSteps[0].testQuestion).toBe("What?");
  });

  it("strips forbidden progressive fields and caps steps at eight", () => {
    const steps = Array.from({ length: 10 }, (_, i) => ({
      id: `step-${i + 1}`,
      title: `Step ${i + 1}`,
      description: `Description ${i + 1}`,
      imageUrl: "",
      caption: "secret",
      testQuestion: "Q",
    }));

    const pages = sanitisePagesInput(
      [
        {
          pageId: "page-1",
          title: "Learn",
          order: 1,
          hero,
          blocks: [progressiveBlock({ sequenceSteps: steps, note: "teacher only" })],
        },
      ],
      true
    );

    const block = pages[0].blocks[0];
    expect(block.sequenceSteps).toHaveLength(8);
    expect(block.note).toBeUndefined();
    expect(block.sequenceSteps[0].caption).toBeUndefined();
    expect(block.enableTestMe).toBe(false);
  });
});

describe("student payload shaping for progressiveReveal interactiveSequence", () => {
  it("reintroduced mongoose caption defaults are stripped from final student payload", () => {
    const {
      mongooseObject,
      mongooseJson,
      studentPayload,
      progressiveBlock,
      storedProgressiveBlock,
    } = buildStudentPayloadThroughProductionPath();

    expect(storedProgressiveBlock.caption).toBe("");
    expect(storedProgressiveBlock.sequenceSteps[0].caption).toBe("");
    expect(findProgressiveBlock(mongooseJson.pages).caption).toBe("");
    expect(findProgressiveBlock(mongooseJson.pages).sequenceSteps[0].caption).toBe("");

    expect(progressiveBlock).toBeDefined();
    expect(progressiveBlock.id).toBe("block-sequence-test");
    expect(progressiveBlock.type).toBe("interactiveSequence");
    expect(progressiveBlock.role).toBe("sequence");
    expect(progressiveBlock.title).toBe("Process");
    expect(progressiveBlock.intro).toBe("Follow each step.");
    expect(progressiveBlock.presentationMode).toBe("progressiveReveal");
    expect(progressiveBlock.enableTestMe).toBe(false);
    expect(progressiveBlock.sourceIds).toEqual(["spec:topic:point-1"]);
    expect(progressiveBlock.sequenceSteps).toHaveLength(2);
    expect(progressiveBlock.sequenceSteps[0].id).toBe("step-1");
    expect(progressiveBlock.sequenceSteps[1].id).toBe("step-2");
    expect(progressiveBlock.sequenceSteps[0].title).toBe("Step 1");
    expect(progressiveBlock.sequenceSteps[1].title).toBe("Step 2");
    expect(progressiveBlock.sequenceSteps[0].description).toBe("First teaching step.");
    expect(progressiveBlock.sequenceSteps[1].description).toBe("Second teaching step.");
    expect(progressiveBlock.sequenceSteps[0].imageUrl).toBe("");
    expect(progressiveBlock.sequenceSteps[0].sourceIds).toEqual(["spec:topic:point-1"]);

    const prohibitedHits = collectProhibitedKeyHits(progressiveBlock, "progressiveBlock");
    expect(prohibitedHits).toEqual([]);
    expect(mongooseObject.pages).toBeDefined();
  });

  it("preserves legacy carousel caption behaviour in final student payload", () => {
    const carouselPages = sanitisePagesInput(
      [
        {
          pageId: "page-1",
          title: "Learn",
          order: 1,
          hero,
          blocks: [
            {
              type: "interactiveSequence",
              title: "Carousel",
              intro: "Intro",
              sequenceSteps: [
                {
                  id: "c1",
                  title: "One",
                  description: "Desc",
                  imageUrl: "",
                  caption: "Key idea",
                },
              ],
            },
          ],
        },
      ],
      true
    );

    const lesson = new Lesson({
      title: "Carousel lesson",
      subject: "Biology",
      level: "GCSE",
      board: "Edexcel",
      teacherId: new mongoose.Types.ObjectId(),
      pages: carouselPages,
    });

    const shaped = shapeProgressiveRevealBlocksForStudentLesson(lesson.toObject());
    const payload = toLessonFullPayload(shaped);
    const carouselBlock = payload.pages[0].blocks[0];

    expect(carouselBlock.presentationMode).toBeUndefined();
    expect(carouselBlock.sequenceSteps[0].caption).toBe("Key idea");
  });

  it("removes mixed-case teacher-key markers from progressive learner payloads", () => {
    const shaped = shapeProgressiveRevealBlocksForStudentLesson({
      pages: [
        {
          blocks: [
            {
              type: "interactiveSequence",
              presentationMode: "progressiveReveal",
              title: "Process",
              intro: "Intro",
              note: "Teacher-Key: secret",
              metadata: { "nested-Teacher-KEY-marker": "TEACHER-KEY : hidden" },
              sequenceSteps: [
                {
                  id: "step-1",
                  title: "Step 1",
                  description: "Teacher-Key: step leak",
                  imageUrl: "",
                },
              ],
            },
          ],
        },
      ],
    });

    const progressive = findProgressiveBlock(shaped.pages);
    expect(progressive).toBeDefined();
    expect(collectProhibitedKeyHits(progressive)).toEqual([]);
    expect(JSON.stringify(progressive).match(TEACHER_KEY_MARKER_RE)).toBeNull();
    expect(JSON.stringify(progressive).match(TEACHER_KEY_KEY_RE)).toBeNull();
  });
});
