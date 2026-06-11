/**
 * Phase 5B.3f.3A — low-risk placeholder cleanup validation.
 * @jest-environment node
 */

const { sanitizeDraftForTest } = require("../routes/ai");

const BANNED_PHRASES = [
  { id: "threeMoves", rx: /Anchor .+ in three moves/i },
  { id: "oneGlanceGeneric", rx: /• Key idea\s*\n• Main comparison\s*\n• Main exam point/i },
  { id: "connectBiological", rx: /students need to connect the idea to real biological examples/i },
  { id: "keyIdeaBecause", rx: /This is a key idea because it helps explain how the topic works/i },
];

const VALIDATION_TOPICS = [
  { topic: "Reflex Arc", topicKey: "aqa-gcse-biology:reflex-arc" },
  { topic: "Cell Structure", topicKey: "aqa-gcse-biology:cell-structure" },
  { topic: "Blood Glucose Control", topicKey: "aqa-gcse-biology:blood-glucose" },
  { topic: "Mitosis and the cell cycle", topicKey: "aqa-gcse-biology:mitosis" },
  { topic: "The carbon cycle", topicKey: "aqa-gcse-biology:carbon-cycle" },
];

function buildMinimalDraft(topic) {
  const blocks = [
    { type: "text", title: "Revision Objectives", role: "lessonObjectives", content: `Objectives for ${topic}.` },
    { type: "text", title: "Prior Knowledge", role: "priorKnowledge", content: "Recall prior ideas." },
    { type: "text", title: "Definition", role: "definition", content: `${topic} is a core GCSE idea.` },
    { type: "text", title: "Why it matters", role: "whyItMatters", content: "Because it appears in exams." },
    { type: "keyIdea", title: "Core model", role: "coreRule", content: "Step A → Step B → Step C." },
    { type: "text", title: "Key examples", role: "keyExamples", content: "• Example one\n• Example two" },
    { type: "text", title: "Exam vocabulary", role: "examVocabulary", content: "term1, term2, term3" },
    { type: "text", title: "Scenario", role: "hook", content: "A student observes a change linked to the topic." },
    { type: "text", title: "Core Teaching", role: "concept", content: "Teaching content about the topic." },
    {
      type: "commonMistake",
      role: "commonMistake",
      content: "Wrong: vague answer.\nCorrect: precise GCSE wording.\nExam link: use command words.",
    },
    { type: "keyIdea", role: "patternRecognition", content: "Pattern for exam answers." },
    { type: "diagram", role: "concept", content: "image here", caption: "image here" },
    {
      type: "keyIdea",
      title: "What to Notice",
      role: "whatToNotice",
      content: "- Feature one\n- Feature two\n- Feature three",
    },
    { type: "text", role: "concept", content: "Extra teaching paragraph." },
    { type: "examTip", role: "concept", content: "In exams, name parts for marks." },
    { type: "diagram", role: "concept", content: "image here", caption: "image here" },
    {
      type: "keyIdea",
      title: "What to Notice",
      role: "whatToNotice",
      content: "- Detail alpha\n- Detail beta\n- Detail gamma",
    },
    {
      type: "checkpoint",
      role: "workedExample",
      prompt: `Explain one process in ${topic}. (3 marks)`,
      questionType: "short",
      options: [],
      explanation:
        "- Point one because it shows mechanism.\n- Point two therefore links to function.\n- Point three because examiners reward detail.",
      correctAnswer: "Point one; point two; point three.",
    },
    { type: "keyIdea", role: "synthesis", content: "Synthesis line for the topic." },
    {
      type: "checkpoint",
      role: "quickCheck",
      prompt: "Which statement is correct about the topic?",
      questionType: "mcq",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
    },
    {
      type: "checkpoint",
      role: "quickCheck",
      prompt: "Describe one feature of the topic. (2 marks)",
      questionType: "short",
      options: [],
      correctAnswer: "Award marks for a correct point and development.",
    },
    { type: "keyIdea", role: "finalMemoryRule", content: `Remember: ${topic} key rule.` },
  ];

  return {
    title: topic,
    topic,
    pages: [{ title: "Page 1", order: 1, blocks }],
  };
}

function allBlockText(draft) {
  return (draft.pages || [])
    .flatMap((p) => p.blocks || [])
    .map((b) => String(b.content ?? ""))
    .join("\n");
}

function openingSlotTitles(draft) {
  return (draft.pages?.[0]?.blocks || [])
    .slice(0, 9)
    .map((b) => String(b.title || "").trim());
}

function countBannedPhrases(text) {
  const hits = {};
  for (const { id, rx } of BANNED_PHRASES) {
    hits[id] = rx.test(text) ? 1 : 0;
  }
  return hits;
}

describe("placeholderCleanup3f3a (Phase 5B.3f.3A)", () => {
  const prevTf = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;

  beforeAll(() => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
  });

  afterAll(() => {
    if (prevTf === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevTf;
  });

  test.each(VALIDATION_TOPICS)("$topic: banned low-risk placeholders absent after sanitizeDraft", ({ topic, topicKey }) => {
    const draft = buildMinimalDraft(topic);
    const rolesBefore = (draft.pages[0].blocks || []).map((b) => b.role);
    const titlesBefore = openingSlotTitles(draft);

    const sanitized = sanitizeDraftForTest(draft, {
      topic,
      topicKey,
      subTopic: topic,
      subject: "Biology",
      level: "GCSE",
    });

    const text = allBlockText(sanitized);
    const hits = countBannedPhrases(text);
    expect(hits.threeMoves).toBe(0);
    expect(hits.oneGlanceGeneric).toBe(0);
    expect(hits.connectBiological).toBe(0);
    expect(hits.keyIdeaBecause).toBe(0);

    const rolesAfter = (sanitized.pages[0].blocks || []).map((b) => b.role);
    const titlesAfter = openingSlotTitles(sanitized);

    expect(titlesAfter.slice(0, 9)).toEqual([
      "Revision Objectives",
      "Prior Knowledge",
      "Definition",
      "Why it matters",
      "Core model",
      "Key examples",
      "Exam vocabulary",
      "Scenario",
      "Core Teaching",
    ]);
    expect(rolesAfter.filter((r) => r === "lessonObjectives").length).toBeGreaterThanOrEqual(1);
    expect(rolesBefore.length).toBeGreaterThan(0);
  });

  test("Mitosis topic may retain topic-specific V10 aha (not three-moves default)", () => {
    const topic = "Mitosis and the cell cycle";
    const draft = buildMinimalDraft(topic);
    const sanitized = sanitizeDraftForTest(draft, {
      topic,
      topicKey: "aqa-gcse-biology:mitosis",
      subTopic: topic,
      subject: "Biology",
      level: "GCSE",
    });
    const text = allBlockText(sanitized);
    expect(text).not.toMatch(/Anchor .+ in three moves/i);
    expect(text).toMatch(/mitosis|meiosis|diploid|haploid/i);
  });
});
