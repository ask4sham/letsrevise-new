const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Inheritance, Variation and Evolution";
const TOPIC_NAME = "Classification";
const UNIT_KEY = "inheritance-variation-evolution";
const TOPIC_LABEL = "Classification";

const MCQS = [
  { question: "Classification groups organisms by:", options: ["Only size", "Similarities and differences; evolutionary relationships", "Only colour", "Only habitat"], correctIndex: 1, marks: 1 },
  { question: "The order of classification (large to small) includes:", options: ["Only species", "Kingdom, phylum, class, order, family, genus, species", "Only genus", "Only kingdom"], correctIndex: 1, marks: 1 },
  { question: "The binomial name consists of:", options: ["Only genus", "Genus and species (e.g. Homo sapiens)", "Only species", "Only family"], correctIndex: 1, marks: 1 },
  { question: "Evolutionary trees show:", options: ["Only living species", "Relationships; common ancestors; how recently species diverged", "Only fossils", "Only one species"], correctIndex: 1, marks: 1 },
  { question: "Species that share a recent common ancestor:", options: ["Are less similar", "Are more similar; closely related", "Are in different kingdoms", "Cannot be compared"], correctIndex: 1, marks: 1 },
  { question: "The three-domain system divides life into:", options: ["Only animals", "Bacteria; Archaea; Eukaryota", "Only plants and animals", "Only eukaryotes"], correctIndex: 1, marks: 1 },
  { question: "DNA sequencing has improved classification because:", options: ["DNA doesn't change", "More accurate relationships; objective; can compare all organisms", "Only for animals", "Only for plants"], correctIndex: 1, marks: 1 },
  { question: "Genus is a group that contains:", options: ["Only one species", "One or more similar species", "Only families", "Only kingdoms"], correctIndex: 1, marks: 1 },
  { question: "Scientific names are used to:", options: ["Only in one country", "Avoid confusion; same name worldwide", "Only in English", "Only for animals"], correctIndex: 1, marks: 1 },
  { question: "Traditional classification was based mainly on:", options: ["Only DNA", "Visible features (morphology, anatomy)", "Only behaviour", "Only habitat"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is the binomial system and give an example.", marks: 2, markScheme: ["Two-part name: genus and species. E.g. Homo sapiens; first word capitalised, both italicised."] },
  { question: "List the order of classification from kingdom to species.", marks: 1, markScheme: ["Kingdom, phylum, class, order, family, genus, species."] },
  { question: "How has DNA sequencing changed classification?", marks: 2, markScheme: ["More accurate evolutionary relationships; objective; can compare species with few visible similarities; revised some groupings."] },
  { question: "What do evolutionary trees show?", marks: 1, markScheme: ["Relationships between species; common ancestors; when species diverged."] },
  { question: "Why do we use scientific (Latin) names?", marks: 1, markScheme: ["Same name worldwide; avoids confusion; reflects relationships (genus)."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
