/**
 * PR-004: Smoke test for /api/enquiry.
 * Runs sample questions in mock mode. Requires MONGO_URI and optionally VECTOR_DB_URL.
 *
 * Usage: node backend/scripts/runEnquirySmokeTest.js
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
process.env.DISABLE_OPENAI = "1";

const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");

const hashedPassword = bcrypt.hashSync("password123", 10);

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const teacher = await User.findOneAndUpdate(
    { email: "enquiry-smoke-teacher@test.com" },
    {
      firstName: "Enquiry",
      lastName: "Smoke",
      email: "enquiry-smoke-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    },
    { upsert: true, new: true }
  );

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "enquiry-smoke-teacher@test.com", password: "password123" });

  const token = loginRes.body?.token;
  if (!token) {
    console.error("Login failed:", loginRes.body);
    process.exit(1);
  }

  const questions = [
    { question: "What is the function of the nucleus?", specKey: "aqa-gcse-biology", topicKey: "aqa-gcse-biology:cell-structure" },
    { question: "Explain photosynthesis", specKey: "aqa-gcse-biology" },
  ];

  for (const q of questions) {
    console.log("\n--- Enquiry:", q.question);
    const res = await request(app)
      .post("/api/enquiry")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send(q);

    if (res.status !== 200) {
      console.error("Error:", res.status, res.body);
      continue;
    }

    const body = res.body;
    console.log("usedSources:", body.usedSources?.length ?? 0);
    console.log("answer.explanation:", (body.answer?.explanation || "").slice(0, 200) + "...");
    console.log("answer.keyPoints:", body.answer?.keyPoints);
    console.log("answer.citations:", body.answer?.citations?.length ?? 0);
    console.log("answer.practice:", body.answer?.practice?.length ?? 0);
    console.log("answer.warnings:", body.answer?.warnings);
    console.log(JSON.stringify(body, null, 2));
  }

  await mongoose.disconnect();
  console.log("\nSmoke test complete.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
