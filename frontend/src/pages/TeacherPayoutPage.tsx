import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface PayoutBalance {
  totalEarnings: number;
  totalWithdrawn: number;
  availableBalance: number;
  pendingPayouts: number;
  nextPayoutDate: string;
  minimumPayout: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  processingTime: string;
  fees: string;
  minimumAmount: number;
  icon: string;
  supportedCoins?: string[];
}

interface PayoutHistoryItem {
  id: string;
  type: string;
  amount: number;
  date: string;
  status: string;
  description: string;
  reference: string;
}

interface PayoutStats {
  totalPayouts: number;
  totalAmount: number;
  pendingPayouts: number;
  completedPayouts: number;
}

const TeacherPayoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<PayoutBalance | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<PayoutHistoryItem[]>([]);
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchPayoutData();
  }, []);

  const fetchPayoutData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Fetch balance
      const balanceResponse = await fetch('http://localhost:5000/api/payouts/balance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const balanceData = await balanceResponse.json();
      if (balanceData.success) {
        setBalance(balanceData.balance);
      }

      // Fetch payment methods
      const methodsResponse = await fetch('http://localhost:5000/api/payouts/payment-methods', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const methodsData = await methodsResponse.json();
      if (methodsData.success) {
        setPaymentMethods(methodsData.paymentMethods);
        if (methodsData.paymentMethods.length > 0) {
          setSelectedMethod(methodsData.paymentMethods[0].id);
        }
      }

      // Fetch payout history
      const historyResponse = await fetch('http://localhost:5000/api/payouts/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const historyData = await historyResponse.json();
      if (historyData.success) {
        setPayoutHistory(historyData.history);
        setStats(historyData.stats);
      }

    } catch (error) {
      console.error('Error fetching payout data:', error);
      setMessage({ type: 'error', text: 'Failed to load payout data' });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!payoutAmount || !selectedMethod || requestingPayout) return;

    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid amount' });
      return;
    }

    if (balance && amount < balance.minimumPayout) {
      setMessage({ type: 'error', text: `Minimum payout amount is ${balance.minimumPayout} ShamCoins` });
      return;
    }

    if (balance && amount > balance.availableBalance) {
      setMessage({ type: 'error', text: 'Insufficient balance' });
      return;
    }

    setRequestingPayout(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/payouts/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: amount,
          paymentMethod: selectedMethod
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: data.msg });
        setShowPayoutForm(false);
        setPayoutAmount('');
        // Refresh data
        fetchPayoutData();
      } else {
        setMessage({ type: 'error', text: data.msg || 'Failed to request payout' });
      }
    } catch (error) {
      console.error('Request payout error:', error);
      setMessage({ type: 'error', text: 'Failed to process payout request' });
    } finally {
      setRequestingPayout(false);
    }
  };

  const handleCancelPayout = async (payoutId: string) => {
    if (!window.confirm('Are you sure you want to cancel this payout request?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/payouts/cancel/${payoutId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: data.msg });
        // Refresh data
        fetchPayoutData();
      } else {
        setMessage({ type: 'error', text: data.msg || 'Failed to cancel payout' });
      }
    } catch (error) {
      console.error('Cancel payout error:', error);
      setMessage({ type: 'error', text: 'Failed to cancel payout' });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US') + ' SC';
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '80vh' 
      }}>
        Loading payout information...
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Teacher Payouts
        </h1>
        <p style={{ color: '#666' }}>
          Manage your earnings and withdraw funds
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

      {/* Balance Summary */}
      {balance && (
        <div style={{
          backgroundColor: '#e8f4fd',
          border: '1px solid #b6d4fe',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{ marginTop: 0, color: '#0d6efd' }}>Earnings Summary</h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#198754' }}>
                {formatCurrency(balance.totalEarnings)}
              </div>
              <div style={{ color: '#666' }}>Total Earnings</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc3545' }}>
                {formatCurrency(balance.totalWithdrawn)}
              </div>
              <div style={{ color: '#666' }}>Total Withdrawn</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0d6efd' }}>
                {formatCurrency(balance.availableBalance)}
              </div>
              <div style={{ color: '#666' }}>Available Balance</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffc107' }}>
                {formatCurrency(balance.pendingPayouts)}
              </div>
              <div style={{ color: '#666' }}>Pending Payouts</div>
            </div>
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <div><strong>Next Payout Date:</strong> {formatDate(balance.nextPayoutDate)}</div>
              <div><strong>Minimum Withdrawal:</strong> {formatCurrency(balance.minimumPayout)}</div>
            </div>
            
            <button
              onClick={() => setShowPayoutForm(true)}
              disabled={balance.availableBalance < balance.minimumPayout}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: balance.availableBalance >= balance.minimumPayout ? '#198754' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: balance.availableBalance >= balance.minimumPayout ? 'pointer' : 'not-allowed'
              }}
            >
              Request Payout
            </button>
          </div>
        </div>
      )}

      {/* Payout Form */}
      {showPayoutForm && (
        <div style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem',
          backgroundColor: 'white'
        }}>
          <h3 style={{ marginTop: 0 }}>Request Payout</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Amount (ShamCoins)
            </label>
            <input
              type="number"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              min={balance?.minimumPayout || 1000}
              max={balance?.availableBalance || 0}
              placeholder={`Minimum: ${balance?.minimumPayout || 1000} SC`}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
            {balance && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                Available: {formatCurrency(balance.availableBalance)} | 
                Min: {formatCurrency(balance.minimumPayout)}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Payment Method
            </label>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  style={{
                    flex: '1',
                    minWidth: '200px',
                    padding: '1rem',
                    border: `2px solid ${selectedMethod === method.id ? '#1976d2' : '#ddd'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: selectedMethod === method.id ? '#f0f8ff' : 'white'
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                    {method.icon} {method.name}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                    {method.description}
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>
                    <strong>Fees:</strong> {method.fees} | 
                    <strong> Time:</strong> {method.processingTime}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowPayoutForm(false)}
              disabled={requestingPayout}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleRequestPayout}
              disabled={requestingPayout || !payoutAmount || !selectedMethod}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#198754',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: requestingPayout ? 'not-allowed' : 'pointer'
              }}
            >
              {requestingPayout ? 'Processing...' : 'Submit Request'}
            </button>
          </div>
        </div>
      )}

      {/* Payout History */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h2 style={{ margin: 0 }}>Payout History</h2>
          {stats && (
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold' }}>{stats.totalPayouts}</div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>Total</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', color: '#ffc107' }}>{stats.pendingPayouts}</div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>Pending</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', color: '#198754' }}>{stats.completedPayouts}</div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>Completed</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold' }}>{formatCurrency(stats.totalAmount)}</div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>Total Amount</div>
              </div>
            </div>
          )}
        </div>

        {payoutHistory.length > 0 ? (
          <div style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr 0.5fr',
              backgroundColor: '#f8f9fa',
              padding: '1rem',
              borderBottom: '1px solid #ddd',
              fontWeight: 'bold'
            }}>
              <div>Date</div>
              <div>Type</div>
              <div>Amount</div>
              <div>Status</div>
              <div>Action</div>
            </div>
            
            {payoutHistory.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr 0.5fr',
                  padding: '1rem',
                  borderBottom: '1px solid #ddd',
                  alignItems: 'center'
                }}
              >
                <div>{formatDate(item.date)}</div>
                <div>{item.description}</div>
                <div style={{ fontWeight: 'bold' }}>{formatCurrency(item.amount)}</div>
                <div>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.875rem',
                    backgroundColor: 
                      item.status === 'completed' ? '#d4edda' :
                      item.status === 'pending' ? '#fff3cd' :
                      item.status === 'cancelled' ? '#f8d7da' : '#e2e3e5',
                    color: 
                      item.status === 'completed' ? '#155724' :
                      item.status === 'pending' ? '#856404' :
                      item.status === 'cancelled' ? '#721c24' : '#383d41'
                  }}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </span>
                </div>
                <div>
                  {item.status === 'pending' && (
                    <button
                      onClick={() => handleCancelPayout(item.id)}
                      style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            color: '#666'
          }}>
            No payout history yet. Request your first payout when you have sufficient earnings.
          </div>
        )}
      </div>

      {/* Important Information */}
      <div style={{
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '8px',
        padding: '1.5rem',
        marginTop: '2rem'
      }}>
        <h3 style={{ marginTop: 0, color: '#856404' }}>Important Information</h3>
        <ul style={{ marginBottom: 0, paddingLeft: '1.5rem' }}>
          <li>Minimum withdrawal amount is 1000 ShamCoins</li>
          <li>Payouts are processed within 3-5 business days</li>
          <li>Transaction fees apply depending on the payment method</li>
          <li>You can cancel pending payout requests at any time</li>
          <li>Contact support for any issues with your payouts</li>
        </ul>
      </div>
    </div>
  );
};

export default TeacherPayoutPage;