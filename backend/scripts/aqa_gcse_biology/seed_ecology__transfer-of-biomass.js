const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Transfer of biomass";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Transfer of biomass";

const MCQS = [
  { question: "When a consumer eats a producer, biomass is:", options: ["Only gained", "Transferred; but much is lost", "Only lost", "Only in plants"], correctIndex: 1, marks: 1 },
  { question: "Biomass is lost because:", options: ["Only in faeces", "Respiration; excretion; egestion; not all eaten", "Only in movement", "Only as heat"], correctIndex: 1, marks: 1 },
  { question: "Only a small percentage of biomass is transferred to the next level; typically:", options: ["About 90%", "About 10%", "About 50%", "100%"], correctIndex: 1, marks: 1 },
  { question: "Respiration uses biomass to:", options: ["Store energy", "Release energy; biomass lost as CO₂ and water", "Only grow", "Only reproduce"], correctIndex: 1, marks: 1 },
  { question: "Not all of an organism is eaten because:", options: ["Only bones", "Roots; bones; parts left behind; not all digestible", "Only leaves", "Only in water"], correctIndex: 1, marks: 1 },
  { question: "Efficiency of biomass transfer can be calculated as:", options: ["Only total biomass", "Biomass at next level / biomass at previous level × 100", "Only in plants", "Only in animals"], correctIndex: 1, marks: 1 },
  { question: "Improving efficiency in food production might involve:", options: ["Only more levels", "Reducing number of levels; limiting movement; warm environment", "Only more predators", "Only more plants"], correctIndex: 1, marks: 1 },
  { question: "Egestion is:", options: ["Respiration", "Loss of faeces (undigested material)", "Only excretion", "Only eating"], correctIndex: 1, marks: 1 },
  { question: "At each trophic level most energy is:", options: ["Passed on", "Lost (not passed to next level)", "Only stored", "Only in producers"], correctIndex: 1, marks: 1 },
  { question: "Why do farmers sometimes feed livestock high-protein food?", options: ["Only taste", "Reduce energy loss to movement; more efficient transfer to human food", "Only cost", "Only growth"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Why is only a small proportion of biomass transferred to the next trophic level?", marks: 2, markScheme: ["Lost in respiration (CO₂, water, heat); excretion; egestion; not all parts eaten or digested."] },
  { question: "What is the approximate efficiency of transfer between trophic levels?", marks: 1, markScheme: ["Around 10%; most energy/biomass is lost."] },
  { question: "How can efficiency of biomass transfer be improved in farming?", marks: 2, markScheme: ["Reduce trophic levels (eat plants not meat); limit movement (e.g. battery farming); control temperature; high-quality feed."] },
  { question: "What is the difference between excretion and egestion?", marks: 1, markScheme: ["Excretion: waste from metabolism (e.g. urea). Egestion: faeces; undigested material."] },
  { question: "Where does the biomass go that is not transferred to the next level?", marks: 1, markScheme: ["Respiration (CO₂, water); heat; excretion; egestion; decomposers."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
