/**
 * Mutation Q9 semantic marking fixtures — plumbing tests use mock LLM responses.
 */
module.exports = {
  question: "Explain how mutagens affect mutations in organisms.",
  marks: 4,
  markScheme: [
    "Mutations occur randomly in the genetic material.",
    "Mutagens increase the probability/rate of mutations occurring.",
    "Mutagens do not determine whether a mutation will be beneficial; mutations may be harmful, neutral or beneficial.",
    "A beneficial mutation may give a selective advantage and become more common through natural selection.",
  ],
  cases: [
    { id: "A", answer: "Mutations occur randomly in the genetic material.", expectedScore: 1 },
    {
      id: "B",
      answer:
        "Mutations occur randomly in the genetic material. Mutagens increase the probability of mutations occurring.",
      expectedScore: 2,
    },
    {
      id: "C",
      answer:
        "Mutations occur randomly. Mutagens increase mutation rate. Mutagens do not direct beneficial mutations.",
      expectedScore: 3,
    },
    {
      id: "D",
      answer:
        "Mutations occur randomly in DNA. Mutagens increase mutation rate. Mutagens do not decide if mutations are beneficial. Beneficial mutations can spread by natural selection.",
      expectedScore: 4,
    },
    {
      id: "E",
      answer:
        "DNA changes happen by chance. Mutagens make these changes more likely. They do not aim mutations to be useful. Helpful changes may become common through natural selection.",
      expectedScore: 4,
    },
    { id: "F", answer: "Plants need sunlight and water.", expectedScore: 0 },
    { id: "G", answer: "Mutations mutations mutations", expectedScore: 0 },
    {
      id: "H",
      answer: "Mutagens cause organisms to evolve useful mutations when needed.",
      expectedScore: 0,
      denyPoint1: true,
    },
    {
      id: "I",
      answer: "Mutations occur randomly in the genetic material. Mitochondria produce ATP.",
      expectedScore: 1,
    },
    { id: "J", answer: "Mutations occur randomly in the genetic material.", expectedScore: 1, staleCorrectAnswer: "OLD MODEL" },
    {
      id: "K",
      answer: "Mutagens do not guarantee that mutations will be beneficial.",
      expectedScore: 1,
      satisfyPoint3: true,
    },
    {
      id: "L",
      answer:
        "Mutations occur randomly in the genetic material. Mutagens increase the probability of mutations. Mutagens do not direct beneficial mutations. Higher humidity increases transpiration.",
      expectedScore: 3,
    },
  ],
};
