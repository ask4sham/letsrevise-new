const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const { sendInternalError } = require('../utils/safeErrorResponse');
const { isStripeCheckoutConfigured, StripeBillingError } = require('../config/stripe');
const { createLetsReviseProCheckoutForUser } = require('../services/stripeCheckoutService');
const { createLetsReviseProPortalSession } = require('../services/stripePortalService');
const { findForbiddenClientBillingKeys } = require('../utils/rejectClientBillingInput');
const { findForbiddenPortalClientBillingKeys } = require('../utils/rejectPortalClientBillingInput');
const { hasStripeLetsReviseProAccess } = require('../utils/stripeBillingAccess');

function respondStripeBillingError(res, err) {
  if (err instanceof StripeBillingError) {
    return res.status(503).json({
      success: false,
      code: err.code,
      msg: err.userMessage,
    });
  }
  return null;
}

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
        features: [
          'Free previews where available',
          'Basic progress tracking',
          'Community support'
        ]
      },
      basic: {
        id: 'basic',
        name: 'Basic',
        price: 9.99,
        features: [
          'Full access to core lessons',
          'Practice and quiz access',
          'AI tutor included',
          'Enhanced progress tracking',
          'Priority support'
        ]
      },
      premium: {
        id: 'premium',
        name: 'Premium',
        price: 19.99,
        features: [
          'Full lesson access across the catalogue',
          'Practice and quiz access',
          'AI tutor included',
          'Advanced analytics',
          'Early access to new features',
          'Dedicated support'
        ]
      },
      enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 49.99,
        features: [
          'Everything in Premium',
          'Custom lesson creation',
          'API access',
          'White-label solution',
          '24/7 dedicated support'
        ]
      }
    };

    res.json({ success: true, plans });
  } catch (err) {
    return sendInternalError('subscriptions/plans', err, res);
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

    // Update user subscription
    user.subscription = plan;
    user.subscriptionEndDate = subscriptionEndDate;

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
        nextPaymentDate: user.subscriptionEndDate
      }
    });

  } catch (err) {
    return sendInternalError('subscriptions/subscribe', err, res);
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
        subscriptionEndDate: user.subscriptionEndDate
      }
    });

  } catch (err) {
    return sendInternalError('subscriptions/cancel', err, res);
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
        nextPaymentDate: user.subscriptionEndDate
      }
    });

  } catch (err) {
    return sendInternalError('subscriptions/upgrade', err, res);
  }
});

// @route   POST api/subscriptions/renew-shamcoins
// @desc    Retired: was monthly sham coin renewal; subscription is access-based for students now.
// @access  Private
router.post('/renew-shamcoins', auth, (req, res) => {
  return res.status(410).json({
    success: false,
    code: 'RENEW_SHAMCOINS_DEPRECATED',
    msg: 'Monthly coin renewal is no longer available. Your subscription includes full lesson access without a separate renewal step.',
  });
});

// @route   POST api/subscriptions/create-checkout-session
// @desc    Create Stripe Checkout Session for LetsRevise Pro (server-owned price; test mode B2)
// @access  Private
router.post('/create-checkout-session', auth, async (req, res) => {
  try {
    const forbiddenKeys = findForbiddenClientBillingKeys(req.body);
    if (forbiddenKeys.length > 0) {
      return res.status(400).json({
        success: false,
        code: 'CLIENT_BILLING_INPUT_NOT_ALLOWED',
        msg: 'Billing inputs are server-owned',
        rejectedKeys: forbiddenKeys,
      });
    }

    if (!isStripeCheckoutConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'STRIPE_NOT_CONFIGURED',
        msg: 'Stripe Checkout is not configured on this server',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (hasStripeLetsReviseProAccess(user)) {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_SUBSCRIBED',
        msg: 'LetsRevise Pro is already active on this account',
      });
    }

    const session = await createLetsReviseProCheckoutForUser(user);

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
      planId: 'letsrevise_pro',
    });
  } catch (err) {
    const billingResponse = respondStripeBillingError(res, err);
    if (billingResponse) return billingResponse;
    return sendInternalError('subscriptions/create-checkout-session', err, res);
  }
});

// @route   POST api/subscriptions/create-portal-session
// @desc    Create Stripe Customer Portal session for LetsRevise Pro billing management (B5)
// @access  Private
router.post('/create-portal-session', auth, async (req, res) => {
  try {
    const forbiddenKeys = findForbiddenPortalClientBillingKeys(req.body);
    if (forbiddenKeys.length > 0) {
      return res.status(400).json({
        success: false,
        code: 'CLIENT_BILLING_INPUT_NOT_ALLOWED',
        msg: 'Billing inputs are server-owned',
        rejectedKeys: forbiddenKeys,
      });
    }

    if (!isStripeCheckoutConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'STRIPE_NOT_CONFIGURED',
        msg: 'Stripe billing is not configured on this server',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const customerId = user.stripeBilling?.customerId;
    if (!customerId) {
      return res.status(403).json({
        success: false,
        code: 'NO_STRIPE_CUSTOMER',
        msg: 'No Stripe billing account is linked to this user',
      });
    }

    const session = await createLetsReviseProPortalSession(customerId);

    res.json({
      success: true,
      url: session.url,
    });
  } catch (err) {
    const billingResponse = respondStripeBillingError(res, err);
    if (billingResponse) return billingResponse;
    return sendInternalError('subscriptions/create-portal-session', err, res);
  }
});

module.exports = router;
