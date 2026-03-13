const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Factors affecting food security";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Factors affecting food security";

const MCQS = [
  { question: "Food security means:", options: ["Only having enough for one day", "All people having access to enough safe, nutritious food", "Only in one country", "Only in cities"], correctIndex: 1, marks: 1 },
  { question: "Factors that can threaten food security include:", options: ["Only weather", "Growing population; conflict; climate change; pests; cost; distribution", "Only farming", "Only water"], correctIndex: 1, marks: 1 },
  { question: "A growing population:", options: ["Only helps", "Increases demand for food; can threaten security", "Only in one country", "Only in rural areas"], correctIndex: 1, marks: 1 },
  { question: "Climate change can affect food security by:", options: ["Only increasing yield", "Drought; floods; changing growing conditions; crop failure", "Only in ocean", "Only in one place"], correctIndex: 1, marks: 1 },
  { question: "Pests and diseases can:", options: ["Only help crops", "Destroy crops; reduce yield", "Only in animals", "Only in water"], correctIndex: 1, marks: 1 },
  { question: "Sustainable farming aims to:", options: ["Only produce more now", "Produce food without depleting resources for future", "Only use more fertiliser", "Only in one country"], correctIndex: 1, marks: 1 },
  { question: "Cost of food affects security because:", options: ["Only in rich countries", "Poor people may not afford enough nutritious food", "Only in cities", "Only in rural areas"], correctIndex: 1, marks: 1 },
  { question: "Distribution of food is a problem when:", options: ["Only surplus everywhere", "Food not available where needed; waste in one place, shortage elsewhere", "Only in one country", "Only in war"], correctIndex: 1, marks: 1 },
  { question: "Increasing food production might involve:", options: ["Only more land", "Better yields; sustainable intensification; reducing waste", "Only more pesticides", "Only in one place"], correctIndex: 1, marks: 1 },
  { question: "Famine can result from:", options: ["Only surplus", "Crop failure; conflict; distribution failure; poverty", "Only in one country", "Only in cities"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is food security?", marks: 1, markScheme: ["All people having access to sufficient, safe, nutritious food to meet their needs."] },
  { question: "Give three factors that can threaten food security.", marks: 2, markScheme: ["Growing population; climate change; conflict; pests/disease; cost; unequal distribution; water availability; loss of farmland."] },
  { question: "How might climate change affect food security?", marks: 2, markScheme: ["Drought or flood; changing temperatures; crop failure; pests spread; less predictable growing seasons."] },
  { question: "Why is the growing human population a challenge for food security?", marks: 1, markScheme: ["More mouths to feed; same or limited land; need to produce more without destroying environment."] },
  { question: "Give one way to improve food security.", marks: 1, markScheme: ["Increase sustainable production; reduce waste; improve distribution; support sustainable farming; pest control."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
