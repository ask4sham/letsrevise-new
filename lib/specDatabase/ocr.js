import { STARTER_SOURCE_NOTE } from "./schema.js";
import { ocrBiologyGcseSpecEntries } from "./ocrBiologyGcse.js";
import { ocrChemistryGcseSpecEntries } from "./ocrChemistryGcse.js";
import { ocrPhysicsGcseSpecEntries } from "./ocrPhysicsGcse.js";
import { ocrCombinedScienceSpecEntries } from "./ocrCombinedScience.js";

/** @type {import("./schema.js").SpecTopicEntry[]} */
export const specEntries = [
  ...ocrBiologyGcseSpecEntries,
  ...ocrChemistryGcseSpecEntries,
  ...ocrPhysicsGcseSpecEntries,
  ...ocrCombinedScienceSpecEntries,
  {
    id: "ocr-ks4gcse-maths-linear-eq",
    board: "OCR",
    subject: "Mathematics",
    keyStage: "KS4 - GCSE",
    qualification: "GCSE",
    topic: "Solving linear equations",
    specCode: "Starter",
    title: "Solving linear equations",
    requiredContent: [
      "Balance / inverse operations",
      "Multi-step rearrangement",
      "Interpretation from short problems",
      "Sanity-checking solutions",
    ],
    requiredSkills: [],
    requiredPracticals: [],
    commonMisconceptions: [],
    examCommandWords: [],
    linkedTopics: [],
    sourceNote: STARTER_SOURCE_NOTE,
  },
];
