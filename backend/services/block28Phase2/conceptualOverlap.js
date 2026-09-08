/**
 * Block 28 Phase 2 — conceptual (biological content) overlap detection.
 */
const { jaccardSimilarity, normalizeForCompare } = require("./qualityGates");

const TOPIC_SIGNATURE_RULES = [
  { id: "meiosis_fertilisation_combo", test: (q) => /meiosis/i.test(q) && /fertil/i.test(q) },
  {
    id: "meiosis_genetic_variation",
    test: (q) => {
      if (!/\bmeiosis\b/i.test(q)) return false;
      if (/\bgenetic (variation|diversity)\b/i.test(q)) return true;
      if (/\bcrossing over\b/i.test(q)) return true;
      if (/\bindependent assortment\b/i.test(q)) return true;
      if (/\bleads? to genetic variation\b/i.test(q)) return true;
      return false;
    },
  },
  {
    id: "meiosis_chromosome_halving",
    test: (q) => {
      if (!/\bmeiosis\b/i.test(q)) return false;
      if (/\b(stages?|meiosis i|meiosis ii|two divisions|how many divisions|homologous chromosomes|sister chromatids)\b/i.test(q)) {
        return false;
      }
      if (/\bwhat does meiosis produce\b/i.test(q)) return true;
      if (/\bconsequences of not having meiosis\b/i.test(q)) return true;
      if (/\bstable chromosome numbers?\b/i.test(q)) return true;
      if (/\bhalv/i.test(q) && /\bchromosome\b/i.test(q)) return true;
      if (/\bwhy gametes must be haploid\b/i.test(q) || /\bgametes must be haploid\b/i.test(q)) return true;
      if (/\bmaintaining stable chromosome\b/i.test(q)) return true;
      return false;
    },
  },
  {
    id: "meiosis_two_divisions",
    test: (q) =>
      /\bmeiosis\b/i.test(q) &&
      /\b(stages?|two divisions|how many divisions|meiosis i|meiosis ii|homologous chromosomes|sister chromatids|recall the stages)\b/i.test(q),
  },
  { id: "fertilisation_genetic_variation", test: (q) => /fertil/i.test(q) && /genetic (variation|diversity)/i.test(q) },
  {
    id: "random_fertilisation_process",
    test: (q) => {
      if (/\bcompare\b.*\bmeiosis\b/i.test(q)) return false;
      if (/\bmeiosis and random fertil/i.test(q) && /\b(together|outline how|apply your knowledge)\b/i.test(q)) {
        return false;
      }
      if (/\brandom fertil/i.test(q)) return true;
      return false;
    },
  },
  {
    id: "meiosis_fertilisation_combined",
    test: (q) => {
      if (!/\bmeiosis\b/i.test(q) || !/\bfertil/i.test(q)) return false;
      if (
        /\bexplain how meiosis\b/i.test(q) &&
        /\b(gametes?|genetically different gametes)\b/i.test(q) &&
        !/\brandom\b/i.test(q)
      ) {
        return false;
      }
      if (/\bcompare\b.*\bmeiosis\b.*\brandom fertil/i.test(q)) return true;
      if (/\boutline how meiosis and random fertil/i.test(q)) return true;
      if (/\bapply your knowledge of meiosis and fertil/i.test(q)) return true;
      if (/\bwork together\b/i.test(q) && /\bmeiosis\b/i.test(q) && /\bfertil/i.test(q)) return true;
      return false;
    },
  },
  {
    id: "genetic_variation_survival",
    test: (q) => {
      if (/\bnatural selection\b/i.test(q)) return true;
      if (/\bevaluate\b.*\bgenetic variation\b.*\b(survival|evolution)\b/i.test(q)) return true;
      if (/\bjustify\b.*\bgenetic variation\b.*\b(survival|species)\b/i.test(q)) return true;
      if (/\bimportance of genetic variation\b.*\b(survival|species)\b/i.test(q)) return true;
      return false;
    },
  },
  { id: "meiosis_gametes_haploid", test: (q) => /meiosis/i.test(q) && /(gamete|haploid)/i.test(q) },
  { id: "uracil_thymine", test: (q) => /uracil/i.test(q) && /thymine/i.test(q) },
  {
    id: "uracil_standalone",
    test: (q) => {
      if (!/\buracil\b/i.test(q)) return false;
      if (
        /\b(give two structural differences|differences between rna and dna|outline the differences|structural differences between rna)\b/i.test(
          q
        )
      ) {
        return false;
      }
      return true;
    },
  },
  { id: "uracil_role", test: (q) => /uracil/i.test(q) && /(role|function|significance|differ)/i.test(q) },
  { id: "single_stranded_rna", test: (q) => /single[\s-]?stranded/i.test(q) && /rna/i.test(q) },
  {
    id: "rna_basic_structure_anchor",
    test: (q) => {
      if (!/\brna\b/i.test(q)) return false;
      if (/\bdescribe the (chemical )?structure of (an )?rna\b/i.test(q)) return true;
      if (/\boutline\b.*\brna'?s? structure\b/i.test(q)) return true;
      if (/\b(nucleotide|sugar-phosphate backbone|phosphodiester)\b/i.test(q) && /\b(describe|outline)\b/i.test(q)) {
        return true;
      }
      return false;
    },
  },
  {
    id: "rna_single_strand_function",
    test: (q) => {
      if (!/\brna\b/i.test(q)) return false;
      if (/\b(single[\s-]?stranded|single strand)\b/i.test(q) && /\b(useful|significance|function|fold)\b/i.test(q)) {
        return true;
      }
      if (/\b(suggest how the structure of rna|structure of rna allows)\b/i.test(q)) return true;
      if (/\bbeing single-stranded is useful\b/i.test(q)) return true;
      return false;
    },
  },
  {
    id: "rna_structure_protein_function_outline",
    test: (q) =>
      /\brna\b/i.test(q) &&
      /\bprotein synthesis\b/i.test(q) &&
      /\b(structure contributes|outline how|justify the necessity|justify the necessity)\b/i.test(q),
  },
  {
    id: "rna_dna_structure_compare",
    test: (q) =>
      /\brna\b/i.test(q) &&
      /\bdna\b/i.test(q) &&
      /(difference|compare|outline|contrast|versus|vs|give two structural)/i.test(q),
  },
  {
    id: "rna_ribose_sugar_compare",
    test: (q) =>
      /\b(ribose|deoxyribose)\b/i.test(q) &&
      /\b(rna|dna)\b/i.test(q) &&
      /\b(importance|analyse|compare|difference|contrast)\b/i.test(q),
  },
  {
    id: "rna_protein_synthesis_types",
    test: (q) =>
      /(mrna|trna|rrna)/i.test(q) ||
      (/\btypes? of rna\b/i.test(q) && /\bprotein synthesis\b/i.test(q)) ||
      (/\bevaluate\b/i.test(q) && /\btypes? of rna\b/i.test(q) && /\bprotein synthesis\b/i.test(q)),
  },
  {
    id: "rna_protein_synthesis_generic",
    test: (q) =>
      /\brna\b/i.test(q) &&
      /\bprotein synthesis\b/i.test(q) &&
      /\b(justify the necessity|justify)\b/i.test(q) &&
      !/(mrna|trna|rrna)/i.test(q),
  },
  {
    id: "dna_copying_replication_process",
    test: (q) => {
      if (!/\bdna\b/i.test(q)) return false;
      if (/\b(errors?|mutation|affect an organism)\b/i.test(q)) return false;
      if (/\breplication\b/i.test(q)) return true;
      if (/\b(copied|copying|copy)\b/i.test(q) && /\b(cell division|enables it to be copied)\b/i.test(q)) {
        return true;
      }
      if (/\bcomplementary base pairing\b/i.test(q) && /\breplication\b/i.test(q)) return true;
      return false;
    },
  },
  {
    id: "dna_double_helix_structure",
    test: (q) => {
      if (!/\bdna\b/i.test(q)) return false;
      if (/\bprotein synthesis\b/i.test(q)) return false;
      if (/\breplication\b/i.test(q) || /\b(copied|copying)\b/i.test(q)) return false;
      return (
        /\bdouble helix\b/i.test(q) ||
        /\bstructure of dna and its components\b/i.test(q) ||
        (/\bstructure of dna\b/i.test(q) && /\bcomponents\b/i.test(q))
      );
    },
  },
  { id: "complementary_base_pairing", test: (q) => /(complementary|base pairing)/i.test(q) && /dna/i.test(q) },
  { id: "dominant_recessive_alleles", test: (q) => /(dominant|recessive)/i.test(q) && /allele/i.test(q) },
  {
    id: "alleles_inheritance_process",
    test: (q) =>
      /allele/i.test(q) &&
      /(one allele from each parent|inherited from each parent|each parent via gametes|inherit.*from each parent|allele[s]? (are |is )?inherited from (each|both) parent|parents? to offspring|combination of alleles in the offspring|gametes?.*allele|contribute to the inheritance|inheritance of traits in humans|how alleles are inherited)/i.test(
        q
      ),
  },
  {
    id: "alleles_variation_mechanism",
    test: (q) =>
      /allele/i.test(q) &&
      /(variation within a species|genetic variation within|different alleles|different dna base sequences|cause variation in inherited characteristics)/i.test(
        q
      ),
  },
];

function extractConceptSignatures(question) {
  const q = String(question || "");
  return TOPIC_SIGNATURE_RULES.filter((rule) => rule.test(q)).map((rule) => rule.id);
}

function sharedSignatures(a, b) {
  const sa = new Set(extractConceptSignatures(a));
  const sb = new Set(extractConceptSignatures(b));
  return [...sa].filter((s) => sb.has(s));
}

/**
 * @returns {{ severity: 'LOW'|'MEDIUM'|'HIGH', similarity: number, sharedSignatures: string[], reason: string|null }}
 */
function assessConceptualOverlap(questionA, questionB) {
  const shared = sharedSignatures(questionA, questionB);
  const lexical = jaccardSimilarity(questionA, questionB);
  const sigsA = extractConceptSignatures(questionA);
  const sigsB = extractConceptSignatures(questionB);

  const uracilStandalone = (sigs) => sigs.includes("uracil_standalone") || sigs.includes("uracil_role");
  if (
    (uracilStandalone(sigsA) && sigsB.includes("rna_dna_structure_compare")) ||
    (uracilStandalone(sigsB) && sigsA.includes("rna_dna_structure_compare"))
  ) {
    return {
      severity: "HIGH",
      similarity: lexical,
      sharedSignatures: shared,
      reason: "Standalone uracil question subsumed by RNA-vs-DNA comparison",
    };
  }
  if (
    (sigsA.includes("rna_ribose_sugar_compare") && sigsB.includes("rna_dna_structure_compare")) ||
    (sigsB.includes("rna_ribose_sugar_compare") && sigsA.includes("rna_dna_structure_compare"))
  ) {
    return {
      severity: "HIGH",
      similarity: lexical,
      sharedSignatures: shared,
      reason: "Ribose sugar comparison subsumed by RNA-vs-DNA structural comparison",
    };
  }

  if (shared.length >= 2 || (shared.length === 1 && lexical >= 0.35)) {
    return {
      severity: "HIGH",
      similarity: lexical,
      sharedSignatures: shared,
      reason: `Shared biological content chain: ${shared.join(", ")}`,
    };
  }
  if (shared.length === 1) {
    const sig = shared[0];
    const inheritanceVsVariation =
      (sig === "alleles_inheritance_process" || sig === "alleles_variation_mechanism") &&
      extractConceptSignatures(questionA).length === 1 &&
      extractConceptSignatures(questionB).length === 1 &&
      extractConceptSignatures(questionA)[0] !== extractConceptSignatures(questionB)[0];
    if (inheritanceVsVariation) {
      return { severity: "LOW", similarity: lexical, sharedSignatures: shared, reason: null };
    }
    const sigsA = extractConceptSignatures(questionA);
    const sigsB = extractConceptSignatures(questionB);
    const combinedMeiosisFert =
      sigsA.includes("meiosis_fertilisation_combined") || sigsB.includes("meiosis_fertilisation_combined");
    const meiosisGameteOnly = (sigs) =>
      sigs.includes("meiosis_genetic_variation") &&
      !sigs.includes("meiosis_fertilisation_combined") &&
      !sigs.includes("random_fertilisation_process");
    if (combinedMeiosisFert && (meiosisGameteOnly(sigsA) || meiosisGameteOnly(sigsB))) {
      return { severity: "LOW", similarity: lexical, sharedSignatures: shared, reason: null };
    }
    const rnaBasicAnchor = (sigs) => sigs.includes("rna_basic_structure_anchor");
    const rnaSingleStrandFn = (sigs) =>
      sigs.includes("rna_single_strand_function") || sigs.includes("single_stranded_rna");
    if (
      (rnaBasicAnchor(sigsA) && rnaSingleStrandFn(sigsB)) ||
      (rnaBasicAnchor(sigsB) && rnaSingleStrandFn(sigsA))
    ) {
      return { severity: "LOW", similarity: lexical, sharedSignatures: shared, reason: null };
    }
    if (
      (rnaBasicAnchor(sigsA) && sigsB.includes("rna_dna_structure_compare")) ||
      (rnaBasicAnchor(sigsB) && sigsA.includes("rna_dna_structure_compare"))
    ) {
      return { severity: "LOW", similarity: lexical, sharedSignatures: shared, reason: null };
    }
    if (
      (rnaBasicAnchor(sigsA) && sigsB.includes("rna_protein_synthesis_types")) ||
      (rnaBasicAnchor(sigsB) && sigsA.includes("rna_protein_synthesis_types"))
    ) {
      return { severity: "LOW", similarity: lexical, sharedSignatures: shared, reason: null };
    }
    const meiosisCluster =
      sig === "meiosis_genetic_variation" ||
      sig === "meiosis_chromosome_halving" ||
      sig === "meiosis_two_divisions";
    const randomFertCluster =
      sig === "random_fertilisation_process" ||
      sig === "meiosis_fertilisation_combined" ||
      sig === "genetic_variation_survival";
    const rnaCluster =
      sig === "rna_protein_synthesis_types" ||
      sig === "rna_structure_protein_function_outline" ||
      sig === "rna_single_strand_function" ||
      sig === "single_stranded_rna" ||
      sig === "uracil_standalone" ||
      sig === "uracil_role" ||
      sig === "uracil_thymine" ||
      sig === "rna_ribose_sugar_compare";
    if (meiosisCluster || randomFertCluster || rnaCluster) {
      return {
        severity: "HIGH",
        similarity: lexical,
        sharedSignatures: shared,
        reason: `Material conceptual duplication: ${shared[0]}`,
      };
    }
    const highThreshold =
      sig === "alleles_inheritance_process" ||
      sig === "dominant_recessive_alleles" ||
      sig === "dna_copying_replication_process" ||
      sig === "dna_double_helix_structure" ||
      sig === "meiosis_genetic_variation" ||
      sig === "meiosis_chromosome_halving"
        ? 0.12
        : 0.28;
    if (sig === "single_stranded_rna" && lexical >= 0.2) {
      return {
        severity: "HIGH",
        similarity: lexical,
        sharedSignatures: shared,
        reason: `Material conceptual duplication: ${shared[0]}`,
      };
    }
    if (
      (sig === "uracil_standalone" || sig === "uracil_role" || sig === "uracil_thymine") &&
      (sigsA.includes("rna_dna_structure_compare") || sigsB.includes("rna_dna_structure_compare"))
    ) {
      return {
        severity: "HIGH",
        similarity: lexical,
        sharedSignatures: shared,
        reason: `Material conceptual duplication: ${shared[0]}`,
      };
    }
    if (lexical >= highThreshold) {
      return {
        severity: "HIGH",
        similarity: lexical,
        sharedSignatures: shared,
        reason: `Material conceptual duplication: ${shared[0]}`,
      };
    }
    return {
      severity: "MEDIUM",
      similarity: lexical,
      sharedSignatures: shared,
      reason: `Related biological theme: ${shared[0]}`,
    };
  }
  if (lexical >= 0.72) {
    return {
      severity: "HIGH",
      similarity: lexical,
      sharedSignatures: shared,
      reason: "Near-identical question wording",
    };
  }
  if (lexical >= 0.55) {
    return {
      severity: "MEDIUM",
      similarity: lexical,
      sharedSignatures: shared,
      reason: "Substantial lexical overlap",
    };
  }
  const na = normalizeForCompare(questionA);
  const nb = normalizeForCompare(questionB);
  if (na === nb) {
    return { severity: "HIGH", similarity: 1, sharedSignatures: shared, reason: "Exact duplicate stem" };
  }
  return { severity: "LOW", similarity: lexical, sharedSignatures: shared, reason: null };
}

function findConceptualOverlapPairs(questions) {
  const pairs = [];
  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      const qa = questions[i].proposedQuestion || questions[i].question || questions[i].originalQuestion;
      const qb = questions[j].proposedQuestion || questions[j].question || questions[j].originalQuestion;
      const assessment = assessConceptualOverlap(qa, qb);
      if (assessment.severity !== "LOW") {
        pairs.push({
          studentQA: questions[i].proposedStudentPosition || i + 1,
          studentQB: questions[j].proposedStudentPosition || j + 1,
          questionIdA: questions[i].questionId,
          questionIdB: questions[j].questionId,
          questionA: qa,
          questionB: qb,
          ...assessment,
        });
      }
    }
  }
  return pairs;
}

function maxOverlapRiskForQuestion(questionId, pairs) {
  const relevant = pairs.filter((p) => p.questionIdA === questionId || p.questionIdB === questionId);
  if (relevant.some((p) => p.severity === "HIGH")) return "HIGH";
  if (relevant.some((p) => p.severity === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

module.exports = {
  TOPIC_SIGNATURE_RULES,
  extractConceptSignatures,
  assessConceptualOverlap,
  findConceptualOverlapPairs,
  maxOverlapRiskForQuestion,
};
