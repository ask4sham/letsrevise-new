const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Infection and Response";
const TOPIC_NAME = "Plant disease";
const UNIT_KEY = "infection-and-response";
const TOPIC_LABEL = "Plant disease";

const MCQS = [
  { question: "Plants can be infected by:", options: ["Only viruses", "Viruses, bacteria, fungi, protists", "Only fungi", "Only insects"], correctIndex: 1, marks: 1 },
  { question: "Signs of plant disease can include:", options: ["Only wilting", "Discolouration; spots; stunted growth; decay", "Only taller plants", "Only more flowers"], correctIndex: 1, marks: 1 },
  { question: "Mineral deficiency can cause:", options: ["Only green leaves", "Yellow leaves; stunted growth; specific symptoms", "Only more fruit", "Only more roots"], correctIndex: 1, marks: 1 },
  { question: "Nitrate deficiency often causes:", options: ["Purple leaves", "Stunted growth; yellow older leaves", "Red leaves only", "No effect"], correctIndex: 1, marks: 1 },
  { question: "Magnesium is needed for:", options: ["Root growth only", "Chlorophyll; deficiency causes yellow leaves", "Flower colour only", "Seed production only"], correctIndex: 1, marks: 1 },
  { question: "How can plant diseases be identified?", options: ["Only by taste", "Reference materials; lab tests; gardening experts", "Only by touch", "Only by smell"], correctIndex: 1, marks: 1 },
  { question: "Physical defences in plants include:", options: ["Only flowers", "Cell wall; waxy cuticle; bark; thorns", "Only roots", "Only leaves"], correctIndex: 1, marks: 1 },
  { question: "Chemical defences in plants include:", options: ["Only water", "Antimicrobial substances; poisons", "Only sugars", "Only oxygen"], correctIndex: 1, marks: 1 },
  { question: "Pests can damage plants by:", options: ["Only shading them", "Eating leaves; spreading disease; damaging roots", "Only watering", "Only fertilising"], correctIndex: 1, marks: 1 },
  { question: "Reducing spread of plant disease can involve:", options: ["Only pesticides", "Removing infected plants; crop rotation; clean equipment", "Only more water", "Only more fertiliser"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Give two physical defences plants have against disease.", marks: 2, markScheme: ["Cell wall; waxy cuticle; bark; thorns; leaf fall. Any two."] },
  { question: "What are the symptoms of magnesium deficiency in plants?", marks: 1, markScheme: ["Yellow leaves; magnesium needed for chlorophyll."] },
  { question: "How might a gardener identify a plant disease?", marks: 2, markScheme: ["Compare symptoms to reference; send sample to lab; use expert/gardening guide."] },
  { question: "Name one way to reduce the spread of plant disease.", marks: 1, markScheme: ["Remove infected plants; crop rotation; clean tools; control pests."] },
  { question: "Why is nitrate important for plant growth?", marks: 1, markScheme: ["Needed for protein/amino acids; growth; deficiency causes stunted growth."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
