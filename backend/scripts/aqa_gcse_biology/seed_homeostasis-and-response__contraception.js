const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "Contraception";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "Contraception";

const MCQS = [
  { question: "Hormonal contraception (e.g. pill) may contain:", options: ["Only FSH", "Oestrogen and/or progesterone to prevent ovulation", "Only LH", "Only testosterone"], correctIndex: 1, marks: 1 },
  { question: "The contraceptive pill works by:", options: ["Killing sperm", "Preventing ovulation; thickening cervical mucus", "Only blocking the uterus", "Only blocking the ovary"], correctIndex: 1, marks: 1 },
  { question: "A barrier method of contraception is:", options: ["The pill", "Condom; diaphragm", "Only injection", "Only implant"], correctIndex: 1, marks: 1 },
  { question: "Condoms can also help prevent:", options: ["Only pregnancy", "Spread of STIs as well as pregnancy", "Only HIV", "Only bacterial infection"], correctIndex: 1, marks: 1 },
  { question: "Non-hormonal methods include:", options: ["Only the pill", "Condom; diaphragm; copper IUD; natural methods", "Only implant", "Only patch"], correctIndex: 1, marks: 1 },
  { question: "Surgical contraception (e.g. vasectomy) is:", options: ["Reversible easily", "Usually permanent", "Only in women", "Only hormonal"], correctIndex: 1, marks: 1 },
  { question: "Progesterone-only contraception:", options: ["Only prevents STIs", "Thickens cervical mucus; may prevent ovulation", "Only for men", "Only barrier"], correctIndex: 1, marks: 1 },
  { question: "Natural family planning involves:", options: ["Taking hormones", "Avoiding sex when fertile; tracking cycle", "Using condoms", "Using the pill"], correctIndex: 1, marks: 1 },
  { question: "Which method is both contraceptive and helps prevent STIs?", options: ["Pill", "Condom", "Implant", "Copper IUD"], correctIndex: 1, marks: 1 },
  { question: "Hormonal methods may have side effects because:", options: ["They are natural", "They alter hormone levels in the body", "They are barriers", "They are permanent"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "How does the combined contraceptive pill work?", marks: 2, markScheme: ["Contains oestrogen and progesterone; prevents ovulation; may thicken cervical mucus."] },
  { question: "Give one advantage of using condoms.", marks: 1, markScheme: ["Helps prevent STIs as well as pregnancy; no hormones; available without prescription."] },
  { question: "What is a barrier method of contraception?", marks: 1, markScheme: ["Physically prevents sperm reaching egg; e.g. condom, diaphragm."] },
  { question: "Name one hormonal and one non-hormonal method.", marks: 2, markScheme: ["Hormonal: pill, patch, implant, injection. Non-hormonal: condom, diaphragm, copper IUD, natural methods."] },
  { question: "Why might someone choose a non-hormonal method?", marks: 1, markScheme: ["Avoid hormone side effects; personal/religious reasons; no prescription needed (e.g. condom)."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
