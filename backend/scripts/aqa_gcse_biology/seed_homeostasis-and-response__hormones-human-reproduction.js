const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "Hormones in human reproduction";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "Hormones in human reproduction";

const MCQS = [
  { question: "Oestrogen is produced by:", options: ["Pituitary", "Ovaries", "Testes", "Thyroid"], correctIndex: 1, marks: 1 },
  { question: "Testosterone is produced by:", options: ["Ovaries", "Testes", "Pituitary", "Pancreas"], correctIndex: 1, marks: 1 },
  { question: "FSH is produced by the pituitary and:", options: ["Only affects testes", "Stimulates egg development; stimulates ovaries", "Only affects sperm", "Only in men"], correctIndex: 1, marks: 1 },
  { question: "LH triggers:", options: ["Only sperm production", "Ovulation (release of egg)", "Only menstruation", "Only fertilisation"], correctIndex: 1, marks: 1 },
  { question: "The menstrual cycle is controlled by:", options: ["Only oestrogen", "Oestrogen; progesterone; FSH; LH", "Only testosterone", "Only LH"], correctIndex: 1, marks: 1 },
  { question: "Progesterone is produced by:", options: ["Pituitary", "Ovaries; corpus luteum; maintains lining", "Only testes", "Only uterus"], correctIndex: 1, marks: 1 },
  { question: "Oestrogen causes the lining of the uterus to:", options: ["Shed", "Thicken (build up)", "Only contract", "Only absorb"], correctIndex: 1, marks: 1 },
  { question: "If no fertilisation, progesterone level falls and:", options: ["Egg is released", "Lining breaks down; menstruation", "More FSH is released", "Pregnancy starts"], correctIndex: 1, marks: 1 },
  { question: "Testosterone is involved in:", options: ["Only female reproduction", "Sperm production; male secondary sexual characteristics", "Only ovulation", "Only menstruation"], correctIndex: 1, marks: 1 },
  { question: "Hormones in reproduction are released by:", options: ["Only the brain", "Pituitary; ovaries; testes", "Only the uterus", "Only the blood"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is the role of FSH in the menstrual cycle?", marks: 2, markScheme: ["Produced by pituitary; causes egg to mature in ovary; stimulates ovaries to produce oestrogen."] },
  { question: "What happens when LH levels rise?", marks: 1, markScheme: ["Triggers ovulation; egg released from ovary."] },
  { question: "What is the role of progesterone?", marks: 1, markScheme: ["Maintains lining of uterus; produced by corpus luteum; falls if no pregnancy."] },
  { question: "Name two hormones involved in the menstrual cycle.", marks: 2, markScheme: ["FSH; LH; oestrogen; progesterone. Any two."] },
  { question: "Where is testosterone produced and what does it do?", marks: 1, markScheme: ["Testes; sperm production; male secondary sexual characteristics."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
