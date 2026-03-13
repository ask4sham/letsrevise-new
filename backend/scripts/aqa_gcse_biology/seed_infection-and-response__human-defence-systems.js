const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Infection and Response";
const TOPIC_NAME = "Human defence systems";
const UNIT_KEY = "infection-and-response";
const TOPIC_LABEL = "Human defence systems";

const MCQS = [
  { question: "The skin is a barrier against pathogens because:", options: ["It is thick", "It acts as physical barrier; secretes antimicrobial substances", "It has no pores", "It is waterproof only"], correctIndex: 1, marks: 1 },
  { question: "HCl in the stomach helps to:", options: ["Digest food only", "Kill pathogens in food", "Absorb nutrients", "Produce enzymes"], correctIndex: 1, marks: 1 },
  { question: "White blood cells can:", options: ["Only carry oxygen", "Engulf pathogens; produce antibodies; produce antitoxins", "Only clot blood", "Only transport nutrients"], correctIndex: 1, marks: 1 },
  { question: "Antibodies are produced by:", options: ["Red blood cells", "White blood cells", "Platelets", "Pathogens"], correctIndex: 1, marks: 1 },
  { question: "What do antitoxins do?", options: ["Kill bacteria", "Neutralise toxins produced by pathogens", "Carry oxygen", "Clot blood"], correctIndex: 1, marks: 1 },
  { question: "The nose has mucus and hairs to:", options: ["Warm air only", "Trap pathogens; prevent entry", "Produce antibodies", "Detect smell only"], correctIndex: 1, marks: 1 },
  { question: "Phagocytosis is when:", options: ["Pathogens eat cells", "White blood cells engulf and digest pathogens", "Antibodies destroy viruses only", "Toxins are released"], correctIndex: 1, marks: 1 },
  { question: "Which is a non-specific defence?", options: ["Antibodies for one pathogen", "Skin; stomach acid; mucus", "Vaccination", "Antibiotic treatment"], correctIndex: 1, marks: 1 },
  { question: "Specific immunity involves:", options: ["Only skin", "Antibodies that target particular pathogens", "Only stomach acid", "Only tears"], correctIndex: 1, marks: 1 },
  { question: "Trachea and bronchi have mucus to:", options: ["Absorb oxygen", "Trap pathogens; cilia waft mucus up", "Produce enzymes", "Store air"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Name two ways the body prevents pathogens entering.", marks: 2, markScheme: ["Skin; mucus in nose/trachea; stomach acid; tears; cilia."] },
  { question: "What is phagocytosis?", marks: 1, markScheme: ["White blood cell engulfs and digests pathogen."] },
  { question: "How do antibodies help fight infection?", marks: 2, markScheme: ["Bind to specific pathogen/antigen; mark for destruction; neutralise."] },
  { question: "What is the role of antitoxins?", marks: 1, markScheme: ["Neutralise toxins produced by pathogens."] },
  { question: "Give one role of white blood cells in defence.", marks: 1, markScheme: ["Phagocytosis; produce antibodies; produce antitoxins."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
