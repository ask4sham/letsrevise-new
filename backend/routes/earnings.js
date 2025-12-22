// routes/earnings.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Your auth middleware
const User = require('../models/User');

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
      description: `Cash out of ${amount} ShamCoins`,
      status: 'completed'
    });

    await user.save();

    res.json({
      message: `Successfully cashed out ${amount} ShamCoins`,
      newBalance: user.balance,
      remainingEarnings: user.earnings,
      totalWithdrawn: user.totalWithdrawn
    });

  } catch (error) {
    console.error('Cash out error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// TEMPORARY: Fix earnings for teachers (transfer shamCoins to earnings)
router.post('/fix-earnings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.userType !== 'teacher') {
      return res.status(403).json({ message: 'Only teachers can use this endpoint' });
    }

    // Transfer available shamCoins to earnings
    const transferAmount = user.shamCoins || 0;
    
    if (transferAmount <= 0) {
      return res.status(400).json({ message: 'No shamCoins available to transfer' });
    }

    // Move shamCoins to earnings
    user.shamCoins -= transferAmount;
    user.earnings = (user.earnings || 0) + transferAmount;
    
    // Record transaction
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'transfer',
      amount: transferAmount,
      date: new Date(),
      description: `Transferred ${transferAmount} ShamCoins to earnings`,
      status: 'completed'
    });

    await user.save();

    res.json({
      message: `Transferred ${transferAmount} ShamCoins to earnings`,
      transferAmount: transferAmount,
      newShamCoins: user.shamCoins,
      newEarnings: user.earnings
    });

  } catch (error) {
    console.error('Fix earnings error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
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
      shamCoins: user.shamCoins || 0
    });
  } catch (error) {
    console.error('Balance fetch error:', error);
    res.status(500).json({ message: 'Server error' });
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
    console.error('Transactions fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;