// routes/earnings.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Your auth middleware
const User = require('../models/User');
const { sendInternalError } = require('../utils/safeErrorResponse');

// POST /api/earnings/cashout
router.post('/cashout', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // Check if user has enough earnings
    if (user.earnings < amount) {
      return res.status(400).json({ message: 'Insufficient earnings' });
    }

    // Deduct earnings and add to balance
    user.earnings -= amount;
    user.balance = (user.balance || 0) + amount;
    user.totalWithdrawn = (user.totalWithdrawn || 0) + amount; // ADDED: Track total withdrawn
    
    // Record transaction
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'cashout',
      amount: amount,
      date: new Date(),
      description: `Cash out of ${amount}`,
      status: 'completed'
    });

    await user.save();

    res.json({
      message: `Successfully cashed out ${amount}`,
      newBalance: user.balance,
      remainingEarnings: user.earnings,
      totalWithdrawn: user.totalWithdrawn
    });

  } catch (error) {
    return sendInternalError('earnings/cashout', error, res);
  }
});

// Retired legacy transfer endpoint (kept for old clients that POST here)
router.post('/fix-earnings', auth, (req, res) => {
  return res.status(410).json({
    success: false,
    code: 'FIX_EARNINGS_DEPRECATED',
    message: 'That legacy transfer is no longer supported.',
  });
});

// GET /api/earnings/balance
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      earnings: user.earnings || 0,
      balance: user.balance || 0,
      totalWithdrawn: user.totalWithdrawn || 0,
    });
  } catch (error) {
    return sendInternalError('earnings/balance', error, res);
  }
});

// GET /api/earnings/transactions
router.get('/transactions', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Sort transactions by date (newest first)
    const transactions = (user.transactions || []).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );

    res.json({
      transactions: transactions.slice(0, 50), // Return last 50 transactions
      total: transactions.length
    });
  } catch (error) {
    return sendInternalError('earnings/transactions', error, res);
  }
});

module.exports = router;