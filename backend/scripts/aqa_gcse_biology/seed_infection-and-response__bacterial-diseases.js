const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Infection and Response";
const TOPIC_NAME = "Bacterial diseases";
const UNIT_KEY = "infection-and-response";
const TOPIC_LABEL = "Bacterial diseases";

const MCQS = [
  { question: "Which is a bacterial disease?", options: ["Measles", "Salmonella", "HIV", "TMV"], correctIndex: 1, marks: 1 },
  { question: "Salmonella is often spread by:", options: ["Air only", "Contaminated food or undercooked poultry", "Vectors only", "Direct contact only"], correctIndex: 1, marks: 1 },
  { question: "Gonorrhoea is spread by:", options: ["Water", "Sexual contact", "Droplets", "Food"], correctIndex: 1, marks: 1 },
  { question: "How can bacterial diseases be treated?", options: ["Vaccines only", "Antibiotics", "No treatment", "Surgery only"], correctIndex: 1, marks: 1 },
  { question: "Antibiotic resistance in bacteria can develop because:", options: ["Antibiotics cause resistance", "Mutations; overuse of antibiotics", "Bacteria are immune", "Viruses help bacteria"], correctIndex: 1, marks: 1 },
  { question: "Prevention of gonorrhoea includes:", options: ["Vaccination only", "Barrier contraception; limiting sexual partners", "Antibiotics only", "Diet"], correctIndex: 1, marks: 1 },
  { question: "Symptoms of Salmonella may include:", options: ["Rash only", "Fever, abdominal cramps, vomiting, diarrhoea", "Cough only", "Joint pain only"], correctIndex: 1, marks: 1 },
  { question: "Bacteria reproduce by:", options: ["Meiosis", "Binary fission", "Budding", "Spores only"], correctIndex: 1, marks: 1 },
  { question: "Why is finishing a course of antibiotics important?", options: ["To save money", "To kill all bacteria; reduce resistance", "To speed recovery only", "Doctors require it"], correctIndex: 1, marks: 1 },
  { question: "Which is used to prevent some bacterial diseases?", options: ["Painkillers only", "Vaccination", "Antibiotics only", "Surgery only"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Name one bacterial disease and how it is spread.", marks: 2, markScheme: ["E.g. Salmonella – food; Gonorrhoea – sexual contact."] },
  { question: "How can Salmonella infection be prevented?", marks: 1, markScheme: ["Cook food thoroughly; hygiene; vaccinate poultry."] },
  { question: "Why has antibiotic resistance become a problem?", marks: 2, markScheme: ["Overuse of antibiotics; mutations in bacteria; resistant strains survive."] },
  { question: "What is gonorrhoea and how can it be treated?", marks: 2, markScheme: ["STI caused by bacteria; treated with antibiotics; resistance is an issue."] },
  { question: "Give one reason to complete a full course of antibiotics.", marks: 1, markScheme: ["Kill all bacteria; reduce risk of resistant strains surviving."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
