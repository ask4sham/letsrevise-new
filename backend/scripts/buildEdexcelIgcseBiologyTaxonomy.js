/* eslint-disable no-console */
/**
 * Build backend/config/edexcel_igcse_biology_topics.json — revision-note taxonomy (screenshot-aligned).
 * Not wired into the app. Run manually:
 *   node backend/scripts/buildEdexcelIgcseBiologyTaxonomy.js
 */
const fs = require("fs");
const path = require("path");

const SPEC_KEY = "edexcel-igcse-biology";

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function topicEntry(mainTopic, sectionTitle, title, opts = {}) {
  const key = slugify(title);
  return {
    topic: title,
    key,
    mainTopic,
    section: sectionTitle,
    topicKey: `${SPEC_KEY}:${key}`,
    tier: [],
    requiredPractical: Boolean(opts.requiredPractical),
  };
}

const MAIN_1 = "The nature and variety of living organisms";
const MAIN_2 = "Structure and functions in living organisms";
const MAIN_3 = "Reproduction and inheritance";
const MAIN_4 = "Ecology and the environment";
const MAIN_5 = "Use of biological resources";

/**
 * Revision-note lesson topics from Edexcel IGCSE Biology 4BI1 screenshot taxonomy.
 * Main topic → section → lesson topic (not one topic per Pearson spec statement).
 */
const UNITS = [
  {
    unit: MAIN_1,
    key: "nature-and-variety-of-living-organisms",
    mainTopic: MAIN_1,
    sections: [
      {
        title: "Characteristics of living organisms",
        slug: "characteristics-of-living-organisms",
        topics: ["Characteristics of Living Organisms"],
      },
      {
        title: "Variety of living organisms",
        slug: "variety-of-living-organisms",
        topics: [
          "Common Features: Eukaryotic Organisms",
          "Common Features: Prokaryotic Organisms",
          "Pathogens",
        ],
      },
    ],
  },
  {
    unit: MAIN_2,
    key: "structure-and-functions-in-living-organisms",
    mainTopic: MAIN_2,
    sections: [
      {
        title: "Level of organisation",
        slug: "level-of-organisation",
        topics: ["Levels of Organisation"],
      },
      {
        title: "Cell structure",
        slug: "cell-structure",
        topics: [
          "Cell Structures",
          "Animal & Plant Cells: Similarities & Differences",
          "Importance of Cell Differentiation",
          "Stem Cells in Medicine: Advantages & Disadvantages",
        ],
      },
      {
        title: "Biological molecules",
        slug: "biological-molecules",
        topics: [
          "Structure of Biological Molecules",
          "Practical: Food Tests",
          "Role of Enzymes",
          "Temperature & Enzyme Function",
          "Practical: Investigating Temperature & Enzyme Activity",
          "pH & Enzyme Function",
          "Practical: Investigating pH & Enzyme Activity",
        ],
      },
      {
        title: "Movement of substances into and out of cells",
        slug: "movement-of-substances",
        topics: [
          "Diffusion, Osmosis & Active Transport",
          "Factors Affecting the Rate of Movement of Substances",
          "Practical: Investigating Diffusion & Osmosis",
        ],
      },
      {
        title: "Nutrition",
        slug: "nutrition",
        topics: [
          "The Process of Photosynthesis",
          "Factors Affecting the Rate of Photosynthesis",
          "Leaf: Structure & Adaptations",
          "Plants & Mineral Ions",
          "Practical: Investigating Photosynthesis",
          "Balanced Diet",
          "Human Alimentary Canal: Structure & Function",
          "Peristalsis",
          "Role of Digestive Enzymes",
          "Bile",
          "Small Intestine: Structure & Adaptations",
          "Practical: Energy Content of a Food Sample",
        ],
      },
      {
        title: "Respiration",
        slug: "respiration",
        topics: [
          "Process of Respiration",
          "Aerobic & Anaerobic Respiration",
          "Practical: Investigating Respiration",
        ],
      },
      {
        title: "Gas exchange",
        slug: "gas-exchange",
        topics: [
          "Gas Exchange in Plants",
          "Leaf Adaptations for Gas Exchange",
          "Gas Exchange: Night vs Day",
          "Practical: The Effect of Light on Gas Exchange in Plants",
          "Structure of the Respiratory System",
          "Role of the Intercostal Muscles & Diaphragm",
          "Alveoli: Adaptations for Gas Exchange",
          "Smoking & the Gas Exchange System",
          "Practical: The Effect of Age on Breathing",
        ],
      },
      {
        title: "Transport",
        slug: "transport",
        topics: [
          "The Need for a Transport System",
          "Role of the Xylem & Phloem",
          "Absorption of Water by Root Hair Cells",
          "Transpiration",
          "Practical: Factors Affecting Transpiration",
          "The Blood",
          "White Blood Cells & Immunity",
          "Vaccinations",
          "Platelets & Blood Clotting",
          "Structure & Function of the Heart",
          "Heart Rate & Exercise",
          "Risk Factors for Coronary Heart Disease",
          "Blood Vessels: Structure & Function",
          "Circulatory System: General Structure",
        ],
      },
      {
        title: "Excretion",
        slug: "excretion",
        topics: [
          "Excretion in Plants",
          "Excretion in Humans",
          "Kidney: Excretion & Osmoregulation",
          "Structure of the Urinary System",
          "Nephron Structure",
          "Nephron Function",
          "ADH & Composition of Urine",
        ],
      },
      {
        title: "Co-ordination and response",
        slug: "coordination-and-response",
        topics: [
          "Response to Changes in the Environment",
          "Homeostasis",
          "Co-ordinating Response",
          "Response to Stimuli: Plants",
          "Nervous & Hormonal Control",
          "Human Nervous System",
          "Role of Neurotransmitters at Synapses",
          "Simple Reflex Arc",
          "The Human Eye: Structure",
          "The Human Eye: Function",
          "The Role of Skin in Temperature Regulation",
          "Hormones: Adrenaline, Insulin, Testosterone, Progesterone & Oestrogen",
          "The Role of Hormones: ADH, FSH & LH",
        ],
      },
    ],
  },
  {
    unit: MAIN_3,
    key: "reproduction-and-inheritance",
    mainTopic: MAIN_3,
    sections: [
      {
        title: "Reproduction",
        slug: "reproduction",
        topics: [
          "Sexual & Asexual Reproduction: Differences",
          "Gametes & Fertilisation",
          "Adaptations for Pollination",
          "The Process of Fertilisation in Plants",
          "Practical: Conditions for Germination",
          "Germinating Seeds",
          "Asexual Plant Reproduction",
          "Human Male & Female Reproductive Systems",
          "Roles of Oestrogen & Progesterone in the Menstrual Cycle",
          "Roles of FSH & LH in the Menstrual Cycle",
          "Role of the Placenta",
          "Amniotic Fluid",
          "Development of Secondary Sexual Characteristics",
        ],
      },
      {
        title: "Inheritance",
        slug: "inheritance",
        topics: [
          "The Genome & Genes",
          "DNA Structure",
          "RNA Structure",
          "Stages of Protein Synthesis",
          "Alleles",
          "Key Terms in Genetics",
          "Codominance",
          "Polygenic Inheritance",
          "Monohybrid Inheritance: Genetic Diagrams",
          "Family Pedigrees",
          "Sex Chromosomes",
          "Mitosis",
          "Meiosis",
          "Random Fertilisation & Genetic Variation",
          "Diploid vs Haploid",
          "Variation within a Species",
          "Mutation",
          "Mutation: Advanced",
          "Darwin's Theory of Evolution by Natural Selection",
          "Antibiotic Resistance",
        ],
      },
    ],
  },
  {
    unit: MAIN_4,
    key: "ecology-and-the-environment",
    mainTopic: MAIN_4,
    sections: [
      {
        title: "The organism in the environment",
        slug: "the-organism-in-the-environment",
        topics: [
          "Population, Community, Habitat & Ecosystem",
          "Practical: Investigating Population Size",
          "Biodiversity",
          "Practical: Investigating the Distribution of Organisms",
          "Abiotic & Biotic Factors",
        ],
      },
      {
        title: "Feeding relationships",
        slug: "feeding-relationships",
        topics: [
          "Trophic Levels",
          "Food Chains, Food Webs & Pyramids",
          "Transfers Along a Food Chain",
        ],
      },
      {
        title: "Cycles within ecosystems",
        slug: "cycles-within-ecosystems",
        topics: ["Carbon Cycle", "Nitrogen Cycle"],
      },
      {
        title: "Human influences on the environment",
        slug: "human-influences-on-the-environment",
        topics: [
          "Biological Consequences of Air Pollution",
          "Greenhouse Gases",
          "Enhanced Greenhouse Effect",
          "Biological Consequences of Water Pollution",
          "The Effects of Deforestation",
        ],
      },
    ],
  },
  {
    unit: MAIN_5,
    key: "use-of-biological-resources",
    mainTopic: MAIN_5,
    sections: [
      {
        title: "Food production",
        slug: "food-production",
        topics: [
          "Crop Plants: Glasshouses & Polythene Tunnels",
          "Crop Plants: Increasing Carbon Dioxide & Temperature",
          "Crop Plants: Fertiliser",
          "Crop Plants: Pest Control",
          "Yeast in Food Production",
          "Practical: Investigating Anaerobic Respiration in Yeast",
          "Role of Bacteria in Yoghurt Production",
          "Industrial Fermenters",
          "Fish Farming",
        ],
      },
      {
        title: "Selective breeding",
        slug: "selective-breeding",
        topics: ["Selective Breeding in Plants", "Selective Breeding in Animals"],
      },
      {
        title: "Genetic modification (genetic engineering)",
        slug: "genetic-modification",
        topics: [
          "The Process of Genetic Modification",
          "Manufacturing Human Insulin",
          "GM Plants & Food Production",
          "Transgenic",
        ],
      },
      {
        title: "Cloning",
        slug: "cloning",
        topics: ["Micropropagation", "The Production of Cloned Mammals"],
      },
    ],
  },
];

function buildTaxonomy() {
  return {
    subject: "Biology",
    examBoard: "Edexcel",
    level: "IGCSE",
    specKey: SPEC_KEY,
    displayName: "Edexcel IGCSE Biology",
    tier: [],
    units: UNITS.map((u) => ({
      unit: u.unit,
      key: u.key,
      mainTopic: u.mainTopic,
      topics: [],
      sections: u.sections.map((s) => ({
        title: s.title,
        slug: s.slug,
        topics: s.topics.map((title) => {
          const practical = /^Practical:/i.test(title);
          return topicEntry(u.mainTopic, s.title, title, { requiredPractical: practical });
        }),
      })),
    })),
  };
}

function countStats(taxonomy) {
  let sections = 0;
  let topics = 0;
  for (const unit of taxonomy.units) {
    sections += (unit.sections || []).length;
    for (const sec of unit.sections || []) {
      topics += (sec.topics || []).length;
    }
  }
  return { mainTopics: taxonomy.units.length, sections, topics };
}

function main() {
  const taxonomy = buildTaxonomy();
  const outPath = path.join(__dirname, "..", "config", "edexcel_igcse_biology_topics.json");
  fs.writeFileSync(outPath, `${JSON.stringify(taxonomy, null, 2)}\n`, "utf8");
  const stats = countStats(taxonomy);
  console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
  console.log(`Main topics: ${stats.mainTopics}`);
  console.log(`Sections: ${stats.sections}`);
  console.log(`Lesson topics: ${stats.topics}`);
}

if (require.main === module) {
  main();
}

module.exports = { buildTaxonomy, countStats, SPEC_KEY, UNITS };
