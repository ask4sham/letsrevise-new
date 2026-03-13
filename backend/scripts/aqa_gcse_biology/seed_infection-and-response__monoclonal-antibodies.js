const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Infection and Response";
const TOPIC_NAME = "Monoclonal antibodies";
const UNIT_KEY = "infection-and-response";
const TOPIC_LABEL = "Monoclonal antibodies";

const MCQS = [
  { question: "Monoclonal antibodies are:", options: ["Identical antibodies from one clone", "Many different antibodies", "Only from plants", "Only used for vaccination"], correctIndex: 0, marks: 1 },
  { question: "They are produced by:", options: ["Red blood cells", "Fusing a mouse B cell with a tumour cell", "Bacteria only", "Viruses"], correctIndex: 1, marks: 1 },
  { question: "Monoclonal antibodies can be used for:", options: ["Only treatment", "Diagnosis; pregnancy tests; targeted treatment", "Only vaccination", "Only pain relief"], correctIndex: 1, marks: 1 },
  { question: "Pregnancy tests use monoclonal antibodies to detect:", options: ["Glucose", "hCG hormone", "Bacteria", "Viruses"], correctIndex: 1, marks: 1 },
  { question: "In cancer treatment, monoclonal antibodies can:", options: ["Only diagnose", "Bind to cancer cells; deliver drug or trigger immune response", "Only relieve pain", "Replace surgery"], correctIndex: 1, marks: 1 },
  { question: "Hybridoma cells are used because they:", options: ["Die quickly", "Divide and produce same antibody", "Only grow in plants", "Are bacteria"], correctIndex: 1, marks: 1 },
  { question: "Monoclonal antibodies are 'specific' meaning:", options: ["They work on all diseases", "They bind to one specific target molecule", "They are cheap", "They last forever"], correctIndex: 1, marks: 1 },
  { question: "A use in research is:", options: ["Only treatment", "Locating or identifying molecules in cells/tissues", "Only in pregnancy", "Only in animals"], correctIndex: 1, marks: 1 },
  { question: "Producing monoclonal antibodies originally involved:", options: ["Only bacteria", "Mice; hybridoma", "Only plants", "Only humans"], correctIndex: 1, marks: 1 },
  { question: "Targeted drug delivery using monoclonal antibodies can:", options: ["Increase damage to healthy cells", "Reduce side effects by targeting specific cells", "Only diagnose", "Replace all other drugs"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What are monoclonal antibodies?", marks: 1, markScheme: ["Identical antibodies produced from one clone of cells; same structure; bind to one specific target."] },
  { question: "Describe how monoclonal antibodies are produced.", marks: 2, markScheme: ["Mouse injected with antigen; B cells make antibodies; fuse with tumour cell to form hybridoma; clone produces identical antibodies."] },
  { question: "Give two uses of monoclonal antibodies.", marks: 2, markScheme: ["Pregnancy tests; diagnosis; targeted cancer treatment; research to locate molecules."] },
  { question: "How can monoclonal antibodies be used in pregnancy testing?", marks: 1, markScheme: ["Bind to hCG in urine; show positive/negative result."] },
  { question: "Why might monoclonal antibodies be used in cancer treatment?", marks: 1, markScheme: ["Target cancer cells specifically; deliver drug or mark for immune system; reduce damage to healthy cells."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
