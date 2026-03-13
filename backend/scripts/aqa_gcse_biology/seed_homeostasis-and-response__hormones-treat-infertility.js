const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "Uses of hormones to treat infertility";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "Uses of hormones to treat infertility";

const MCQS = [
  { question: "FSH can be used to treat infertility by:", options: ["Stopping ovulation", "Stimulating egg maturation in the ovaries", "Only in men", "Only preventing pregnancy"], correctIndex: 1, marks: 1 },
  { question: "IVF stands for:", options: ["In vitro fertilisation", "In vivo fertilisation", "Internal vascular fertilisation", "Injection for fertility"], correctIndex: 0, marks: 1 },
  { question: "In IVF, eggs are fertilised:", options: ["Only inside the body", "Outside the body (in a dish) then implanted", "Only in the ovary", "Only in the uterus"], correctIndex: 1, marks: 1 },
  { question: "LH may be given in fertility treatment to:", options: ["Stop ovulation", "Trigger ovulation", "Only thicken lining", "Only in men"], correctIndex: 1, marks: 1 },
  { question: "Fertility drugs may contain:", options: ["Only progesterone", "FSH and/or LH to stimulate egg production", "Only oestrogen", "Only testosterone"], correctIndex: 1, marks: 1 },
  { question: "Why might someone need IVF?", options: ["Only for contraception", "Blocked oviducts; low sperm count; other fertility issues", "Only for STIs", "Only for diabetes"], correctIndex: 1, marks: 1 },
  { question: "Hormone treatment for infertility can cause:", options: ["No side effects", "Multiple pregnancies (multiple eggs released)", "Only single pregnancy", "Only in men"], correctIndex: 1, marks: 1 },
  { question: "In IVF, several embryos may be produced so that:", options: ["All are always implanted", "One or more can be implanted; others stored or discarded", "None are used", "Only one is ever used"], correctIndex: 1, marks: 1 },
  { question: "Fertility treatment raises ethical issues about:", options: ["Only cost", "Multiple embryos; disposal; who can access treatment", "Only success rate", "Only hormones"], correctIndex: 1, marks: 1 },
  { question: "Oestrogen and progesterone may be given in IVF to:", options: ["Stop pregnancy", "Prepare/maintain the lining of the uterus", "Only trigger ovulation", "Only in men"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "How can FSH be used to treat infertility?", marks: 2, markScheme: ["Given as fertility drug; stimulates egg maturation in ovary; may trigger release of more than one egg."] },
  { question: "What is IVF?", marks: 1, markScheme: ["Eggs fertilised outside body (in lab); embryos then implanted into uterus."] },
  { question: "Give one reason why IVF might be used.", marks: 1, markScheme: ["Blocked oviducts; low sperm count; ovulation problems; other fertility issues."] },
  { question: "What is a possible downside of fertility drugs that stimulate egg production?", marks: 1, markScheme: ["Multiple eggs released; risk of multiple pregnancy."] },
  { question: "Give one ethical issue associated with IVF.", marks: 1, markScheme: ["Disposal of unused embryos; multiple pregnancies; access to treatment; cost."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
