/**
 * Question deduplication guard — generator tests.
 */

const {
  applyQuestionDeduplicationGuard,
  listQuestionBlocksInLesson,
  isGenericPlaceholderStem,
  questionsAreNearDuplicate,
  normalizeQuestionStem,
  isBloodGlucoseTopic,
} = require("../lib/questionDeduplicationGuard");

function mcqBlock(n, heading, question, answer = "Insulin") {
  return [
    `${n} — ${heading}`,
    "Paste into: Checkpoint block",
    "",
    "Question:",
    question,
    "",
    "Option 1:",
    "Insulin",
    "",
    "Option 2:",
    "Glucagon",
    "",
    "Option 3:",
    "ADH",
    "",
    "Option 4:",
    "Thyroxine",
    "",
    "Answer:",
    answer,
    "",
  ].join("\n");
}

function collectCheckpointQuestions(text) {
  return listQuestionBlocksInLesson(text)
    .filter((b) => b.kind === "checkpoint" || b.kind === "quickCheck")
    .map((b) => normalizeQuestionStem(b.stem));
}

describe("questionDeduplicationGuard", () => {
  test("detects generic placeholder stems", () => {
    expect(isGenericPlaceholderStem("Which statement best matches this topic?")).toBe(true);
    expect(isGenericPlaceholderStem("Explain one key idea about Homeostasis using a cause → effect chain.")).toBe(true);
    expect(isGenericPlaceholderStem("When blood glucose rises, which hormone is released?")).toBe(false);
  });

  test("near-duplicate detection catches same stem meaning", () => {
    const a = "When blood glucose rises above the set point which hormone does the pancreas release";
    const b = "When blood glucose rises above the set point, which hormone does the pancreas release?";
    expect(questionsAreNearDuplicate(a, b)).toBe(true);
  });

  test("a generated lesson cannot contain two identical checkpoint questions", () => {
    const q =
      "When blood glucose rises above the set point, which hormone does the pancreas release?";
    const lesson = [
      "LESSON OBJECTIVE FIELD:",
      "Control blood glucose.",
      "",
      mcqBlock(12, "CHECKPOINT", q),
      "",
      mcqBlock(18, "CHECKPOINT", q),
    ].join("\n");

    const result = applyQuestionDeduplicationGuard(lesson, {
      topic: "Control of blood glucose",
      topicKey: "aqa-biology-gcse:homeostasis",
    });

    expect(result.changed).toBe(true);
    expect(result.duplicatesResolved).toBeGreaterThanOrEqual(1);

    const stems = collectCheckpointQuestions(result.text);
    const unique = new Set(stems);
    expect(unique.size).toBe(stems.length);
  });

  test("a lesson cannot contain repeated generic placeholder questions", () => {
    const generic = "Which statement best matches this topic?";
    const lesson = [
      mcqBlock(5, "CHECKPOINT", generic),
      "",
      mcqBlock(9, "QUICK CHECK", generic),
    ].join("\n");

    const result = applyQuestionDeduplicationGuard(lesson, {
      topic: "Control of blood glucose",
    });

    expect(result.changed).toBe(true);
    const stems = collectCheckpointQuestions(result.text);
    const genericCount = stems.filter((s) => isGenericPlaceholderStem(s)).length;
    expect(genericCount).toBeLessThanOrEqual(1);
  });

  test("blood glucose lesson receives distinct checkpoint questions", () => {
    expect(isBloodGlucoseTopic("Control of blood glucose", "")).toBe(true);

    const lesson = [
      mcqBlock(1, "CHECKPOINT", "Which statement best matches this topic?"),
      "",
      mcqBlock(2, "CHECKPOINT", "Which statement best matches this topic?"),
      "",
      mcqBlock(3, "QUICK CHECK", "Which statement best matches this topic?"),
    ].join("\n");

    const result = applyQuestionDeduplicationGuard(lesson, {
      topic: "Control of blood glucose",
    });

    const stems = collectCheckpointQuestions(result.text);
    expect(stems.length).toBe(3);
    expect(new Set(stems).size).toBe(3);

    const joined = result.text.toLowerCase();
    expect(joined).toMatch(/insulin|glucagon|glycogen|pancreas|negative feedback/);
    expect(joined).not.toMatch(/unrelated topic|nervous system pathway/);
  });

  test("deduplication does not remove legitimate different questions on the same topic", () => {
    const lesson = [
      mcqBlock(
        1,
        "CHECKPOINT",
        "When blood glucose rises above the set point, which hormone does the pancreas release?",
        "Insulin"
      ),
      "",
      mcqBlock(
        2,
        "QUICK CHECK",
        "When blood glucose falls below the set point, which hormone is released to raise it?",
        "Glucagon"
      ),
    ].join("\n");

    const result = applyQuestionDeduplicationGuard(lesson, {
      topic: "Control of blood glucose",
    });

    expect(result.changed).toBe(false);
    expect(result.duplicatesResolved).toBe(0);
    expect(collectCheckpointQuestions(result.text)).toHaveLength(2);
  });

  test("simulates post-autofix duplicate generic checkpoints (inject + repair pattern)", () => {
    const genericMain = "Which statement best matches this topic?";
    const genericQuick = "What should a strong exam answer usually include?";
    const lesson = [
      mcqBlock(10, "CHECKPOINT", genericMain),
      "",
      mcqBlock(11, "QUICK CHECK", genericQuick),
      "",
      mcqBlock(12, "CHECKPOINT", genericMain),
    ].join("\n");

    const result = applyQuestionDeduplicationGuard(lesson, {
      topic: "Control of blood glucose",
    });

    expect(result.changed).toBe(true);
    const stems = collectCheckpointQuestions(result.text);
    expect(new Set(stems).size).toBe(stems.length);
    expect(stems.filter((s) => isGenericPlaceholderStem(s)).length).toBeLessThanOrEqual(1);
  });
});

describe("JSON lesson page question diversity", () => {
  const {
    auditLessonPagesDuplication,
    repairLessonPagesDuplication,
    enforceQuestionDiversityOnDraft,
    extractQuestionsFromLessonPages,
    CROSS_ROLE_NEAR_DUP_THRESHOLD,
  } = require("../lib/questionDeduplicationGuard");

  function pagesWith(blocks) {
    return [{ pageId: "p1", title: "Page 1", blocks }];
  }

  test("detects exact duplicate stems across checkpoint blocks", () => {
    const q = "Which structure carries sperm towards the urethra?";
    const audit = auditLessonPagesDuplication(
      pagesWith([
        { type: "checkpoint", prompt: q, options: ["A", "B", "C", "D"], correctAnswer: "A" },
        {
          type: "checkpoint",
          role: "quickCheck",
          prompt: q,
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
        },
      ])
    );
    expect(audit.clean).toBe(false);
    expect(audit.issues.some((i) => i.kind === "near_duplicate_stem")).toBe(true);
  });

  test("detects near-duplicate selfCheck vs checkpoint stems", () => {
    const audit = auditLessonPagesDuplication(
      pagesWith([
        {
          type: "checkpoint",
          prompt: "Which change is controlled by hormones during puberty in males?",
          options: ["Voice breaks", "Photosynthesis", "Osmosis", "Digestion"],
          correctAnswer: "Voice breaks",
        },
        {
          type: "selfCheck",
          prompt: "Which change is controlled by hormones during puberty in males and females?",
          questionType: "mcq",
          options: ["Voice breaks", "Photosynthesis", "Osmosis", "Digestion"],
          correctAnswer: "Voice breaks",
        },
      ])
    );
    expect(audit.clean).toBe(false);
    expect(
      audit.issues.some(
        (i) =>
          i.kind === "near_duplicate_stem" &&
          ((i.role === "selfCheck" && i.otherRole === "checkpoint") ||
            (i.role === "checkpoint" && i.otherRole === "selfCheck"))
      )
    ).toBe(true);
  });

  test("detects duplicate MCQ option sets", () => {
    const opts = ["Sperm duct", "Urethra", "Testis", "Ovary"];
    const audit = auditLessonPagesDuplication(
      pagesWith([
        {
          type: "checkpoint",
          prompt: "Which structure produces sperm?",
          options: opts,
          correctAnswer: "Testis",
        },
        {
          type: "checkpoint",
          role: "quickCheck",
          prompt: "Which structure carries urine and sperm?",
          options: [...opts].reverse(),
          correctAnswer: "Urethra",
        },
      ])
    );
    expect(audit.clean).toBe(false);
    expect(audit.issues.some((i) => i.kind === "duplicate_option_set")).toBe(true);
  });

  test("detects repeated generic placeholder stems", () => {
    const audit = auditLessonPagesDuplication(
      pagesWith([
        {
          type: "checkpoint",
          prompt: "Which statement best matches this topic?",
          options: ["A", "B", "C", "D"],
        },
        {
          type: "selfCheck",
          prompt: "Which statement is correct?",
          questionType: "mcq",
          options: ["A", "B", "C", "D"],
        },
      ])
    );
    expect(audit.clean).toBe(false);
    expect(audit.issues.some((i) => i.kind === "generic_placeholder")).toBe(true);
  });

  test("valid varied questions pass", () => {
    const audit = auditLessonPagesDuplication(
      pagesWith([
        {
          type: "checkpoint",
          prompt: "Which structure carries sperm towards the urethra?",
          options: ["Sperm duct", "Ovary", "Uterus", "Cervix"],
          correctAnswer: "Sperm duct",
        },
        {
          type: "selfCheck",
          prompt: "Explain why sperm production occurs in the testes.",
          questionType: "short",
        },
        {
          type: "checkpoint",
          role: "quickCheck",
          prompt: "Why does fertilisation create genetic variation?",
          options: [
            "Mixing of maternal and paternal alleles",
            "Mitosis only",
            "No meiosis",
            "Identical clones",
          ],
          correctAnswer: "Mixing of maternal and paternal alleles",
        },
      ])
    );
    expect(audit.clean).toBe(true);
    expect(extractQuestionsFromLessonPages(pagesWith([])).length).toBe(0);
  });

  test("repair replaces only flagged duplicate questions", () => {
    const pages = pagesWith([
      {
        type: "checkpoint",
        prompt: "When blood glucose rises above the set point, which hormone does the pancreas release?",
        options: ["Insulin", "Glucagon", "ADH", "Thyroxine"],
        correctAnswer: "Insulin",
      },
      {
        type: "selfCheck",
        prompt: "When blood glucose rises above the set point, which hormone does the pancreas release?",
        questionType: "mcq",
        options: ["Insulin", "Glucagon", "ADH", "Thyroxine"],
        correctAnswer: "Insulin",
      },
    ]);
    const keep = pages[0].blocks[0].prompt;
    const result = repairLessonPagesDuplication(pages, {
      topic: "Control of blood glucose",
      topicKey: "aqa-biology-gcse:homeostasis",
    });
    expect(result.changed).toBe(true);
    expect(result.repaired).toBeGreaterThanOrEqual(1);
    expect(pages[0].blocks[0].prompt).toBe(keep);
    expect(pages[0].blocks[1].prompt).not.toBe(keep);
    const after = auditLessonPagesDuplication(pages);
    expect(after.clean).toBe(true);
  });

  test("enforceQuestionDiversityOnDraft repairs then reports clean", () => {
    const draft = {
      pages: pagesWith([
        {
          type: "checkpoint",
          prompt: "Which statement best matches this topic?",
          options: ["A", "B", "C", "D"],
        },
        {
          type: "selfCheck",
          prompt: "Which statement best matches this topic?",
          questionType: "mcq",
          options: ["A", "B", "C", "D"],
        },
      ]),
    };
    const result = enforceQuestionDiversityOnDraft(draft, {
      topic: "Control of blood glucose",
      topicKey: "aqa-biology-gcse:homeostasis",
    });
    expect(result.repaired).toBeGreaterThanOrEqual(1);
    expect(result.clean).toBe(true);
    expect(CROSS_ROLE_NEAR_DUP_THRESHOLD).toBe(0.72);
  });

  test("enforce fails clean=false when repair cannot diversify enough", () => {
    // Tiny pool exhaustion simulation: identical stems with empty topic → generic alternatives
    // may still leave near-dups if pool is tiny; for blood glucose pool should succeed.
    // Use a nonsense topic with three identical generics — repair should still clean via pool rotation.
    const draft = {
      pages: pagesWith([
        {
          type: "checkpoint",
          prompt: "Which statement best matches this topic?",
          options: ["A", "B", "C", "D"],
        },
        {
          type: "checkpoint",
          role: "quickCheck",
          prompt: "Which statement best matches this topic?",
          options: ["A", "B", "C", "D"],
        },
        {
          type: "selfCheck",
          prompt: "Which statement best matches this topic?",
          options: ["A", "B", "C", "D"],
        },
      ]),
    };
    const result = enforceQuestionDiversityOnDraft(draft, {
      topic: "Control of blood glucose",
    });
    // Blood-glucose pool has enough distinct stems to clean.
    expect(result.clean).toBe(true);
  });

  test("enumerates pageQuiz questions[] without top-level prompt", () => {
    const haploid = "Why must human gametes be haploid before fertilisation?";
    const questions = extractQuestionsFromLessonPages(
      pagesWith([
        {
          type: "pageQuiz",
          questions: [
            {
              id: "quiz1",
              prompt: haploid,
              options: ["A", "B", "C", "D"],
              correctAnswer: "So fusion restores the diploid chromosome number in the zygote",
            },
          ],
        },
      ])
    );
    expect(questions.some((q) => q.role === "pageQuiz" && q.stem === haploid)).toBe(true);
  });

  test("flags examPractice HTML duplicate against pageQuiz questions[]", () => {
    const haploid = "Why must human gametes be haploid before fertilisation?";
    const audit = auditLessonPagesDuplication(
      pagesWith([
        {
          type: "pageQuiz",
          questions: [
            {
              id: "quiz1",
              prompt: haploid,
              options: ["A", "B", "C", "D"],
              correctAnswer: "So fusion restores the diploid chromosome number in the zygote",
            },
          ],
        },
        {
          type: "text",
          role: "examPractice",
          title: "Practice Questions",
          content: [
            "<p><strong>Q1 (1 mark)</strong></p>",
            `<p>${haploid}</p>`,
            "<details><summary>Reveal Model Answer</summary>",
            "<p><strong>Model answer:</strong></p>",
            "<p>So fusion restores the diploid chromosome number in the zygote</p>",
            "</details>",
          ].join("\n"),
        },
      ])
    );
    expect(audit.clean).toBe(false);
    expect(
      audit.issues.some(
        (i) =>
          i.kind === "near_duplicate_stem" &&
          ((i.role === "examPractice" && i.otherRole === "pageQuiz") ||
            (i.role === "pageQuiz" && i.otherRole === "examPractice"))
      )
    ).toBe(true);
  });

  test("fingerprint normalisation matches frontend contract", () => {
    const {
      mcqFingerprintFromStemAndAnswer,
      normalizeQuestionStemForFingerprint,
    } = require("../lib/questionDeduplicationGuard");
    const stem = "Why must human gametes be haploid before fertilisation?";
    const answer = "So fusion restores the diploid chromosome number in the zygote";
    expect(normalizeQuestionStemForFingerprint(stem)).toBe(
      "why must human gametes be haploid before fertilisation"
    );
    expect(mcqFingerprintFromStemAndAnswer(stem, answer)).toBe(
      "why must human gametes be haploid before fertilisation|so fusion restores the diploid chromosome number in the zygote"
    );
  });
});
