const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Lesson = require('../models/Lesson');
const auth = require('../middleware/auth');

// @route   GET api/payouts/balance
// @desc    Get teacher's earnings and payout balance
// @access  Private (Teachers only)
router.get('/balance', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ msg: 'Only teachers can access payout information' });
    }

    const teacher = await User.findById(req.user._id);
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Calculate total earnings from lesson sales
    const lessons = await Lesson.find({ teacherId: req.user._id });
    const totalEarnings = lessons.reduce((sum, lesson) => {
      // Teacher gets 70% of each lesson sale
      return sum + (lesson.purchases || 0) * lesson.shamCoinPrice * 0.7;
    }, 0);

    // Update teacher's earnings if different
    if (teacher.earnings !== totalEarnings) {
      teacher.earnings = totalEarnings;
      await teacher.save();
    }

    // Calculate available balance (earnings minus already withdrawn)
    const availableBalance = teacher.earnings - teacher.totalWithdrawn;

    res.json({
      success: true,
      balance: {
        totalEarnings: teacher.earnings,
        totalWithdrawn: teacher.totalWithdrawn,
        availableBalance: availableBalance,
        pendingPayouts: 0, // Will implement pending payouts later
        nextPayoutDate: new Date(new Date().setDate(new Date().getDate() + 7)), // Weekly payouts
        minimumPayout: 1000 // Minimum 1000 ShamCoins to withdraw
      },
      earningsBreakdown: lessons.map(lesson => ({
        lessonId: lesson._id,
        title: lesson.title,
        purchases: lesson.purchases || 0,
        price: lesson.shamCoinPrice,
        earnings: (lesson.purchases || 0) * lesson.shamCoinPrice * 0.7
      }))
    });

  } catch (err) {
    console.error('Get balance error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   POST api/payouts/request
// @desc    Request a payout
// @access  Private (Teachers only)
router.post('/request', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ msg: 'Only teachers can request payouts' });
    }

    const { amount, paymentMethod } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ msg: 'Valid amount is required' });
    }

    if (!paymentMethod || !['paypal', 'bank_transfer', 'crypto'].includes(paymentMethod)) {
      return res.status(400).json({ msg: 'Valid payment method is required (paypal, bank_transfer, crypto)' });
    }

    const teacher = await User.findById(req.user._id);
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Calculate available balance
    const availableBalance = teacher.earnings - teacher.totalWithdrawn;
    
    // Check minimum payout amount
    if (amount < 1000) {
      return res.status(400).json({ msg: 'Minimum payout amount is 1000 ShamCoins' });
    }

    // Check if teacher has sufficient balance
    if (amount > availableBalance) {
      return res.status(400).json({ 
        msg: 'Insufficient balance', 
        availableBalance,
        requestedAmount: amount 
      });
    }

    // Create payout request
    const payoutRequest = {
      amount: amount,
      paymentMethod: paymentMethod,
      status: 'pending',
      requestedAt: new Date(),
      estimatedProcessingDays: 3
    };

    // Add to transactions
    teacher.transactions.push({
      type: 'payout_request',
      amount: -amount, // Negative amount for withdrawal
      description: `Payout request via ${paymentMethod}`,
      status: 'pending',
      reference: `PAYOUT-${Date.now()}`
    });

    // Update teacher's withdrawn amount (but don't deduct from earnings yet until approved)
    teacher.totalWithdrawn += amount;

    await teacher.save();

    res.json({
      success: true,
      msg: 'Payout request submitted successfully',
      payout: {
        id: teacher.transactions[teacher.transactions.length - 1]._id,
        amount: amount,
        paymentMethod: paymentMethod,
        status: 'pending',
        requestedAt: payoutRequest.requestedAt,
        estimatedProcessingDate: new Date(new Date().setDate(new Date().getDate() + 3)),
        transactionId: `PAYOUT-${Date.now()}`
      },
      balance: {
        totalEarnings: teacher.earnings,
        totalWithdrawn: teacher.totalWithdrawn,
        availableBalance: teacher.earnings - teacher.totalWithdrawn
      }
    });

  } catch (err) {
    console.error('Request payout error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   GET api/payouts/history
// @desc    Get payout history
// @access  Private (Teachers only)
router.get('/history', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ msg: 'Only teachers can view payout history' });
    }

    const teacher = await User.findById(req.user._id);
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Filter payout transactions
    const payoutHistory = teacher.transactions
      .filter(transaction => 
        transaction.type === 'payout_request' || 
        transaction.type === 'withdrawal' ||
        transaction.type === 'cashout'
      )
      .map(transaction => ({
        id: transaction._id,
        type: transaction.type,
        amount: Math.abs(transaction.amount),
        date: transaction.date,
        status: transaction.status,
        description: transaction.description,
        reference: transaction.reference
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // Most recent first

    res.json({
      success: true,
      history: payoutHistory,
      stats: {
        totalPayouts: payoutHistory.length,
        totalAmount: payoutHistory.reduce((sum, payout) => sum + payout.amount, 0),
        pendingPayouts: payoutHistory.filter(p => p.status === 'pending').length,
        completedPayouts: payoutHistory.filter(p => p.status === 'completed').length
      }
    });

  } catch (err) {
    console.error('Get payout history error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   POST api/payouts/cancel/:payoutId
// @desc    Cancel a pending payout request
// @access  Private (Teachers only)
router.post('/cancel/:payoutId', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ msg: 'Only teachers can cancel payouts' });
    }

    const { payoutId } = req.params;
    const teacher = await User.findById(req.user._id);
    
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Find the payout transaction
    const payoutIndex = teacher.transactions.findIndex(
      t => t._id.toString() === payoutId && 
           (t.type === 'payout_request' || t.type === 'withdrawal') &&
           t.status === 'pending'
    );

    if (payoutIndex === -1) {
      return res.status(404).json({ msg: 'Pending payout request not found' });
    }

    const payout = teacher.transactions[payoutIndex];
    
    // Update the transaction status
    payout.status = 'cancelled';
    
    // Refund the amount to withdrawn total
    teacher.totalWithdrawn -= Math.abs(payout.amount);

    await teacher.save();

    res.json({
      success: true,
      msg: 'Payout request cancelled successfully',
      cancelledPayout: {
        id: payout._id,
        amount: Math.abs(payout.amount),
        status: payout.status
      },
      balance: {
        totalEarnings: teacher.earnings,
        totalWithdrawn: teacher.totalWithdrawn,
        availableBalance: teacher.earnings - teacher.totalWithdrawn
      }
    });

  } catch (err) {
    console.error('Cancel payout error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   GET api/payouts/payment-methods
// @desc    Get available payment methods
// @access  Private (Teachers only)
router.get('/payment-methods', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ msg: 'Only teachers can view payment methods' });
    }

    const paymentMethods = [
      {
        id: 'paypal',
        name: 'PayPal',
        description: 'Fast and secure PayPal transfers',
        processingTime: '1-2 business days',
        fees: '2.9% + $0.30 per transaction',
        minimumAmount: 1000,
        icon: '💳'
      },
      {
        id: 'bank_transfer',
        name: 'Bank Transfer',
        description: 'Direct bank transfer (wire transfer)',
        processingTime: '3-5 business days',
        fees: '1.5% per transaction',
        minimumAmount: 1000,
        icon: '🏦'
      },
      {
        id: 'crypto',
        name: 'Cryptocurrency',
        description: 'Receive payments in cryptocurrency',
        processingTime: 'Instant',
        fees: '1% per transaction',
        minimumAmount: 1000,
        icon: '₿',
        supportedCoins: ['Bitcoin', 'Ethereum', 'USDC']
      }
    ];

    res.json({ success: true, paymentMethods });

  } catch (err) {
    console.error('Get payment methods error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   GET api/payouts/withdrawal-limit
// @desc    Get withdrawal limits and rules
// @access  Private (Teachers only)
router.get('/withdrawal-limit', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ msg: 'Only teachers can view withdrawal limits' });
    }

    const limits = {
      minimumWithdrawal: 1000,
      maximumWithdrawal: 50000,
      dailyLimit: 10000,
      monthlyLimit: 100000,
      processingFee: {
        paypal: '2.9% + $0.30',
        bank_transfer: '1.5%',
        crypto: '1%'
      },
      processingTime: {
        paypal: '1-2 business days',
        bank_transfer: '3-5 business days',
        crypto: 'Instant'
      },
      verificationRequired: true,
      taxFormRequired: {
        threshold: 60000,
        form: 'W-9 for US residents, W-8BEN for non-residents'
      }
    };

    res.json({ success: true, limits });

  } catch (err) {
    console.error('Get withdrawal limit error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;