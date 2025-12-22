// components/reviews/RatingDisplay.tsx
import React from 'react';

interface RatingDisplayProps {
  rating: number;
  totalRatings?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
}

const RatingDisplay: React.FC<RatingDisplayProps> = ({
  rating,
  totalRatings = 0,
  size = 'md',
  showCount = true
}) => {
  const sizeMap = {
    sm: { starSize: '1rem', textSize: '0.875rem' },
    md: { starSize: '1.25rem', textSize: '1rem' },
    lg: { starSize: '1.5rem', textSize: '1.125rem' }
  };

  const { starSize, textSize } = sizeMap[size];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ display: 'flex' }}>
        {[...Array(5)].map((_, i) => (
          <span
            key={i}
            style={{
              fontSize: starSize,
              color: i < Math.floor(rating) ? '#fbbf24' : '#d1d5db',
              position: 'relative'
            }}
          >
            ★
            {i < rating && i >= Math.floor(rating) && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${(rating - Math.floor(rating)) * 100}%`,
                  overflow: 'hidden',
                  color: '#fbbf24'
                }}
              >
                ★
              </span>
            )}
          </span>
        ))}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <span style={{ 
          fontSize: textSize, 
          fontWeight: 600,
          color: '#374151'
        }}>
          {rating.toFixed(1)}
        </span>
        
        {showCount && totalRatings > 0 && (
          <>
            <span style={{ 
              fontSize: '0.875rem', 
              color: '#6b7280',
              marginLeft: '0.25rem'
            }}>
              ({totalRatings} {totalRatings === 1 ? 'review' : 'reviews'})
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default RatingDisplay;