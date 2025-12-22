import React from 'react';
import { theme } from '../../styles/theme';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon,
  trend,
  color = 'primary',
}) => {
  const colorMap = {
    primary: theme.colors.primary[500],
    secondary: theme.colors.secondary[500],
    success: theme.colors.success[500],
    warning: theme.colors.warning[500],
    danger: theme.colors.danger[500],
  };

  return (
    <div
      style={{
        background: 'white',
        borderRadius: theme.radii.xl,
        padding: theme.spacing[6],
        boxShadow: theme.shadows.lg,
        border: `1px solid ${theme.colors.gray[200]}`,
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = theme.shadows['2xl'];
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = theme.shadows.lg;
      }}
    >
      {/* Decorative accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: `linear-gradient(90deg, ${colorMap[color]}, ${colorMap[color]}80)`,
        }}
      />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: theme.fontSizes.sm, color: theme.colors.gray[600], marginBottom: theme.spacing[2] }}>
            {title}
          </div>
          <div style={{ fontSize: theme.fontSizes['3xl'], fontWeight: 'bold', color: theme.colors.gray[800] }}>
            {value}
          </div>
          
          {description && (
            <div style={{ fontSize: theme.fontSizes.sm, color: theme.colors.gray[500], marginTop: theme.spacing[2] }}>
              {description}
            </div>
          )}
          
          {trend && (
            <div style={{ display: 'flex', alignItems: 'center', marginTop: theme.spacing[2], fontSize: theme.fontSizes.sm }}>
              <span style={{ 
                color: trend.isPositive ? theme.colors.success[500] : theme.colors.danger[500],
                fontWeight: 600,
              }}>
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span style={{ color: theme.colors.gray[500], marginLeft: theme.spacing[2] }}>
                from last month
              </span>
            </div>
          )}
        </div>
        
        {icon && (
          <div style={{
            padding: theme.spacing[3],
            borderRadius: theme.radii.lg,
            background: `${colorMap[color]}15`,
            color: colorMap[color],
            fontSize: theme.fontSizes['2xl'],
          }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;