import React, { useState } from 'react';

interface LessonProgressTrackerProps {
  lessonId: string;
  lessonTitle: string;
  initialProgress: number;
  initialCompleted: boolean;
  timeSpentMinutes: number;
  purchased: boolean;
  onProgressUpdate?: (progress: number, completed: boolean) => void;
}

const LessonProgressTracker: React.FC<LessonProgressTrackerProps> = ({
  lessonId,
  lessonTitle,
  initialProgress,
  initialCompleted,
  timeSpentMinutes,
  purchased,
  onProgressUpdate
}) => {
  const [progress, setProgress] = useState(initialProgress);
  const [completed, setCompleted] = useState(initialCompleted);
  const [timeSpent, setTimeSpent] = useState(timeSpentMinutes);
  const [isPlaying, setIsPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showCompletionReward, setShowCompletionReward] = useState(false);

  const handleProgressChange = async (newProgress: number) => {
    if (!purchased) return;

    try {
      setSaving(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setProgress(newProgress);
      if (newProgress === 100 && !completed) {
        setCompleted(true);
        setShowCompletionReward(true);
        setTimeout(() => setShowCompletionReward(false), 5000);
      }
      setTimeSpent(timeSpent + (isPlaying ? 5 : 0));
      
      if (onProgressUpdate) {
        onProgressUpdate(newProgress, newProgress === 100);
      }
    } catch (error) {
      console.error('Error updating progress:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    setProgress(value);
    handleProgressChange(value);
  };

  const handleMarkComplete = async () => {
    if (!purchased) return;

    try {
      setSaving(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setProgress(100);
      setCompleted(true);
      setShowCompletionReward(true);
      setTimeout(() => setShowCompletionReward(false), 5000);
      
      if (onProgressUpdate) {
        onProgressUpdate(100, true);
      }
    } catch (error) {
      console.error('Error marking lesson complete:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTimeTrackingToggle = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      // Add 5 minutes when starting
      setTimeSpent(timeSpent + 5);
    }
  };

  const handleSubmitReview = async () => {
    if (!rating) return;

    try {
      setSubmittingReview(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setReviewDialogOpen(false);
      setRating(null);
      setReview('');
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setSubmittingReview(false);
    }
  };

  const getProgressLabel = () => {
    if (progress === 0) return 'Not Started';
    if (progress < 30) return 'Beginning';
    if (progress < 70) return 'In Progress';
    if (progress < 100) return 'Almost Done';
    return 'Completed';
  };

  const getProgressColor = () => {
    if (progress === 100) return '#4caf50';
    if (progress >= 70) return '#2196f3';
    if (progress >= 30) return '#ff9800';
    return '#f44336';
  };

  return (
    <>
      <div style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '1rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ margin: 0 }}>Your Progress</h3>
          <span style={{
            padding: '0.25rem 0.75rem',
            backgroundColor: completed ? '#4caf50' : progress > 0 ? '#2196f3' : '#e0e0e0',
            color: 'white',
            borderRadius: '20px',
            fontSize: '0.875rem'
          }}>
            {getProgressLabel()}
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '0.5rem'
          }}>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>{getProgressLabel()}</span>
            <span style={{ fontWeight: 'bold' }}>{progress}%</span>
          </div>
          <div style={{
            height: '10px',
            backgroundColor: '#e0e0e0',
            borderRadius: '5px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              backgroundColor: getProgressColor(),
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {/* Progress Slider */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            color: '#666',
            fontSize: '0.875rem',
            marginBottom: '0.5rem'
          }}>
            Adjust your progress:
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={progress}
            onChange={handleSliderChange}
            disabled={saving || completed || !purchased}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              backgroundColor: '#e0e0e0',
              outline: 'none'
            }}
          />
        </div>

        {/* Time Tracking */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <button
            onClick={handleTimeTrackingToggle}
            disabled={completed || saving || !purchased}
            style={{
              padding: '0.5rem',
              borderRadius: '50%',
              border: '1px solid #ddd',
              backgroundColor: isPlaying ? '#2196f3' : 'white',
              color: isPlaying ? 'white' : '#666',
              cursor: 'pointer',
              minWidth: '40px',
              minHeight: '40px'
            }}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <div>
            <div style={{ color: '#666', fontSize: '0.875rem' }}>Time Spent</div>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
              ⏰ {Math.floor(timeSpent / 60)}h {timeSpent % 60}m
            </div>
          </div>
          <span style={{
            padding: '0.25rem 0.75rem',
            backgroundColor: isPlaying ? '#2196f3' : '#e0e0e0',
            color: 'white',
            borderRadius: '20px',
            fontSize: '0.875rem'
          }}>
            {isPlaying ? 'Learning...' : 'Paused'}
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={handleMarkComplete}
            disabled={completed || saving || !purchased}
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: completed || !purchased ? 'not-allowed' : 'pointer',
              opacity: completed || !purchased ? 0.6 : 1
            }}
          >
            {completed ? '✓ Completed' : 'Mark as Complete'}
          </button>
          
          {completed && (
            <button
              onClick={() => setReviewDialogOpen(true)}
              disabled={saving}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: 'white',
                color: '#1976d2',
                border: '1px solid #1976d2',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              Leave Review
            </button>
          )}
        </div>

        {/* Completion Reward Alert */}
        {showCompletionReward && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#4caf50',
            color: 'white',
            borderRadius: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>🎉 Congratulations! You've earned ShamCoins for completing this lesson!</span>
            <button
              onClick={() => setShowCompletionReward(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '1.25rem',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Saving Indicator */}
        {saving && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '1rem',
            color: '#666'
          }}>
            <span>Saving progress...</span>
          </div>
        )}
      </div>

      {/* Review Dialog */}
      {reviewDialogOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '1.5rem',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h3 style={{ margin: 0 }}>Review Lesson</h3>
              <button
                onClick={() => setReviewDialogOpen(false)}
                disabled={submittingReview}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ marginBottom: '0.5rem' }}>
                How would you rate "{lessonTitle}"?
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    style={{
                      fontSize: '2rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: star <= (rating || 0) ? '#ffc107' : '#e0e0e0'
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Your Review (Optional)
              </label>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Share your experience with this lesson..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                onClick={() => setReviewDialogOpen(false)}
                disabled={submittingReview}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={!rating || submittingReview}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: rating ? '#1976d2' : '#e0e0e0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: rating ? 'pointer' : 'not-allowed'
                }}
              >
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LessonProgressTracker;