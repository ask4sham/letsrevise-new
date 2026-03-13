const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Organisation";
const TOPIC_NAME = "Transport in plants";
const UNIT_KEY = "organisation";
const TOPIC_LABEL = "Transport in plants";

const MCQS = [
  { question: "Water is transported from roots to leaves in:", options: ["Phloem", "Xylem", "Epidermis", "Palisade"], correctIndex: 1, marks: 1 },
  { question: "Translocation is the movement of:", options: ["Water", "Sugars (e.g. sucrose) in phloem", "Minerals only", "Oxygen only"], correctIndex: 1, marks: 1 },
  { question: "What drives the movement of water up the xylem?", options: ["Only gravity", "Transpiration pull and cohesion", "Phloem only", "Root pressure only"], correctIndex: 1, marks: 1 },
  { question: "Sugars move from source to sink. A source could be:", options: ["Root only", "Leaf (photosynthesis)", "Flower only", "Stem only"], correctIndex: 1, marks: 1 },
  { question: "Xylem vessels are made of:", options: ["Living cells", "Dead cells; hollow; strengthened by lignin", "Only cellulose", "Only phloem"], correctIndex: 1, marks: 1 },
  { question: "Where does translocation occur?", options: ["Xylem only", "Phloem", "Epidermis", "Stomata only"], correctIndex: 1, marks: 1 },
  { question: "Root pressure:", options: ["Pushes water down", "Helps push water up (one factor)", "Only in leaves", "Stops flow"], correctIndex: 1, marks: 1 },
  { question: "A sink in plants is where:", options: ["Water is lost", "Sugars are used or stored", "Light is absorbed only", "Minerals are absorbed"], correctIndex: 1, marks: 1 },
  { question: "Cohesion-tension helps explain:", options: ["Translocation", "Water flow up xylem", "Stomatal opening only", "Root growth only"], correctIndex: 1, marks: 1 },
  { question: "Phloem is made of:", options: ["Only dead cells", "Sieve tubes and companion cells", "Only xylem", "Only epidermis"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is translocation?", marks: 1, markScheme: ["Movement of sugars (e.g. sucrose) in phloem; from source to sink."] },
  { question: "Describe how water moves from roots to leaves.", marks: 2, markScheme: ["In xylem; transpiration pull; cohesion; adhesion; root pressure."] },
  { question: "What is the difference between xylem and phloem?", marks: 2, markScheme: ["Xylem: water and minerals up; dead; lignin. Phloem: sugars; living sieve tubes."] },
  { question: "What is a source and a sink?", marks: 2, markScheme: ["Source: where sugar is made (e.g. leaf). Sink: where used/stored (e.g. root, fruit)."] },
  { question: "Name the process by which water is lost from leaves.", marks: 1, markScheme: ["Transpiration."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
