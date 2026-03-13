const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Pyramids of biomass";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Pyramids of biomass";

const MCQS = [
  { question: "A pyramid of biomass shows:", options: ["Only number of organisms", "Mass of living material (biomass) at each trophic level", "Only energy", "Only producers"], correctIndex: 1, marks: 1 },
  { question: "The pyramid is always pyramid-shaped because:", options: ["There are more consumers", "Biomass decreases at each level (energy lost)", "Only in water", "Only in summer"], correctIndex: 1, marks: 1 },
  { question: "Biomass is usually measured in:", options: ["Only numbers", "Grams per metre squared (g/m²) or similar", "Only litres", "Only degrees"], correctIndex: 1, marks: 1 },
  { question: "The bottom bar of the pyramid represents:", options: ["Top predators", "Producers (largest biomass)", "Decomposers", "Primary consumers"], correctIndex: 1, marks: 1 },
  { question: "Why does biomass decrease at higher trophic levels?", options: ["More organisms", "Energy lost; less energy = less biomass can be supported", "Only in plants", "Only in animals"], correctIndex: 1, marks: 1 },
  { question: "Pyramids of biomass are more accurate than pyramids of numbers because:", options: ["They are smaller", "One large organism has more biomass than many small; numbers can mislead", "Only for plants", "Only for animals"], correctIndex: 1, marks: 1 },
  { question: "Dry mass is often used for biomass to:", options: ["Add water", "Remove effect of water content; more comparable", "Only in plants", "Only in animals"], correctIndex: 1, marks: 1 },
  { question: "If the pyramid is inverted it might mean:", options: ["Nothing", "Sample taken at one time (e.g. phytoplankton reproduce fast)", "Only in lab", "Only on land"], correctIndex: 1, marks: 1 },
  { question: "The width of each bar represents:", options: ["Only height", "Relative biomass at that trophic level", "Only number", "Only energy in joules"], correctIndex: 1, marks: 1 },
  { question: "Pyramids of biomass help to show:", options: ["Only food chains", "Transfer of biomass; why few top predators", "Only producers", "Only consumers"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What does a pyramid of biomass show?", marks: 1, markScheme: ["Mass of living material (biomass) at each trophic level; usually bar diagram with producers at bottom."] },
  { question: "Why does the biomass decrease at each trophic level?", marks: 2, markScheme: ["Energy lost (respiration, heat, waste); less energy to build biomass at next level."] },
  { question: "Why might we use dry mass for biomass?", marks: 1, markScheme: ["Water content varies; dry mass gives comparable measure of actual organic material."] },
  { question: "How is a pyramid of biomass different from a pyramid of numbers?", marks: 1, markScheme: ["Biomass: mass at each level. Numbers: count of organisms; can be misleading (e.g. one tree vs many insects)."] },
  { question: "What is the shape of a typical pyramid of biomass and why?", marks: 1, markScheme: ["Pyramid (wide at bottom); biomass decreases going up trophic levels."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
