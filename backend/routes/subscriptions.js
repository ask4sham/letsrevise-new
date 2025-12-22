const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Mock Stripe for now - we'll integrate real Stripe later
const stripe = {
  checkout: {
    sessions: {
      create: async (sessionData) => {
        // Mock implementation
        return {
          id: 'mock_session_' + Date.now(),
          url: 'https://checkout.stripe.com/mock',
          ...sessionData
        };
      }
    }
  }
};

// @route   GET api/subscriptions/plans
// @desc    Get available subscription plans
// @access  Public
router.get('/plans', async (req, res) => {
  try {
    const plans = {
      free: {
        id: 'free',
        name: 'Free',
        price: 0,
        shamCoinsPerMonth: 0,
        features: [
          'Access to free lessons only',
          'Basic progress tracking',
          'Community support'
        ]
      },
      basic: {
        id: 'basic',
        name: 'Basic',
        price: 9.99,
        shamCoinsPerMonth: 100,
        features: [
          'Access to all basic lessons',
          'Enhanced progress tracking',
          '100 ShamCoins monthly',
          'Priority support'
        ]
      },
      premium: {
        id: 'premium',
        name: 'Premium',
        price: 19.99,
        shamCoinsPerMonth: 250,
        features: [
          'Access to all lessons',
          'Advanced analytics',
          '250 ShamCoins monthly',
          'Early access to new features',
          'Dedicated support'
        ]
      },
      enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 49.99,
        shamCoinsPerMonth: 1000,
        features: [
          'Everything in Premium',
          '1000 ShamCoins monthly',
          'Custom lesson creation',
          'API access',
          'White-label solution',
          '24/7 dedicated support'
        ]
      }
    };

    res.json({ success: true, plans });
  } catch (err) {
    console.error('Get plans error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   GET api/subscriptions/my-subscription
// @desc    Get current user's subscription info
// @access  Private
router.get('/my-subscription', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const subscriptionInfo = {
      plan: user.subscription || 'free',
      subscriptionEndDate: user.subscriptionEndDate,
      monthlyShamCoinAllowance: user.monthlyShamCoinAllowance || 0,
      shamCoinsEarnedThisMonth: user.shamCoinsEarnedThisMonth || 0,
      shamCoinsRemaining: user.monthlyShamCoinAllowance - user.shamCoinsEarnedThisMonth,
      nextPaymentDate: user.subscriptionEndDate || null,
      daysUntilExpiry: user.subscriptionEndDate ? 
        Math.ceil((new Date(user.subscriptionEndDate) - new Date()) / (1000 * 60 * 60 * 24)) : null
    };

    res.json({ success: true, subscription: subscriptionInfo });
  } catch (err) {
    console.error('Get subscription error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   POST api/subscriptions/subscribe
// @desc    Subscribe to a plan
// @access  Private
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    
    if (!plan || !['basic', 'premium', 'enterprise'].includes(plan)) {
      return res.status(400).json({ msg: 'Valid plan is required (basic, premium, enterprise)' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Calculate subscription end date (30 days from now)
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30);

    // Get sham coin allowance based on plan
    const shamCoinAllowance = {
      basic: 100,
      premium: 250,
      enterprise: 1000
    }[plan];

    // Update user subscription
    user.subscription = plan;
    user.subscriptionEndDate = subscriptionEndDate;
    user.monthlyShamCoinAllowance = shamCoinAllowance;
    user.shamCoinsEarnedThisMonth = 0;

    // Add transaction record
    user.transactions.push({
      type: 'subscription',
      amount: 0, // Will be actual amount when real payment is integrated
      description: `Subscribed to ${plan} plan`,
      status: 'completed'
    });

    await user.save();

    res.json({
      success: true,
      msg: `Successfully subscribed to ${plan} plan`,
      subscription: {
        plan: user.subscription,
        subscriptionEndDate: user.subscriptionEndDate,
        monthlyShamCoinAllowance: user.monthlyShamCoinAllowance,
        nextPaymentDate: user.subscriptionEndDate
      }
    });

  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   POST api/subscriptions/cancel
// @desc    Cancel subscription
// @access  Private
router.post('/cancel', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (user.subscription === 'free') {
      return res.status(400).json({ msg: 'No active subscription to cancel' });
    }

    const oldPlan = user.subscription;
    
    // Downgrade to free plan
    user.subscription = 'free';
    user.subscriptionEndDate = null;
    user.monthlyShamCoinAllowance = 0;

    // Add transaction record
    user.transactions.push({
      type: 'subscription',
      amount: 0,
      description: `Cancelled ${oldPlan} subscription`,
      status: 'completed'
    });

    await user.save();

    res.json({
      success: true,
      msg: 'Subscription cancelled successfully',
      subscription: {
        plan: user.subscription,
        subscriptionEndDate: user.subscriptionEndDate,
        monthlyShamCoinAllowance: user.monthlyShamCoinAllowance
      }
    });

  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   POST api/subscriptions/upgrade
// @desc    Upgrade subscription plan
// @access  Private
router.post('/upgrade', auth, async (req, res) => {
  try {
    const { newPlan } = req.body;
    
    if (!newPlan || !['basic', 'premium', 'enterprise'].includes(newPlan)) {
      return res.status(400).json({ msg: 'Valid new plan is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const oldPlan = user.subscription;
    
    // Update to new plan
    user.subscription = newPlan;
    
    // Extend subscription by 30 days or set to 30 days from now
    if (user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date()) {
      // Extend existing subscription
      user.subscriptionEndDate.setDate(user.subscriptionEndDate.getDate() + 30);
    } else {
      // Start new subscription
      user.subscriptionEndDate = new Date();
      user.subscriptionEndDate.setDate(user.subscriptionEndDate.getDate() + 30);
    }

    // Update sham coin allowance
    const shamCoinAllowance = {
      basic: 100,
      premium: 250,
      enterprise: 1000
    }[newPlan];
    
    user.monthlyShamCoinAllowance = shamCoinAllowance;

    // Add transaction record
    user.transactions.push({
      type: 'subscription',
      amount: 0, // Will be actual amount when real payment is integrated
      description: `Upgraded from ${oldPlan} to ${newPlan} plan`,
      status: 'completed'
    });

    await user.save();

    res.json({
      success: true,
      msg: `Successfully upgraded to ${newPlan} plan`,
      subscription: {
        plan: user.subscription,
        subscriptionEndDate: user.subscriptionEndDate,
        monthlyShamCoinAllowance: user.monthlyShamCoinAllowance,
        nextPaymentDate: user.subscriptionEndDate
      }
    });

  } catch (err) {
    console.error('Upgrade subscription error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   POST api/subscriptions/renew-shamcoins
// @desc    Renew monthly sham coin allowance
// @access  Private
router.post('/renew-shamcoins', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (user.subscription === 'free') {
      return res.status(400).json({ msg: 'Free plan does not include monthly sham coins' });
    }

    // Check if it's time to renew (first day of month or subscription renewal)
    const today = new Date();
    const lastRenewal = user.transactions
      .filter(t => t.type === 'shamcoin_renewal')
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (lastRenewal) {
      const lastRenewalDate = new Date(lastRenewal.date);
      const daysSinceRenewal = Math.floor((today - lastRenewalDate) / (1000 * 60 * 60 * 24));
      
      if (daysSinceRenewal < 30) {
        return res.status(400).json({ 
          msg: `Sham coins renewed ${daysSinceRenewal} days ago. Next renewal in ${30 - daysSinceRenewal} days.`
        });
      }
    }

    // Add sham coins
    const allowance = user.monthlyShamCoinAllowance || 0;
    user.shamCoins += allowance;
    user.shamCoinsEarnedThisMonth = 0;

    // Add transaction record
    user.transactions.push({
      type: 'shamcoin_renewal',
      amount: allowance,
      description: `Monthly sham coin renewal for ${user.subscription} plan`,
      status: 'completed'
    });

    await user.save();

    res.json({
      success: true,
      msg: `Successfully renewed ${allowance} sham coins`,
      shamCoins: user.shamCoins,
      nextRenewalDate: new Date(today.setDate(today.getDate() + 30))
    });

  } catch (err) {
    console.error('Renew sham coins error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   POST api/subscriptions/create-checkout-session
// @desc    Create checkout session (mock for now)
// @access  Private
router.post('/create-checkout-session', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    
    if (!plan || !['basic', 'premium', 'enterprise'].includes(plan)) {
      return res.status(400).json({ msg: 'Valid plan is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Create mock checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
              description: `Monthly subscription to ${plan} plan`
            },
            unit_amount: {
              basic: 999,
              premium: 1999,
              enterprise: 4999
            }[plan],
            recurring: {
              interval: 'month'
            }
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription/cancel`,
      customer_email: user.email,
      metadata: {
        userId: user._id.toString(),
        plan: plan
      }
    });

    res.json({ 
      success: true, 
      sessionId: session.id, 
      url: session.url,
      message: 'Mock checkout session created. In production, this would redirect to Stripe.'
    });
  } catch (err) {
    console.error('Create checkout session error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;