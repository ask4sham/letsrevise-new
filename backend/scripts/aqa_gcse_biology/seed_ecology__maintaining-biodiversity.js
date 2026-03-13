const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Maintaining biodiversity";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Maintaining biodiversity";

const MCQS = [
  { question: "Ways to maintain biodiversity include:", options: ["Only deforestation", "Protected areas; breeding programmes; habitat restoration; legal protection", "Only hunting", "Only farming"], correctIndex: 1, marks: 1 },
  { question: "Protected areas (e.g. national parks) help by:", options: ["Only allowing hunting", "Limiting development; protecting habitats and species", "Only in one country", "Only for plants"], correctIndex: 1, marks: 1 },
  { question: "Breeding programmes (e.g. in zoos) can:", options: ["Only reduce numbers", "Increase population of endangered species; reintroduce", "Only in wild", "Only for one species"], correctIndex: 1, marks: 1 },
  { question: "Habitat restoration might involve:", options: ["Only building", "Replanting; recreating wetlands; removing invasive species", "Only digging", "Only in cities"], correctIndex: 1, marks: 1 },
  { question: "International agreements (e.g. CITES) aim to:", options: ["Only trade more", "Control trade in endangered species; protect them", "Only in one country", "Only for plants"], correctIndex: 1, marks: 1 },
  { question: "Reducing waste and recycling can help biodiversity by:", options: ["Only saving money", "Less habitat for landfill; less pollution; less demand for raw materials", "Only in water", "Only in soil"], correctIndex: 1, marks: 1 },
  { question: "Seed banks store:", options: ["Only animals", "Seeds of plants (especially rare) for future", "Only food", "Only one species"], correctIndex: 1, marks: 1 },
  { question: "Fishing quotas help to:", options: ["Only increase catch", "Limit catch; allow fish populations to recover", "Only in one country", "Only in rivers"], correctIndex: 1, marks: 1 },
  { question: "Why maintain biodiversity?", options: ["Only for beauty", "Ecosystem stability; resources; ethical; potential medicines", "Only in zoos", "Only in labs"], correctIndex: 1, marks: 1 },
  { question: "Reintroduction programmes:", options: ["Only in zoos", "Release captive-bred or relocated species into wild", "Only for plants", "Only in one place"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Give three ways to maintain or increase biodiversity.", marks: 2, markScheme: ["Protected areas; breeding programmes; habitat restoration; seed banks; legal protection (CITES); reduce pollution; sustainable practices."] },
  { question: "What is the role of breeding programmes in conservation?", marks: 2, markScheme: ["Increase numbers of endangered species; maintain genetic diversity; may allow reintroduction to wild."] },
  { question: "What are seed banks and why are they used?", marks: 1, markScheme: ["Store seeds of plants (especially rare species); preserve genetic diversity; for future use or reintroduction."] },
  { question: "How can international agreements help protect species?", marks: 1, markScheme: ["Control trade (e.g. CITES); prevent over-exploitation; countries work together."] },
  { question: "Give one reason why it is important to maintain biodiversity.", marks: 1, markScheme: ["Ecosystem stability; resources (food, medicine); ethical; resilience to change."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
