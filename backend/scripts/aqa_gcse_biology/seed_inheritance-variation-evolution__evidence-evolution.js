const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Inheritance, Variation and Evolution";
const TOPIC_NAME = "Evidence for evolution";
const UNIT_KEY = "inheritance-variation-evolution";
const TOPIC_LABEL = "Evidence for evolution";

const MCQS = [
  { question: "Evidence for evolution includes:", options: ["Only one source", "Fossils; comparative anatomy; DNA; antibiotic resistance", "Only religion", "Only theory"], correctIndex: 1, marks: 1 },
  { question: "Comparative anatomy shows:", options: ["No similarity", "Similar structures in different species (e.g. pentadactyl limb)", "Only in humans", "Only in plants"], correctIndex: 1, marks: 1 },
  { question: "Similar DNA between species suggests:", options: ["No relationship", "Common ancestor; closer DNA = more recent common ancestor", "Only same environment", "Only same diet"], correctIndex: 1, marks: 1 },
  { question: "The pentadactyl limb is found in:", options: ["Only humans", "Mammals, birds, reptiles, amphibians (same basic structure)", "Only fish", "Only insects"], correctIndex: 1, marks: 1 },
  { question: "Fossils provide evidence by:", options: ["Only showing living species", "Showing organisms that lived in the past; sequence of change", "Only showing plants", "Only showing recent life"], correctIndex: 1, marks: 1 },
  { question: "Antibiotic resistance in bacteria supports evolution because:", options: ["Bacteria don't change", "Resistant strains survive and reproduce; we see change over time", "Only one bacterium", "Only in one country"], correctIndex: 1, marks: 1 },
  { question: "Homologous structures are:", options: ["Same function, different origin", "Similar structure, different function; suggest common ancestor", "Only in fossils", "Only in one species"], correctIndex: 1, marks: 1 },
  { question: "The fossil record is incomplete because:", options: ["All organisms fossilise", "Many organisms don't fossilise; soft tissue decays; conditions rare", "Only plants fossilise", "Only recent fossils exist"], correctIndex: 1, marks: 1 },
  { question: "DNA evidence is strong because:", options: ["DNA never changes", "All living things use DNA; more similar DNA = closer relationship", "Only in animals", "Only in humans"], correctIndex: 1, marks: 1 },
  { question: "Evolution is a theory that:", options: ["Has no evidence", "Is supported by many lines of evidence", "Only applies to fossils", "Only applies to bacteria"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Give three types of evidence for evolution.", marks: 2, markScheme: ["Fossils; comparative anatomy (e.g. pentadactyl limb); DNA similarity; antibiotic resistance; embryology."] },
  { question: "How does the pentadactyl limb support evolution?", marks: 2, markScheme: ["Same basic structure in different species; different functions; suggests common ancestor; adaptive radiation."] },
  { question: "How does DNA provide evidence for evolution?", marks: 1, markScheme: ["Similar DNA between species suggests common ancestor; closer relationship = more similar DNA."] },
  { question: "Why is the fossil record incomplete?", marks: 1, markScheme: ["Many organisms don't fossilise; soft parts decay; specific conditions needed; many fossils destroyed."] },
  { question: "What are homologous structures?", marks: 1, markScheme: ["Structures with similar origin/structure but different function; suggest common ancestor."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
