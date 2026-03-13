/**
 * Step 4 + 13: Microscopy → Magnification Calculations template.
 * Step 4: original mapper. Step 13: fixed SaveMyExams-style storyboard.
 * Returns a fixed 11-scene ordered list; ignores input scene count.
 * No routes. No DB. No integration.
 */

const DURATIONS = [6, 12, 14, 8, 12, 10, 12, 8, 10, 12, 8];

const FIXED_SCENES = [
  {
    id: "scene_1_title",
    kind: "intro",
    title: "Magnification Calculations",
    narration:
      "Magnification Calculations. Learn how to use a light microscope and calculate magnification from image and actual sizes.",
    layout: "full-text",
    assetKey: "none",
    animationHint: "fade-in-title",
  },
  {
    id: "scene_2_intro",
    kind: "explainer",
    title: "Cells and Microscopes",
    narration:
      "Cells and Microscopes.\n\nLight microscopes use lenses to magnify small objects. You can see cells, tissues, and their structures clearly.",
    layout: "split-left-text-right-image",
    assetKey: "microscope",
    animationHint: "fade-sequence",
  },
  {
    id: "scene_3_micrograph",
    kind: "explainer",
    title: "Microscope Views",
    narration:
      "Microscope Views.\n\nWhen you look through the eyepiece you see a micrograph—the magnified image. Different specimens show different cell types.",
    layout: "split-left-text-right-image",
    assetKey: "microscope-panel",
    animationHint: "fade-sequence",
  },
  {
    id: "scene_4_formula",
    kind: "explainer",
    title: "The Magnification Formula",
    narration:
      "The Magnification Formula.\n\nMagnification equals image size divided by actual size. Remember this for your exam.",
    layout: "formula-center",
    assetKey: "magnification-formula",
    animationHint: "fade-sequence",
  },
  {
    id: "scene_5_triangle",
    kind: "explainer",
    title: "The IAM Triangle",
    narration:
      "The IAM Triangle.\n\nUse the triangle to remember: Image = Magnification × Actual size. Cover the one you want to find.",
    layout: "triangle-center",
    assetKey: "iam-triangle",
    animationHint: "fade-sequence",
  },
  {
    id: "scene_6_worked_setup",
    kind: "explainer",
    title: "Worked Example: Plant Cell",
    narration:
      "Worked Example: Plant Cell.\n\nA plant cell is magnified. The image is 12 mm wide. The actual cell is 0.03 mm. Find the magnification.",
    layout: "split-left-text-right-image",
    assetKey: "plant-cell",
    animationHint: "fade-sequence",
  },
  {
    id: "scene_7_worked_ruler",
    kind: "explainer",
    title: "Measuring the Image",
    narration:
      "Measuring the Image.\n\nUse a ruler to measure the image size on the photograph or screen. Convert to millimetres for the formula.",
    layout: "split-left-text-right-image",
    assetKey: "ruler-plant-cell",
    animationHint: "fade-sequence",
  },
  {
    id: "scene_8_worked_answer",
    kind: "explainer",
    title: "Worked Example Answer",
    narration:
      "Worked Example Answer.\n\nMagnification = 12 mm ÷ 0.03 mm = 400×. Always give your answer as a number with × or 'times'.",
    layout: "formula-center",
    assetKey: "magnification-formula",
    animationHint: "fade-sequence",
  },
  {
    id: "scene_9_exam_question",
    kind: "explainer",
    title: "Exam-Style Question",
    narration:
      "Exam-Style Question.\n\nA root hair cell image measures 8 mm. The actual cell is 0.04 mm long. Calculate the magnification.",
    layout: "split-left-text-right-image",
    assetKey: "root-hair-cell",
    animationHint: "fade-sequence",
  },
  {
    id: "scene_10_exam_answer",
    kind: "explainer",
    title: "Exam-Style Answer",
    narration:
      "Exam-Style Answer.\n\nMagnification = 8 ÷ 0.04 = 200×. Check units: both in mm, so they cancel. Always show your working.",
    layout: "split-left-text-right-image",
    assetKey: "root-hair-ruler",
    animationHint: "fade-sequence",
  },
  {
    id: "scene_11_summary",
    kind: "summary",
    title: "Summary",
    narration:
      "Summary.\n\nRemember: magnification = image size ÷ actual size. Use the IAM triangle to rearrange. Show units and working in your answers.",
    layout: "full-text",
    assetKey: "iam-triangle",
    animationHint: "checklist-recap",
  },
];

/**
 * Build fixed scenes with cumulative start/end times.
 */
function buildFixedScenes() {
  let start = 0;
  return FIXED_SCENES.map((scene, i) => {
    const duration = DURATIONS[i] ?? 8;
    const end = start + duration;
    const built = {
      ...scene,
      start,
      end,
      duration,
      visualHint: scene.assetKey === "none" ? "text-slide" : scene.assetKey,
    };
    start = end;
    return built;
  });
}

/**
 * Map storyboard to microscopy-magnification template format.
 * Step 13: returns fixed 11-scene storyboard; input scenes are ignored.
 * @param {Object} storyboard - { scenes, metadata } from buildStoryboard()
 * @returns {Object} { template, scenes: [...], metadata }
 */
function mapMicroscopyMagnificationStoryboard(storyboard) {
  const input = storyboard || {};
  const metadata = input.metadata || {};
  const scenes = buildFixedScenes();

  return {
    template: "microscopy-magnification",
    scenes,
    metadata: {
      ...metadata,
      title: metadata.title || "Magnification Calculations",
      sceneCount: scenes.length,
      totalDurationSeconds: scenes.length > 0 ? scenes[scenes.length - 1].end : 0,
    },
  };
}

module.exports = mapMicroscopyMagnificationStoryboard;
