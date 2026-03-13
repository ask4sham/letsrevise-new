const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Waste management";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Waste management";

const MCQS = [
  { question: "Human waste can cause pollution of:", options: ["Only land", "Land; water; air", "Only air", "Only one place"], correctIndex: 1, marks: 1 },
  { question: "Landfill is:", options: ["Only recycling", "Burying waste in ground", "Only composting", "Only burning"], correctIndex: 1, marks: 1 },
  { question: "Problems with landfill include:", options: ["Only cost", "Space; leachate; methane; visual; takes long to decompose", "Only in one country", "Only in cities"], correctIndex: 1, marks: 1 },
  { question: "Recycling reduces:", options: ["Only cost", "Need for raw materials; energy; landfill; pollution", "Only waste", "Only plastic"], correctIndex: 1, marks: 1 },
  { question: "Composting is used for:", options: ["Only plastic", "Organic waste (e.g. food, garden); produces compost", "Only metal", "Only glass"], correctIndex: 1, marks: 1 },
  { question: "Incineration (burning waste) can:", options: ["Only reduce volume", "Reduce volume; produce energy; but may release pollutants", "Only add waste", "Only in water"], correctIndex: 1, marks: 1 },
  { question: "Reducing waste at source means:", options: ["Only recycling", "Using less; designing for less waste", "Only burning", "Only landfill"], correctIndex: 1, marks: 1 },
  { question: "Sewage treatment aims to:", options: ["Only add nutrients", "Remove harmful substances before water returned to environment", "Only in sea", "Only in rivers"], correctIndex: 1, marks: 1 },
  { question: "Plastic waste is a problem because:", options: ["Only cost", "Does not decompose quickly; can harm wildlife; persists", "Only in water", "Only on land"], correctIndex: 1, marks: 1 },
  { question: "Better waste management can help biodiversity by:", options: ["Only saving money", "Less pollution; less habitat destroyed for landfill", "Only in one place", "Only in water"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Give two problems with disposing of waste in landfill.", marks: 2, markScheme: ["Uses space; leachate can pollute water; methane produced; slow decomposition; visual impact."] },
  { question: "How does recycling help the environment?", marks: 2, markScheme: ["Reduces need for raw materials; saves energy; reduces landfill; can reduce pollution."] },
  { question: "What is composting and what is it used for?", marks: 1, markScheme: ["Breaking down organic waste (e.g. food, garden) by decomposers; produces compost for soil."] },
  { question: "Give one way to reduce the amount of waste produced.", marks: 1, markScheme: ["Use less; buy less packaging; reuse; design products for longer life."] },
  { question: "Why is plastic waste a particular concern?", marks: 1, markScheme: ["Does not biodegrade quickly; persists; can harm wildlife; microplastics; fills landfill."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
