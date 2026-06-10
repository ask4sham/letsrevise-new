/**
 * Re-export shared parse utilities for frontend TypeScript consumers.
 */

export type RpSpecialistBlockKind = "equipment" | "method" | "resultsTable" | "evaluationGrid";

export type ParsedMarkdownTable = {
  headers: string[];
  rows: string[][];
};

export {
  detectRpSpecialistBlock,
  parseEquipmentItems,
  parseMethodSteps,
  parseMarkdownTable,
  defaultSectionTitle,
} from "../../../lib/teacherBrain/requiredPracticalBlockParse.js";
