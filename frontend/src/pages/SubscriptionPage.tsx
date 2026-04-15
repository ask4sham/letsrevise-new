import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPricing } from '../api/pricing';
import { formatMoney } from '../utils/money';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { getErrorMessageFromData } from '../utils/apiErrorMessage';
import { apiUrl } from '../utils/apiBaseUrl';
import VerificationGate from '../components/auth/VerificationGate';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
}

interface UserSubscription {
  plan: string;
  subscriptionEndDate: string | null;
  nextPaymentDate: string | null;
  daysUntilExpiry: number | null;
}

type SubscriptionPricing = {
  currency: string;
  monthly: { amount: number };
  annual?: { amount: number };
};

const SubscriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useCurrentUser({ watchLocation: true });
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [pricing, setPricing] = useState<SubscriptionPricing | null>(null);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const currency = pricing?.currency || 'GBP';
  const monthlyAmount = pricing?.monthly?.amount ?? 999;
  const annualAmount = pricing?.annual?.amount ?? 8999;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      try {
        const sub = await fetchPricing();
        setPricing(sub as SubscriptionPricing);
      } catch {
        // fallback: pricing state stays null, we use defaults
      }

      const plansResponse = await fetch('/api/subscriptions/plans');
      const plansData = await plansResponse.json();
      if (plansData.success) {
        setPlans(Object.values(plansData.plans));
      }

      if (token) {
        const subResponse = await fetch('/api/subscriptions/my-subscription', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const subData = await subResponse.json();
        if (subData.success && subData.subscription) {
          const s = subData.subscription;
          setUserSubscription({
            plan: s.plan,
            subscriptionEndDate: s.subscriptionEndDate ?? null,
            nextPaymentDate: s.nextPaymentDate ?? null,
            daysUntilExpiry: s.daysUntilExpiry ?? null,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
      setMessage({ type: 'error', text: 'Failed to load subscription data' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (processing) return;

    setProcessing(true);
    setMessage(null);

    try {
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(apiUrl('/api/subscriptions/subscribe'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan: planId })
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.msg });
        fetchSubscriptionData();
      } else {
        setMessage({ type: 'error', text: getErrorMessageFromData(data, 'Failed to subscribe') });
      }
    } catch (error) {
      console.error('Subscribe error:', error);
      setMessage({ type: 'error', text: 'Failed to process subscription' });
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose access to premium features.')) {
      return;
    }

    setProcessing(true);
    setMessage(null);

    try {
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(apiUrl('/api/subscriptions/cancel'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.msg });
        fetchSubscriptionData();
      } else {
        setMessage({ type: 'error', text: getErrorMessageFromData(data, 'Failed to cancel subscription') });
      }
    } catch (error) {
      console.error('Cancel error:', error);
      setMessage({ type: 'error', text: 'Failed to cancel subscription' });
    } finally {
      setProcessing(false);
    }
  };

  const handleUpgrade = async (newPlan: string) => {
    if (processing) return;

    setProcessing(true);
    setMessage(null);

    try {
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(apiUrl('/api/subscriptions/upgrade'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPlan })
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.msg });
        fetchSubscriptionData();
      } else {
        setMessage({ type: 'error', text: data.msg || 'Failed to upgrade' });
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      setMessage({ type: 'error', text: 'Failed to upgrade subscription' });
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '80vh'
      }}>
        Loading subscription information...
      </div>
    );
  }

  return (
    <>
    <VerificationGate>
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Subscription Plans
        </h1>
        <p style={{ color: '#666' }}>
          Choose a plan for full lesson access, practice, quizzes, and the AI tutor
        </p>
      </div>

      {message && (
        <div style={{
          padding: '1rem',
          backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
          color: message.type === 'success' ? '#155724' : '#721c24',
          border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px',
          marginBottom: '1.5rem'
        }}>
          {message.text}
        </div>
      )}

      {userSubscription && userSubscription.plan !== 'free' && (
        <div style={{
          backgroundColor: '#e8f4fd',
          border: '1px solid #b6d4fe',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{ marginTop: 0, color: '#0d6efd' }}>Current Subscription</h2>
          <p style={{ marginTop: 0, marginBottom: '1rem', color: '#495057' }}>
            Full lesson access, practice, and quizzes are included with your subscription.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <strong>Plan:</strong> {userSubscription.plan.charAt(0).toUpperCase() + userSubscription.plan.slice(1)}
            </div>
            <div>
              <strong>Renewal date:</strong> {formatDate(userSubscription.nextPaymentDate)}
            </div>
            {userSubscription.daysUntilExpiry !== null && (
              <div>
                <strong>Days until renewal:</strong> {userSubscription.daysUntilExpiry} days
              </div>
            )}
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleCancel}
              disabled={processing}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {processing ? 'Processing...' : 'Cancel subscription'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        {plans.map((plan) => (
          <div
            key={plan.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '2rem',
              backgroundColor: 'white',
              boxShadow: userSubscription?.plan === plan.id ? '0 0 0 2px #1976d2' : 'none',
              position: 'relative'
            }}
          >
            {userSubscription?.plan === plan.id && (
              <div style={{
                position: 'absolute',
                top: '-10px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#1976d2',
                color: 'white',
                padding: '0.25rem 1rem',
                borderRadius: '20px',
                fontSize: '0.875rem'
              }}>
                Current Plan
              </div>
            )}

            <h2 style={{ marginTop: 0, color: '#1976d2' }}>
              {plan.name}
            </h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>
                {plan.id === 'free'
                  ? formatMoney(0, currency)
                  : plan.id === 'basic'
                    ? formatMoney(monthlyAmount, currency)
                    : plan.id === 'premium'
                      ? formatMoney(annualAmount, currency)
                      : plan.id === 'enterprise'
                        ? formatMoney(4999, currency)
                        : formatMoney(Math.round((plan.price || 0) * 100), currency)}
              </span>
              <span style={{ color: '#666' }}>
                {plan.id === 'premium' ? '/year' : '/month'}
              </span>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>What&apos;s included</h4>
              <ul style={{ paddingLeft: '1.5rem', margin: 0 }}>
                {plan.features.map((feature, index) => (
                  <li key={index} style={{ marginBottom: '0.5rem' }}>{feature}</li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => {
                if (userSubscription?.plan === plan.id) {
                  return;
                } else if (userSubscription?.plan === 'free') {
                  handleSubscribe(plan.id);
                } else {
                  handleUpgrade(plan.id);
                }
              }}
              disabled={processing || userSubscription?.plan === plan.id}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: userSubscription?.plan === plan.id ? '#6c757d' : '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: userSubscription?.plan === plan.id ? 'default' : 'pointer',
                opacity: userSubscription?.plan === plan.id ? 0.6 : 1
              }}
            >
              {processing ? 'Processing...' :
                userSubscription?.plan === plan.id ? 'Current Plan' :
                userSubscription?.plan === 'free' ? 'Subscribe' :
                'Upgrade'}
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '3rem', padding: '2rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <h2 style={{ marginTop: 0, color: '#1976d2' }}>Why subscribe?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          <div>
            <h3 style={{ color: '#198754' }}>📚 Full lesson access</h3>
            <p>Unlock the full catalogue while your subscription is active.</p>
          </div>
          <div>
            <h3 style={{ color: '#198754' }}>🤖 AI tutor included</h3>
            <p>Get help and explanations tailored to your topics.</p>
          </div>
          <div>
            <h3 style={{ color: '#198754' }}>✅ Practice and quiz access</h3>
            <p>Reinforce learning with questions and activities tied to lessons.</p>
          </div>
          <div>
            <h3 style={{ color: '#198754' }}>🎓 Priority support</h3>
            <p>Faster responses when you need help with your account or learning.</p>
          </div>
        </div>
      </div>

      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '4px',
        color: '#856404'
      }}>
        <strong>Free plan:</strong> You can continue with access to free previews and basic features.
        Subscribe or upgrade anytime for full lesson access and the benefits above.
      </div>
      </div>
    </VerificationGate>
    </>
  );
};

export default SubscriptionPage;
