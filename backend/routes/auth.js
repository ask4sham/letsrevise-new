// /backend/routes/auth.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { isActiveUserDoc, withActiveUserFilter } = require("../utils/activeUser");
const ParentLinkRequest = require("../models/ParentLinkRequest");
const { check, validationResult } = require("express-validator");
const { validatePasswordStrength } = require("../utils/passwordStrength");
const { sendInternalError, IS_PRODUCTION } = require("../utils/safeErrorResponse");
const { CURRENT_USER_PROJECTION, toCurrentUserDto } = require("../utils/userResponse");

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

/** Cooldown between verification emails (signup + resend), per user. */
const VERIFICATION_EMAIL_COOLDOWN_MS = 45 * 1000;

function buildAuthUserPayload(userDoc) {
  const u = userDoc;
  const status = (u.verificationStatus || "pending").toString().toLowerCase();
  return {
    id: u._id.toString(),
    email: u.email,
    userType: u.userType,
    firstName: u.firstName,
    lastName: u.lastName || "",
    referralCode: u.referralCode,
    schoolName: u.schoolName || null,
    verificationStatus: u.verificationStatus || "pending",
    emailVerified: status === "verified",
    staffRole: u.staffRole || null,
    yearGroup: u.yearGroup ?? null,
    stageKey: u.stageKey ?? null,
  };
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
      if (user.isDeleted === true) {
        return res.json({ success: false, message: "Debug: User is soft-deleted" });
      }
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
      // Check if user exists (case-insensitive). Email unique index still holds the row for soft-deleted users.
      let user = await User.findOne({ email: new RegExp(`^${normalizedEmail}$`, "i") });
      if (user) {
        /**
         * Policy B (safest): do NOT auto-restore on re-register. Prevents silently merging a new signup
         * with a deactivated account and avoids ambiguity if the email changed hands. Admin must restore.
         */
        if (user.isDeleted === true) {
          console.log(`❌ Registration blocked (soft-deleted email): ${normalizedEmail}`);
          return res.status(403).json({
            msg: "This email was previously used on a closed account. Please contact support to restore access, or use a different email.",
            code: "ACCOUNT_SOFT_DELETED",
          });
        }
        const vStatus = (user.verificationStatus || "pending").toString().toLowerCase();
        if (vStatus !== "verified") {
          console.log(`❌ Registration blocked (existing unverified account): ${normalizedEmail}`);
          return res.status(400).json({
            msg: "This email is already registered but not verified yet. Sign in with your password, then verify your email from the banner or resend a verification link.",
            code: "EMAIL_ALREADY_REGISTERED_UNVERIFIED",
          });
        }
        console.log(`❌ User already exists: ${normalizedEmail}`);
        return res.status(400).json({
          msg: "This email is already registered. Sign in instead, or use Forgot password if you need to reset your password.",
          code: "EMAIL_ALREADY_REGISTERED",
        });
      }

      // Minimal signup: first name only (last name optional — can be completed in profile/onboarding)
      if (!firstName || !String(firstName).trim()) {
        console.log("❌ Missing first name");
        return res.status(400).json({ msg: "First name is required" });
      }

      const normalizedLastName = typeof lastName === "string" ? lastName.trim() : "";

      // ✅ Student yearGroup optional at signup (7..13) — can be set in onboarding
      let parsedYearGroup = null;
      if (normalizedType === "student" && yearGroup !== undefined && yearGroup !== null && String(yearGroup).trim() !== "") {
        const n = Number(yearGroup);
        if (!Number.isFinite(n) || n < 7 || n > 13) {
          return res.status(400).json({
            msg: "Year group must be between 7 and 13.",
          });
        }
        parsedYearGroup = n;
      }

      // For parent accounts, if they provided a student email, ensure it exists (and is a student)
      let linkedStudent = null;
      if (normalizedType === "parent" && normalizedLinkedStudentEmail) {
        linkedStudent = await User.findOne(
          withActiveUserFilter({
            email: new RegExp(`^${normalizedLinkedStudentEmail}$`, "i"),
            userType: "student",
          })
        ).select("_id email userType");

        if (!linkedStudent) {
          return res.status(400).json({
            msg: "Linked student not found. Please register the student first (as a student account) using that email.",
          });
        }
      }

      user = new User({
        email: normalizedEmail,
        password, // will be replaced with hashed version below
        userType: normalizedType,
        firstName: firstName.trim(),
        lastName: normalizedLastName,
        schoolName: resolvedSchoolName,
        verificationStatus: "pending",

        // ✅ Persist student yearGroup (User model derives stageKey automatically)
        ...(normalizedType === "student" && parsedYearGroup != null ? { yearGroup: parsedYearGroup } : {}),
      });

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      user.password = hashedPassword;

      console.log(`Password hashed: ${hashedPassword.substring(0, 30)}...`);

      // PR2: referral currency bonuses disabled

      // Email verification token (24h expiry)
      const verificationToken = crypto.randomBytes(32).toString("hex");
      user.emailVerificationToken = verificationToken;
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await user.save();
      console.log(`✅ User registered: ${normalizedEmail} as ${normalizedType}`);

      // Send verification email — account is kept even if email fails; client can resend
      const baseUrl = (process.env.APP_BASE_URL || "http://localhost:3000").trim().replace(/\/+$/, "");
      const verifyUrl = `${baseUrl}/#/verify-email?token=${encodeURIComponent(verificationToken)}`;

      let verificationEmailSent = false;
      let verificationEmailWarning = null;

      if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
        console.error(
          "[auth/register] Verification email not sent: missing RESEND_API_KEY or RESEND_FROM_EMAIL"
        );
        verificationEmailSent = false;
        verificationEmailWarning =
          "We could not send a verification email right now (email not configured). Use Resend email from your account when ready.";
      } else {
        try {
          await sendVerificationEmail({
            to: normalizedEmail,
            firstName: user.firstName,
            verifyUrl,
          });
          user.verificationEmailLastSentAt = new Date();
          await user.save();
          verificationEmailSent = true;
        } catch (emailErr) {
          console.error("[auth/register] Resend verification email failed:", emailErr);
          verificationEmailSent = false;
          verificationEmailWarning =
            "Your account was created, but we could not send the verification email. Please use “Resend email” from the app.";
        }
      }

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

      const { getJwtSecret } = require("../utils/jwtSecret");
      const jwtSecretKey = getJwtSecret();

      if (shouldDebugJwt()) {
        console.log(`🔑 JWT fingerprint (SIGN/register): ${secretFingerprint(jwtSecretKey)}`);
      }

      jwt.sign(payload, jwtSecretKey, { 
        algorithm: "HS256",
        expiresIn: "7d" 
      }, (err, token) => {
        if (err) {
          return sendInternalError("auth/register/jwt", err, res);
        }
        console.log(`✅ Registration complete, token generated for ${normalizedEmail}`);

        return res.status(201).json({
          msg: verificationEmailSent
            ? "Account created. Check your email to verify your account."
            : "Account created. We could not send a verification email automatically — use Resend from the app when you are ready.",
          token,
          user: buildAuthUserPayload(user),
          verificationEmailSent,
          ...(verificationEmailWarning ? { verificationEmailWarning } : {}),
          // extra, non-breaking field (frontend can ignore)
          link: linkInfo,
        });
      });
    } catch (err) {
      if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map((val) => val.message);
        console.log("[auth/register] validation:", messages.join("; "));
        return res.status(400).json({ msg: messages.join(", ") });
      }
      return sendInternalError("auth/register", err, res);
    }
  }
);

// @route   GET api/auth/verify-email?token=...
// @desc    Verify email using token sent on signup
// @access  Public
router.get("/verify-email", async (req, res) => {
  const token = (req.query.token || "").toString().trim();
  if (!token) {
    return res.status(400).json({ ok: false, code: "invalid", msg: "Missing verification token" });
  }

  try {
    const user = await User.findOne({ emailVerificationToken: token });

    if (!user) {
      return res.status(400).json({
        ok: false,
        code: "invalid",
        msg: "This verification link is invalid.",
      });
    }
    if (user.isDeleted === true) {
      return res.status(403).json({ ok: false, code: "invalid", msg: "This account is no longer active." });
    }

    const status = (user.verificationStatus || "pending").toString().toLowerCase();
    if (status === "verified") {
      return res.json({
        ok: true,
        code: "already_verified",
        msg: "Your email is already verified.",
      });
    }

    const exp = user.emailVerificationExpires;
    if (!exp || exp.getTime() <= Date.now()) {
      return res.status(400).json({
        ok: false,
        code: "expired",
        msg: "This verification link has expired.",
      });
    }

    user.verificationStatus = "verified";
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    console.log(`✅ Email verified: ${user.email}`);
    return res.json({ ok: true, code: "success", msg: "Your email has been verified." });
  } catch (err) {
    return sendInternalError("auth/verify-email", err, res, { extra: { ok: false } });
  }
});

// @route   POST api/auth/resend-verification
// @desc    Resend verification email for unverified users
// @access  Public (rate-limited by authLimiter)
router.post("/resend-verification", [check("email", "Valid email is required").isEmail()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, msg: "Valid email is required" });
  }
  const email = normEmail(req.body.email);

  try {
    const user = await User.findOne({ email: new RegExp(`^${email}$`, "i") });
    if (!user) {
      // Don't reveal whether user exists
      return res.json({ ok: true, msg: "If an unverified account exists, a new verification email has been sent." });
    }
    if (user.isDeleted === true) {
      return res.json({ ok: true, msg: "If an unverified account exists, a new verification email has been sent." });
    }
    const status = (user.verificationStatus || "pending").toString().toLowerCase();
    if (status === "verified") {
      return res.json({ ok: true, code: "already_verified", msg: "This account is already verified." });
    }

    const last = user.verificationEmailLastSentAt;
    if (last instanceof Date && Date.now() - last.getTime() < VERIFICATION_EMAIL_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil(
        (VERIFICATION_EMAIL_COOLDOWN_MS - (Date.now() - last.getTime())) / 1000
      );
      return res.status(429).json({
        ok: false,
        code: "RATE_LIMIT",
        msg: `Please wait ${retryAfterSeconds}s before requesting another email.`,
        retryAfterSeconds,
      });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    user.verificationEmailLastSentAt = new Date();
    await user.save();

    const baseUrl = (process.env.APP_BASE_URL || "http://localhost:3000").trim().replace(/\/+$/, "");
    const verifyUrl = `${baseUrl}/#/verify-email?token=${encodeURIComponent(verificationToken)}`;

    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
      console.warn("[auth/resend-verification] Email not sent: missing RESEND config");
      return res.status(503).json({
        ok: false,
        code: "EMAIL_UNAVAILABLE",
        msg: "Verification email could not be sent (email service not configured).",
      });
    }

    try {
      await sendVerificationEmail({ to: user.email, firstName: user.firstName, verifyUrl });
    } catch (emailErr) {
      console.error("[auth/resend-verification] send failed:", emailErr);
      return res.status(503).json({
        ok: false,
        code: "EMAIL_SEND_FAILED",
        msg: "Could not send the verification email. Please try again shortly.",
      });
    }

    console.log(`📧 Resent verification email to ${user.email}`);
    return res.json({ ok: true, code: "sent", msg: "A new verification email has been sent." });
  } catch (err) {
    return sendInternalError("auth/resend-verification", err, res, { extra: { ok: false } });
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
      if (!user || user.isDeleted === true) {
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
      if (user.isDeleted === true) {
        return res.status(403).json({
          msg: "This account has been closed. Contact support to restore access.",
          code: "ACCOUNT_DELETED",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      user.password = hashedPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      console.log(`✅ Password reset successful for ${user.email}`);
      return res.json({ ok: true, msg: "Password reset successfully. You can now sign in." });
    } catch (err) {
      return sendInternalError("auth/reset-password", err, res);
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
    // Role is UI-only on LoginPage; backend authorizes by persisted user.userType only.
    if (IS_PRODUCTION) {
      console.log(`[auth/login] attempt email=${normalizedEmail}`);
    } else {
      const bodyKeys = req.body && typeof req.body === "object" ? Object.keys(req.body) : [];
      console.log(
        `[auth/login] attempt email=${normalizedEmail} keys=[${bodyKeys.join(",")}] passwordPresent=${!!password}`
      );
    }

    try {
      if (mongoose.connection.readyState !== 1) {
        console.error("[auth/login] MongoDB not connected readyState=", mongoose.connection.readyState);
        return res.status(503).json({
          msg: "Database is temporarily unavailable. Please try again shortly.",
          code: "DATABASE_UNAVAILABLE",
        });
      }

      let user = await User.findOne({ email: new RegExp(`^${normalizedEmail}$`, "i") });

      if (!user) {
        if (!IS_PRODUCTION) console.log(`[auth/login] fail reason=user_not_found email=${normalizedEmail}`);
        else console.log("[auth/login] fail reason=user_not_found");
        return res.status(400).json({ msg: "Invalid credentials" });
      }
      if (user.isDeleted === true) {
        console.log(`[auth/login] fail reason=account_deleted userId=${user._id}`);
        return res.status(403).json({
          msg: "This account has been closed. Contact support to restore access.",
          code: "ACCOUNT_DELETED",
        });
      }

      if (!user.password || typeof user.password !== "string") {
        console.error("[auth/login] fail reason=no_password_hash userId=", String(user._id));
        return res.status(403).json({
          msg: "This account has no password set. Use Forgot password or contact support.",
          code: "NO_PASSWORD_SET",
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        const trimmedMatch = await bcrypt.compare(password.trim(), user.password);
        if (!trimmedMatch) {
          if (!IS_PRODUCTION) console.log(`[auth/login] fail reason=bad_password email=${normalizedEmail}`);
          else console.log("[auth/login] fail reason=bad_password");
          return res.status(400).json({ msg: "Invalid credentials" });
        }
      }

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

      jwt.sign(
        payload,
        jwtSecretKey,
        {
          algorithm: "HS256",
          expiresIn: "7d",
        },
        (err, token) => {
          if (err) {
            console.error("[auth/login] JWT sign failed:", err.message);
            return sendInternalError("auth/login/jwt", err, res);
          }

          if (process.env.NODE_ENV !== "test") {
            console.log(`[auth/login] success userId=${user._id} userType=${user.userType}`);
          }

          res.json({
            token,
            user: buildAuthUserPayload(user),
          });
        }
      );
    } catch (err) {
      return sendInternalError("auth/login", err, res);
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
      if (!user.password || typeof user.password !== "string") {
        return res.status(400).json({ msg: "Password change is not available for this account." });
      }

      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return res.status(400).json({ msg: "Current password is incorrect" });
      }

      user.password = await bcrypt.hash(newPassword, 12);
      await user.save();

      if (process.env.NODE_ENV !== "production") {
        console.log(`✅ Password changed for ${user.email}`);
      } else {
        console.log("[auth/me/password] success userId=", String(userId));
      }
      return res.json({ ok: true, msg: "Password updated successfully." });
    } catch (err) {
      return sendInternalError("auth/me/password", err, res);
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

      if (!user.password || typeof user.password !== "string") {
        return res.status(400).json({ msg: "Email change requires a password on this account." });
      }
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return res.status(400).json({ msg: "Current password is incorrect" });
      }

      const existing = await User.findOne({ email: new RegExp(`^${normalizedNew}$`, "i") });
      if (existing && String(existing._id) !== String(userId)) {
        if (existing.isDeleted === true) {
          return res.status(400).json({
            msg: "That email is not available. Contact support if you need to recover a closed account.",
          });
        }
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
      return sendInternalError("auth/me/email", err, res);
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
    if (user.isDeleted === true) {
      return res.redirect("/#/confirm-email-change?error=inactive");
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

    const user = await User.findById(userId).select(CURRENT_USER_PROJECTION).lean();
    if (!user) {
      return res.status(401).json({ msg: "User not found" });
    }
    if (!isActiveUserDoc(user)) {
      return res.status(401).json({
        msg: "This account has been closed. Contact support if you need access.",
        code: "ACCOUNT_DELETED",
      });
    }

    res.json(toCurrentUserDto(user));
  } catch (err) {
    console.error(err.message);
    return res.status(401).json({ msg: "Token is not valid" });
  }
});

module.exports = router;