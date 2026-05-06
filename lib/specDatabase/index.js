export {
  STARTER_SOURCE_NOTE,
  OFFICIAL_AQA_SOURCE_NOTE,
  OFFICIAL_AQA_TRILOGY_SOURCE_NOTE,
  OFFICIAL_EDEXCEL_SOURCE_NOTE,
  OFFICIAL_OCR_SOURCE_NOTE,
  OFFICIAL_EDUQAS_SOURCE_NOTE,
} from "./schema.js";
export { edexcelBiologyGcseSpecEntries } from "./edexcelBiologyGcse.js";
export { edexcelChemistryGcseSpecEntries } from "./edexcelChemistryGcse.js";
export { edexcelPhysicsGcseSpecEntries } from "./edexcelPhysicsGcse.js";
export { edexcelCombinedScienceSpecEntries } from "./edexcelCombinedScience.js";
export { specEntries as aqaSpecEntries } from "./aqa.js";
export { aqaBiologyGcseSpecEntries } from "./aqaBiologyGcse.js";
export { aqaCombinedScienceTrilogySpecEntries } from "./aqaCombinedScienceTrilogy.js";
export { specEntries as edexcelSpecEntries } from "./edexcel.js";
export { specEntries as ocrSpecEntries } from "./ocr.js";
export { ocrBiologyGcseSpecEntries } from "./ocrBiologyGcse.js";
export { ocrChemistryGcseSpecEntries } from "./ocrChemistryGcse.js";
export { ocrPhysicsGcseSpecEntries } from "./ocrPhysicsGcse.js";
export { ocrCombinedScienceSpecEntries } from "./ocrCombinedScience.js";
export { specEntries as eduqasSpecEntries } from "./eduqas.js";
export { eduqasBiologyGcseSpecEntries } from "./eduqasBiologyGcse.js";
export { eduqasChemistryGcseSpecEntries } from "./eduqasChemistryGcse.js";
export { eduqasPhysicsGcseSpecEntries } from "./eduqasPhysicsGcse.js";
export { eduqasCombinedScienceSpecEntries } from "./eduqasCombinedScience.js";
export { specEntries as cceaSpecEntries } from "./ccea.js";
export {
  findSpecEntry,
  buildSpecPromptSection,
  normaliseTopicInput,
  normaliseBoardKey,
  normaliseSubjectKey,
  normaliseKeyStageKey,
  normaliseTierFilter,
  inferQualificationTypeFromSubject,
  normalizeContentItem,
  filterSpecEntryForContext,
  ALL_ENTRIES,
} from "./specLookup.js";
