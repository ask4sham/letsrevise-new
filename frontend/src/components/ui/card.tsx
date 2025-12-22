import React from 'react';
import { theme } from '../../styles/theme';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  hoverable = false,
  padding = 'md'
}) => {
  const paddingMap = {
    sm: theme.spacing[4],
    md: theme.spacing[6],
    lg: theme.spacing[8],
  };

  return (
    <div
      style={{
        backgroundColor: theme.colors.white,
        borderRadius: theme.radii.lg,
        padding: paddingMap[padding],
        boxShadow: theme.shadows.md,
        border: `1px solid ${theme.colors.gray[200]}`,
        transition: hoverable ? 'all 0.2s ease' : 'none',
        ...(hoverable && {
          '&:hover': {
            boxShadow: theme.shadows.lg,
            transform: 'translateY(-2px)',
          }
        })
      }}
      className={className}
    >
      {children}
    </div>
  );
};

export default Card;