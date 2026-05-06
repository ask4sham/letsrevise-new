import { STARTER_SOURCE_NOTE } from "./schema.js";
import { eduqasBiologyGcseSpecEntries } from "./eduqasBiologyGcse.js";
import { eduqasChemistryGcseSpecEntries } from "./eduqasChemistryGcse.js";
import { eduqasPhysicsGcseSpecEntries } from "./eduqasPhysicsGcse.js";
import { eduqasCombinedScienceSpecEntries } from "./eduqasCombinedScience.js";

/** @type {import("./schema.js").SpecTopicEntry[]} */
export const specEntries = [
  ...eduqasBiologyGcseSpecEntries,
  ...eduqasChemistryGcseSpecEntries,
  ...eduqasPhysicsGcseSpecEntries,
  ...eduqasCombinedScienceSpecEntries,
];
