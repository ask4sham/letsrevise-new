const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Inheritance, Variation and Evolution";
const TOPIC_NAME = "Resistant bacteria";
const UNIT_KEY = "inheritance-variation-evolution";
const TOPIC_LABEL = "Resistant bacteria";

const MCQS = [
  { question: "Antibiotic-resistant bacteria have:", options: ["No mutations", "Mutations that allow them to survive antibiotics", "Only one bacterium", "Only in hospitals"], correctIndex: 1, marks: 1 },
  { question: "Resistance develops because:", options: ["Antibiotics cause resistance", "Mutation produces resistant strain; non-resistant killed; resistant survive and reproduce", "Only one dose", "Only in one country"], correctIndex: 1, marks: 1 },
  { question: "MRSA is:", options: ["A virus", "Methicillin-resistant Staphylococcus aureus; antibiotic-resistant bacteria", "A vaccine", "A type of antibiotic"], correctIndex: 1, marks: 1 },
  { question: "To reduce antibiotic resistance we should:", options: ["Use antibiotics for all infections", "Only use when needed; complete full course; not for viral infections", "Use as prevention only", "Use more antibiotics"], correctIndex: 1, marks: 1 },
  { question: "Why is finishing a course of antibiotics important?", options: ["To save money", "Kill all bacteria; resistant ones may remain if stopped early", "To slow recovery", "Doctors require it"], correctIndex: 1, marks: 1 },
  { question: "Resistant bacteria are an example of:", options: ["No evolution", "Evolution by natural selection", "Only mutation", "Only in labs"], correctIndex: 1, marks: 1 },
  { question: "Overuse of antibiotics:", options: ["Reduces resistance", "Increases chance of resistant strains developing", "Only in animals", "Only in hospitals"], correctIndex: 1, marks: 1 },
  { question: "In natural selection of bacteria, the 'selection pressure' is:", options: ["Food", "The antibiotic (kills non-resistant)", "Only temperature", "Only oxygen"], correctIndex: 1, marks: 1 },
  { question: "Why shouldn't antibiotics be used for flu?", options: ["Flu is not serious", "Flu is viral; antibiotics only work on bacteria; overuse increases resistance", "Only in children", "Only in adults"], correctIndex: 1, marks: 1 },
  { question: "New antibiotics are needed because:", options: ["Old ones don't work on viruses", "Resistant strains evolve; some infections hard to treat", "Only for prevention", "Only in one country"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "How does antibiotic resistance develop?", marks: 2, markScheme: ["Mutation in bacteria produces resistant allele; antibiotic kills non-resistant; resistant survive and reproduce; resistance spreads."] },
  { question: "Why should patients complete a full course of antibiotics?", marks: 1, markScheme: ["To kill all bacteria; stopping early may leave resistant bacteria to multiply."] },
  { question: "How is antibiotic resistance an example of natural selection?", marks: 2, markScheme: ["Variation (resistant vs non-resistant); antibiotic is selection pressure; resistant survive and reproduce; allele frequency increases."] },
  { question: "Give one way to reduce the development of resistant bacteria.", marks: 1, markScheme: ["Use antibiotics only when needed; complete full course; restrict use in farming; don't use for viral infections."] },
  { question: "What is MRSA?", marks: 1, markScheme: ["Methicillin-resistant Staphylococcus aureus; bacterium that is resistant to several antibiotics."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
