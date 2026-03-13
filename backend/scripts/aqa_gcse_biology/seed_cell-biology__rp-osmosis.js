const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Required Practical: Osmosis";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Required Practical: Osmosis";

const MCQS = [
  { question: "In the osmosis potato practical, what do we measure?", options: ["Colour change", "Mass or length of potato cylinders", "Temperature", "pH"], correctIndex: 1, marks: 1 },
  { question: "Why are potato cylinders placed in different concentrations of sugar or salt solution?", options: ["To keep them warm", "To create different water concentrations outside the potato", "To stain them", "To kill cells"], correctIndex: 1, marks: 1 },
  { question: "What is the control in the potato osmosis practical?", options: ["Distilled water", "Strong sugar solution only", "No potato", "Boiled potato only"], correctIndex: 0, marks: 1 },
  { question: "If a potato cylinder gains mass, the solution outside was:", options: ["More concentrated than the potato", "Dilute / lower concentration than potato", "Same concentration", "Pure salt"], correctIndex: 1, marks: 1 },
  { question: "Why do we dry the potato cylinders before weighing?", options: ["To stain them", "To remove surface water so mass is accurate", "To heat them", "To cut them"], correctIndex: 1, marks: 1 },
  { question: "What happens to potato in distilled water?", options: ["Loses mass", "Gains mass (water enters by osmosis)", "No change", "Dissolves"], correctIndex: 1, marks: 1 },
  { question: "Why use several potato cylinders per concentration?", options: ["To use more potato", "To calculate mean and improve reliability", "To save time", "To change concentration"], correctIndex: 1, marks: 1 },
  { question: "When the concentration outside equals that inside the potato, the mass change is:", options: ["Maximum", "Zero / minimal", "Negative only", "Always positive"], correctIndex: 1, marks: 1 },
  { question: "Which variable do we change in this investigation?", options: ["Temperature", "Concentration of solution", "Type of potato", "Time only"], correctIndex: 1, marks: 1 },
  { question: "Osmosis in this practical is the movement of:", options: ["Sugar into potato", "Water through potato cell membranes", "Salt only", "Air"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Describe how to investigate osmosis using potato cylinders.", marks: 3, markScheme: ["Cut equal-sized cylinders; measure mass/length; place in different concentration solutions; leave same time; dry and reweigh; repeat for reliability."] },
  { question: "Why might potato cylinders be left in the solution for 20–30 minutes?", marks: 1, markScheme: ["Allow time for osmosis to occur / reach equilibrium."] },
  { question: "If a cylinder loses mass, in which direction did water move?", marks: 1, markScheme: ["Out of the potato / from potato into solution."] },
  { question: "Why use multiple cylinders per concentration?", marks: 1, markScheme: ["Calculate mean; improve reliability; identify anomalies."] },
  { question: "What is the independent variable in this investigation?", marks: 1, markScheme: ["Concentration of sugar or salt solution."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
