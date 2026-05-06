import { STARTER_SOURCE_NOTE } from "./schema.js";

import { edexcelBiologyGcseSpecEntries } from "./edexcelBiologyGcse.js";

import { edexcelChemistryGcseSpecEntries } from "./edexcelChemistryGcse.js";

import { edexcelPhysicsGcseSpecEntries } from "./edexcelPhysicsGcse.js";

import { edexcelCombinedScienceSpecEntries } from "./edexcelCombinedScience.js";



/** @type {import("./schema.js").SpecTopicEntry[]} */

export const specEntries = [

  ...edexcelBiologyGcseSpecEntries,

  ...edexcelChemistryGcseSpecEntries,

  ...edexcelPhysicsGcseSpecEntries,

  ...edexcelCombinedScienceSpecEntries,

  {

    id: "edexcel-ks4gcse-maths-linear-eq",

    board: "Edexcel",

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

