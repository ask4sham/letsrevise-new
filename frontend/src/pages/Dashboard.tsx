import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { getAxiosErrorMessage } from '../utils/apiErrorMessage';
import { apiUrl } from '../utils/apiBaseUrl';
import { clearAuth, updateUser } from '../utils/authStorage';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { token, refresh } = useCurrentUser({ watchLocation: true });
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchUserProfile();
  }, [navigate, token]);

  const fetchUserProfile = async () => {
    if (!token) return;
    try {
      const response = await axios.get(apiUrl('/api/users/profile'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const profile = response.data;

      // Phase D fallback: ensure entitlements is present if backend has not wired it yet
      if (!profile.entitlements) {
        const expiresAt = profile?.subscriptionV2?.expiresAt ?? null;
        const plan = profile?.subscriptionV2?.plan;
        const hasActiveSub = expiresAt ? new Date(expiresAt).getTime() > Date.now() : false;
        const isTrial = plan === "trial" && hasActiveSub;
        profile.entitlements = { hasActiveSub, isTrial, expiresAt };
      }

      setUser(profile);
      updateUser(profile);
      refresh();
    } catch (error) {
      console.error('Error fetching user profile:', getAxiosErrorMessage(error, 'Profile request failed'));
      clearAuth();
      refresh();
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold mb-6 text-blue-700">
            Welcome, {user?.firstName}!
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* User Info Card */}
            <div className="bg-blue-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">User Information</h2>
              <div className="space-y-2">
                <p><strong>Name:</strong> {user?.firstName} {user?.lastName}</p>
                <p><strong>Email:</strong> {user?.email}</p>
                <p><strong>Account Type:</strong> 
                  <span className={`ml-2 px-2 py-1 rounded ${user?.userType === 'teacher' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                    {user?.userType?.toUpperCase()}
                  </span>
                </p>
                <p><strong>Status:</strong> 
                  <span className={`ml-2 px-2 py-1 rounded ${user?.verificationStatus === 'verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {user?.verificationStatus?.toUpperCase()}
                  </span>
                </p>
                {user?.institution && (
                  <p><strong>Institution:</strong> {user.institution}</p>
                )}
              </div>
            </div>

            {/* Students: subscription messaging. Teachers: earnings + referral */}
            {user?.userType === 'student' ? (
              <div className="bg-indigo-50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Subscription</h2>
                <div className="text-center">
                  {user?.entitlements?.hasActiveSub ? (
                    <p className="text-gray-700">Included in your subscription.</p>
                  ) : (
                    <>
                      <p className="text-gray-600 mb-4">Upgrade to access full lessons and quizzes.</p>
                      <button
                        type="button"
                        onClick={() => navigate('/subscription')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold"
                      >
                        Upgrade to access
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Earnings</h2>
                <div className="text-center">
                  <div className="text-4xl font-bold text-emerald-700 mb-2">
                    {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
                      Number(user?.earnings ?? 0)
                    )}
                  </div>
                  <p className="text-gray-600 mb-4">Earnings from subscription access to your lessons.</p>
                  
                  {user?.userType === 'teacher' && user?.referralCode && (
                    <div className="mt-4 p-4 bg-blue-100 rounded">
                      <p className="font-semibold">Your Referral Code:</p>
                      <code className="bg-white px-3 py-1 rounded text-lg font-mono">
                        {user.referralCode}
                      </code>
                      <p className="text-sm text-gray-600 mt-2">
                        Share this code with other teachers to earn commissions!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="md:col-span-2 bg-gray-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {user?.userType === 'teacher' ? (
                  <>
                    <button 
                      onClick={() => navigate('/create-lesson')}
                      className="bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-lg transition"
                    >
                      Create New Lesson
                    </button>
                    <button className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-lg transition">
                      View Students
                    </button>
                    <button className="bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-lg transition">
                      Earnings Report
                    </button>
                    <button className="bg-yellow-500 hover:bg-yellow-600 text-white p-4 rounded-lg transition">
                      Referral Dashboard
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => navigate('/student-dashboard')}
                      className="bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-lg transition"
                    >
                      Browse Lessons
                    </button>
                    <button className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-lg transition">
                      My Progress
                    </button>
                    <button className="bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-lg transition">
                      Take Quiz
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/subscription')}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white p-4 rounded-lg transition"
                    >
                      Upgrade to access
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;