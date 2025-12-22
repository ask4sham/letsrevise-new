import React, { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
}

const SEO: React.FC<SEOProps> = ({
  title = 'LetsRevise - Learn, Teach, Earn',
  description = 'LetsRevise is a platform where students can learn from expert teachers and teachers can earn by sharing their knowledge.',
  keywords = 'learning, education, online courses, teaching, earn money, lessons, tutorials, UK curriculum, LetsRevise',
  image = '/logo.png',
  url = '',
  type = 'website'
}) => {
  const siteTitle = title.includes('LetsRevise') ? title : `${title} | LetsRevise`;
  
  useEffect(() => {
    // Update document title
    document.title = siteTitle;
    
    // Update or create meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', description);
    
    // Update or create meta keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', keywords);
    
    // Update or create Open Graph tags
    const updateOrCreateMeta = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };
    
    updateOrCreateMeta('og:title', siteTitle);
    updateOrCreateMeta('og:description', description);
    updateOrCreateMeta('og:image', image);
    updateOrCreateMeta('og:type', type);
    updateOrCreateMeta('og:url', url || window.location.href);
    
    // Update or create Twitter tags
    const updateOrCreateMetaName = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };
    
    updateOrCreateMetaName('twitter:title', siteTitle);
    updateOrCreateMetaName('twitter:description', description);
    updateOrCreateMetaName('twitter:image', image);
    updateOrCreateMetaName('twitter:card', 'summary_large_image');
    
    // Update canonical link
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', url || window.location.href);
    
    // Cleanup function
    return () => {
      // Reset to default title on unmount
      document.title = 'LetsRevise';
    };
  }, [title, description, keywords, image, url, type, siteTitle]);
  
  // This component doesn't render anything visible
  return null;
};

export default SEO;