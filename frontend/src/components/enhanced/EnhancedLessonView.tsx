import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

interface Lesson {
  _id: string;
  title: string;
  description: string;
  content: string;
  subject: string;
  level: string;
  topic: string;
  teacherName: string;
  teacherId: string;
  estimatedDuration: number;
  shamCoinPrice: number;
  isPublished: boolean;
  views: number;
  averageRating: number;
  totalRatings: number;
  createdAt: string;
}

interface User {
  _id: string;
  userType: string;
  shamCoins: number;
  purchasedLessons: Array<{
    lessonId: string;
    purchasedAt: string;
  }>;
}

const EnhancedLessonView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('content');

  useEffect(() => {
    fetchLesson();
    fetchUserData();
  }, [id]);

  const fetchLesson = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/lessons/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLesson(response.data);
    } catch (err: any) {
      console.error('Error fetching lesson:', err);
      setError('Failed to load lesson. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  };

  const handlePurchase = async () => {
    if (!lesson) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/lessons/${lesson._id}/purchase`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data.success) {
        alert('Lesson purchased successfully!');
        fetchUserData();
      }
    } catch (err: any) {
      console.error('Purchase error:', err);
      alert(err.response?.data?.msg || 'Failed to purchase lesson');
    }
  };

  const hasPurchased = () => {
    if (!user || !lesson) return false;
    return user.purchasedLessons?.some(
      purchase => purchase.lessonId === lesson._id
    );
  };

  const canAccessContent = () => {
    if (!lesson) return false;
    return lesson.shamCoinPrice === 0 || hasPurchased() || user?.userType === 'teacher';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading lesson...</p>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    const errorMessage = error || "The lesson you're looking for doesn't exist.";
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😞</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Lesson Not Found</h1>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isTeacher = user?.userType === 'teacher';
  const canAccess = canAccessContent();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 py-12">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Lessons
          </button>
          
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm">{lesson.subject}</span>
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm">{lesson.level}</span>
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm">{lesson.estimatedDuration} min</span>
              {lesson.shamCoinPrice === 0 && (
                <span className="px-3 py-1 bg-green-500/20 rounded-full text-sm">FREE</span>
              )}
              {!lesson.isPublished && (
                <span className="px-3 py-1 bg-yellow-500/20 rounded-full text-sm">DRAFT</span>
              )}
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{lesson.title}</h1>
            <p className="text-xl text-white/90 mb-6">{lesson.description}</p>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-lg font-bold">
                    {lesson.teacherName.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium">By {lesson.teacherName}</p>
                  <p className="text-white/80 text-sm">Expert {lesson.subject} Teacher</p>
                </div>
              </div>
              
              <div className="ml-auto">
                {!canAccess ? (
                  <button
                    onClick={handlePurchase}
                    className="px-6 py-3 bg-white text-blue-600 font-bold rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {lesson.shamCoinPrice === 0 ? 'Start Learning Free' : `Purchase for ${lesson.shamCoinPrice} ShamCoins`}
                  </button>
                ) : (
                  <button className="px-6 py-3 bg-white text-blue-600 font-bold rounded-lg hover:bg-gray-100 transition-colors">
                    Start Learning
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Left Column - Lesson Content */}
          <div className="flex-1">
            {/* Tabs */}
            <div className="flex gap-2 mb-8 border-b border-gray-200">
              {['content', 'resources', 'reviews'].map(tab => (
                <button
                  key={tab}
                  className={`px-6 py-3 font-medium capitalize transition-colors ${activeTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'content' && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                {!canAccess ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🔒</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Content Locked</h2>
                    <p className="text-gray-600 mb-6">
                      {lesson.shamCoinPrice === 0 
                        ? 'Please enroll in this free lesson to access the content.'
                        : `Purchase this lesson for ${lesson.shamCoinPrice} ShamCoins to unlock all content.`
                      }
                    </p>
                    <button
                      onClick={handlePurchase}
                      className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {lesson.shamCoinPrice === 0 ? 'Enroll Free' : `Purchase for ${lesson.shamCoinPrice} ShamCoins`}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="prose max-w-none">
                      <ReactMarkdown>{lesson.content}</ReactMarkdown>
                    </div>
                    
                    {/* Progress Section */}
                    <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl">
                      <h3 className="text-xl font-bold text-gray-800 mb-4">Your Progress</h3>
                      <div className="mb-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>Lesson Completion</span>
                          <span>0%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                        </div>
                      </div>
                      <button className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
                        Mark as Completed
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'resources' && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">📎 Learning Resources</h2>
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📚</div>
                  <h3 className="text-xl font-medium text-gray-700 mb-2">No resources available</h3>
                  <p className="text-gray-500">Check back later for additional learning materials.</p>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">⭐ Student Reviews</h2>
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">⭐</div>
                  <h3 className="text-xl font-medium text-gray-700 mb-2">No reviews yet</h3>
                  <p className="text-gray-500">Be the first to review this lesson!</p>
                  <button className="mt-6 px-6 py-2 border-2 border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors">
                    Write a Review
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="w-80 hidden lg:block">
            <div className="sticky top-8 space-y-6">
              {/* Lesson Info Card */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-gray-800 mb-4">Lesson Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subject</span>
                    <span className="font-medium">{lesson.subject}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Level</span>
                    <span className="font-medium">{lesson.level}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration</span>
                    <span className="font-medium">{lesson.estimatedDuration} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Topic</span>
                    <span className="font-medium text-right">{lesson.topic}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Price</span>
                    <span className={`font-medium ${lesson.shamCoinPrice === 0 ? 'text-green-600' : 'text-gray-800'}`}>
                      {lesson.shamCoinPrice === 0 ? 'Free' : `${lesson.shamCoinPrice} ShamCoins`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Views</span>
                    <span className="font-medium">{lesson.views || 0}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-gray-800 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  {isTeacher && (
                    <Link
                      to={`/edit-lesson/${lesson._id}`}
                      className="block w-full text-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Edit Lesson
                    </Link>
                  )}
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Notes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedLessonView;
