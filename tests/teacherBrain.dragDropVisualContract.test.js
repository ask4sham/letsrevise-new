/**
 * Phase 2 — drag-drop visual contract in Teacher Brain image prompts.
 */

const {
  formatDragDropImageDesignRequirements,
  IMAGE_DESIGN_REQUIREMENTS_HEADING,
} = require("../lib/teacherBrain/dragDropVisualContract");
const {
  formatTextToImageBrief,
  formatImageDropZonesBrief,
} = require("../lib/teacherBrain/diagramBriefInjector");

const CONTRACT_MUST_LINES = [
  /MUST be 900×1350 portrait/i,
  /MUST NOT use landscape layout/i,
  /68% left diagram area and 32% right drop-zone rail/i,
  /four empty drop boxes labelled A, B, C, D only/i,
  /MUST NOT use extra numeric labels 1–4/i,
  /232×76 px on the 900×1350 artboard/i,
  /Concept cards are rendered separately by the application/i,
  /Do NOT draw concept card answer text inside the image/i,
];

function expectContractBlock(text) {
  expect(text).toMatch(IMAGE_DESIGN_REQUIREMENTS_HEADING);
  for (const re of CONTRACT_MUST_LINES) {
    expect(text).toMatch(re);
  }
}

describe("dragDropVisualContract", () => {
  test("formatDragDropImageDesignRequirements includes all strict lines", () => {
    expectContractBlock(formatDragDropImageDesignRequirements());
  });

  test("includes pair alignment when pairs provided", () => {
    const text = formatDragDropImageDesignRequirements({
      pairs: [
        { prompt: "Sensory neurone", answer: "To CNS" },
        { prompt: "Relay neurone", answer: "In spinal cord" },
      ],
    });
    expect(text).toMatch(/A — printed empty box aligned beside: Sensory neurone/);
    expect(text).toMatch(/In-app concept cards \(NOT in image\)/);
  });
});

describe("Teacher Brain briefs include visual contract", () => {
  test("formatTextToImageBrief includes IMAGE DESIGN REQUIREMENTS", () => {
    const brief = formatTextToImageBrief(
      null,
      { title: "Reflex arc", mustShow: ["Sensory pathway"] },
      {
        title: "Reflex arc",
        pairs: [
          { prompt: "Sensory neurone", answer: "Carries impulses from receptor to the CNS" },
          { prompt: "Relay neurone", answer: "Links neurones in spinal cord" },
          { prompt: "Motor neurone", answer: "Carries impulses to effector" },
          { prompt: "Effector", answer: "Produces the response" },
        ],
      }
    );
    expect(brief).toMatch(/TEXT → IMAGE DESIGN BRIEF/);
    expectContractBlock(brief);
    expect(brief).toMatch(/Sensory neurone/);
  });

  test("formatImageDropZonesBrief includes IMAGE DESIGN REQUIREMENTS", () => {
    const brief = formatImageDropZonesBrief(null, { title: "Plant leaf" }, {
      title: "Plant disease",
      pairs: [
        { prompt: "Waxy cuticle", answer: "Physical defence" },
        { prompt: "Fungus", answer: "Pathogen" },
      ],
    });
    expect(brief).toMatch(/IMAGE \+ DROP ZONES DESIGN BRIEF/);
    expectContractBlock(brief);
  });
});

describe("validation topic prompts (Phase 2)", () => {
  const topics = [
    {
      name: "Reflex arc",
      block: {
        title: "Reflex arc — drag and drop match",
        pairs: [
          { prompt: "Sensory neurone", answer: "Carries impulses from receptor to the CNS" },
          { prompt: "Relay neurone", answer: "Links neurones inside the spinal cord for fast reflexes" },
          { prompt: "Motor neurone", answer: "Carries impulses from the CNS to a muscle or gland" },
          { prompt: "Effector", answer: "Produces the response" },
        ],
      },
    },
    {
      name: "Plant disease",
      block: {
        title: "Plant disease — defences and symptoms",
        pairs: [
          { prompt: "Waxy cuticle", answer: "Physical defence against pathogens" },
          { prompt: "Fungus / bacteria", answer: "Infectious agent" },
          { prompt: "Yellow leaves (chlorosis)", answer: "Sign of magnesium deficiency or disease" },
          { prompt: "Remove infected plants", answer: "Reduces spread of disease" },
        ],
      },
    },
    {
      name: "Photosynthesis",
      block: {
        title: "Photosynthesis — inputs and outputs",
        pairs: [
          { prompt: "Chlorophyll", answer: "Absorbs light energy" },
          { prompt: "Carbon dioxide", answer: "Raw material taken in" },
          { prompt: "Glucose", answer: "Sugar product" },
          { prompt: "Oxygen", answer: "Gas released" },
        ],
      },
    },
  ];

  test.each(topics)("$name brief contains full contract block", ({ block }) => {
    const brief = formatTextToImageBrief(null, { title: block.title }, block);
    expectContractBlock(brief);
  });
});
