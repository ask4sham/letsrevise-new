const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Land use";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Land use";

const MCQS = [
  { question: "Human land use includes:", options: ["Only building", "Farming; building; quarrying; dumping waste", "Only farming", "Only forests"], correctIndex: 1, marks: 1 },
  { question: "Deforestation is carried out to:", options: ["Only protect species", "Clear land for farming; timber; roads", "Only plant trees", "Only for water"], correctIndex: 1, marks: 1 },
  { question: "Peat bogs are destroyed when:", options: ["Only left alone", "Drained for farming; peat cut for compost/fuel", "Only in winter", "Only in one country"], correctIndex: 1, marks: 1 },
  { question: "Destroying peat bogs releases:", options: ["Only oxygen", "CO₂ (stored carbon); contributes to global warming", "Only nitrogen", "Only water"], correctIndex: 1, marks: 1 },
  { question: "Land use conflict can occur when:", options: ["Everyone agrees", "Different needs (e.g. farming vs conservation vs housing)", "Only in cities", "Only in countryside"], correctIndex: 1, marks: 1 },
  { question: "Reducing land use impact might involve:", options: ["Only more building", "Recycling; reducing waste; sustainable farming; protecting habitats", "Only more roads", "Only more peat use"], correctIndex: 1, marks: 1 },
  { question: "Quarrying can reduce biodiversity by:", options: ["Only adding species", "Destroying habitats; pollution", "Only in water", "Only in one place"], correctIndex: 1, marks: 1 },
  { question: "Sustainable land use aims to:", options: ["Use all land now", "Meet needs without compromising future; protect resources", "Only build more", "Only farm more"], correctIndex: 1, marks: 1 },
  { question: "Building and roads reduce land available for:", options: ["Only more building", "Wildlife; farming; natural habitats", "Only cars", "Only people"], correctIndex: 1, marks: 1 },
  { question: "Peat is used in gardening as:", options: ["Only fuel", "Compost; soil conditioner", "Only building", "Only food"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Give two ways humans use land and one effect on the environment.", marks: 2, markScheme: ["E.g. farming – habitat loss, fertilisers. Building – habitat loss. Quarrying – destruction, dust. Peat – CO₂ release, habitat loss."] },
  { question: "Why is destruction of peat bogs a concern?", marks: 2, markScheme: ["Releases stored CO₂; increases global warming; destroys habitat; reduces biodiversity."] },
  { question: "What is land use conflict?", marks: 1, markScheme: ["Different demands on land (e.g. farming vs conservation vs housing) that are hard to satisfy together."] },
  { question: "Give one way to reduce the negative impact of land use.", marks: 1, markScheme: ["Recycle; reduce waste; sustainable farming; protect areas; use alternatives to peat."] },
  { question: "What does sustainable land use mean?", marks: 1, markScheme: ["Using land in a way that meets current needs without damaging ability of future generations to meet theirs."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
