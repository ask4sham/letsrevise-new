/**
 * Editor-only presets for `interactiveDiagram` blocks. Same shape as saved lesson data — no new schema.
 */

import type { InteractiveDiagramEmbeddedTestMcq } from "../../utils/interactiveDiagramHotspots";

/**
 * AQA GCSE Cell Division — mitosis as a **sequence of stages** (raster, same folder as the curriculum).
 * File: `backend/public/visuals/biology/aqa-gcse/cell-biology/cell-division/Mitosis sequence.png`
 * Public: `/visuals/...` below (served with other curated visuals; spaces are valid in path segments).
 * Note: the manifest `mitosis-and-the-cell-cycle.svg` is a small placeholder, not a real diagram, so it is not used here.
 */
export const AQA_GCSE_MITOSIS_SEQUENCE_PNG_PUBLIC_PATH =
  "/visuals/biology/aqa-gcse/cell-biology/cell-division/Mitosis sequence.png";

/** Tracked asset: `backend/public/visuals/.../cell-structure/Animal Cell organel explanation.png` (not the manifest placeholder SVG). */
export const AQA_GCSE_ANIMAL_CELL_ORGANELLES_PNG_PUBLIC_PATH =
  "/visuals/biology/aqa-gcse/cell-biology/cell-structure/Animal Cell organel explanation.png";

/** Tracked asset: `backend/public/visuals/.../cell-structure/Plant cells organell explanation.png` (not the manifest placeholder SVG). */
export const AQA_GCSE_PLANT_CELL_ORGANELLES_PNG_PUBLIC_PATH =
  "/visuals/biology/aqa-gcse/cell-biology/cell-structure/Plant cells organell explanation.png";

export type InteractiveDiagramTemplate = {
  id: string;
  label: string;
  subject?: string;
  topic?: string;
  title: string;
  intro: string;
  /**
   * When set, editor “Apply template” also sets `block.imageUrl` (same relative `/visuals/...` as elsewhere).
   * Omitted = keep existing block image; teachers can still upload or paste a URL.
   */
  imageUrl?: string;
  hotspots: Array<{
    /** Optional stable id (e.g. phase name); falls back to generated id when applying template. */
    id?: string;
    x: number;
    y: number;
    label: string;
    description: string;
    /** Preset “Test me” MCQ — used before any AI generation. */
    test?: InteractiveDiagramEmbeddedTestMcq;
  }>;
};

export const INTERACTIVE_DIAGRAM_TEMPLATES: InteractiveDiagramTemplate[] = [
  {
    id: "mitosis-stages",
    label: "Mitosis stages",
    subject: "Biology",
    topic: "Cell division",
    title: "Mitosis stages",
    intro: "Click each stage to learn what happens during mitosis.",
    imageUrl: AQA_GCSE_MITOSIS_SEQUENCE_PNG_PUBLIC_PATH,
    hotspots: [
      {
        id: "interphase",
        x: 12,
        y: 42,
        label: "Interphase",
        description:
          "The cell grows and increases in size. DNA replicates to form two copies of each chromosome. Organelles and proteins are also produced, preparing the cell for division.",
        test: {
          question: "What mainly happens during interphase?",
          options: [
            "Sister chromatids are pulled to opposite poles",
            "Chromosomes line up along the middle of the cell",
            "The cytoplasm splits into two daughter cells",
            "The cell grows and its DNA is copied",
          ],
          correctIndex: 3,
          explanation:
            "Interphase is G1/S/G2 growth and preparation — DNA replication (S phase) doubles genetic material before mitosis.",
        },
      },
      {
        id: "prophase",
        x: 28,
        y: 35,
        label: "Prophase",
        description:
          "Chromosomes condense and become visible. The nuclear membrane breaks down, and chromosomes are released into the cytoplasm. Spindle fibres begin to form.",
        test: {
          question: "What happens during prophase?",
          options: [
            "Chromosomes line up",
            "Chromosomes condense and nucleus breaks down",
            "Chromatids separate",
            "Cell divides",
          ],
          correctIndex: 1,
          explanation: "Chromatin condenses into visible chromosomes and the nuclear envelope breaks apart as the spindle develops.",
        },
      },
      {
        id: "metaphase",
        x: 43,
        y: 35,
        label: "Metaphase",
        description:
          "Chromosomes line up along the centre (equator) of the cell. Each chromosome is attached to spindle fibres at its centromere to ensure equal separation.",
        test: {
          question: "What happens during metaphase?",
          options: [
            "Chromosomes line up across the centre of the cell attached to spindle fibres",
            "Sister chromatids move apart to opposite poles",
            "New nuclear membranes form around each chromosome set",
            "The cytoplasm divides to form two cells",
          ],
          correctIndex: 0,
          explanation:
            "At metaphase chromosomes congress on the metaphase plate — held by spindle microtubules at centromeres.",
        },
      },
      {
        id: "anaphase",
        x: 58,
        y: 35,
        label: "Anaphase",
        description:
          "Spindle fibres contract, pulling sister chromatids apart to opposite ends of the cell. Each chromatid is now an individual chromosome.",
        test: {
          question: "What happens during anaphase?",
          options: [
            "Chromosomes shorten and thicken",
            "Chromosomes arrange on the equator",
            "Sister chromatids are pulled apart to opposite poles",
            "The nuclear envelope reforms",
          ],
          correctIndex: 2,
          explanation:
            "Anaphase is when cohesin is cleaved and sister chromatids are pulled toward opposite spindle poles.",
        },
      },
      {
        id: "telophase",
        x: 73,
        y: 35,
        label: "Telophase",
        description:
          "Nuclear membranes reform around each set of chromosomes. Chromosomes begin to decondense, and spindle fibres break down as the cell starts to separate.",
        test: {
          question: "What happens during telophase?",
          options: [
            "Spindle fibres pull chromatids apart",
            "Chromosomes line up at the equator",
            "Nuclei reform and chromosomes start to unravel",
            "DNA is duplicated",
          ],
          correctIndex: 2,
          explanation:
            "Telophase ends mitosis — two new nuclei assemble and chromosomes decondense; spindle disappears.",
        },
      },
      {
        id: "cytokinesis",
        x: 89,
        y: 35,
        label: "Cytokinesis",
        description:
          "The cytoplasm divides. The cell membrane pinches in (animal cells) or a cell plate forms (plant cells), producing two genetically identical daughter cells.",
        test: {
          question: "What happens during cytokinesis?",
          options: [
            "DNA is copied",
            "Chromosomes attach to spindle fibres",
            "The nucleus breaks down",
            "The cytoplasm divides to complete cell division",
          ],
          correctIndex: 3,
          explanation:
            "Cytokinesis divides the cytoplasm (cleavage furrow in animals or cell plate in plants) — after nuclear division.",
        },
      },
    ],
  },
  {
    id: "animal-cell-organelles",
    label: "Animal cell organelles",
    subject: "Biology",
    topic: "Cell structure",
    title: "Animal cell organelles",
    intro: "Click each organelle to learn its function.",
    imageUrl: AQA_GCSE_ANIMAL_CELL_ORGANELLES_PNG_PUBLIC_PATH,
    hotspots: [
      {
        x: 18,
        y: 52,
        label: "Cell membrane",
        description: "Controls what enters and leaves the cell.",
      },
      {
        x: 48,
        y: 58,
        label: "Cytoplasm",
        description: "Jelly-like substance where many chemical reactions happen.",
      },
      {
        x: 50,
        y: 42,
        label: "Nucleus",
        description: "Contains genetic material and controls the cell's activities.",
      },
      {
        x: 70,
        y: 55,
        label: "Mitochondria",
        description: "Site of aerobic respiration, releasing energy for the cell.",
      },
      {
        x: 38,
        y: 68,
        label: "Ribosomes",
        description: "Where proteins are made.",
      },
    ],
  },
  {
    id: "plant-cell-organelles",
    label: "Plant cell organelles",
    subject: "Biology",
    topic: "Cell structure",
    title: "Plant cell organelles",
    intro: "Click each plant cell structure to learn its function.",
    imageUrl: AQA_GCSE_PLANT_CELL_ORGANELLES_PNG_PUBLIC_PATH,
    hotspots: [
      {
        x: 10,
        y: 48,
        label: "Cell wall",
        description: "A rigid outer layer made of cellulose that supports and strengthens the cell.",
      },
      {
        x: 18,
        y: 48,
        label: "Cell membrane",
        description: "Controls what enters and leaves the cell.",
      },
      {
        x: 38,
        y: 58,
        label: "Cytoplasm",
        description: "A jelly-like substance where many chemical reactions occur.",
      },
      {
        x: 44,
        y: 40,
        label: "Nucleus",
        description: "Contains genetic material (DNA) and controls the cell's activities.",
      },
      {
        x: 68,
        y: 38,
        label: "Chloroplasts",
        description: "Contain chlorophyll and are the site of photosynthesis.",
      },
      {
        x: 52,
        y: 52,
        label: "Large vacuole",
        description: "Contains cell sap and helps maintain pressure to keep the cell rigid.",
      },
      {
        x: 72,
        y: 62,
        label: "Mitochondria",
        description: "Where respiration occurs to release energy.",
      },
      {
        x: 32,
        y: 68,
        label: "Ribosomes",
        description: "Where proteins are made.",
      },
    ],
  },
  {
    id: "light-microscope-parts",
    label: "Light microscope parts",
    subject: "Biology",
    topic: "Microscopy",
    title: "Light microscope parts",
    intro: "Click each microscope part to learn what it does.",
    hotspots: [
      {
        x: 50,
        y: 10,
        label: "Eyepiece lens",
        description: "Magnifies the image formed by the objective lenses; often ×10 in school microscopes.",
      },
      {
        x: 50,
        y: 22,
        label: "Objective lens",
        description: "The main magnifying lens near the slide; can be low, medium, or high power (e.g. ×4, ×10, ×40).",
      },
      {
        x: 50,
        y: 48,
        label: "Stage",
        description: "A flat platform where the slide is placed; often has a hole so light can pass through the specimen.",
      },
      {
        x: 50,
        y: 58,
        label: "Clips",
        description: "Spring clips (or a mechanical stage) that hold the slide steady while you view it.",
      },
      {
        x: 50,
        y: 86,
        label: "Light source / mirror",
        description: "Provides light that passes up through the specimen; on some models a mirror reflects room light instead.",
      },
      {
        x: 20,
        y: 36,
        label: "Coarse focus",
        description: "Moves the stage a large amount to get the image roughly in focus; use it first, then the fine control.",
      },
      {
        x: 80,
        y: 36,
        label: "Fine focus",
        description: "Small adjustments for a sharp, clear image after coarse focusing — especially at high magnification.",
      },
    ],
  },
];
