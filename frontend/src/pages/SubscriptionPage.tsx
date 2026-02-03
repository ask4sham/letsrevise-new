import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  shamCoinsPerMonth: number;
  features: string[];
}

interface UserSubscription {
  plan: string;
  subscriptionEndDate: string | null;
  monthlyShamCoinAllowance: number;
  shamCoinsEarnedThisMonth: number;
  shamCoinsRemaining: number;
  nextPaymentDate: string | null;
  daysUntilExpiry: number | null;
}

const SubscriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      // Fetch plans
      const plansResponse = await fetch('http://localhost:5000/api/subscriptions/plans');
      const plansData = await plansResponse.json();
      if (plansData.success) {
        setPlans(Object.values(plansData.plans));
      }

      // Fetch user subscription
      const token = localStorage.getItem('token');
      if (token) {
        const subResponse = await fetch('http://localhost:5000/api/subscriptions/my-subscription', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const subData = await subResponse.json();
        if (subData.success) {
          setUserSubscription(subData.subscription);
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
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('http://localhost:5000/api/subscriptions/subscribe', {
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
        // Refresh subscription data
        fetchSubscriptionData();
      } else {
        setMessage({ type: 'error', text: data.msg || 'Failed to subscribe' });
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
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('http://localhost:5000/api/subscriptions/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: data.msg });
        // Refresh subscription data
        fetchSubscriptionData();
      } else {
        setMessage({ type: 'error', text: data.msg || 'Failed to cancel subscription' });
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
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('http://localhost:5000/api/subscriptions/upgrade', {
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
        // Refresh subscription data
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

  const handleRenewShamCoins = async () => {
    if (processing) return;
    
    setProcessing(true);
    setMessage(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('http://localhost:5000/api/subscriptions/renew-shamcoins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: data.msg });
        // Refresh subscription data
        fetchSubscriptionData();
      } else {
        setMessage({ type: 'error', text: data.msg || 'Failed to renew sham coins' });
      }
    } catch (error) {
      console.error('Renew error:', error);
      setMessage({ type: 'error', text: 'Failed to renew sham coins' });
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
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Subscription Plans
        </h1>
        <p style={{ color: '#666' }}>
          Choose a plan that fits your learning needs
        </p>
      </div>

      {/* Message Display */}
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

      {/* Current Subscription Info */}
      {userSubscription && userSubscription.plan !== 'free' && (
        <div style={{
          backgroundColor: '#e8f4fd',
          border: '1px solid #b6d4fe',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{ marginTop: 0, color: '#0d6efd' }}>Current Subscription</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <strong>Plan:</strong> {userSubscription.plan.charAt(0).toUpperCase() + userSubscription.plan.slice(1)}
            </div>
            <div>
              <strong>Monthly Allowance:</strong> {userSubscription.monthlyShamCoinAllowance} ShamCoins
            </div>
            <div>
              <strong>Used This Month:</strong> {userSubscription.shamCoinsEarnedThisMonth} ShamCoins
            </div>
            <div>
              <strong>Remaining:</strong> {userSubscription.shamCoinsRemaining} ShamCoins
            </div>
            <div>
              <strong>Renewal Date:</strong> {formatDate(userSubscription.nextPaymentDate)}
            </div>
            {userSubscription.daysUntilExpiry !== null && (
              <div>
                <strong>Days Until Expiry:</strong> {userSubscription.daysUntilExpiry} days
              </div>
            )}
          </div>
          
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleRenewShamCoins}
              disabled={processing || userSubscription.shamCoinsRemaining > 0}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: userSubscription.shamCoinsRemaining > 0 ? '#6c757d' : '#198754',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: userSubscription.shamCoinsRemaining > 0 ? 'not-allowed' : 'pointer',
                opacity: userSubscription.shamCoinsRemaining > 0 ? 0.6 : 1
              }}
            >
              {processing ? 'Processing...' : 'Renew ShamCoins Now'}
            </button>
            
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
              {processing ? 'Processing...' : 'Cancel Subscription'}
            </button>
          </div>
        </div>
      )}

      {/* Subscription Plans */}
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
                ${plan.price}
              </span>
              <span style={{ color: '#666' }}>/month</span>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', marginRight: '0.5rem' }}>
                  {plan.shamCoinsPerMonth}
                </span>
                <span>ShamCoins/month</span>
              </div>
            </div>
            
            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>Features:</h4>
              <ul style={{ paddingLeft: '1.5rem', margin: 0 }}>
                {plan.features.map((feature, index) => (
                  <li key={index} style={{ marginBottom: '0.5rem' }}>{feature}</li>
                ))}
              </ul>
            </div>
            
            <button
              onClick={() => {
                if (userSubscription?.plan === plan.id) {
                  // Already subscribed to this plan
                  return;
                } else if (userSubscription?.plan === 'free') {
                  // New subscription
                  handleSubscribe(plan.id);
                } else {
                  // Upgrade
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
                userSubscription?.plan === 'free' ? 'Subscribe Now' :
                'Upgrade Plan'}
            </button>
          </div>
        ))}
      </div>

      {/* Subscription Benefits */}
      <div style={{ marginTop: '3rem', padding: '2rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <h2 style={{ marginTop: 0, color: '#1976d2' }}>Why Subscribe?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          <div>
            <h3 style={{ color: '#198754' }}>💰 ShamCoin Allowance</h3>
            <p>Get monthly ShamCoins to purchase premium lessons without additional costs.</p>
          </div>
          <div>
            <h3 style={{ color: '#198754' }}>📚 Unlimited Access</h3>
            <p>Access all premium content and features across the platform.</p>
          </div>
          <div>
            <h3 style={{ color: '#198754' }}>📈 Progress Tracking</h3>
            <p>Advanced analytics and detailed progress reports for your learning journey.</p>
          </div>
          <div>
            <h3 style={{ color: '#198754' }}>🎓 Priority Support</h3>
            <p>Get faster responses and dedicated support for your learning needs.</p>
          </div>
        </div>
      </div>

      {/* Free Plan Notice */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '4px',
        color: '#856404'
      }}>
        <strong>Free Plan Users:</strong> You can continue using the free plan with access to free lessons and basic features. 
        Upgrade anytime to unlock premium content and features.
      </div>
    </div>
  );
};

export default SubscriptionPage;