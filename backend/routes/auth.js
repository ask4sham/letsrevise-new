// /backend/routes/auth.js
const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const ParentLinkRequest = require("../models/ParentLinkRequest");
const { check, validationResult } = require("express-validator");
const { validatePasswordStrength } = require("../utils/passwordStrength");

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { msg: "Too many reset requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { msg: "Too many reset attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ✅ SINGLE SOURCE OF TRUTH for JWT secret (trimmed / normalized)
const { getJwtSecret } = require("../utils/jwtSecret");

console.log("✅ LOADED: backend/routes/auth.js (JWT signer)");

function normEmail(v) {
  return (v || "").toString().trim().toLowerCase();
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
      <p>If you didn't expect this, you can ignore this email.</p>
    </div>
  `;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    subject,
    html,
  });
}

/** Password reset: send reset link. Uses Resend; logs only if not configured. */
async function sendPasswordResetEmail({ to, firstName, resetUrl, expiresInHours }) {
  const displayName = (firstName || "there").trim() || "there";
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.log("📧 Password reset email (DEV LOG ONLY):", { to, resetUrl });
    return;
  }
  const { Resend } = require("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const subject = "Reset your LetsRevise password";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Reset your password</h2>
      <p>Hi ${displayName},</p>
      <p>You requested a password reset for your LetsRevise account. Click the link below to set a new password:</p>
      <p>
        <a href="${resetUrl}" style="padding:10px 14px;background:#2563eb;color:white;border-radius:6px;text-decoration:none;">
          Reset my password
        </a>
      </p>
      <p>This link expires in ${expiresInHours} hour${expiresInHours !== 1 ? "s" : ""}. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    subject,
    html,
  });
}

/** Email change verification: send confirmation link to new address. Uses Resend; logs only if not configured. */
async function sendEmailChangeVerification({ to, confirmUrl, expiresInHours }) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.log("📧 Email change verification (DEV LOG ONLY):", { to, confirmUrl });
    return;
  }
  const { Resend } = require("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const subject = "Confirm your new email address";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Confirm your new email</h2>
      <p>You requested to change your LetsRevise account email. Click the link below to complete the change:</p>
      <p>
        <a href="${confirmUrl}" style="padding:10px 14px;background:#2563eb;color:white;border-radius:6px;text-decoration:none;">
          Confirm new email
        </a>
      </p>
      <p>This link expires in ${expiresInHours} hour${expiresInHours !== 1 ? "s" : ""}. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    subject,
    html,
  });
}

/** Email verification: send verification link to new user. Uses Resend; logs only if not configured. */
async function sendVerificationEmail({ to, firstName, verifyUrl }) {
  const displayName = (firstName || "there").trim() || "there";
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.log("📧 Verification email (DEV LOG ONLY):", { to, verifyUrl });
    return;
  }
  const { Resend } = require("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const subject = "Verify your LetsRevise account";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Verify your email</h2>
      <p>Hi ${displayName},</p>
      <p>Thanks for signing up for LetsRevise. Please verify your email by clicking the link below:</p>
      <p>
        <a href="${verifyUrl}" style="padding:10px 14px;background:#2563eb;color:white;border-radius:6px;text-decoration:none;">
          Verify my email
        </a>
      </p>
      <p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
    </div>
  `;
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    subject,
    html,
  });
}

// Debug route - test password matching. DISABLED in production.
router.post("/debug-login", async (req, res) => {
  if (process.env.NODE_ENV === "production" || (process.env.DEBUG_ENDPOINTS !== "1" && process.env.DEBUG_ENDPOINTS !== "true")) {
    return res.status(404).json({ msg: "Not found" });
  }
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
    const payload = { success: false, message: "Debug error: " + error.message };
    if (process.env.NODE_ENV !== "production") payload.stack = error?.stack;
    return res.status(500).json(payload);
  }
});

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post(
  "/register",
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password is required").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const pwCheck = validatePasswordStrength(req.body.password);
    if (!pwCheck.valid) {
      return res.status(400).json({ errors: [{ msg: pwCheck.msg }] });
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
      yearGroup, // ✅ NEW: student year group (7..13)
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
    const resolvedSchoolName =
      (schoolName && schoolName.trim()) || (institution && institution.trim()) || null;

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

      // ✅ Student yearGroup validation (7..13)
      let parsedYearGroup = null;
      if (normalizedType === "student") {
        const n = Number(yearGroup);
        if (!Number.isFinite(n) || n < 7 || n > 13) {
          return res.status(400).json({
            msg: "Year group is required for students (7 to 13).",
          });
        }
        parsedYearGroup = n;
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

        // ✅ Persist student yearGroup (User model derives stageKey automatically)
        ...(normalizedType === "student" ? { yearGroup: parsedYearGroup } : {}),
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

      // Email verification token (24h expiry)
      const verificationToken = crypto.randomBytes(32).toString("hex");
      user.emailVerificationToken = verificationToken;
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await user.save();
      console.log(`✅ User registered: ${normalizedEmail} as ${normalizedType}`);

      // Send verification email
      const baseUrl = (process.env.APP_BASE_URL || "http://localhost:3000").trim().replace(/\/+$/, "");
      const verifyUrl = `${baseUrl}/#/verify-email?token=${encodeURIComponent(verificationToken)}`;
      await sendVerificationEmail({
        to: normalizedEmail,
        firstName: user.firstName,
        verifyUrl,
      });

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

        const baseUrl = (process.env.APP_BASE_URL || "http://localhost:3000").trim().replace(/\/+$/, "");
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

      // Create JWT (same rule as middleware, via utils)
      const payload = {
        user: {
          id: user._id.toString(),
          userType: user.userType,
        },
      };

      // ✅ CHANGED: Use JWT_SECRET_KEY directly from environment
      const jwtSecretKey = process.env.JWT_SECRET_KEY;
      if (!jwtSecretKey) {
        console.error("❌ JWT_SECRET_KEY environment variable is not set");
        return res.status(500).json({ msg: "Server configuration error" });
      }

      if (shouldDebugJwt()) {
        console.log(`🔑 JWT_SECRET_KEY fingerprint (SIGN/register): ${secretFingerprint(jwtSecretKey)}`);
      }

      // ✅ CHANGED: Sign with JWT_SECRET_KEY
      jwt.sign(payload, jwtSecretKey, { 
        algorithm: "HS256",
        expiresIn: "7d" 
      }, (err, token) => {
        if (err) {
          console.error("JWT error:", err);
          return res.status(500).send("Server error");
        }
        console.log(`✅ Registration complete, token generated for ${normalizedEmail}`);

        return res.status(201).json({
          msg: "Account created. Check your email to verify your account, then sign in.",
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

            // ✅ NEW (non-breaking): these allow frontend gating reliably
            yearGroup: user.yearGroup ?? null,
            stageKey: user.stageKey ?? null,
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

// @route   GET api/auth/verify-email?token=...
// @desc    Verify email using token sent on signup
// @access  Public
router.get("/verify-email", async (req, res) => {
  const token = (req.query.token || "").toString().trim();
  if (!token) {
    return res.status(400).json({ ok: false, msg: "Missing verification token" });
  }

  try {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      const expired = await User.findOne({ emailVerificationToken: token });
      if (expired) {
        return res.status(400).json({ ok: false, msg: "Verification link has expired. Please request a new one." });
      }
      return res.status(400).json({ ok: false, msg: "Invalid verification token" });
    }

    user.verificationStatus = "verified";
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    console.log(`✅ Email verified: ${user.email}`);
    return res.json({ ok: true, msg: "Email verified. You can now sign in." });
  } catch (err) {
    console.error("Verify email error:", err);
    return res.status(500).json({ ok: false, msg: "Server error" });
  }
});

// @route   POST api/auth/resend-verification
// @desc    Resend verification email for unverified users
// @access  Public (rate-limited by authLimiter)
router.post("/resend-verification", [check("email", "Valid email is required").isEmail()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ msg: "Valid email is required" });
  }
  const email = normEmail(req.body.email);

  try {
    const user = await User.findOne({ email: new RegExp(`^${email}$`, "i") });
    if (!user) {
      // Don't reveal whether user exists
      return res.json({ ok: true, msg: "If an unverified account exists, a new verification email has been sent." });
    }
    const status = (user.verificationStatus || "pending").toString().toLowerCase();
    if (status === "verified") {
      return res.json({ ok: true, msg: "This account is already verified. You can sign in." });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const baseUrl = (process.env.APP_BASE_URL || "http://localhost:3000").trim().replace(/\/+$/, "");
    const verifyUrl = `${baseUrl}/#/verify-email?token=${encodeURIComponent(verificationToken)}`;
    await sendVerificationEmail({ to: user.email, firstName: user.firstName, verifyUrl });

    console.log(`📧 Resent verification email to ${user.email}`);
    return res.json({ ok: true, msg: "A new verification email has been sent. Check your inbox." });
  } catch (err) {
    console.error("Resend verification error:", err);
    return res.status(500).json({ ok: false, msg: "Server error" });
  }
});

// @route   POST api/auth/forgot-password
// @desc    Request password reset email (always returns generic success)
// @access  Public (rate-limited)
const PASSWORD_RESET_EXPIRY_HOURS = 1;
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  [check("email", "Valid email is required").isEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ msg: "Valid email is required" });
    }
    const email = normEmail(req.body.email);

    const genericSuccess = {
      ok: true,
      msg: "If an account exists with that email, you will receive a password reset link shortly.",
    };

    try {
      const user = await User.findOne({ email: new RegExp(`^${email}$`, "i") });
      if (!user) {
        return res.json(genericSuccess);
      }

      const token = crypto.randomBytes(32).toString("hex");
      user.passwordResetToken = token;
      user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000);
      await user.save();

      const baseUrl = (process.env.APP_BASE_URL || "http://localhost:3000").trim().replace(/\/+$/, "");
      const resetUrl = `${baseUrl}/#/reset-password?token=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail({
        to: user.email,
        firstName: user.firstName,
        resetUrl,
        expiresInHours: PASSWORD_RESET_EXPIRY_HOURS,
      });

      console.log(`📧 Password reset email sent to ${user.email}`);
      return res.json(genericSuccess);
    } catch (err) {
      console.error("Forgot password error:", err);
      return res.json(genericSuccess);
    }
  }
);

// @route   POST api/auth/reset-password
// @desc    Reset password using token (single-use, expires)
// @access  Public (rate-limited)
router.post(
  "/reset-password",
  resetPasswordLimiter,
  [
    check("token", "Reset token is required").notEmpty(),
    check("password", "Password is required").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e) => e.msg).join("; ");
      return res.status(400).json({ msg });
    }
    const pwCheck = validatePasswordStrength(req.body.password);
    if (!pwCheck.valid) {
      return res.status(400).json({ msg: pwCheck.msg });
    }
    const { token, password } = req.body;
    const trimmedToken = (token || "").toString().trim();

    try {
      const user = await User.findOne({
        passwordResetToken: trimmedToken,
        passwordResetExpires: { $gt: new Date() },
      });

      if (!user) {
        const expired = await User.findOne({ passwordResetToken: trimmedToken });
        if (expired) {
          return res.status(400).json({ msg: "Reset link has expired. Please request a new one." });
        }
        return res.status(400).json({ msg: "Invalid or expired reset link. Please request a new one." });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      user.password = hashedPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      console.log(`✅ Password reset successful for ${user.email}`);
      return res.json({ ok: true, msg: "Password reset successfully. You can now sign in." });
    } catch (err) {
      console.error("Reset password error:", err);
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  "/login",
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password is required").exists(),
  ],
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

      // Block login for unverified users (admins are typically verified via seed/admin)
      const status = (user.verificationStatus || "pending").toString().toLowerCase();
      if (status !== "verified") {
        console.log(`❌ Login blocked: ${normalizedEmail} verificationStatus=${status}`);
        return res.status(403).json({
          msg: "Please verify your email before signing in. Check your inbox for the verification link.",
          code: "EMAIL_NOT_VERIFIED",
        });
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

      // Create JWT (same rule as middleware — use getJwtSecret so sign and verify use same env var)
      const payload = {
        user: {
          id: user._id.toString(),
          userType: user.userType,
        },
      };

      const { getJwtSecret } = require("../utils/jwtSecret");
      const jwtSecretKey = getJwtSecret();

      if (shouldDebugJwt()) {
        console.log(`🔑 JWT secret fingerprint (SIGN/login): ${secretFingerprint(jwtSecretKey)}`);
      }

      jwt.sign(payload, jwtSecretKey, { 
        algorithm: "HS256",
        expiresIn: "7d" 
      }, (err, token) => {
        if (err) {
          console.error("JWT error:", err);
          return res.status(500).send("Server error");
        }

        if (process.env.NODE_ENV !== "test") {
          console.log(`✅ Login successful for ${normalizedEmail}, userType: ${user.userType}`);
        }

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
            staffRole: user.staffRole || null,

            // ✅ NEW (non-breaking): reliable gating for lessons
            yearGroup: user.yearGroup ?? null,
            stageKey: user.stageKey ?? null,
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

// @route   PUT api/auth/me/password
// @desc    Change password (authenticated, requires current password)
// @access  Private
const auth = require("../middleware/auth");
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { msg: "Too many password change attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.put(
  "/me/password",
  auth,
  changePasswordLimiter,
  [
    check("currentPassword", "Current password is required").notEmpty(),
    check("newPassword", "New password is required").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e) => e.msg).join("; ");
      return res.status(400).json({ msg });
    }
    const pwCheck = validatePasswordStrength(req.body.newPassword);
    if (!pwCheck.valid) {
      return res.status(400).json({ msg: pwCheck.msg });
    }
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?._id || req.user?.id;

    try {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ msg: "User not found" });

      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return res.status(400).json({ msg: "Current password is incorrect" });
      }

      user.password = await bcrypt.hash(newPassword, 12);
      await user.save();

      console.log(`✅ Password changed for ${user.email}`);
      return res.json({ ok: true, msg: "Password updated successfully." });
    } catch (err) {
      console.error("Change password error:", err);
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

// @route   PUT api/auth/me/email
// @desc    Change email (authenticated, requires current password). Admin: immediate. Non-admin: requires reverification.
// @access  Private
router.put(
  "/me/email",
  auth,
  [
    check("currentPassword", "Current password is required").notEmpty(),
    check("newEmail", "Valid new email is required").isEmail(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e) => e.msg).join("; ");
      return res.status(400).json({ msg });
    }
    const { currentPassword, newEmail } = req.body;
    const userId = req.user?._id || req.user?.id;
    const normalizedNew = normEmail(newEmail);

    try {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ msg: "User not found" });

      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return res.status(400).json({ msg: "Current password is incorrect" });
      }

      const existing = await User.findOne({ email: new RegExp(`^${normalizedNew}$`, "i") });
      if (existing && String(existing._id) !== String(userId)) {
        return res.status(400).json({ msg: "That email is already in use" });
      }

      const isAdmin = (user.userType || "").toString().toLowerCase() === "admin";

      if (isAdmin) {
        // Admin: immediate email change (no reverification)
        user.email = normalizedNew;
        user.pendingNewEmail = undefined;
        user.emailChangeToken = undefined;
        user.emailChangeExpires = undefined;
        await user.save();
        console.log(`✅ Email changed for admin ${userId} to ${normalizedNew}`);
        return res.json({
          ok: true,
          msg: "Email updated successfully.",
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            userType: user.userType,
          },
        });
      }

      // Non-admin: store pending, send verification email
      const emailChangeToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      user.pendingNewEmail = normalizedNew;
      user.emailChangeToken = emailChangeToken;
      user.emailChangeExpires = expiresAt;
      await user.save();

      const baseUrl = (process.env.APP_BASE_URL || "http://localhost:3000").trim().replace(/\/+$/, "");
      const confirmUrl = `${baseUrl}/api/auth/confirm-email-change?token=${encodeURIComponent(emailChangeToken)}`;
      await sendEmailChangeVerification({ to: normalizedNew, confirmUrl, expiresInHours: 24 });

      console.log(`📧 Email change verification sent for user ${userId} → ${normalizedNew}`);
      return res.json({
        ok: true,
        msg: "Check your new email to complete the change.",
        requiresVerification: true,
      });
    } catch (err) {
      console.error("Change email error:", err);
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

// @route   GET api/auth/confirm-email-change
// @desc    Confirm email change (token from verification email). No auth required.
// @access  Public
router.get("/confirm-email-change", async (req, res) => {
  const token = (req.query.token || "").toString().trim();
  if (!token) {
    return res.redirect("/#/confirm-email-change?error=missing");
  }
  try {
    const user = await User.findOne({
      emailChangeToken: token,
      emailChangeExpires: { $gt: new Date() },
    });
    if (!user) {
      return res.redirect("/#/confirm-email-change?error=invalid");
    }
    const newEmail = user.pendingNewEmail;
    if (!newEmail) {
      return res.redirect("/#/confirm-email-change?error=invalid");
    }
    user.email = newEmail;
    user.pendingNewEmail = undefined;
    user.emailChangeToken = undefined;
    user.emailChangeExpires = undefined;
    await user.save();
    console.log(`✅ Email change confirmed for user ${user._id} → ${newEmail}`);
    return res.redirect("/#/confirm-email-change?success=1");
  } catch (err) {
    console.error("Confirm email change error:", err);
    return res.redirect("/#/confirm-email-change?error=server");
  }
});

// @route   GET api/auth/user
// @desc    Get user data
// @access  Private
router.get("/user", async (req, res) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "").trim();

    if (!token) {
      return res.status(401).json({ msg: "No token" });
    }

    const { getJwtSecret } = require("../utils/jwtSecret");
    const jwtSecretKey = getJwtSecret();
    const decoded = jwt.verify(token, jwtSecretKey, { algorithms: ["HS256"] });
    const userId = decoded.user?.id || decoded.userId || decoded.id;

    if (!userId) {
      return res.status(401).json({ msg: "Token valid but user id missing in payload" });
    }

    const user = await User.findById(userId).select("-password");

    // ✅ Ensure yearGroup + stageKey are returned for gating
    res.json(user);
  } catch (err) {
    console.error(err.message);
    return res.status(401).json({ msg: "Token is not valid" });
  }
});

module.exports = router;