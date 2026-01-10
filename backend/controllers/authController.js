const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

/**
 * IMPORTANT (Production):
 * - NEVER fall back to a hardcoded secret.
 * - MUST use the SAME normalization rule as middleware (trim).
 */
function getJwtSecret() {
  const raw = process.env.JWT_SECRET;
  const secret = typeof raw === "string" ? raw.trim() : "";

  // keep the safety bar, but after trim
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET is missing or too short. Set a strong JWT_SECRET in Render Environment."
    );
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

// Register new user
exports.register = async (req, res) => {
  try {
    const {
      email,
      password,
      userType,
      firstName,
      lastName,
      institution,
      referredBy,
    } = req.body;

    console.log("Registration attempt for:", email);

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate referral code for teachers
    let referralCode = undefined;
    if (userType === "teacher") {
      const generateCode = () => {
        const prefix = "TEACH-";
        const random = Math.random()
          .toString(36)
          .substring(2, 10)
          .toUpperCase();
        return prefix + random;
      };

      let isUnique = false;
      while (!isUnique) {
        referralCode = generateCode();
        const existing = await User.findOne({ referralCode });
        if (!existing) isUnique = true;
      }
    }

    // Create new user with current timestamp
    const now = new Date();
    const user = new User({
      email,
      password: hashedPassword,
      userType,
      firstName,
      lastName,
      referralCode,
      ...(userType === "teacher" && { institution }),
      ...(referredBy && { referredBy }),
      shamCoins: referredBy ? 150 : 100,
      createdAt: now,
      updatedAt: now,
    });

    // Handle referral bonus for referrer
    if (referredBy) {
      const referrer = await User.findOne({ referralCode: referredBy });
      if (referrer) {
        referrer.shamCoins += 50;
        referrer.updatedAt = new Date();
        await referrer.save();
        console.log(`Added 50 coins to referrer: ${referrer.email}`);
      }
    }

    await user.save();
    console.log("User saved successfully:", user.email);

    // Create JWT token (NO fallback secret)
    const jwtSecret = getJwtSecret();
    if (shouldDebugJwt()) {
      console.log(
        `🔑 JWT_SECRET fingerprint (SIGN/register): ${secretFingerprint(
          jwtSecret
        )}`
      );
    }

    const token = jwt.sign(
      {
        userId: user._id,
        userType: user.userType,
        email: user.email,
      },
      jwtSecret,
      { expiresIn: "7d" }
    );

    // Return user data without password
    const userResponse = {
      _id: user._id,
      email: user.email,
      userType: user.userType,
      firstName: user.firstName,
      lastName: user.lastName,
      verificationStatus: user.verificationStatus,
      shamCoins: user.shamCoins,
      referralCode: user.referralCode,
      institution: user.institution,
      referredBy: user.referredBy,
      createdAt: user.createdAt,
    };

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("Registration error:", error);

    // Handle specific MongoDB errors
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.email) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
      if (error.keyPattern && error.keyPattern.referralCode) {
        return res.status(400).json({
          success: false,
          message: "Referral code conflict. Please try again.",
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Server error during registration",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Create JWT token (NO fallback secret)
    const jwtSecret = getJwtSecret();
    if (shouldDebugJwt()) {
      console.log(
        `🔑 JWT_SECRET fingerprint (SIGN/login): ${secretFingerprint(jwtSecret)}`
      );
    }

    const token = jwt.sign(
      {
        userId: user._id,
        userType: user.userType,
        email: user.email,
      },
      jwtSecret,
      { expiresIn: "7d" }
    );

    // Return user data without password
    const userResponse = {
      _id: user._id,
      email: user.email,
      userType: user.userType,
      firstName: user.firstName,
      lastName: user.lastName,
      verificationStatus: user.verificationStatus,
      shamCoins: user.shamCoins,
      referralCode: user.referralCode,
      institution: user.institution,
      createdAt: user.createdAt,
    };

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching profile",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Test endpoint
exports.test = (req, res) => {
  res.json({
    success: true,
    message: "Auth API is working!",
    timestamp: new Date().toISOString(),
  });
};
