const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Infection and Response";
const TOPIC_NAME = "Communicable disease";
const UNIT_KEY = "infection-and-response";
const TOPIC_LABEL = "Communicable disease";

const MCQS = [
  { question: "What is a communicable disease?", options: ["Cannot spread", "Caused by pathogen; can spread", "Only genetic", "Only in plants"], correctIndex: 1, marks: 1 },
  { question: "Which is a pathogen?", options: ["Red blood cell", "Virus, bacterium, fungus, protist", "Antibody", "Vaccine"], correctIndex: 1, marks: 1 },
  { question: "How can bacteria cause disease?", options: ["Only by producing toxins", "Producing toxins or damaging cells", "Only in plants", "Only by mutation"], correctIndex: 1, marks: 1 },
  { question: "How do viruses cause disease?", options: ["By eating cells", "Reproduce inside cells; damage or destroy them", "By producing toxins only", "Only in bacteria"], correctIndex: 1, marks: 1 },
  { question: "How can communicable diseases spread?", options: ["Only by air", "Air, water, direct contact, vectors", "Only by touch", "Only by food"], correctIndex: 1, marks: 1 },
  { question: "What is a vector?", options: ["A disease", "An organism that carries a pathogen", "A type of vaccine", "An antibiotic"], correctIndex: 1, marks: 1 },
  { question: "Which is an example of a communicable disease?", options: ["Cancer", "Measles", "Diabetes type 2", "Heart disease"], correctIndex: 1, marks: 1 },
  { question: "Preventing spread can include:", options: ["Only drugs", "Hygiene, vaccination, isolating infected", "Only surgery", "Only diet"], correctIndex: 1, marks: 1 },
  { question: "Pathogens can be spread by:", options: ["Only humans", "Humans, animals, water, air, surfaces", "Only water", "Only air"], correctIndex: 1, marks: 1 },
  { question: "Why is preventing spread important?", options: ["Only for animals", "To reduce number of infected; protect vulnerable", "Only in hospitals", "Only for viruses"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is a communicable disease?", marks: 1, markScheme: ["Disease caused by pathogen; can spread between organisms."] },
  { question: "Give two ways pathogens can be spread.", marks: 2, markScheme: ["Air (droplets); water; direct contact; vectors; food. Any two."] },
  { question: "How do bacteria cause disease?", marks: 2, markScheme: ["Produce toxins; or damage/destroy cells."] },
  { question: "What is a vector? Give one example.", marks: 2, markScheme: ["Organism that carries pathogen. E.g. mosquito (malaria), tick."] },
  { question: "Name one way to reduce the spread of a communicable disease.", marks: 1, markScheme: ["Hygiene; vaccination; isolate infected; clean water; vector control."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
