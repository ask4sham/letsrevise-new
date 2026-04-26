/**
 * Editor-only presets for `interactiveDiagram` blocks. Same shape as saved lesson data — no new schema.
 */

export type InteractiveDiagramTemplate = {
  id: string;
  label: string;
  subject?: string;
  topic?: string;
  title: string;
  intro: string;
  /** Omitted in stock templates; teachers upload or paste URL to match the diagram. */
  imageUrl?: string;
  hotspots: Array<{
    x: number;
    y: number;
    label: string;
    description: string;
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
    hotspots: [
      {
        x: 12,
        y: 42,
        label: "Interphase",
        description: "The cell grows, increases in size, and copies its DNA to prepare for mitosis.",
      },
      {
        x: 28,
        y: 35,
        label: "Prophase",
        description:
          "Chromosomes condense and become visible. The nuclear membrane breaks down and spindle fibres begin to form.",
      },
      {
        x: 43,
        y: 35,
        label: "Metaphase",
        description: "Chromosomes line up across the centre of the cell and attach to spindle fibres.",
      },
      {
        x: 58,
        y: 35,
        label: "Anaphase",
        description: "Spindle fibres pull sister chromatids apart to opposite ends of the cell.",
      },
      {
        x: 73,
        y: 35,
        label: "Telophase",
        description: "Nuclear membranes form around each set of chromosomes and the cell begins to divide.",
      },
      {
        x: 89,
        y: 35,
        label: "Cytokinesis",
        description: "The cytoplasm and cell membrane divide to form two genetically identical daughter cells.",
      },
    ],
  },
  {
    id: "plant-cell-organelles",
    label: "Plant cell organelles",
    subject: "Biology",
    topic: "Cells",
    title: "Plant cell organelles",
    intro: "Click each organelle to learn its function.",
    hotspots: [
      {
        x: 12,
        y: 22,
        label: "Cell wall",
        description: "A rigid outer layer made of cellulose that supports the cell and gives the plant its shape.",
      },
      {
        x: 28,
        y: 38,
        label: "Cell membrane",
        description: "A partially permeable barrier that controls what enters and leaves the cell.",
      },
      {
        x: 50,
        y: 55,
        label: "Cytoplasm",
        description: "A gel-like solution where many chemical reactions and organelles are suspended.",
      },
      {
        x: 52,
        y: 32,
        label: "Nucleus",
        description: "Contains DNA and controls the cell’s activities by regulating gene expression.",
      },
      {
        x: 24,
        y: 62,
        label: "Chloroplast",
        description: "Site of photosynthesis: uses light energy to make glucose and oxygen from carbon dioxide and water.",
      },
      {
        x: 72,
        y: 48,
        label: "Vacuole",
        description: "A large permanent vacuole filled with cell sap that helps maintain turgor and stores substances.",
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
