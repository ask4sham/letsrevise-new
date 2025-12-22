import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { useGet } from '../hooks/useApi';
import { StudentStats, RecentActivity } from '../types/progress';

const StudentProgressPage: React.FC = () => {
  const navigate = useNavigate();
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);

  const { data, loading, error, fetch } = useGet('/progress/stats', {
    onSuccess: (data) => {
      if (data.success) {
        // data loaded ok
      }
    },
    onError: (err) => {
      const message =
        typeof err === 'string'
          ? err
          : (err as any)?.message || 'Failed to load progress data';

      setToast({
        message,
        type: 'error',
      });
    },
  });

  // error from useApi is now string | null, but keep this defensive
  const errorMessage =
    error == null
      ? null
      : typeof error === 'string'
      ? error
      : (error as any).message || 'An unexpected error occurred while loading progress.';

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.userType !== 'student') {
      navigate('/dashboard');
    } else {
      fetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = data?.success ? (data.stats as StudentStats) : null;
  const recentActivity = data?.success
    ? (data.recentActivity as RecentActivity[])
    : [];

  const handleLessonClick = (lessonId: string) => {
    navigate(`/lesson/${lessonId}`);
  };

  const formatTime = (minutes: number) => {
    if (!minutes || minutes <= 0) return '0m';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (loading) {
    return <LoadingSpinner size="large" text="Loading your progress..." />;
  }

  if (errorMessage) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <h2>Unable to Load Progress</h2>
        <p style={{ color: '#666', marginBottom: '2rem' }}>{errorMessage}</p>
        <button
          onClick={() => fetch()}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!stats) {
    // This should only happen if API shape changes, but keep a friendly fallback
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <h2>No Progress Data</h2>
        <p style={{ color: '#666', marginBottom: '2rem' }}>
          Start learning to see your progress here!
        </p>
        <button
          onClick={() => navigate('/lessons')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Browse Lessons
        </button>
      </div>
    );
  }

  const subjectProgress = stats.subjectProgress || [];

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1
            style={{
              fontSize: '2.5rem',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
            }}
          >
            My Learning Progress
            {loading && (
              <span
                style={{
                  fontSize: '1rem',
                  color: '#666',
                  marginLeft: '1rem',
                }}
              >
                (updating...)
              </span>
            )}
          </h1>
          <p style={{ color: '#666' }}>
            Track your learning journey, achievements, and statistics
          </p>
        </div>

        {/* Summary cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '0.25rem' }}>
              Lessons Purchased
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>
              {stats.totalPurchased}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#A0AEC0', marginTop: '0.25rem' }}>
              {stats.totalCompleted} completed • {stats.totalInProgress} in progress
            </div>
          </div>

          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '0.25rem' }}>
              Completion Rate
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>
              {stats.completionRate}%
            </div>
            <div style={{ fontSize: '0.85rem', color: '#A0AEC0', marginTop: '0.25rem' }}>
              Average progress {stats.averageProgress}%
            </div>
          </div>

          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '0.25rem' }}>
              Study Time
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>
              {formatTime(stats.totalTimeSpentMinutes)}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#A0AEC0', marginTop: '0.25rem' }}>
              {stats.timeCompletionRatio}% of estimated duration
            </div>
          </div>

          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '0.25rem' }}>
              Learning Streak
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>
              {stats.streakDays} day{stats.streakDays === 1 ? '' : 's'}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#A0AEC0', marginTop: '0.25rem' }}>
              Keep coming back to grow your streak
            </div>
          </div>
        </div>

        {/* Time & coins row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 0.8fr',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}
          >
            <h3 style={{ marginBottom: '0.75rem' }}>Time Spent vs Estimated</h3>
            <p style={{ color: '#4A5568', marginBottom: '0.5rem' }}>
              Time spent: <strong>{formatTime(stats.totalTimeSpentMinutes)}</strong>
            </p>
            <p style={{ color: '#4A5568', marginBottom: '0.5rem' }}>
              Estimated total duration:{' '}
              <strong>
                {formatTime(stats.estimatedTotalDurationMinutes || 0)}
              </strong>
            </p>
            <p style={{ color: '#718096', fontSize: '0.9rem' }}>
              You have completed approximately {stats.timeCompletionRatio}% of the
              expected study time for your purchased lessons.
            </p>
          </div>

          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}
          >
            <h3 style={{ marginBottom: '0.75rem' }}>ShamCoins Spent</h3>
            <p style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              {stats.totalShamCoinsSpent}
            </p>
            <p style={{ color: '#718096', fontSize: '0.9rem' }}>
              Total ShamCoins used to purchase lessons.
            </p>
          </div>
        </div>

        {/* Subject progress + recent activity */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 0.9fr',
            gap: '1.5rem',
          }}
        >
          {/* Subject progress table */}
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}
          >
            <h3 style={{ marginBottom: '1rem' }}>Progress by Subject</h3>
            {subjectProgress.length === 0 ? (
              <p style={{ color: '#A0AEC0', fontSize: '0.9rem' }}>
                Once you start learning, you&apos;ll see your progress by subject
                here.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.9rem',
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '0.5rem',
                          borderBottom: '1px solid #E2E8F0',
                        }}
                      >
                        Subject
                      </th>
                      <th
                        style={{
                          textAlign: 'right',
                          padding: '0.5rem',
                          borderBottom: '1px solid #E2E8F0',
                        }}
                      >
                        Lessons
                      </th>
                      <th
                        style={{
                          textAlign: 'right',
                          padding: '0.5rem',
                          borderBottom: '1px solid #E2E8F0',
                        }}
                      >
                        Completed
                      </th>
                      <th
                        style={{
                          textAlign: 'right',
                          padding: '0.5rem',
                          borderBottom: '1px solid #E2E8F0',
                        }}
                      >
                        Avg. Progress
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectProgress.map((sp, idx) => (
                      <tr key={idx}>
                        <td
                          style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #EDF2F7',
                          }}
                        >
                          {sp.subject}
                        </td>
                        <td
                          style={{
                            padding: '0.5rem',
                            textAlign: 'right',
                            borderBottom: '1px solid #EDF2F7',
                          }}
                        >
                          {sp.totalLessons}
                        </td>
                        <td
                          style={{
                            padding: '0.5rem',
                            textAlign: 'right',
                            borderBottom: '1px solid #EDF2F7',
                          }}
                        >
                          {sp.completedLessons}
                        </td>
                        <td
                          style={{
                            padding: '0.5rem',
                            textAlign: 'right',
                            borderBottom: '1px solid #EDF2F7',
                          }}
                        >
                          {sp.averageProgress}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent activity list */}
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}
          >
            <h3 style={{ marginBottom: '1rem' }}>Recent Activity</h3>
            {recentActivity.length === 0 ? (
              <p style={{ color: '#A0AEC0', fontSize: '0.9rem' }}>
                When you start studying lessons, your recent activity will appear
                here for quick access.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {recentActivity.map((act, idx) => (
                  <li
                    key={idx}
                    style={{
                      padding: '0.75rem 0',
                      borderBottom:
                        idx === recentActivity.length - 1
                          ? 'none'
                          : '1px solid #EDF2F7',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleLessonClick(act.lessonId)}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            marginBottom: '0.15rem',
                          }}
                        >
                          {act.title}
                        </div>
                        <div
                          style={{
                            fontSize: '0.85rem',
                            color: '#718096',
                          }}
                        >
                          {act.subject} •{' '}
                          {new Date(act.lastAccessed).toLocaleDateString()}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: '0.85rem',
                          color: act.completed ? '#38A169' : '#3182CE',
                          fontWeight: 600,
                        }}
                      >
                        {act.completed ? 'Completed' : `${act.progress}%`}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentProgressPage;
