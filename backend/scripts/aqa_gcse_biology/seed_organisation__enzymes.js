const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Organisation";
const TOPIC_NAME = "Enzymes";
const UNIT_KEY = "organisation";
const TOPIC_LABEL = "Enzymes";

const MCQS = [
  { question: "What are enzymes?", options: ["Carbohydrates", "Biological catalysts (proteins)", "Lipids", "Minerals"], correctIndex: 1, marks: 1 },
  { question: "Enzymes speed up reactions by:", options: ["Increasing temperature", "Lowering activation energy", "Using up energy", "Stopping other reactions"], correctIndex: 1, marks: 1 },
  { question: "What is the lock and key model?", options: ["Enzyme shape fits substrate", "Substrate fits any enzyme", "Enzymes never change", "Key is the product"], correctIndex: 0, marks: 1 },
  { question: "At what pH do most enzymes work best?", options: ["Always pH 1", "Their optimum pH (varies)", "Always pH 14", "Neutral only"], correctIndex: 1, marks: 1 },
  { question: "What happens to an enzyme at very high temperature?", options: ["It works faster", "It denatures (shape changes)", "It multiplies", "Nothing"], correctIndex: 1, marks: 1 },
  { question: "What is the active site?", options: ["Where the product forms", "Region where substrate binds", "The whole enzyme", "A type of enzyme"], correctIndex: 1, marks: 1 },
  { question: "Denaturation means:", options: ["Enzyme works better", "Permanent change in shape; active site no longer fits", "Enzyme is cooled", "Substrate is changed"], correctIndex: 1, marks: 1 },
  { question: "Which factor does NOT affect enzyme activity?", options: ["Temperature", "pH", "Substrate concentration", "Colour of solution"], correctIndex: 3, marks: 1 },
  { question: "Amylase catalyses the breakdown of:", options: ["Protein", "Starch", "Lipid", "Cellulose"], correctIndex: 1, marks: 1 },
  { question: "Why do enzymes have an optimum temperature?", options: ["They don't", "Balance: rate increases with heat but high heat denatures", "They only work in cold", "They need light"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is an enzyme?", marks: 1, markScheme: ["Biological catalyst; protein; speeds up reactions."] },
  { question: "Explain why high temperature can stop an enzyme working.", marks: 2, markScheme: ["Enzyme denatures; shape of active site changes; substrate no longer fits."] },
  { question: "What is meant by optimum pH?", marks: 1, markScheme: ["pH at which the enzyme works best / fastest."] },
  { question: "Describe the lock and key model.", marks: 2, markScheme: ["Substrate fits active site; specific shape; like key in lock."] },
  { question: "Name one factor that affects the rate of an enzyme-controlled reaction.", marks: 1, markScheme: ["Temperature; pH; substrate concentration."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
