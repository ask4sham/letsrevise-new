const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "Uses of plant hormones";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "Uses of plant hormones";

const MCQS = [
  { question: "Auxins can be used as:", options: ["Fertilisers", "Weed killers; rooting powder", "Only fungicides", "Only insecticides"], correctIndex: 1, marks: 1 },
  { question: "Selective weed killers work because:", options: ["They kill all plants", "They affect broad-leaved plants more than grasses (e.g. auxins)", "They only affect roots", "They only affect flowers"], correctIndex: 1, marks: 1 },
  { question: "Rooting powder contains:", options: ["Only fertiliser", "Auxin to stimulate root growth in cuttings", "Only water", "Only fungicide"], correctIndex: 1, marks: 1 },
  { question: "Gibberellins can be used to:", options: ["Kill weeds", "Promote flowering; grow larger fruit; delay ripening", "Only for roots", "Only for leaves"], correctIndex: 1, marks: 1 },
  { question: "Ethene can be used to:", options: ["Slow ripening", "Ripen fruit (e.g. in storage/transport)", "Only kill weeds", "Only promote growth"], correctIndex: 1, marks: 1 },
  { question: "Fruit can be stored unripe and ripened later using:", options: ["Only auxin", "Ethene when needed", "Only gibberellin", "Only water"], correctIndex: 1, marks: 1 },
  { question: "Why might farmers use auxin-based weed killer?", options: ["To kill all plants", "To kill broad-leaved weeds in cereal crops", "To grow more roots", "To ripen fruit"], correctIndex: 1, marks: 1 },
  { question: "Plant hormones in agriculture can:", options: ["Only harm crops", "Increase yield; control growth; ripen fruit", "Only kill insects", "Only replace fertiliser"], correctIndex: 1, marks: 1 },
  { question: "Dormancy in seeds can be broken using:", options: ["Only water", "Gibberellins", "Only ethene", "Only auxin"], correctIndex: 1, marks: 1 },
  { question: "Taking cuttings and using rooting powder is an example of:", options: ["Only sexual reproduction", "Using auxin to grow new plants (clone)", "Only seed growth", "Only fertilisation"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Give two uses of auxins in agriculture or gardening.", marks: 2, markScheme: ["Weed killer (selective); rooting powder for cuttings."] },
  { question: "How do selective weed killers work?", marks: 2, markScheme: ["Contain auxin-like substance; broad-leaved plants absorb more and grow abnormally and die; grasses less affected."] },
  { question: "How can ethene be used in the food industry?", marks: 1, markScheme: ["Ripen fruit during transport/storage; fruit picked unripe, ethene added to ripen."] },
  { question: "What is rooting powder and why is it used?", marks: 1, markScheme: ["Contains auxin; applied to cuttings to stimulate root growth."] },
  { question: "Give one use of gibberellins.", marks: 1, markScheme: ["Promote germination; stem elongation; larger fruit; delay senescence."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
