/**
 * Cross-topic semantic marking fixtures (mock plumbing + live calibration).
 */
module.exports = [
  {
    topic: "transpiration",
    question: "Explain how environmental factors affect the rate of transpiration.",
    marks: 4,
    markScheme: [
      "Higher temperature increases the rate of transpiration.",
      "Higher humidity decreases the rate of transpiration.",
      "Wind increases the rate of transpiration.",
      "Light intensity increases the rate of transpiration when stomata are open.",
    ],
    cases: [
      { id: "one-point", answer: "Higher temperature increases transpiration.", expectedScore: 1 },
      {
        id: "two-point",
        answer: "Higher temperature increases transpiration. Wind increases transpiration.",
        expectedScore: 2,
      },
      {
        id: "full",
        answer:
          "Higher temperature increases transpiration. Higher humidity decreases transpiration. Wind increases transpiration. More light increases transpiration when stomata are open.",
        expectedScore: 4,
      },
      {
        id: "paraphrase",
        answer:
          "Warmer conditions speed up water loss. Damp air slows transpiration. Moving air removes water vapour faster. Brighter light opens stomata and increases water loss.",
        expectedScore: 4,
      },
      {
        id: "keyword-spam",
        answer: "temperature humidity wind light transpiration",
        expectedScore: 0,
      },
      {
        id: "wrong-science",
        answer: "Higher humidity increases transpiration because the air is wetter.",
        expectedScore: 0,
      },
      {
        id: "contradiction",
        answer: "Higher humidity increases the rate of transpiration.",
        expectedScore: 0,
      },
      {
        id: "partial-noise",
        answer: "Wind increases transpiration. football cricket rugby.",
        expectedScore: 1,
      },
    ],
  },
  {
    topic: "cell-structure",
    question: "Describe the functions of four cell structures.",
    marks: 4,
    markScheme: [
      "Nucleus contains genetic material and controls cell activities.",
      "Mitochondria are the site of aerobic respiration and ATP production.",
      "Ribosomes are the site of protein synthesis.",
      "Cell membrane controls which substances enter and leave the cell.",
    ],
    cases: [
      { id: "one-point", answer: "The nucleus controls the cell and contains DNA.", expectedScore: 1 },
      {
        id: "two-point",
        answer: "The nucleus controls the cell. Mitochondria carry out aerobic respiration.",
        expectedScore: 2,
      },
      {
        id: "full",
        answer:
          "The nucleus contains DNA and controls the cell. Mitochondria release energy by aerobic respiration. Ribosomes make proteins. The cell membrane controls entry and exit of substances.",
        expectedScore: 4,
      },
      {
        id: "paraphrase",
        answer:
          "DNA in the nucleus directs the cell. Mitochondria produce ATP through respiration. Proteins are assembled on ribosomes. The membrane regulates movement in and out.",
        expectedScore: 4,
      },
      {
        id: "keyword-spam",
        answer: "nucleus mitochondria ribosomes membrane",
        expectedScore: 0,
      },
      {
        id: "wrong-science",
        answer: "Mitochondria are the site of photosynthesis.",
        expectedScore: 0,
      },
      {
        id: "contradiction",
        answer: "The nucleus has no genetic material.",
        expectedScore: 0,
      },
      {
        id: "partial-noise",
        answer: "Ribosomes are the site of protein synthesis. basketball.",
        expectedScore: 1,
      },
    ],
  },
  {
    topic: "mitosis",
    question: "Describe the stages of mitosis and why mitosis is important.",
    marks: 4,
    markScheme: [
      "DNA replicates before mitosis so each new cell receives a full set of chromosomes.",
      "Chromosomes line up along the middle of the cell during metaphase.",
      "Chromatids are pulled apart to opposite ends of the cell during anaphase.",
      "Mitosis produces genetically identical body cells for growth and repair.",
    ],
    cases: [
      { id: "one-point", answer: "DNA replicates before mitosis.", expectedScore: 1 },
      {
        id: "two-point",
        answer: "DNA replicates before mitosis. Chromosomes line up in the middle during metaphase.",
        expectedScore: 2,
      },
      {
        id: "full",
        answer:
          "DNA replicates first. Chromosomes line up in metaphase. Chromatids move apart in anaphase. Mitosis makes identical cells for growth and repair.",
        expectedScore: 4,
      },
      {
        id: "paraphrase",
        answer:
          "The genetic material doubles before division. Chromosomes align centrally. Sister chromatids separate to opposite poles. Identical body cells are produced for growth and tissue repair.",
        expectedScore: 4,
      },
      { id: "keyword-spam", answer: "prophase metaphase anaphase telophase mitosis", expectedScore: 0 },
      {
        id: "wrong-science",
        answer: "Mitosis produces four genetically different gametes.",
        expectedScore: 0,
      },
      {
        id: "contradiction",
        answer: "Mitosis produces genetically different cells.",
        expectedScore: 0,
      },
      {
        id: "partial-noise",
        answer: "Mitosis produces identical body cells for growth and repair. pizza.",
        expectedScore: 1,
      },
    ],
  },
  {
    topic: "chd",
    question: "Explain how lifestyle factors can affect coronary heart disease.",
    marks: 4,
    markScheme: [
      "A diet high in saturated fat can increase blood cholesterol.",
      "Smoking damages blood vessels and increases CHD risk.",
      "Lack of exercise can contribute to obesity and CHD risk.",
      "High blood pressure can damage artery walls and increase CHD risk.",
    ],
    cases: [
      { id: "one-point", answer: "A diet high in saturated fat increases cholesterol.", expectedScore: 1 },
      {
        id: "two-point",
        answer: "Saturated fat increases cholesterol. Smoking damages blood vessels.",
        expectedScore: 2,
      },
      {
        id: "full",
        answer:
          "Saturated fat raises cholesterol. Smoking damages arteries. Lack of exercise can cause obesity. High blood pressure damages artery walls.",
        expectedScore: 4,
      },
      {
        id: "paraphrase",
        answer:
          "Eating too much saturated fat raises blood cholesterol. Cigarette smoke harms blood vessels. Not exercising increases obesity risk. Raised blood pressure can damage arteries.",
        expectedScore: 4,
      },
      { id: "keyword-spam", answer: "fat smoking exercise blood pressure CHD", expectedScore: 0 },
      {
        id: "wrong-science",
        answer: "Exercise always increases CHD risk.",
        expectedScore: 0,
      },
      {
        id: "contradiction",
        answer: "Smoking decreases CHD risk.",
        expectedScore: 0,
      },
      {
        id: "partial-noise",
        answer: "High blood pressure can damage artery walls. tennis.",
        expectedScore: 1,
      },
    ],
  },
  {
    topic: "xylem",
    question: "Explain how xylem transports water in a plant.",
    marks: 4,
    markScheme: [
      "Water evaporates from leaves by transpiration creating a transpiration pull.",
      "Water moves up xylem vessels as a continuous column due to cohesion between water molecules.",
      "Adhesion between water and xylem walls helps water move upwards.",
      "Root pressure can push water up the xylem in some conditions.",
    ],
    cases: [
      { id: "one-point", answer: "Transpiration from leaves pulls water upward.", expectedScore: 1 },
      {
        id: "two-point",
        answer: "Transpiration pulls water up. Cohesion keeps the water column continuous.",
        expectedScore: 2,
      },
      {
        id: "full",
        answer:
          "Transpiration pulls water up. Cohesion forms a continuous column. Adhesion helps water stick to xylem walls. Root pressure can also push water up.",
        expectedScore: 4,
      },
      {
        id: "paraphrase",
        answer:
          "Water loss from leaves draws water upward. Water molecules stick together in the xylem. Water also adheres to vessel walls. Roots can generate pressure to move water.",
        expectedScore: 4,
      },
      { id: "keyword-spam", answer: "transpiration cohesion adhesion root pressure xylem", expectedScore: 0 },
      {
        id: "wrong-science",
        answer: "Xylem transports sugars made in photosynthesis.",
        expectedScore: 0,
      },
      {
        id: "contradiction",
        answer: "Transpiration decreases the pull of water up the xylem.",
        expectedScore: 0,
      },
      {
        id: "partial-noise",
        answer: "Adhesion between water and xylem walls helps water move upwards. cats.",
        expectedScore: 1,
      },
    ],
  },
  {
    topic: "tumours",
    question: "Compare benign and malignant tumours.",
    marks: 4,
    markScheme: [
      "Benign tumours do not spread to other parts of the body.",
      "Malignant tumours can invade neighbouring tissues.",
      "Malignant tumours can spread to other parts of the body through the blood or lymph.",
      "Benign tumours are usually slower growing than malignant tumours.",
    ],
    cases: [
      { id: "one-point", answer: "Benign tumours do not spread to other parts of the body.", expectedScore: 1 },
      {
        id: "two-point",
        answer: "Benign tumours stay in one place. Malignant tumours can invade neighbouring tissues.",
        expectedScore: 2,
      },
      {
        id: "full",
        answer:
          "Benign tumours do not spread. Malignant tumours invade nearby tissues. Malignant tumours can spread in blood or lymph. Benign tumours usually grow more slowly.",
        expectedScore: 4,
      },
      {
        id: "paraphrase",
        answer:
          "Benign growths remain local. Cancerous tumours invade surrounding tissue. Malignant cells can travel in blood or lymph. Benign tumours tend to grow slowly.",
        expectedScore: 4,
      },
      { id: "keyword-spam", answer: "benign malignant spread invade blood lymph", expectedScore: 0 },
      {
        id: "wrong-science",
        answer: "Benign tumours always spread quickly to other organs.",
        expectedScore: 0,
      },
      {
        id: "contradiction",
        answer: "Benign tumours spread to other parts of the body.",
        expectedScore: 0,
      },
      {
        id: "partial-noise",
        answer: "Malignant tumours can spread through the blood or lymph. dogs.",
        expectedScore: 1,
      },
    ],
  },
];
