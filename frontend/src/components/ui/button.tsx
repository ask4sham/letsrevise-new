import React from 'react';
import { theme } from '../../styles/theme';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  type = 'button',
  className = '',
  leftIcon,
  rightIcon,
}) => {
  const variantStyles = {
    primary: {
      background: `linear-gradient(135deg, ${theme.colors.primary[500]} 0%, ${theme.colors.primary[600]} 100%)`,
      color: theme.colors.white,
      hover: `linear-gradient(135deg, ${theme.colors.primary[600]} 0%, ${theme.colors.primary[700]} 100%)`,
    },
    secondary: {
      background: `linear-gradient(135deg, ${theme.colors.secondary[500]} 0%, ${theme.colors.secondary[600]} 100%)`,
      color: theme.colors.white,
      hover: `linear-gradient(135deg, ${theme.colors.secondary[600]} 0%, ${theme.colors.secondary[700]} 100%)`,
    },
    success: {
      background: `linear-gradient(135deg, ${theme.colors.success[500]} 0%, ${theme.colors.success[600]} 100%)`,
      color: theme.colors.white,
      hover: `linear-gradient(135deg, ${theme.colors.success[600]} 0%, ${theme.colors.success[700]} 100%)`,
    },
    warning: {
      background: `linear-gradient(135deg, ${theme.colors.warning[500]} 0%, ${theme.colors.warning[600]} 100%)`,
      color: theme.colors.white,
      hover: `linear-gradient(135deg, ${theme.colors.warning[600]} 0%, ${theme.colors.warning[700]} 100%)`,
    },
    danger: {
      background: `linear-gradient(135deg, ${theme.colors.danger[500]} 0%, ${theme.colors.danger[600]} 100%)`,
      color: theme.colors.white,
      hover: `linear-gradient(135deg, ${theme.colors.danger[600]} 0%, ${theme.colors.danger[700]} 100%)`,
    },
    ghost: {
      background: 'transparent',
      color: theme.colors.gray[700],
      hover: theme.colors.gray[100],
    },
  };

  const sizeStyles = {
    sm: {
      padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
      fontSize: theme.fontSizes.sm,
    },
    md: {
      padding: `${theme.spacing[3]} ${theme.spacing[6]}`,
      fontSize: theme.fontSizes.md,
    },
    lg: {
      padding: `${theme.spacing[4]} ${theme.spacing[8]}`,
      fontSize: theme.fontSizes.lg,
    },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...variantStyles[variant],
        ...sizeStyles[size],
        width: fullWidth ? '100%' : 'auto',
        border: 'none',
        borderRadius: theme.radii.md,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.6 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[2],
        textDecoration: 'none',
      }}
      className={className}
      onMouseEnter={(e) => {
        if (!disabled && variant !== 'ghost') {
          e.currentTarget.style.background = variantStyles[variant].hover;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && variant !== 'ghost') {
          e.currentTarget.style.background = variantStyles[variant].background;
        }
      }}
    >
      {leftIcon && <span>{leftIcon}</span>}
      {children}
      {rightIcon && <span>{rightIcon}</span>}
    </button>
  );
};

export default Button;