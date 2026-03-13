const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Global warming";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Global warming";

const MCQS = [
  { question: "Global warming is the increase in:", options: ["Only ocean temperature", "Average temperature of the Earth's atmosphere", "Only land temperature", "Only winter temperature"], correctIndex: 1, marks: 1 },
  { question: "Greenhouse gases include:", options: ["Only oxygen", "CO₂; methane; water vapour", "Only nitrogen", "Only hydrogen"], correctIndex: 1, marks: 1 },
  { question: "The greenhouse effect is:", options: ["Only harmful", "Natural; gases trap heat; too much increases temperature", "Only in summer", "Only in cities"], correctIndex: 1, marks: 1 },
  { question: "Burning fossil fuels increases:", options: ["Only oxygen", "CO₂ in atmosphere", "Only nitrogen", "Only water vapour"], correctIndex: 1, marks: 1 },
  { question: "Methane is released by:", options: ["Only cars", "Cattle; rice paddies; decay in landfills", "Only industry", "Only oceans"], correctIndex: 1, marks: 1 },
  { question: "Consequences of global warming can include:", options: ["Only cooling", "Rising sea levels; melting ice; extreme weather; distribution change", "Only more rain everywhere", "Only in one country"], correctIndex: 1, marks: 1 },
  { question: "Reducing CO₂ emissions might involve:", options: ["Only more burning", "Renewable energy; less deforestation; efficiency", "Only more cars", "Only more industry"], correctIndex: 1, marks: 1 },
  { question: "Deforestation contributes to global warming because:", options: ["Trees release CO₂ when growing", "Fewer trees absorb CO₂; burning releases CO₂", "Only in water", "Only in soil"], correctIndex: 1, marks: 1 },
  { question: "Climate change can affect biodiversity by:", options: ["Only helping all species", "Changing habitats; some species cannot adapt; distribution shifts", "Only in ocean", "Only in one place"], correctIndex: 1, marks: 1 },
  { question: "Carbon footprint is:", options: ["Only weight", "Total CO₂ (and other greenhouse gases) produced by an activity/person", "Only in cars", "Only in industry"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is the greenhouse effect and how does it lead to global warming?", marks: 2, markScheme: ["Greenhouse gases trap heat in atmosphere. Increase in these gases (e.g. CO₂ from burning fossil fuels) traps more heat; Earth warms."] },
  { question: "Give two human activities that increase CO₂ in the atmosphere.", marks: 2, markScheme: ["Burning fossil fuels; deforestation (burning, decay); industry; transport."] },
  { question: "Give one consequence of global warming.", marks: 1, markScheme: ["Rising sea levels; melting ice; extreme weather; species distribution change; habitat loss."] },
  { question: "How can we reduce the rate of global warming?", marks: 1, markScheme: ["Reduce fossil fuel use; renewable energy; reduce deforestation; energy efficiency; reduce methane (e.g. farming)."] },
  { question: "What is meant by carbon footprint?", marks: 1, markScheme: ["Total amount of greenhouse gases (often as CO₂ equivalent) produced by a person/activity/organisation."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
