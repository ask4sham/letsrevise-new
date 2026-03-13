const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Inheritance, Variation and Evolution";
const TOPIC_NAME = "Extinction";
const UNIT_KEY = "inheritance-variation-evolution";
const TOPIC_LABEL = "Extinction";

const MCQS = [
  { question: "Extinction means:", options: ["A species evolves", "No living members of a species remain", "Only one animal died", "Only in one place"], correctIndex: 1, marks: 1 },
  { question: "Causes of extinction can include:", options: ["Only one cause", "Environmental change; new predator; disease; competition; catastrophic event", "Only humans", "Only climate"], correctIndex: 1, marks: 1 },
  { question: "Dinosaurs may have become extinct due to:", options: ["Only disease", "Asteroid impact; climate change; other factors", "Only competition", "Only humans"], correctIndex: 1, marks: 1 },
  { question: "If the environment changes quickly, species may not:", options: ["Evolve", "Adapt in time; become extinct", "Reproduce", "Eat"], correctIndex: 1, marks: 1 },
  { question: "New predators can cause extinction if:", options: ["Prey adapt quickly", "Prey have no adaptation; population wiped out", "Only one is eaten", "Only in one year"], correctIndex: 1, marks: 1 },
  { question: "Human activity can cause extinction by:", options: ["Only helping", "Habitat destruction; hunting; pollution; introduced species", "Only conservation", "Only breeding"], correctIndex: 1, marks: 1 },
  { question: "Mass extinction is when:", options: ["One species dies", "Many species become extinct in a short time", "Only plants die", "Only in one place"], correctIndex: 1, marks: 1 },
  { question: "After a mass extinction:", options: ["No new species", "New species may evolve; niches become available", "Only same species return", "Only one species survives"], correctIndex: 1, marks: 1 },
  { question: "Competition can lead to extinction if:", options: ["Both species benefit", "One species is better adapted; outcompetes the other", "Only in plants", "Only in water"], correctIndex: 1, marks: 1 },
  { question: "Conservation can help to:", options: ["Cause extinction", "Prevent extinction; protect habitats and species", "Only study fossils", "Only in zoos"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is extinction?", marks: 1, markScheme: ["When a species has no living members left."] },
  { question: "Give two causes of extinction.", marks: 2, markScheme: ["Environmental change; new predator; disease; competition; catastrophic event; human activity (habitat loss, hunting)."] },
  { question: "How might human activity cause extinction?", marks: 2, markScheme: ["Habitat destruction; hunting; pollution; introduced species; climate change."] },
  { question: "Why might a species not survive rapid environmental change?", marks: 1, markScheme: ["No time to adapt through natural selection; no suitable variants; population declines to zero."] },
  { question: "What is mass extinction?", marks: 1, markScheme: ["When many species become extinct in a relatively short period."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
