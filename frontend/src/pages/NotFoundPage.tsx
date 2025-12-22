import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '6rem', margin: 0, color: '#1976d2' }}>404</h1>
      <h2 style={{ fontSize: '2rem', margin: '1rem 0' }}>Page Not Found</h2>
      <p style={{ color: '#666', maxWidth: '500px', marginBottom: '2rem' }}>
        Oops! The page you're looking for doesn't exist or has been moved.
      </p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#f8f9fa',
            color: '#212529',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          ← Go Back
        </button>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Go Home
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#198754',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Go to Dashboard
        </button>
      </div>
      
      {/* Quick links */}
      <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #dee2e6', width: '100%' }}>
        <h3 style={{ marginBottom: '1rem' }}>Quick Links</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
          <a href="/lessons" style={{ color: '#1976d2', textDecoration: 'none' }}>Browse Lessons</a>
          <a href="/subscription" style={{ color: '#1976d2', textDecoration: 'none' }}>Subscription Plans</a>
          <a href="/login" style={{ color: '#1976d2', textDecoration: 'none' }}>Login</a>
          <a href="/register" style={{ color: '#1976d2', textDecoration: 'none' }}>Register</a>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;