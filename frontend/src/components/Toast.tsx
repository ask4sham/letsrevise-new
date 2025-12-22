import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type,
  duration = 5000,
  onClose
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = {
    success: '#d4edda',
    error: '#f8d7da',
    info: '#d1ecf1',
    warning: '#fff3cd'
  };

  const textColor = {
    success: '#155724',
    error: '#721c24',
    info: '#0c5460',
    warning: '#856404'
  };

  const borderColor = {
    success: '#c3e6cb',
    error: '#f5c6cb',
    info: '#bee5eb',
    warning: '#ffeaa7'
  };

  const icon = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 1000,
      minWidth: '300px',
      maxWidth: '400px',
      padding: '1rem',
      backgroundColor: bgColor[type],
      color: textColor[type],
      border: `1px solid ${borderColor[type]}`,
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      display: 'flex',
      alignItems: 'flex-start',
      animation: 'slideIn 0.3s ease-out'
    }}>
      <span style={{ marginRight: '0.75rem', fontSize: '1.25rem' }}>
        {icon[type]}
      </span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, lineHeight: 1.5 }}>{message}</p>
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: textColor[type],
          fontSize: '1.25rem',
          cursor: 'pointer',
          marginLeft: '0.5rem',
          padding: '0'
        }}
      >
        ×
      </button>
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
};

export default Toast;