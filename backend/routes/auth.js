const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { check, validationResult } = require('express-validator');

// Debug route - test password matching
router.post('/debug-login', async (req, res) => {
  console.log('\n🔍 DEBUG LOGIN REQUEST:', req.body);
  
  const { email, password } = req.body;
  
  try {
    const user = await User.findOne({ email });
    console.log('USER FOUND:', user ? 'YES' : 'NO');
    
    if (user) {
      console.log('User details:', {
        email: user.email,
        userType: user.userType,
        firstName: user.firstName,
        lastName: user.lastName,
        passwordHash: user.password ? user.password.substring(0, 30) + '...' : 'NO PASSWORD',
        hashLength: user.password ? user.password.length + ' chars' : 'N/A'
      });
      
      if (!user.password) {
        return res.json({ success: false, message: 'Debug: User has no password set' });
      }
      
      const isMatch = await bcrypt.compare(password, user.password);
      console.log('Password match:', isMatch);
      
      if (isMatch) {
        return res.json({ 
          success: true, 
          message: 'Debug: Password matches',
          user: {
            email: user.email,
            userType: user.userType,
            firstName: user.firstName,
            lastName: user.lastName
          }
        });
      } else {
        // Test with trimmed password
        const trimmedMatch = await bcrypt.compare(password.trim(), user.password);
        console.log('Password match (trimmed):', trimmedMatch);
        
        return res.json({ 
          success: false, 
          message: 'Debug: Password does NOT match',
          details: {
            passwordProvided: `"${password}" (${password.length} chars)`,
            passwordTrimmed: `"${password.trim()}" (${password.trim().length} chars)`,
            hashStartsWith: user.password.substring(0, 30)
          }
        });
      }
    } else {
      return res.json({ 
        success: false, 
        message: 'Debug: User not found',
        searchedEmail: email
      });
    }
  } catch (error) {
    console.error('Debug error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Debug error: ' + error.message,
      stack: error.stack
    });
  }
});

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post(
  '/register',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      email,
      password,
      userType,
      firstName,
      lastName,
      institution,          // legacy field from older frontend
      schoolName,           // new field from current frontend
      referralCode,
      linkedStudentEmail    // for parent accounts
    } = req.body;

    // Normalise userType
    const rawType = (userType || 'student').toString().toLowerCase();
    const allowedTypes = ['student', 'teacher', 'parent', 'admin'];

    let normalizedType = allowedTypes.includes(rawType) ? rawType : 'student';

    // Do NOT allow public registration as admin
    if (normalizedType === 'admin') {
      console.log(`⚠️  Public registration attempted as admin for ${email}. Forcing userType=student.`);
      normalizedType = 'student';
    }

    // Work out school name (support both old "institution" and new "schoolName")
    const resolvedSchoolName =
      (schoolName && schoolName.trim()) ||
      (institution && institution.trim()) ||
      null;

    console.log(`\n📝 Registration attempt for: ${email} (${normalizedType})`);

    try {
      // Check if user exists
      let user = await User.findOne({ email });
      if (user) {
        console.log(`❌ User already exists: ${email}`);
        return res.status(400).json({ msg: 'User already exists' });
      }

      // Create user - validate that required fields are present
      if (!firstName || !lastName) {
        console.log('❌ Missing first/last name');
        return res
          .status(400)
          .json({ msg: 'First name and last name are required' });
      }

      // Determine starting ShamCoins based on user type
      // Students: 500, Teachers: 100, Parents: 0
      let startingShamCoins = 500;
      if (normalizedType === 'teacher') startingShamCoins = 100;
      if (normalizedType === 'parent') startingShamCoins = 0;

      user = new User({
        email,
        password, // will be replaced with hashed version below
        userType: normalizedType,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        schoolName: resolvedSchoolName,
        shamCoins: startingShamCoins,
        // keep existing default for verificationStatus if schema defines it,
        // otherwise set to "pending" explicitly (harmless if field doesn't exist)
        verificationStatus: 'pending'
      });

      // For parent accounts, optionally store linked student email
      if (normalizedType === 'parent' && linkedStudentEmail) {
        user.linkedStudentEmail = linkedStudentEmail.trim().toLowerCase();
      }

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
          user.shamCoins += 100; // Extra bonus for using referral
        }
      }

      await user.save();
      console.log(`✅ User registered: ${email} as ${normalizedType}`);

      // Create JWT
      const payload = {
        user: {
          id: user._id.toString(),
          userType: user.userType
        }
      };

      jwt.sign(
        payload,
        process.env.JWT_SECRET || 'dev_secret',
        { expiresIn: '7d' },
        (err, token) => {
          if (err) {
            console.error('JWT error:', err);
            return res.status(500).send('Server error');
          }
          console.log(`✅ Registration complete, token generated for ${email}`);

          // We now also include a message, but keep token + user the same for compatibility
          return res.status(201).json({
            msg: 'User registered successfully. Please check your email to verify your account.',
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
              verificationStatus: user.verificationStatus || 'pending'
            }
          });
        }
      );
    } catch (err) {
      console.error('❌ Registration error:', err.message);
      console.error('Error stack:', err.stack);
      // Check for validation errors
      if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((val) => val.message);
        console.log('Validation messages:', messages);
        return res.status(400).json({ msg: messages.join(', ') });
      }
      res.status(500).send('Server error');
    }
  }
);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Login validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    console.log(`\n🔐 Login attempt for: ${email}`);

    try {
      // Check if user exists - with multiple search methods
      let user = await User.findOne({ email });

      if (!user) {
        // Try case-insensitive search
        user = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });
        if (user) {
          console.log(
            `⚠️  Found user with case-insensitive search: ${user.email}`
          );
        }
      }

      if (!user) {
        console.log(`❌ User not found: ${email}`);
        return res.status(400).json({ msg: 'Invalid credentials' });
      }

      console.log(`✅ User found: ${user.email} (${user.userType})`);
      console.log(`Password hash: ${user.password.substring(0, 30)}...`);

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      console.log(`Password match for ${email}: ${isMatch}`);

      if (!isMatch) {
        // Try with trimmed password
        const trimmedMatch = await bcrypt.compare(
          password.trim(),
          user.password
        );
        console.log(`Password match (trimmed): ${trimmedMatch}`);

        if (!trimmedMatch) {
          console.log(`❌ Password does not match for ${email}`);
          return res.status(400).json({ msg: 'Invalid credentials' });
        }
      }

      // Create JWT
      const payload = {
        user: {
          id: user._id.toString(),
          userType: user.userType
        }
      };

      jwt.sign(
        payload,
        process.env.JWT_SECRET || 'dev_secret',
        { expiresIn: '7d' },
        (err, token) => {
          if (err) {
            console.error('JWT error:', err);
            return res.status(500).send('Server error');
          }
          console.log(
            `✅ Login successful for ${email}, userType: ${user.userType}`
          );
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
              verificationStatus: user.verificationStatus || 'pending'
            }
          });
        }
      );
    } catch (err) {
      console.error('❌ Login error:', err.message);
      console.error('Error stack:', err.stack);
      res.status(500).send('Server error');
    }
  }
);

// @route   GET api/auth/user
// @desc    Get user data
// @access  Private
router.get('/user', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ msg: 'No token' });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev_secret'
    );
    const user = await User.findById(decoded.user.id).select('-password');

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
