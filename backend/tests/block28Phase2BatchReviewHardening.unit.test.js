/**
 * Block 28 Phase 2 batch review hardening — golden regression tests (no DB writes).
 */
const { deriveLessonContentBoundary } = require("../services/block28Phase2/lessonContentBoundary");
const { analyzeCoverageGaps } = require("../services/block28Phase2/coverageAnalysis");
const {
  isNoiseToken,
  isMeaningfulObjective,
  filterMeaningfulObjectives,
} = require("../services/block28Phase2/coverageGapFilter");
const {
  isGenericFillerPoint,
  assessSemanticReadiness,
  SCHEME_STATUS,
} = require("../services/block28Phase2/schemeQuality");
const {
  assessConceptualOverlap,
  findConceptualOverlapPairs,
} = require("../services/block28Phase2/conceptualOverlap");
const {
  proposeRetainedRepair,
  MARK_DEMAND,
  isSimpleRecallStem,
} = require("../services/block28Phase2/repairProposals");
const { proposeFinalSet, classifyAttachments, SELECTION } = require("../services/block28Phase2/selectionEngine");
const { auditLessonAttachments } = require("../services/block28Phase2/lessonAttachmentAudit");
const { buildLessonReviewPack, PACK_STATUS, resolvePackStatus } = require("../services/block28Phase2/batchReviewPack");

function oid(n) {
  return String(n).padStart(24, "0").slice(0, 24);
}

function makeMaster(id, overrides = {}) {
  return {
    _id: oid(id),
    type: "short",
    subject: "Biology",
    examBoard: "Edexcel",
    level: "IGCSE",
    topicKey: overrides.topicKey || "edexcel-igcse-biology:alleles",
    question: overrides.question || "Explain what an allele is.",
    marks: overrides.marks ?? 4,
    markScheme: overrides.markScheme ?? ["Point one.", "Point two."],
    status: "published",
    ...overrides,
  };
}

function makeLesson(id, refs, pages = [], overrides = {}) {
  return {
    _id: oid(id),
    title: overrides.title || "Alleles",
    topicKey: overrides.topicKey || "edexcel-igcse-biology:alleles",
    status: "published",
    pages,
    examQuestions: refs.map((r, i) => ({
      questionId: oid(r.q),
      addedAt: new Date(`2026-01-0${i + 1}`),
    })),
    ...overrides,
  };
}

describe("Block 28 Phase 2 batch review hardening", () => {
  describe("Alleles — coverage gap noise rejected", () => {
    test("stopwords, URLs and prior-knowledge fragments are not meaningful objectives", () => {
      expect(isNoiseToken("each")).toBe(true);
      expect(isNoiseToken("lesson")).toBe(true);
      expect(isMeaningfulObjective("each")).toBe(false);
      expect(isMeaningfulObjective("lesson")).toBe(false);
      expect(
        isMeaningfulObjective("https://storage.supabase.co/lesson-media/dyjiwezataxahbpuxjhz.png")
      ).toBe(false);
      expect(isMeaningfulObjective("Prior knowledge before we start: students should already know genes")).toBe(
        false
      );
    });

    test("meaningful objectives filter excludes noise from Alleles lesson boundary", () => {
      const lesson = makeLesson(
        1,
        [],
        [
          {
            blocks: [
              { text: "<p>each lesson page https://storage.supabase.co/lesson-media/foo.png</p>" },
              {
                text:
                  "Explain how dominant and recessive alleles determine phenotype in inherited characteristics.",
              },
            ],
          },
        ],
        { title: "Alleles" }
      );
      const boundary = deriveLessonContentBoundary(lesson);
      expect(boundary.meaningfulObjectives.some((o) => /each|lesson|supabase|https/i.test(o))).toBe(false);
      expect(boundary.meaningfulKeyTerms).not.toContain("each");
      expect(boundary.meaningfulKeyTerms).not.toContain("lesson");
    });

    test("coverage analysis does not propose NEW_MASTER for each/lesson tokens", () => {
      const boundary = {
        meaningfulObjectives: filterMeaningfulObjectives([
          "each",
          "lesson",
          "https://storage.supabase.co/lesson-media/foo.png",
          "Explain how dominant and recessive alleles determine phenotype in inherited characteristics.",
        ]),
        meaningfulKeyTerms: ["allele", "dominant", "recessive"],
        keyTerms: ["each", "lesson", "allele"],
      };
      const repairs = [
        {
          proposedQuestion: "Explain the significance of dominant and recessive alleles in genetic inheritance.",
          proposedMarks: 4,
          proposedScheme: [
            "Dominant allele masks expression of recessive allele in heterozygotes.",
            "Recessive allele only expressed when homozygous recessive.",
            "Alleles are alternative forms of the same gene at a locus.",
            "Phenotype depends on allele combination inherited from parents.",
          ],
        },
      ];
      const coverage = analyzeCoverageGaps(boundary, repairs, []);
      const gaps = coverage.gapProposals.map((g) => g.gap.toLowerCase());
      expect(gaps).not.toContain("each");
      expect(gaps).not.toContain("lesson");
      expect(gaps.some((g) => g.includes("http"))).toBe(false);
    });
  });

  describe("Generic mark-scheme filler banned", () => {
    const fillerExamples = [
      "Describes the process or mechanism relevant to the question.",
      "Links the explanation to the biological context in the question.",
      "Provides evidence or reasoning supporting one side of the comparison or evaluation.",
      "Provides contrasting evidence or a counter-argument.",
      "Gives further detail.",
      "Explains significance in general terms.",
    ];

    test.each(fillerExamples)("detects generic filler: %s", (point) => {
      expect(isGenericFillerPoint(point)).toBe(true);
    });

    test("repair reduces marks instead of inventing filler when scheme count < marks", () => {
      const repair = proposeRetainedRepair({
        questionId: oid(1),
        question: "Evaluate the importance of alleles in causing variation in inherited characteristics.",
        marks: 4,
        markScheme: ["Alleles are alternative forms of a gene.", "Different alleles produce different phenotypes."],
        markSchemeCount: 2,
      });
      expect(repair.proposedScheme.some(isGenericFillerPoint)).toBe(false);
      expect(repair.proposedMarks).toBe(2);
      expect(repair.proposedScheme).toHaveLength(2);
      expect(repair.semanticReadiness).not.toBe("PASS");
      expect(repair.markDemand.verdict).toBe(MARK_DEMAND.BORDERLINE);
    });

    test("semantic readiness fails on generic filler in proposed scheme", () => {
      const result = assessSemanticReadiness({
        marks: 4,
        markScheme: [
          "Dominant allele masks recessive allele in heterozygotes.",
          "Describes the process or mechanism relevant to the question.",
          "Recessive allele expressed only when homozygous.",
          "Alleles are alternative forms of the same gene.",
        ],
        markDemand: { verdict: MARK_DEMAND.NATURAL },
        schemeStatus: SCHEME_STATUS.READY,
      });
      expect(result.semanticReadiness).not.toBe("PASS");
      expect(result.reasons).toContain("generic_filler_points");
    });
  });

  describe("Random Fertilisation — conceptual overlap detection", () => {
    const meiosisFertQuestions = [
      "Compare the processes of meiosis and random fertilisation in terms of their contributions to genetic variation.",
      "Apply your knowledge of meiosis and fertilisation to explain how they work together to increase genetic variation.",
      "Outline how meiosis and random fertilisation together contribute to genetic diversity in a population.",
      "Explain how meiosis contributes to genetic variation in gametes.",
    ];

    test("flags HIGH overlap among meiosis + fertilisation combination questions", () => {
      const pairs = [];
      for (let i = 0; i < meiosisFertQuestions.length; i++) {
        for (let j = i + 1; j < meiosisFertQuestions.length; j++) {
          const assessment = assessConceptualOverlap(meiosisFertQuestions[i], meiosisFertQuestions[j]);
          if (assessment.severity === "HIGH") pairs.push({ i, j, assessment });
        }
      }
      expect(pairs.length).toBeGreaterThan(0);
    });

    test("findConceptualOverlapPairs surfaces material duplication in final set", () => {
      const questions = meiosisFertQuestions.map((q, i) => ({
        questionId: oid(i + 1),
        question: q,
        proposedStudentPosition: i + 1,
      }));
      const pairs = findConceptualOverlapPairs(questions);
      const highPairs = pairs.filter((p) => p.severity === "HIGH");
      expect(highPairs.length).toBeGreaterThan(0);
    });
  });

  describe("RNA Structure — repeated uracil/thymine and single-strand content", () => {
    const rnaQuestions = [
      "Explain the role of uracil in RNA and how it differs from thymine in DNA.",
      "Explain why the presence of uracil instead of thymine is significant for RNA's function.",
      "Evaluate the significance of RNA being single-stranded in relation to its function in protein synthesis.",
      "Outline the differences between RNA and DNA in terms of their structure and function.",
    ];

    test("detects repeated uracil/thymine conceptual overlap", () => {
      const a = assessConceptualOverlap(rnaQuestions[0], rnaQuestions[1]);
      expect(a.severity).toBe("HIGH");
      expect(a.sharedSignatures).toContain("uracil_thymine");
    });

    test("detects single-stranded RNA conceptual overlap", () => {
      const a = assessConceptualOverlap(
        "Evaluate the significance of RNA being single-stranded in relation to its function in protein synthesis.",
        "Outline how RNA's single-stranded structure allows it to fold and bind during protein synthesis."
      );
      expect(a.severity).toBe("HIGH");
      expect(a.sharedSignatures).toContain("single_stranded_rna");
    });
  });

  describe("Meiosis — mark demand and selection", () => {
    test("1-mark recall items may remain 1 mark", () => {
      expect(isSimpleRecallStem("What is the chromosome number in a human gamete?")).toBe(true);
      const repair = proposeRetainedRepair({
        questionId: oid(1),
        question: "What is the chromosome number in a human gamete?",
        marks: 1,
        markScheme: ["23 chromosomes in a human gamete."],
      });
      expect(repair.proposedMarks).toBe(1);
      expect(repair.markDemand.verdict).toBe(MARK_DEMAND.NATURAL);
    });

    test("does not pad to 10 with recall promotion when strong set is smaller", () => {
      const masters = new Map();
      const refs = [];
      const stems = [
        "Analyse the role of crossing over during meiosis and its effect on genetic diversity.",
        "Explain how meiosis contributes to genetic variation in offspring.",
        "What is the chromosome number in a human gamete?",
        "Where does meiosis take place in humans?",
        "How does meiosis lead to genetic variation?",
        "What does meiosis produce and why is the chromosome number halved?",
        "Recall the stages of meiosis and describe their significance in producing gametes.",
        "Analyse how errors in meiosis can lead to genetic disorders.",
      ];
      for (let i = 0; i < stems.length; i++) {
        const marks = stems[i].startsWith("What") || stems[i].startsWith("Where") ? 1 : 4;
        const scheme =
          marks === 1
            ? ["Valid biology point."]
            : ["Meiosis produces haploid gametes.", "Crossing over increases allele combinations.", "Independent assortment shuffles chromosomes.", "Gametes fuse at fertilisation restoring diploid number."];
        const m = makeMaster(i + 1, {
          topicKey: "edexcel-igcse-biology:meiosis",
          question: stems[i],
          marks,
          markScheme: scheme.slice(0, marks),
        });
        masters.set(oid(i + 1), m);
        refs.push({ q: i + 1 });
      }
      const lesson = makeLesson(3, refs, [{ blocks: [{ text: "Meiosis produces haploid gametes." }] }], {
        title: "Meiosis",
        topicKey: "edexcel-igcse-biology:meiosis",
      });
      const usage = new Map(refs.map((r) => [oid(r.q), 1]));
      const audit = auditLessonAttachments(lesson, masters, usage);
      const boundary = deriveLessonContentBoundary(lesson);
      const { classified } = classifyAttachments(audit, boundary);
      const { selected, belowRecommendedSize, selectionNote } = proposeFinalSet(classified, boundary);
      expect(selected.length).toBeLessThanOrEqual(10);
      expect(selected.filter((s) => s.marks === 1).length).toBeLessThanOrEqual(3);
      if (selected.length < 10) {
        expect(selectionNote).toMatch(/not padded to 10/i);
      }
    });
  });

  describe("DNA Structure — mark reduction requires justification", () => {
    test("generic filler cannot convert 4/2 into 4/4", () => {
      const repair = proposeRetainedRepair({
        questionId: oid(1),
        question: "Explain the structure of DNA and its components.",
        marks: 4,
        markScheme: ["DNA is a double helix.", "Bases pair complementarily."],
      });
      expect(repair.proposedScheme).toHaveLength(2);
      expect(repair.proposedScheme.some(isGenericFillerPoint)).toBe(false);
      expect(repair.proposedMarks).toBe(2);
      expect(repair.markDemand.verdict).toBe(MARK_DEMAND.BORDERLINE);
      expect(repair.markDemand.note).toMatch(/Reduced from 4 to 2/i);
      expect(repair.repairNote).toMatch(/reduce|lower|marks/i);
      expect(repair.semanticReadiness).not.toBe("PASS");
    });

    test("BORDERLINE flagged when evaluate question lacks independent assessable ideas", () => {
      const repair = proposeRetainedRepair({
        questionId: oid(2),
        question: "Evaluate the importance of complementary base pairing in DNA replication.",
        marks: 4,
        markScheme: ["Adenine pairs with thymine.", "Guanine pairs with cytosine."],
      });
      expect([MARK_DEMAND.BORDERLINE, MARK_DEMAND.ARTIFICIALLY_PADDED]).toContain(repair.markDemand.verdict);
      expect(repair.semanticReadiness).not.toBe("PASS");
    });
  });

  describe("Pack status confidence states", () => {
    test("unresolved final-set HIGH pairs block READY_FOR_HUMAN_REVIEW", () => {
      const status = resolvePackStatus({
        preSelectionHighPairs: 16,
        finalSetHighPairs: 2,
        unresolvedHighPairs: 2,
        unresolvedSchemeCount: 0,
        genericFillerCount: 0,
        semanticReviewRequiredCount: 0,
        borderlineCount: 0,
        semanticFailCount: 0,
      });
      expect(status).toBe(PACK_STATUS.BLOCKED_BY_DUPLICATION);
    });

    test("Random Fertilisation may have pre-selection HIGH but selection reduces final-set overlap", () => {
      const masters = new Map();
      const refs = [];
      const stems = [
        "Compare the processes of meiosis and random fertilisation in terms of their contributions to genetic variation.",
        "Apply your knowledge of meiosis and fertilisation to explain how they work together to increase genetic variation.",
        "Outline how meiosis and random fertilisation together contribute to genetic diversity in a population.",
        "Explain how meiosis contributes to genetic variation in gametes.",
        "Describe how random fertilisation can lead to unique traits in offspring.",
        "Outline the process of random fertilisation and its role in producing genetic diversity.",
        "Evaluate the significance of genetic variation in a population for survival and evolution.",
        "Explain the significance of alleles in the context of genetic variation.",
        "Analyse the role of genetic variation in the context of natural selection.",
        "Justify the importance of genetic variation for the survival of a species.",
      ];
      for (let i = 0; i < stems.length; i++) {
        const m = makeMaster(i + 1, {
          topicKey: "edexcel-igcse-biology:random-fertilisation",
          question: stems[i],
          marks: 4,
          markScheme: [
            "Meiosis produces genetically different haploid gametes.",
            "Random fertilisation fuses gametes unpredictably.",
            "New allele combinations increase genetic variation.",
            "Variation supports natural selection in changing environments.",
          ],
        });
        masters.set(oid(i + 1), m);
        refs.push({ q: i + 1 });
      }
      const lesson = makeLesson(4, refs, [{ blocks: [{ text: "Meiosis and fertilisation increase variation." }] }], {
        title: "Random Fertilisation & Genetic Variation",
        topicKey: "edexcel-igcse-biology:random-fertilisation",
      });
      const usage = new Map(refs.map((r) => [oid(r.q), 1]));
      const pack = buildLessonReviewPack(lesson, masters, usage);
      expect(pack.qualitySummary.preSelectionHighPairs).toBeGreaterThan(0);
      expect(pack.qualitySummary.finalSetHighPairs).toBe(0);
      expect(pack.qualitySummary.unresolvedHighPairs).toBe(0);
      expect(pack.packStatus).not.toBe(PACK_STATUS.BLOCKED_BY_DUPLICATION);
    });
  });

  describe("Alleles inheritance vs variation", () => {
    test("approved Q2 and Q5 stems are not false HIGH duplicates", () => {
      const assessment = assessConceptualOverlap(
        "Explain how alleles contribute to the inheritance of traits in humans.",
        "Describe how alleles cause variation in inherited characteristics within a species."
      );
      expect(assessment.severity).not.toBe("HIGH");
    });
  });
});
