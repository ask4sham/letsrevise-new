const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "The eye";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "The eye";

const MCQS = [
  { question: "Light is focused on the retina by the:", options: ["Optic nerve", "Cornea and lens", "Iris only", "Ciliary muscle only"], correctIndex: 1, marks: 1 },
  { question: "The lens changes shape to:", options: ["Produce tears", "Focus on near and far objects (accommodation)", "Control light only", "Send impulses"], correctIndex: 1, marks: 1 },
  { question: "The iris controls:", options: ["Focus", "Amount of light entering (pupil size)", "Colour only", "Distance only"], correctIndex: 1, marks: 1 },
  { question: "Rods and cones are:", options: ["In the lens", "Receptor cells in the retina", "In the cornea", "In the iris"], correctIndex: 1, marks: 1 },
  { question: "In bright light the pupil:", options: ["Dilates", "Constricts (gets smaller)", "Disappears", "Changes colour"], correctIndex: 1, marks: 1 },
  { question: "To focus on a near object the lens:", options: ["Becomes thinner", "Becomes fatter (more curved)", "Does not change", "Moves back"], correctIndex: 1, marks: 1 },
  { question: "Long-sightedness (hyperopia) means:", options: ["Near objects blurry; lens too strong", "Near objects blurry; lens too weak or eyeball too short", "Far objects blurry", "No focus"], correctIndex: 1, marks: 1 },
  { question: "Short-sightedness (myopia) can be corrected with:", options: ["Convex lens", "Concave lens", "No lens", "Only surgery"], correctIndex: 1, marks: 1 },
  { question: "The optic nerve carries impulses:", options: ["To the lens", "From retina to brain", "To the iris", "To the cornea"], correctIndex: 1, marks: 1 },
  { question: "The cornea does not contain blood vessels so that:", options: ["It is strong", "It stays transparent for light", "It can move", "It can grow"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "How does the eye focus on near and far objects?", marks: 2, markScheme: ["Ciliary muscles change shape of lens; fatter for near, thinner for far (accommodation)."] },
  { question: "What happens to the pupil in bright light and why?", marks: 2, markScheme: ["Pupil constricts (gets smaller); iris muscles contract; less light enters; protects retina."] },
  { question: "What is long-sightedness and how can it be corrected?", marks: 2, markScheme: ["Near objects blurry; eyeball too short or lens too weak. Convex lens."] },
  { question: "Where are the light receptor cells and what do they do?", marks: 1, markScheme: ["Retina; rods and cones detect light; send impulses via optic nerve to brain."] },
  { question: "What is the role of the iris?", marks: 1, markScheme: ["Controls pupil size; amount of light entering the eye."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
