/**
 * Editor presets for `interactiveSequence` blocks (step-by-step, e.g. mitosis phases).
 */

export type InteractiveSequenceStepTemplateRow = {
  /** Stable editor key — optional when saving. */
  id?: string;
  title: string;
  description: string;
  imageUrl?: string;
  caption?: string;
};

export type InteractiveSequenceBlockTemplate = {
  id: string;
  label: string;
  title: string;
  intro: string;
  sequenceSteps: InteractiveSequenceStepTemplateRow[];
};

export const INTERACTIVE_SEQUENCE_TEMPLATE_MITOSIS: InteractiveSequenceBlockTemplate = {
  id: "mitosis-sequence-steps",
  label: "Use mitosis sequence template",
  title: "Mitosis",
  intro: "Click each step to see how the cell divides — one stage at a time.",
  sequenceSteps: [
    {
      id: "seq-interphase",
      title: "Interphase — DNA replication",
      description:
        "The cell grows and prepares to divide. During the S phase of interphase, each chromosome is copied so it consists of two identical sister chromatids joined at a centromere.",
      imageUrl: "/visuals/biology/mitosis/step1-dna-replication.png",
      caption:
        "Each chromosome duplicates into two sister chromatids joined at the centromere",
    },
    {
      id: "seq-prophase",
      title: "Prophase",
      description:
        "The chromosomes condense and become visible. The nuclear envelope breaks down and spindle fibres form between the poles of the cell.",
      imageUrl: "/visuals/biology/mitosis/step2-prophase.png",
      caption:
        "Chromosomes shorten and thicken while the nuclear envelope breaks apart and spindle fibres form",
    },
    {
      id: "seq-metaphase",
      title: "Metaphase",
      description:
        "Chromosomes line up along the metaphase plate (middle of the cell) and spindle fibres attach to centromeres.",
      imageUrl: "/visuals/biology/mitosis/step3-metaphase.png",
      caption:
        "Chromosomes line up across the centre of the cell attached to spindle fibres at their centromeres",
    },
    {
      id: "seq-anaphase",
      title: "Anaphase",
      description:
        "The centromeres split. Sister chromatids move to opposite poles as spindle fibres shorten.",
      imageUrl: "/visuals/biology/mitosis/step4-anaphase.png",
      caption:
        "Sister chromatids are separated and pulled to opposite poles along the spindle",
    },
    {
      id: "seq-telophase",
      title: "Telophase",
      description:
        "Chromosomes arrive at opposite poles and begin to uncoil. New nuclear membranes form around each chromosome set.",
      imageUrl: "/visuals/biology/mitosis/step5-telophase.png",
      caption:
        "Two new nuclei form and chromosomes uncoil as the spindle fades",
    },
    {
      id: "seq-cytokinesis",
      title: "Cytokinesis",
      description:
        "The cytoplasm splits (in animal cells the membrane pinches in). Two genetically identical daughter cells are formed.",
      imageUrl: "/visuals/biology/mitosis/step6-cytokinesis.png",
      caption:
        "The cytoplasm divides so each daughter cell has a full chromosome set wrapped in membrane",
    },
  ],
};

export const INTERACTIVE_SEQUENCE_TEMPLATES: InteractiveSequenceBlockTemplate[] = [
  INTERACTIVE_SEQUENCE_TEMPLATE_MITOSIS,
];
