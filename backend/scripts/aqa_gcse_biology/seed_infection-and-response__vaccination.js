const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Infection and Response";
const TOPIC_NAME = "Vaccination";
const UNIT_KEY = "infection-and-response";
const TOPIC_LABEL = "Vaccination";

const MCQS = [
  { question: "Vaccination involves introducing:", options: ["Live active pathogen", "Dead or weakened pathogen or antigens", "Antibiotics", "Antitoxins only"], correctIndex: 1, marks: 1 },
  { question: "Why does vaccination protect against disease?", options: ["It kills all pathogens", "Body produces antibodies; memory cells give long-term immunity", "It blocks the nose", "It raises body temperature only"], correctIndex: 1, marks: 1 },
  { question: "Herd immunity means:", options: ["Only vaccinated people are protected", "Enough people vaccinated so disease spreads less; protects unvaccinated", "Only animals are immune", "Immunity lasts one day"], correctIndex: 1, marks: 1 },
  { question: "Memory cells are produced by:", options: ["Red blood cells", "White blood cells after exposure to antigen", "Platelets", "Pathogens"], correctIndex: 1, marks: 1 },
  { question: "If a vaccinated person meets the real pathogen:", options: ["They always get ill", "Memory cells produce antibodies quickly", "Nothing happens", "Vaccine is used up"], correctIndex: 1, marks: 1 },
  { question: "Vaccines can contain:", options: ["Only live pathogens", "Dead pathogens; weakened pathogens; antigens", "Only antibiotics", "Only toxins"], correctIndex: 1, marks: 1 },
  { question: "Why might booster vaccinations be needed?", options: ["To cure disease", "Immunity may decrease over time", "To replace blood", "To kill bacteria"], correctIndex: 1, marks: 1 },
  { question: "Vaccination is an example of:", options: ["Natural passive immunity", "Artificial active immunity", "No immunity", "Only herd immunity"], correctIndex: 1, marks: 1 },
  { question: "Which disease has been reduced by vaccination?", options: ["None", "Measles; polio; smallpox (eradicated)", "Only flu", "Only colds"], correctIndex: 1, marks: 1 },
  { question: "Antigens in a vaccine trigger:", options: ["Disease", "Production of antibodies by white blood cells", "Only fever", "Only pain"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "How does vaccination lead to immunity?", marks: 2, markScheme: ["Introduce dead/weakened pathogen or antigens; body produces antibodies; memory cells give long-term response."] },
  { question: "What is herd immunity?", marks: 1, markScheme: ["When enough people are immune so disease spreads less; protects those not vaccinated."] },
  { question: "Why might a person need a booster vaccination?", marks: 1, markScheme: ["Immunity may decrease over time; booster increases antibody/memory response."] },
  { question: "What is in a vaccine?", marks: 2, markScheme: ["Dead or weakened pathogen; or antigens; to trigger immune response without causing disease."] },
  { question: "Give one benefit of vaccination to society.", marks: 1, markScheme: ["Reduce spread of disease; herd immunity; eradicate or control disease."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
