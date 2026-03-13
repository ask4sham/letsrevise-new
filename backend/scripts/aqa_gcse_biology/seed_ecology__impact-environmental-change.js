const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Impact of environmental change";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Impact of environmental change";

const MCQS = [
  { question: "Environmental changes that can affect distribution include:", options: ["Only temperature", "Temperature; water; atmospheric gases; availability of resources", "Only light", "Only soil"], correctIndex: 1, marks: 1 },
  { question: "If temperature increases, some species may:", options: ["Only stay", "Move to cooler areas (e.g. poleward or up mountains)", "Only die immediately", "Only in water"], correctIndex: 1, marks: 1 },
  { question: "Distribution of a species means:", options: ["Only how many", "Where it is found (geographic range)", "Only in one place", "Only in one year"], correctIndex: 1, marks: 1 },
  { question: "Water availability can affect:", options: ["Only animals", "Where plants and animals can live", "Only plants", "Only in desert"], correctIndex: 1, marks: 1 },
  { question: "Atmospheric change (e.g. pollution) can:", options: ["Only help species", "Harm some species; change distribution", "Only affect water", "Only affect soil"], correctIndex: 1, marks: 1 },
  { question: "Loss of habitat can cause:", options: ["Only more species", "Population decline; extinction; change in distribution", "Only migration", "Only in one country"], correctIndex: 1, marks: 1 },
  { question: "Indicator species can show:", options: ["Only temperature", "Environmental quality (e.g. pollution level)", "Only rainfall", "Only light"], correctIndex: 1, marks: 1 },
  { question: "Lichens can indicate:", options: ["Only water", "Air quality (sensitive to sulfur dioxide)", "Only soil", "Only temperature"], correctIndex: 1, marks: 1 },
  { question: "Rapid environmental change may mean:", options: ["All species adapt", "Some species cannot adapt; decline or extinction", "Only more biodiversity", "Only in one place"], correctIndex: 1, marks: 1 },
  { question: "Changes in one species can affect others because of:", options: ["No link", "Interdependence (food chains; competition)", "Only in water", "Only in plants"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "How might a rise in temperature affect the distribution of a species?", marks: 2, markScheme: ["May move to cooler areas (higher altitude, poleward); may disappear from warmer parts of range; may expand into newly suitable areas."] },
  { question: "What is an indicator species?", marks: 1, markScheme: ["Species whose presence/absence or abundance indicates environmental quality (e.g. pollution)."] },
  { question: "Give two environmental factors that can change and affect distribution.", marks: 2, markScheme: ["Temperature; water availability; atmospheric gases; light; pH; availability of food/nutrients."] },
  { question: "Why might rapid environmental change lead to extinction?", marks: 1, markScheme: ["Species may not have time to adapt; no suitable variants; population declines to zero."] },
  { question: "How can lichens be used to indicate air quality?", marks: 1, markScheme: ["Sensitive to sulfur dioxide; few or no lichens = polluted air; many = cleaner air."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
