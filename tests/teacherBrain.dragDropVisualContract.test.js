/**

 * Phase 2 — drag-drop visual contract in Teacher Brain image prompts.

 */



const {

  formatDragDropImageDesignRequirements,

  formatTextToImageImageDesignRequirements,

  IMAGE_DESIGN_REQUIREMENTS_HEADING,

} = require("../lib/teacherBrain/dragDropVisualContract");

const {

  formatTextToImageBrief,

  formatImageDropZonesBrief,

} = require("../lib/teacherBrain/diagramBriefInjector");



const DIAGRAM_CONTRACT_MUST_LINES = [

  /MUST be 900×1350 portrait/i,

  /MUST NOT use landscape layout/i,

  /68% left diagram area and 32% right functional matching rail/i,

  /not a decorative panel/i,

  /four empty drop boxes labelled A, B, C, D only/i,

  /MUST NOT use extra numeric labels 1–4/i,

  /156×76 px/,

  /234×114 px/,

  /421\.5 px \(70\.25%\)/,

  /identical in size/i,

  /without overflowing above or below/i,

  /62 px vertical spacing/i,

  /expand the right rail slightly/i,

  /Do not stretch boxes to different heights/i,

  /same horizontal centreline/i,

  /Concept cards are rendered separately by the application/i,

  /Do NOT draw concept card answer text inside the image/i,

];



const TTI_CONTRACT_MUST_LINES = [

  /The application owns all targets/i,

  /The image owns only the educational diagram and a clean blank right-hand rail/i,

  /Do NOT draw A, B, C, D letters in the image/i,

  /Do NOT draw marker letters, answer boxes, dotted boxes, rectangles, or concept-card text/i,

  /Leave the right functional rail blank and clean so the application can render all targets/i,

  /Do NOT draw answer rectangles or hard-line drop boxes inside the image/i,

  /MUST be 900×1350 portrait/i,

  /MUST NOT use landscape layout/i,

  /68% left diagram area and 32% right functional matching rail/i,

  /blank white space/i,

  /four stacked blank white zones/i,

  /MUST NOT draw empty answer boxes, printed target rectangles, hard-line drop boxes/i,

  /runtime application owns all drop-zone rectangles/i,

  /reserve four equal blank white zones in the right rail/i,

  /Concept cards are rendered separately by the application/i,

  /Do NOT draw concept card answer text inside the image/i,

  /dotted target boxes are NOT drawn in the image/i,

  /blank right-rail row must share the same horizontal centreline/i,

];



const TTI_CONTRACT_MUST_NOT_LINES = [

  /Only place large A, B, C, D labels centred at the intended drop-zone positions/i,

  /MUST show four marker letters only on the right rail/i,

  /four empty drop boxes labelled A, B, C, D only/i,

  /Marker A MUST align horizontally/i,

  /place A, B, C, D vertically stacked in the right functional rail/i,

  /large readable marker letters/i,

];



const REFLEX_ARC_BLOCK = {

  title: "Reflex arc — drag and drop match",

  pairs: [

    { prompt: "Sensory neurone", answer: "Carries impulses from receptor to the CNS" },

    { prompt: "Relay neurone", answer: "Links neurones inside the spinal cord for fast reflexes" },

    { prompt: "Motor neurone", answer: "Carries impulses from the CNS to a muscle or gland" },

    { prompt: "Effector", answer: "Produces the response" },

  ],

};



function expectContractBlock(text, mustLines, mustNotLines = []) {

  expect(text).toMatch(IMAGE_DESIGN_REQUIREMENTS_HEADING);

  for (const re of mustLines) {

    expect(text).toMatch(re);

  }

  for (const re of mustNotLines) {

    expect(text).not.toMatch(re);

  }

}



describe("dragDropVisualContract", () => {

  test("formatDragDropImageDesignRequirements includes diagram printed-box lines", () => {

    expectContractBlock(formatDragDropImageDesignRequirements(), DIAGRAM_CONTRACT_MUST_LINES);

  });



  test("formatTextToImageImageDesignRequirements uses diagram-only contract", () => {

    const text = formatTextToImageImageDesignRequirements();

    expectContractBlock(text, TTI_CONTRACT_MUST_LINES, TTI_CONTRACT_MUST_NOT_LINES);

    expect(text).toMatch(/Do NOT draw A, B, C, D letters in the image/i);

    expect(text).toMatch(/right functional rail blank and clean/i);

    expect(text).not.toMatch(/Only place large A, B, C, D labels/i);

    expect(text).not.toMatch(/MUST show four marker letters/i);

  });



  test("TTI contract includes structure-to-row alignment when pairs provided", () => {

    const text = formatTextToImageImageDesignRequirements({

      pairs: [

        { prompt: "Sensory neurone", answer: "To CNS" },

        { prompt: "Relay neurone", answer: "In spinal cord" },

      ],

    });

    expect(text).toMatch(

      /Blank right-rail row 1 \(first \(top\)\): MUST align horizontally with the matching structure on the left \(Sensory neurone\)/

    );

    expect(text).toMatch(/no letters, boxes, or borders/i);

    expect(text).toMatch(/In-app concept cards \(NOT in image\)/);

    expect(text).toMatch(/Check that blank right-rail row 1 \(first\) aligns horizontally with Sensory neurone/);

    expect(text).not.toMatch(/four empty drop boxes labelled A, B, C, D only/i);

    expect(text).not.toMatch(/Marker A MUST align/i);

  });



  test("diagram contract still includes box alignment when pairs provided", () => {

    const text = formatDragDropImageDesignRequirements({

      pairs: [

        { prompt: "Sensory neurone", answer: "To CNS" },

        { prompt: "Relay neurone", answer: "In spinal cord" },

      ],

    });

    expect(text).toMatch(/Box A MUST align horizontally with the matching structure on the left \(Sensory neurone\)/);

    expect(text).toMatch(/Check that A aligns to Sensory neurone/);

  });

});



describe("Teacher Brain briefs include visual contract", () => {

  test("formatTextToImageBrief includes diagram-only IMAGE DESIGN REQUIREMENTS", () => {

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

    expectContractBlock(brief, TTI_CONTRACT_MUST_LINES, TTI_CONTRACT_MUST_NOT_LINES);

    expect(brief).toMatch(/Do NOT draw A, B, C, D letters in the image/i);

    expect(brief).toMatch(/right functional rail blank and clean/i);

    expect(brief).not.toMatch(/Only place large A, B, C, D labels/i);

    expect(brief).not.toMatch(/MUST show four marker letters/i);

    expect(brief).toMatch(/Sensory neurone/);

  });



  test("formatImageDropZonesBrief includes diagram printed-box contract", () => {

    const brief = formatImageDropZonesBrief(null, { title: "Plant leaf" }, {

      title: "Plant disease",

      pairs: [

        { prompt: "Waxy cuticle", answer: "Physical defence" },

        { prompt: "Fungus", answer: "Pathogen" },

      ],

    });

    expect(brief).toMatch(/IMAGE \+ DROP ZONES DESIGN BRIEF/);

    expectContractBlock(brief, DIAGRAM_CONTRACT_MUST_LINES);

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



  test.each(topics)("$name TTI brief contains diagram-only contract block", ({ block }) => {

    const brief = formatTextToImageBrief(null, { title: block.title }, block);

    expectContractBlock(brief, TTI_CONTRACT_MUST_LINES, TTI_CONTRACT_MUST_NOT_LINES);

  });



  test("Reflex arc TTI brief includes structure-row alignment and final checklist", () => {

    const brief = formatTextToImageBrief(null, { title: "Reflex arc" }, REFLEX_ARC_BLOCK);

    expect(brief).toMatch(/Strict horizontal alignment \(blank right-rail rows\)/);

    expect(brief).toMatch(/Check that blank right-rail row 1 \(first\) aligns horizontally with Sensory neurone/);

    expect(brief).toMatch(/Check that blank right-rail row 2 \(second\) aligns horizontally with Relay neurone/);

    expect(brief).toMatch(/Check that blank right-rail row 3 \(third\) aligns horizontally with Motor neurone/);

    expect(brief).toMatch(/Check that blank right-rail row 4 \(fourth\) aligns horizontally with Effector/);

    expect(brief).toMatch(/Confirm the image has NO A, B, C, or D letters anywhere/i);

    expect(brief).not.toMatch(/marker letters on image/i);

  });

});


