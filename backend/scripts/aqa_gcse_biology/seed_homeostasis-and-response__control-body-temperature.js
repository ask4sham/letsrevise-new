const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "Control of body temperature";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "Control of body temperature";

const MCQS = [
  { question: "Body temperature is monitored by:", options: ["Only the skin", "Thermoregulatory centre in the brain", "Only the heart", "Only the liver"], correctIndex: 1, marks: 1 },
  { question: "If the body is too hot, blood vessels in the skin:", options: ["Constrict", "Vasodilate (widen); more blood to surface", "Stop flowing", "Only in feet"], correctIndex: 1, marks: 1 },
  { question: "Sweating helps cool the body because:", options: ["Water is cold", "Evaporation of sweat uses heat from body", "Sweat warms the skin", "Sweat contains salt"], correctIndex: 1, marks: 1 },
  { question: "If the body is too cold, blood vessels in the skin:", options: ["Vasodilate", "Vasoconstrict; less blood to surface", "Sweat more", "Only shiver"], correctIndex: 1, marks: 1 },
  { question: "Shivering:", options: ["Cools the body", "Muscle contraction generates heat", "Reduces temperature", "Only in summer"], correctIndex: 1, marks: 1 },
  { question: "The thermoregulatory centre has receptors that detect:", options: ["Only external temperature", "Blood temperature (and may receive skin signals)", "Only sweat", "Only shivering"], correctIndex: 1, marks: 1 },
  { question: "Vasoconstriction when cold:", options: ["Increases heat loss", "Reduces heat loss from skin surface", "Increases sweating", "Cools the blood"], correctIndex: 1, marks: 1 },
  { question: "When hot, hairs lie flat to:", options: ["Trap more air", "Reduce insulation; allow heat loss", "Warm the body", "Produce sweat"], correctIndex: 1, marks: 1 },
  { question: "Normal core body temperature is around:", options: ["25 °C", "37 °C", "40 °C", "30 °C"], correctIndex: 1, marks: 1 },
  { question: "Temperature control is an example of:", options: ["Positive feedback", "Negative feedback", "No feedback", "Only hormonal control"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "How does the body reduce heat loss when cold?", marks: 2, markScheme: ["Vasoconstriction; less blood to skin surface; shivering; hairs stand up (erector muscles)."] },
  { question: "How does sweating help cool the body?", marks: 1, markScheme: ["Sweat evaporates; uses heat energy from body; cools skin."] },
  { question: "Where is body temperature monitored?", marks: 1, markScheme: ["Thermoregulatory centre in brain; detects blood temperature; may receive impulses from skin."] },
  { question: "What is vasodilation and when does it happen?", marks: 2, markScheme: ["Blood vessels widen; when body too hot; more blood to skin; more heat lost."] },
  { question: "Why might someone shiver when cold?", marks: 1, markScheme: ["Muscle contraction releases heat; warms the body."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
