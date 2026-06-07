/**
 * Shared contract: LetsRevise Generator export ↔ Create Lesson import.
 * IMPORTANT: Keep logical parity with:
 *   letsrevise-generator/lib/generatorEditorBlockMap.js
 *   letsrevise-generator/lib/buildGeneratorExportJson.js
 */

export const LESSON_GENERATOR_EXPORT_FORMAT_V1 = "letsrevise.generator.export.v1";

/**
 * generatorBlockKind → Create Lesson editor mapping (same semantics as generator repo).
 * `editorType` must be a canonical LessonBlockType (camelCase).
 */
export const GENERATOR_KIND_TO_EDITOR_SPEC: Record<
  string,
  { editorType: string; role: string; defaultTitle?: string; note?: string }
> = {
  hook: { editorType: "text", role: "hook" },
  "core-rule": { editorType: "keyIdeas", role: "coreRule" },
  "common-mistake": { editorType: "misconceptions", role: "commonMistake" },
  "pattern-recognition": { editorType: "keyIdeas", role: "patternRecognition" },
  diagram: { editorType: "diagram", role: "concept" },
  "what-to-notice": {
    editorType: "keyIdeas",
    role: "whatToNotice",
    defaultTitle: "What to Notice",
  },
  "text-concept": { editorType: "text", role: "concept" },
  "exam-tip": { editorType: "examTips", role: "concept" },
  "exam-technique": { editorType: "examTips", role: "examTechnique" },
  "synoptic-link": { editorType: "keyIdeas", role: "synopticLink", defaultTitle: "Synoptic link" },
  "why-this-matters": {
    editorType: "text",
    role: "whyItMatters",
    defaultTitle: "Why it matters",
  },
  synthesis: { editorType: "keyIdeas", role: "synthesis" },
  "quick-check": { editorType: "checkpoint", role: "quickCheck" },
  checkpoint: { editorType: "checkpoint", role: "checkpoint" },
  "worked-example": { editorType: "selfCheck", role: "workedExample" },
  "self-check-question": { editorType: "selfCheck", role: "selfCheck" },
  "final-memory-rule": { editorType: "keyIdeas", role: "finalMemoryRule" },
  keywords: { editorType: "keyWords", role: "keyWords" },
  "deeper-knowledge": { editorType: "deeperKnowledge", role: "deeperKnowledge" },
  "step-by-step-diagram": {
    editorType: "interactiveSequence",
    role: "sequence",
  },
  "interactive-diagram": { editorType: "interactiveDiagram", role: "hotspot" },
  "drag-drop-match": { editorType: "dragDropMatch", role: "match" },
  "data-graph": { editorType: "graph", role: "graph" },
  objectives: { editorType: "keyIdeas", role: "lessonObjectives" },
  "prior-knowledge": { editorType: "text", role: "priorKnowledge" },
  definition: { editorType: "text", role: "definition" },
  "core-model": { editorType: "keyIdeas", role: "coreModel" },
  "key-examples": { editorType: "text", role: "keyExamples" },
  "exam-vocabulary": { editorType: "text", role: "examVocabulary" },
  "core-learning": { editorType: "text", role: "coreTeaching" },
  summary: { editorType: "keyIdeas", role: "summary" },
  "exam-practice": { editorType: "text", role: "examPractice" },
  text: { editorType: "text", role: "concept" },
};
