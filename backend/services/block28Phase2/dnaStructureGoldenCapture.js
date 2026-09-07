/**
 * Block 28 Phase 2 — DNA Structure human-approved repair metadata (read-only).
 * Biology-reviewed content for guarded production repair — NOT written to DB by this module.
 */
const DNA_STRUCTURE_LESSON_ID = "6a6db174826272226c7798fd";

const APPROVED_MASTER_IDS = Object.freeze([
  "6a6f2be07ddc99159b9b6a43",
  "6a6f2be17ddc99159b9b6a4c",
  "6a6f2be17ddc99159b9b6a4f",
  "6a6f2be07ddc99159b9b6a46",
  "6a6f2be17ddc99159b9b6a5b",
]);

const DEPRIORITISED_MASTER_IDS = Object.freeze([
  "6a6f2be17ddc99159b9b6a55",
  "6a6f2be17ddc99159b9b6a58",
  "6a6f2be17ddc99159b9b6a52",
  "6a6f2be07ddc99159b9b6a49",
  "6a6f2be07ddc99159b9b6a40",
]);

/** Biology-approved repair metadata — pending guarded production write. */
const APPROVED_REPAIR_METADATA = Object.freeze([
  {
    questionId: "6a6f2be07ddc99159b9b6a43",
    proposedQuestion: "Describe the structure of DNA and its components.",
    proposedMarks: 3,
    proposedScheme: [
      "DNA consists of two strands twisted into a double helix.",
      "Each strand has a sugar-phosphate backbone.",
      "DNA contains four bases: adenine, thymine, guanine and cytosine.",
    ],
  },
  {
    questionId: "6a6f2be17ddc99159b9b6a4c",
    proposedQuestion: "Compare the roles of the sugar-phosphate backbone and the nitrogenous bases in DNA structure.",
    proposedMarks: 2,
    proposedScheme: [
      "The sugar-phosphate backbone forms the structural framework of each DNA strand.",
      "The sequence of nitrogenous bases carries the genetic information.",
    ],
  },
  {
    questionId: "6a6f2be17ddc99159b9b6a4f",
    proposedQuestion: "Explain why hydrogen bonds between bases are essential for the stability of DNA.",
    proposedMarks: 2,
    proposedScheme: [
      "Hydrogen bonds form between complementary bases on opposite strands.",
      "These bonds hold the two strands together and help maintain the double helix.",
    ],
  },
  {
    questionId: "6a6f2be07ddc99159b9b6a46",
    proposedQuestion: "Outline how the structure of DNA enables it to be copied during cell division.",
    proposedMarks: 3,
    proposedScheme: [
      "The DNA double helix unwinds and the two strands separate.",
      "Each original strand acts as a template for a new complementary strand.",
      "Complementary bases pair A–T and G–C, producing two DNA molecules with the same base sequence as the original.",
    ],
  },
  {
    questionId: "6a6f2be17ddc99159b9b6a5b",
    proposedQuestion: "Explain how the sequence of bases in DNA is related to the production of proteins.",
    proposedMarks: 2,
    proposedScheme: [
      "The sequence of bases in DNA contains the genetic instructions for the order of amino acids in a protein.",
      "Different base sequences may result in different amino acid sequences and therefore different proteins.",
    ],
  },
]);

module.exports = {
  DNA_STRUCTURE_LESSON_ID,
  APPROVED_MASTER_IDS,
  DEPRIORITISED_MASTER_IDS,
  APPROVED_REPAIR_METADATA,
};
