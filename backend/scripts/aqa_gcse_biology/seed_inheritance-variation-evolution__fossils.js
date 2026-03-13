const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Inheritance, Variation and Evolution";
const TOPIC_NAME = "Fossils";
const UNIT_KEY = "inheritance-variation-evolution";
const TOPIC_LABEL = "Fossils";

const MCQS = [
  { question: "Fossils are:", options: ["Only living organisms", "Remains or traces of organisms from the past", "Only rocks", "Only plants"], correctIndex: 1, marks: 1 },
  { question: "Fossils can form when:", options: ["Only from hard parts", "Parts don't decay (e.g. in ice, amber, mud); minerals replace tissue; traces (footprints)", "Only in water", "Only in air"], correctIndex: 1, marks: 1 },
  { question: "Why do we have few fossils of early life?", options: ["They were all destroyed", "Organisms were soft-bodied; decayed; conditions for fossilisation rare", "Only plants existed", "Only in one place"], correctIndex: 1, marks: 1 },
  { question: "Fossils can show:", options: ["Only recent life", "How organisms changed over time; extinct species", "Only humans", "Only one species"], correctIndex: 1, marks: 1 },
  { question: "Dating fossils can be done by:", options: ["Only guessing", "Relative position in rock layers; radiometric dating", "Only colour", "Only size"], correctIndex: 1, marks: 1 },
  { question: "Older fossils are usually found in:", options: ["Top layers", "Deeper rock layers (if not disturbed)", "Only surface", "Only one layer"], correctIndex: 1, marks: 1 },
  { question: "Extinction shown by fossils means:", options: ["Species evolved", "Species has no living members", "Only one died", "Only in one place"], correctIndex: 1, marks: 1 },
  { question: "Fossil evidence can show:", options: ["Only one organism", "Transitional forms; sequence of evolution", "Only plants", "Only animals"], correctIndex: 1, marks: 1 },
  { question: "Why might soft-bodied organisms not form fossils?", options: ["They are too small", "They decay quickly before fossilisation", "Only in water", "Only on land"], correctIndex: 1, marks: 1 },
  { question: "Cast fossils form when:", options: ["Organism stays intact", "Organism decays leaving a cavity; mineral fills it", "Only in ice", "Only in amber"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is a fossil?", marks: 1, markScheme: ["Remains or traces of organisms preserved from the past."] },
  { question: "Describe two ways fossils can form.", marks: 2, markScheme: ["Parts don't decay (ice, amber, lack of oxygen). Minerals replace tissue. Traces: footprints, burrows."] },
  { question: "Why is the fossil record incomplete?", marks: 2, markScheme: ["Soft-bodied organisms decay; specific conditions needed; many destroyed; not all environments preserve fossils."] },
  { question: "How can fossils provide evidence for evolution?", marks: 1, markScheme: ["Show sequence of life over time; transitional forms; extinct species; change in organisms."] },
  { question: "How can we estimate the age of a fossil?", marks: 1, markScheme: ["Position in rock layers (relative); radiometric dating of rocks."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
