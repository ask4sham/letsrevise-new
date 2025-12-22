/**
 * Seed test data for LetsRevise
 * - Ensures a Teacher + Student exist in Mongo
 * - Gives Student ShamCoins
 * - Creates 2 Published Lessons in Supabase (matching your actual Supabase column names)
 *
 * Run: node scripts/seed-test-data.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { createClient } = require("@supabase/supabase-js");

const User = require("../models/User");

// ---------- CONFIG ----------
const TEACHER_EMAIL = "teacher@example.com";
const STUDENT_EMAIL = "student@example.com";
const STUDENT_SHAMCOINS = 500;

// ---------- Supabase ----------
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------- Mongo ----------
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error("❌ Missing MONGODB_URI in backend/.env");
  process.exit(1);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function ensureUser({ email, userType, firstName, lastName }) {
  let user = await User.findOne({ email });

  if (!user) {
    user = new User({
      email,
      userType,
      firstName,
      lastName,
      password: "test12345",
      shamCoins: 0,
      purchasedLessons: [],
    });

    await user.save();
    console.log(`✅ Created ${userType} user: ${email}`);
  } else {
    if (user.userType !== userType) {
      user.userType = userType;
      await user.save();
      console.log(`🔄 Updated userType for ${email} → ${userType}`);
    } else {
      console.log(`✅ Found ${userType} user: ${email}`);
    }
  }

  return user;
}

async function giveStudentCoins(student, amount) {
  if (typeof student.shamCoins === "number") {
    student.shamCoins = amount;
  } else if (typeof student.shamCoinBalance === "number") {
    student.shamCoinBalance = amount;
  } else {
    student.shamCoins = amount;
  }
  await student.save();
  console.log(`💰 Set ${student.email} coins → ${amount}`);
}

async function getLessonColumns() {
  const { data, error } = await supabase.from("lessons").select("*").limit(1);

  if (error) {
    throw new Error(`Supabase select lessons failed: ${error.message}`);
  }

  // If table is empty, we can still seed – just fetch column names using a safe select list
  if (!data || data.length === 0) {
    // fallback minimal column guess (we'll still insert only fields that exist after this call)
    // But to avoid guessing wrong, we just error with clear instructions.
    throw new Error(
      `No rows found in Supabase lessons table. Create 1 lesson first from the Teacher UI, then re-run seed.`
    );
  }

  const cols = Object.keys(data[0] || {});
  console.log(`✅ Supabase lessons columns detected (${cols.length})`);
  return new Set(cols);
}

function pickKey(cols, candidates) {
  for (const k of candidates) {
    if (cols.has(k)) return k;
  }
  return null;
}

function buildLessonRow(cols, teacherMongoId, lesson) {
  const row = {};

  const mapping = [
    ["title", ["title"]],
    ["description", ["description", "shortDescription", "short_description"]],
    ["content", ["content", "lessonContent", "lesson_content"]],
    ["subject", ["subject"]],
    ["level", ["level"]],
    ["topic", ["topic", "topicUnit", "topic_unit"]],
    ["estimatedDuration", ["estimatedDuration", "estimated_duration", "duration", "estimated_minutes"]],
    ["shamCoinPrice", ["shamCoinPrice", "sham_coin_price", "price", "coin_price"]],
    ["isPublished", ["isPublished", "is_published", "published"]],
    ["views", ["views"]],
    ["averageRating", ["averageRating", "average_rating", "avg_rating"]],
    ["totalRatings", ["totalRatings", "total_ratings", "ratings_count"]],
    ["teacherName", ["teacherName", "teacher_name"]],
  ];

  for (const [canonical, candidates] of mapping) {
    const col = pickKey(cols, candidates);
    if (!col) continue;
    row[col] = lesson[canonical];
  }

  // IMPORTANT FIX:
  // If your lessons table has a UUID teacherId column, DO NOT write Mongo ObjectId into it.
  // Only set teacherId if we actually have a UUID.
  const teacherIdCol = pickKey(cols, ["teacherId", "teacher_id", "teacherUUID", "teacher_uuid"]);
  const teacherIdValue = String(teacherMongoId);
  if (teacherIdCol && UUID_RE.test(teacherIdValue)) {
    row[teacherIdCol] = teacherIdValue;
  }

  // Optional created_at
  const createdAtCol = pickKey(cols, ["createdAt", "created_at"]);
  if (createdAtCol && !row[createdAtCol]) row[createdAtCol] = new Date().toISOString();

  return row;
}

async function createSupabaseLessons(teacherMongoId) {
  const cols = await getLessonColumns();

  const seedLessons = [
    {
      title: "Algebra Foundations (Linear Equations)",
      description: "Solve linear equations step-by-step with examples and practice.",
      content:
        "# Algebra Foundations\n\n## What you will learn\n- What variables mean\n- How to solve linear equations\n\n## Example\nSolve: **2x + 3 = 11**\n\n**Step 1:** subtract 3 → 2x = 8\n\n**Step 2:** divide by 2 → x = 4\n\n## Practice\n1) x + 5 = 12\n2) 3x = 21\n",
      subject: "Mathematics",
      level: "GCSE",
      topic: "Algebra",
      estimatedDuration: 30,
      shamCoinPrice: 50,
      isPublished: true,
      views: 0,
      averageRating: 0,
      totalRatings: 0,
      teacherName: "Test Teacher",
    },
    {
      title: "Photosynthesis Basics (GCSE Biology)",
      description: "Learn the photosynthesis equation and how plants make glucose.",
      content:
        "# Photosynthesis\n\n## Key idea\nPlants use light energy to convert **carbon dioxide + water** into **glucose + oxygen**.\n\n## Word equation\n**carbon dioxide + water → glucose + oxygen**\n\n## Balanced symbol equation\n**6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂**\n",
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      estimatedDuration: 25,
      shamCoinPrice: 60,
      isPublished: true,
      views: 0,
      averageRating: 0,
      totalRatings: 0,
      teacherName: "Test Teacher",
    },
  ];

  // Avoid duplicates by title
  const titles = seedLessons.map((l) => l.title);
  const { data: existing, error: existingErr } = await supabase
    .from("lessons")
    .select("id,title")
    .in("title", titles);

  if (existingErr) {
    throw new Error(`Supabase check existing lessons failed: ${existingErr.message}`);
  }

  const existingTitles = new Set((existing || []).map((x) => x.title));
  const toInsert = seedLessons
    .filter((l) => !existingTitles.has(l.title))
    .map((l) => buildLessonRow(cols, teacherMongoId, l));

  if (toInsert.length === 0) {
    console.log("✅ Supabase lessons already exist (skipping insert).");
    return;
  }

  const { data, error } = await supabase.from("lessons").insert(toInsert).select("id,title");

  if (error) {
    throw new Error(`Supabase insert lessons failed: ${error.message}`);
  }

  console.log("✅ Created Supabase lessons:");
  (data || []).forEach((l) => console.log(` - ${l.title} (id: ${l.id})`));
}

async function main() {
  console.log("🚀 Seeding test data...");

  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected MongoDB");

  const teacher = await ensureUser({
    email: TEACHER_EMAIL,
    userType: "teacher",
    firstName: "Test",
    lastName: "Teacher",
  });

  const student = await ensureUser({
    email: STUDENT_EMAIL,
    userType: "student",
    firstName: "Test",
    lastName: "Student",
  });

  await giveStudentCoins(student, STUDENT_SHAMCOINS);

  await createSupabaseLessons(teacher._id);

  console.log("🎉 Seed complete.");
  console.log("Next:");
  console.log(`- Login as student: ${STUDENT_EMAIL}`);
  console.log(`- Student coins set to: ${STUDENT_SHAMCOINS}`);
  console.log("- Browse published lessons and purchase them.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
