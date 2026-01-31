// backend/models/LevelProfile.ts (conceptual schema)
export type Level = "KS3" | "GCSE" | "A-Level";

export type AssessmentStyle = "describe" | "explain" | "analyse";

export type LevelProfile = {
  level: Level;

  // What is visible at this level
  visibleEntities: string[];      // entity ids from CanonicalVisualModel
  visibleSteps?: number[];        // step order numbers allowed

  // How to label things at this level
  vocabularyMap?: Record<string, string>; // entity/process renames for level-appropriate language

  // Optional UX tuning
  ui: {
    diagramComplexity: "low" | "medium" | "high";
    animationSpeedMs: number;          // per-step animation
    showStepLabels: boolean;
    showLegend: boolean;
    allowMisconceptionToggle: boolean;
    allowZoom: boolean;
  };

  // What kind of checkpoint UX we bias toward
  assessmentStyle: AssessmentStyle;

  // What we intentionally hide (for teacher clarity and future expansion)
  hiddenDetails?: string[]; // free text list
};
