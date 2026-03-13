const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Sustainable fisheries";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Sustainable fisheries";

const MCQS = [
  { question: "Overfishing means:", options: ["Fishing too little", "Catching fish faster than they can reproduce; stocks decline", "Only in rivers", "Only in one country"], correctIndex: 1, marks: 1 },
  { question: "Sustainable fishing aims to:", options: ["Catch as much as possible now", "Maintain fish stocks for future; not overfish", "Only in freshwater", "Only in one place"], correctIndex: 1, marks: 1 },
  { question: "Fishing quotas limit:", options: ["Only size of boat", "Amount of fish that can be caught", "Only in summer", "Only in one country"], correctIndex: 1, marks: 1 },
  { question: "Net mesh size can be regulated so that:", options: ["Only small fish caught", "Young/small fish escape; only mature fish caught", "Only large fish escape", "Only in rivers"], correctIndex: 1, marks: 1 },
  { question: "Why let young fish escape?", options: ["Only to save them", "They can reproduce; maintain population", "Only in ocean", "Only in one place"], correctIndex: 1, marks: 1 },
  { question: "Fish stocks can be maintained by:", options: ["Only fishing more", "Quotas; mesh size; closed seasons; protected areas", "Only in one country", "Only in rivers"], correctIndex: 1, marks: 1 },
  { question: "Depletion of fish stocks affects:", options: ["Only fishermen", "Food security; ecosystem; jobs; other species", "Only in ocean", "Only in one place"], correctIndex: 1, marks: 1 },
  { question: "Closed seasons allow:", options: ["Only more fishing", "Fish to reproduce without being caught", "Only in summer", "Only in rivers"], correctIndex: 1, marks: 1 },
  { question: "Sustainable fisheries consider:", options: ["Only profit now", "Long-term; breeding population; ecosystem", "Only one species", "Only one country"], correctIndex: 1, marks: 1 },
  { question: "Aquaculture (fish farming) can:", options: ["Only reduce demand", "Provide fish; may reduce pressure on wild stocks if sustainable", "Only in ocean", "Only in one place"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is overfishing and why is it a problem?", marks: 2, markScheme: ["Catching fish faster than they reproduce. Stocks decline; ecosystem affected; food security and jobs at risk."] },
  { question: "Give two ways to make fishing more sustainable.", marks: 2, markScheme: ["Quotas (limit catch); mesh size (let young escape); closed seasons; protected areas; restrict damaging methods."] },
  { question: "Why is mesh size important?", marks: 1, markScheme: ["Larger mesh allows young/small fish to escape; they can grow and reproduce; maintain stocks."] },
  { question: "What is a fishing quota?", marks: 1, markScheme: ["Limit on the amount of a species that can be caught; helps prevent overfishing."] },
  { question: "How can sustainable fisheries help food security?", marks: 1, markScheme: ["Maintain fish stocks so people can rely on fish as food in the long term."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
