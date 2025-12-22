import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

const GoogleAnalytics: React.FC = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Initialize Google Analytics
    if (typeof window.gtag === 'function') {
      window.gtag('config', 'G-XXXXXXXXXX', { // Replace with your GA4 ID
        page_path: location.pathname + location.search,
      });
    }
  }, [location]);

  // Only load in production
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <>
      {/* Google Analytics script */}
      <script
        async
        src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX" // Replace with your GA4 ID
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XXXXXXXXXX'); // Replace with your GA4 ID
          `,
        }}
      />
    </>
  );
};

export default GoogleAnalytics;