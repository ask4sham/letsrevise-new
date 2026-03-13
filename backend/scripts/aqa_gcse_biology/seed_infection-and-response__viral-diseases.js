const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Infection and Response";
const TOPIC_NAME = "Viral diseases";
const UNIT_KEY = "infection-and-response";
const TOPIC_LABEL = "Viral diseases";

const MCQS = [
  { question: "Which disease is caused by a virus?", options: ["Tuberculosis", "Measles", "Cholera", "Salmonella"], correctIndex: 1, marks: 1 },
  { question: "How do viruses reproduce?", options: ["Outside cells", "Inside host cells", "By binary fission", "By spores"], correctIndex: 1, marks: 1 },
  { question: "HIV attacks which cells?", options: ["Red blood cells", "White blood cells", "Platelets", "Neurones"], correctIndex: 1, marks: 1 },
  { question: "TMV affects:", options: ["Humans", "Plants", "Bacteria", "Fungi"], correctIndex: 1, marks: 1 },
  { question: "Why are viral diseases hard to treat?", options: ["Viruses are too small", "Viruses live inside cells; drugs may harm host", "Viruses mutate slowly", "Antibiotics work on them"], correctIndex: 1, marks: 1 },
  { question: "Measles is spread mainly by:", options: ["Water", "Droplets from coughs/sneezes", "Vectors only", "Food"], correctIndex: 1, marks: 1 },
  { question: "What is TMV?", options: ["A bacterial disease", "Tobacco mosaic virus", "A fungal infection", "A vaccine"], correctIndex: 1, marks: 1 },
  { question: "HIV can lead to AIDS because:", options: ["It damages the heart", "It weakens the immune system", "It affects digestion", "It damages nerves only"], correctIndex: 1, marks: 1 },
  { question: "Prevention of viral diseases often relies on:", options: ["Antibiotics only", "Vaccination and hygiene", "Surgery only", "Diet only"], correctIndex: 1, marks: 1 },
  { question: "Viruses are not considered living because:", options: ["They are too small", "They do not carry out life processes outside a host", "They have no DNA", "They cannot cause disease"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Name one viral disease and how it is spread.", marks: 2, markScheme: ["E.g. measles – droplets; HIV – body fluids; TMV – contact/damage."] },
  { question: "Why are antibiotics not used against viruses?", marks: 1, markScheme: ["Antibiotics target bacteria; viruses reproduce inside cells; no effect on viruses."] },
  { question: "What is the effect of TMV on plants?", marks: 2, markScheme: ["Mosaic pattern on leaves; reduced growth/yield; affects chloroplasts."] },
  { question: "How does HIV affect the body?", marks: 1, markScheme: ["Attacks white blood cells; weakens immune system; can lead to AIDS."] },
  { question: "Give one way to reduce the spread of viral diseases.", marks: 1, markScheme: ["Vaccination; hygiene; isolation; use of condoms for HIV."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
