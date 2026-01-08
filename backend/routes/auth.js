// /backend/routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const ParentLinkRequest = require("../models/ParentLinkRequest");
const { check, validationResult } = require("express-validator");

function normEmail(v) {
  return (v || "").toString().trim().toLowerCase();
}

/**
 * IMPORTANT:
 * Use the SAME secret normalization rule everywhere (sign + verify).
 * Your middleware trims JWT_SECRET before verify.
 * If signing does NOT trim, tokens can become "invalid" (signature mismatch)
 * when Render env values contain trailing spaces/newlines.
 */
function getJwtSecret() {
  const raw = process.env.JWT_SECRET;
  const secret = typeof raw === "string" ? raw.trim() : "";
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Check Render env vars.");
  }
  return secret;
}

function shouldDebugJwt() {
  return process.env.DEBUG_JWT === "1" || process.env.DEBUG_JWT === "true";
}

function secretFingerprint(secret) {
  const hash = crypto.createHash("sha256").update(secret).digest("hex");
  return `len=${secret.length}, sha256=${hash.slice(0, 12)}…`;
}

function signParentLinkToken({ reqId, parentId, studentId }) {
  const raw = process.env.PARENT_LINK_TOKEN_SECRET;
  const secret = typeof raw === "string" ? raw.trim() : "";
  if (!secret) throw new Error("Missing PARENT_LINK_TOKEN_SECRET");

  return jwt.sign(
    { type: "parent_link_approval", reqId, parentId, studentId },
    secret,
    { expiresIn: "48h" }
  );
}

// Real email sender with Resend (falls back to logs if not configured)
async function sendParentLinkEmail({ to, parentName, approveUrl, rejectUrl }) {
  // ✅ Dev-safe fallback (keeps existing behaviour)
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.log("📧 Parent link email (DEV LOG ONLY):", {
      to,
      subject: `${parentName} wants to link as your parent`,
      approveUrl,
      rejectUrl,
    });
    return;
  }

  const { Resend } = require("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  const subject = `${parentName} wants to link as your parent`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>${subject}</h2>
      <p>${parentName} has requested to link to your account as a parent.</p>
      <p>Please choose one:</p>
      <p>
        <a href="${approveUrl}" style="padding:10px 14px;border:1px solid #111;border-radius:6px;text-decoration:none;">
          Approve
        </a>
        &nbsp;
        <a href="${rejectUrl}" style="padding:10px 14px;border:1px solid #111;border-radius:6px;text-decoration:none;">
          Reject
        </a>
      </p>
      <p>If you didn’t expect this, you can ignore this email.</p>
    </div>
  `;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    subject,
    html,
  });
}

// Debug route - test password matching
router.post("/debug-login", async (req, res) => {
  console.log("\n🔍 DEBUG LOGIN REQUEST:", req.body);

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    console.log("USER FOUND:", user ? "YES" : "NO");

    if (user) {
      console.log("User details:", {
        email: user.email,
        userType: user.userType,
        firstName: user.firstName,
        lastName: user.lastName,
        passwordHash: user.password ? user.password.substring(0, 30) + "..." : "NO PASSWORD",
        hashLength: user.password ? user.password.length + " chars" : "N/A",
      });

      if (!user.password) {
        return res.json({ success: false, message: "Debug: User has no password set" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      console.log("Password match:", isMatch);

      if (isMatch) {
        return res.json({
          success: true,
          message: "Debug: Password matches",
          user: {
            email: user.email,
            userType: user.userType,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        });
      } else {
        // Test with trimmed password
        const trimmedMatch = await bcrypt.compare(password.trim(), user.password);
        console.log("Password match (trimmed):", trimmedMatch);

        return res.json({
          success: false,
          message: "Debug: Password does NOT match",
          details: {
            passwordProvided: `"${password}" (${password.length} chars)`,
            passwordTrimmed: `"${password.trim()}" (${password.trim().length} chars)`,
            hashStartsWith: user.password.substring(0, 30),
          },
        });
      }
    } else {
      return res.json({
        success: false,
        message: "Debug: User not found",
        searchedEmail: email,
      });
    }
  } catch (error) {
    console.error("Debug error:", error);
    return res.status(500).json({
      success: false,
      message: "Debug error: " + error.message,
      stack: error.stack,
    });
  }
});

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post(
  "/register",
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Please enter a password with 6 or more characters").isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      email,
      password,
      userType,
      firstName,
      lastName,
      institution, // legacy field from older frontend
      schoolName, // new field from current frontend
      referralCode,
      linkedStudentEmail, // for parent accounts
    } = req.body;

    // Normalise userType
    const rawType = (userType || "student").toString().toLowerCase();
    const allowedTypes = ["student", "teacher", "parent", "admin"];

    let normalizedType = allowedTypes.includes(rawType) ? rawType : "student";

    // Do NOT allow public registration as admin
    if (normalizedType === "admin") {
      console.log(`⚠️  Public registration attempted as admin for ${email}. Forcing userType=student.`);
      normalizedType = "student";
    }

    // Work out school name (support both old "institution" and new "schoolName")
    const resolvedSchoolName = (schoolName && schoolName.trim()) || (institution && institution.trim()) || null;

    const normalizedEmail = normEmail(email);
    const normalizedLinkedStudentEmail =
      normalizedType === "parent" ? normEmail(linkedStudentEmail) : "";

    console.log(`\n📝 Registration attempt for: ${normalizedEmail} (${normalizedType})`);

    try {
      // Check if user exists (case-insensitive)
      let user = await User.findOne({ email: new RegExp(`^${normalizedEmail}$`, "i") });
      if (user) {
        console.log(`❌ User already exists: ${normalizedEmail}`);
        return res.status(400).json({ msg: "User already exists" });
      }

      // Validate required fields
      if (!firstName || !lastName) {
        console.log("❌ Missing first/last name");
        return res.status(400).json({ msg: "First name and last name are required" });
      }

      // For parent accounts, if they provided a student email, ensure it exists (and is a student)
      let linkedStudent = null;
      if (normalizedType === "parent" && normalizedLinkedStudentEmail) {
        linkedStudent = await User.findOne({
          email: new RegExp(`^${normalizedLinkedStudentEmail}$`, "i"),
          userType: "student",
        }).select("_id email userType");

        if (!linkedStudent) {
          return res.status(400).json({
            msg: "Linked student not found. Please register the student first (as a student account) using that email.",
          });
        }
      }

      // Determine starting ShamCoins based on user type
      let startingShamCoins = 500;
      if (normalizedType === "teacher") startingShamCoins = 100;
      if (normalizedType === "parent") startingShamCoins = 0;

      user = new User({
        email: normalizedEmail,
        password, // will be replaced with hashed version below
        userType: normalizedType,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        schoolName: resolvedSchoolName,
        shamCoins: startingShamCoins,
        verificationStatus: "pending",
      });

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      user.password = hashedPassword;

      console.log(`Password hashed: ${hashedPassword.substring(0, 30)}...`);

      // Handle referral code
      if (referralCode) {
        const referrer = await User.findOne({ referralCode });
        if (referrer) {
          referrer.shamCoins = (referrer.shamCoins || 0) + 50;
          await referrer.save();
          user.shamCoins += 100; // bonus for using referral
        }
      }

      await user.save();
      console.log(`✅ User registered: ${normalizedEmail} as ${normalizedType}`);

      /**
       * ✅ Parent-link approval flow (NEW)
       */
      let linkInfo = null;
      if (normalizedType === "parent" && linkedStudent?._id) {
        const parentId = user._id;
        const studentId = linkedStudent._id;

        // Prevent duplicates (pending/approved)
        const existing = await ParentLinkRequest.findOne({
          parentId,
          studentId,
          status: { $in: ["pending", "approved"] },
        }).lean();

        let reqDoc;
        if (existing) {
          reqDoc = existing;
        } else {
          reqDoc = await ParentLinkRequest.create({
            parentId,
            studentId,
            status: "pending",
            requestedAt: new Date(),
            studentEmailSnapshot: linkedStudent.email,
            parentEmailSnapshot: normalizedEmail,
          });
        }

        const token = signParentLinkToken({
          reqId: reqDoc._id.toString(),
          parentId: parentId.toString(),
          studentId: studentId.toString(),
        });

        const baseUrl = (process.env.APP_BASE_URL || "http://localhost:3000").trim();
        const approveUrl = `${baseUrl}/parent-link/approve?token=${encodeURIComponent(token)}`;
        const rejectUrl = `${baseUrl}/parent-link/reject?token=${encodeURIComponent(token)}`;

        await sendParentLinkEmail({
          to: linkedStudent.email,
          parentName: `${user.firstName} ${user.lastName}`.trim(),
          approveUrl,
          rejectUrl,
        });

        linkInfo = {
          linkedStudentEmail: normalizedLinkedStudentEmail,
          linkedStudentId: studentId.toString(),
          parentId: parentId.toString(),
          requestId: reqDoc._id.toString(),
          status: reqDoc.status,
        };

        console.log("🔗 Parent link request created/exists (no children[] write yet):", linkInfo);
      }

      // Create JWT (NO FALLBACK; same trim rule as middleware)
      const payload = {
        user: {
          id: user._id.toString(),
          userType: user.userType,
        },
      };

      const jwtSecret = getJwtSecret();
      if (shouldDebugJwt()) {
        console.log(`🔑 JWT_SECRET fingerprint (SIGN/register): ${secretFingerprint(jwtSecret)}`);
      }

      jwt.sign(payload, jwtSecret, { expiresIn: "7d" }, (err, token) => {
        if (err) {
          console.error("JWT error:", err);
          return res.status(500).send("Server error");
        }
        console.log(`✅ Registration complete, token generated for ${normalizedEmail}`);

        return res.status(201).json({
          msg: "User registered successfully. Please check your email to verify your account.",
          token,
          user: {
            id: user._id.toString(),
            email: user.email,
            userType: user.userType,
            firstName: user.firstName,
            lastName: user.lastName,
            shamCoins: user.shamCoins || 0,
            referralCode: user.referralCode,
            schoolName: user.schoolName || null,
            verificationStatus: user.verificationStatus || "pending",
          },
          // extra, non-breaking field (frontend can ignore)
          link: linkInfo,
        });
      });
    } catch (err) {
      console.error("❌ Registration error:", err.message);
      console.error("Error stack:", err.stack);

      if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map((val) => val.message);
        console.log("Validation messages:", messages);
        return res.status(400).json({ msg: messages.join(", ") });
      }

      res.status(500).send("Server error");
    }
  }
);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  "/login",
  [check("email", "Please include a valid email").isEmail(), check("password", "Password is required").exists()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Login validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const normalizedEmail = normEmail(email);
    console.log(`\n🔐 Login attempt for: ${normalizedEmail}`);

    try {
      // Check if user exists - with case-insensitive search
      let user = await User.findOne({ email: new RegExp(`^${normalizedEmail}$`, "i") });

      if (!user) {
        console.log(`❌ User not found: ${normalizedEmail}`);
        return res.status(400).json({ msg: "Invalid credentials" });
      }

      console.log(`✅ User found: ${user.email} (${user.userType})`);
      console.log(`Password hash: ${user.password.substring(0, 30)}...`);

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      console.log(`Password match for ${normalizedEmail}: ${isMatch}`);

      if (!isMatch) {
        // Try with trimmed password
        const trimmedMatch = await bcrypt.compare(password.trim(), user.password);
        console.log(`Password match (trimmed): ${trimmedMatch}`);

        if (!trimmedMatch) {
          console.log(`❌ Password does not match for ${normalizedEmail}`);
          return res.status(400).json({ msg: "Invalid credentials" });
        }
      }

      // Create JWT (NO FALLBACK; same trim rule as middleware)
      const payload = {
        user: {
          id: user._id.toString(),
          userType: user.userType,
        },
      };

      const jwtSecret = getJwtSecret();
      if (shouldDebugJwt()) {
        console.log(`🔑 JWT_SECRET fingerprint (SIGN/login): ${secretFingerprint(jwtSecret)}`);
      }

      jwt.sign(payload, jwtSecret, { expiresIn: "7d" }, (err, token) => {
        if (err) {
          console.error("JWT error:", err);
          return res.status(500).send("Server error");
        }

        console.log(`✅ Login successful for ${normalizedEmail}, userType: ${user.userType}`);

        res.json({
          token,
          user: {
            id: user._id.toString(),
            email: user.email,
            userType: user.userType,
            firstName: user.firstName,
            lastName: user.lastName,
            shamCoins: user.shamCoins || 0,
            referralCode: user.referralCode,
            schoolName: user.schoolName || null,
            verificationStatus: user.verificationStatus || "pending",
          },
        });
      });
    } catch (err) {
      console.error("❌ Login error:", err.message);
      console.error("Error stack:", err.stack);
      res.status(500).send("Server error");
    }
  }
);

// @route   GET api/auth/user
// @desc    Get user data
// @access  Private
router.get("/user", async (req, res) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "").trim();

    if (!token) {
      return res.status(401).json({ msg: "No token" });
    }

    // Verify with the same normalized secret (NO FALLBACK)
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    const userId = decoded.user?.id || decoded.userId || decoded.id;

    if (!userId) {
      return res.status(401).json({ msg: "Token valid but user id missing in payload" });
    }

    const user = await User.findById(userId).select("-password");

    res.json(user);
  } catch (err) {
    console.error(err.message);
    return res.status(401).json({ msg: "Token is not valid" });
  }
});

module.exports = router;
