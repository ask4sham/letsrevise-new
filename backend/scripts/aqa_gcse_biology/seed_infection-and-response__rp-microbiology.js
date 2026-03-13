const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Infection and Response";
const TOPIC_NAME = "Required Practical: Microbiology";
const UNIT_KEY = "infection-and-response";
const TOPIC_LABEL = "Required Practical: Microbiology";

const MCQS = [
  { question: "In the microbiology practical, aseptic technique is used to:", options: ["Speed up growth", "Prevent contamination by unwanted microorganisms", "Kill all bacteria", "Make bacteria visible"], correctIndex: 1, marks: 1 },
  { question: "Why is the inoculating loop flamed?", options: ["To cool it", "To sterilise it and prevent contamination", "To grow bacteria", "To colour the agar"], correctIndex: 1, marks: 1 },
  { question: "Agar plates are incubated upside down to:", options: ["Speed growth", "Prevent condensation dripping onto culture", "Kill bacteria", "Reduce temperature"], correctIndex: 1, marks: 1 },
  { question: "What is used to spread bacteria on agar?", options: ["Finger", "Inoculating loop or spreader", "Water only", "Antibiotic"], correctIndex: 1, marks: 1 },
  { question: "Why should the lid of the Petri dish be opened as little as possible?", options: ["To keep it warm", "To reduce contamination from air", "To slow growth", "To save agar"], correctIndex: 1, marks: 1 },
  { question: "At what temperature are school cultures usually incubated?", options: ["37 °C", "25 °C to avoid growth of human pathogens", "100 °C", "0 °C"], correctIndex: 1, marks: 1 },
  { question: "Clear zones around antibiotic discs indicate:", options: ["No effect", "Bacteria are killed or growth inhibited there", "More growth", "Contamination"], correctIndex: 1, marks: 1 },
  { question: "What is a culture medium?", options: ["A type of microscope", "Agar or broth containing nutrients for growth", "A disinfectant", "A type of antibiotic"], correctIndex: 1, marks: 1 },
  { question: "To test the effect of antibiotics you might:", options: ["Only add water", "Place antibiotic discs on inoculated agar; measure zones", "Heat the agar only", "Freeze the plate"], correctIndex: 1, marks: 1 },
  { question: "Disinfecting the work surface before and after helps to:", options: ["Grow more bacteria", "Reduce contamination; ensure safety", "Cool the agar", "Colour the bacteria"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is aseptic technique and why is it used?", marks: 2, markScheme: ["Working in a way to avoid contamination; sterilise equipment; minimal opening of lids; prevent unwanted microbes."] },
  { question: "Why are agar plates incubated at 25 °C in schools?", marks: 1, markScheme: ["To avoid growing human pathogens that grow best at 37 °C; safety."] },
  { question: "How could you test the effect of an antibiotic on bacteria?", marks: 2, markScheme: ["Inoculate agar with bacteria; place antibiotic disc; incubate; measure zone of inhibition."] },
  { question: "Give one way to sterilise equipment in this practical.", marks: 1, markScheme: ["Flame inoculating loop; use disinfectant; autoclave."] },
  { question: "Why are Petri dish lids not fully removed when inoculating?", marks: 1, markScheme: ["To reduce contamination from air; aseptic technique."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
