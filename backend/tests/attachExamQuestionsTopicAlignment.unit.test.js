/**
 * Regression: Question Bank modal (GET /exam-questions) and attach-by-topic must
 * resolve the same Edexcel topic namespace when specKey is provided.
 */
const { buildTopicSelectorQueryClause } = require("../utils/examQuestionTopicSelectorMatch");
const { queryCandidates, parseTopicKey } = require("../utils/topicKey");
const { resolveQuestionBankNamespacedTopicKey } = require("../utils/resolveTopicRuntimeKeys");

function topicKeyCandidatesFromClause(clause) {
  if (clause.topicKey?.$in) return clause.topicKey.$in;
  if (Array.isArray(clause.$or) && clause.$or[0]?.topicKey?.$in) return clause.$or[0].topicKey.$in;
  return [];
}

function attachByTopicTopicKeyFilter(namespacedTopicKey) {
  const parsed = parseTopicKey(namespacedTopicKey);
  const specKey = parsed.specKey || "aqa-gcse-biology";
  const bankNs = resolveQuestionBankNamespacedTopicKey(specKey, namespacedTopicKey);
  const bankParsed = parseTopicKey(bankNs);
  const queryCands = queryCandidates(bankParsed.specKey || specKey, bankParsed.topicKey);
  return queryCands.length > 0 ? { topicKey: { $in: queryCands } } : { topicKey: bankNs };
}

describe("attachExamQuestions topic alignment", () => {
  test("Edexcel Mutation: modal with specKey matches attach-by-topic namespace", () => {
    const slug = "mutation";
    const namespaced = "edexcel-igcse-biology:mutation";

    const modalClause = buildTopicSelectorQueryClause({
      specKey: "edexcel-igcse-biology",
      topicKey: slug,
    });
    const attachFilter = attachByTopicTopicKeyFilter(namespaced);

    const modalCandidates = topicKeyCandidatesFromClause(modalClause.clause).sort();
    const attachCandidates = attachFilter.topicKey.$in.slice().sort();

    expect(modalCandidates).toEqual(attachCandidates);
    expect(modalCandidates).toContain(namespaced);
    expect(modalCandidates).not.toContain("aqa-gcse-biology:mutation");
  });

  test("Edexcel Mutation slug without specKey still defaults to AQA (documents unsafe modal path)", () => {
    const slug = "mutation";
    const modalWithoutSpec = buildTopicSelectorQueryClause({ topicKey: slug });
    const modalWithSpec = buildTopicSelectorQueryClause({
      specKey: "edexcel-igcse-biology",
      topicKey: slug,
    });

    const withoutSpecCandidates = topicKeyCandidatesFromClause(modalWithoutSpec.clause);
    const withSpecCandidates = topicKeyCandidatesFromClause(modalWithSpec.clause);

    expect(withoutSpecCandidates).toContain("aqa-gcse-biology:mutation");
    expect(withoutSpecCandidates).not.toContain("edexcel-igcse-biology:mutation");
    expect(withSpecCandidates).toContain("edexcel-igcse-biology:mutation");
  });
});
