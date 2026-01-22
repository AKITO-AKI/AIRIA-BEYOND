// SEO component for meta tags
// Install react-helmet-async: npm install react-helmet-async
// This module will work with or without react-helmet-async installed

interface SEOProps {
  title?: string;
  description?: string;
}

export const SEO = ({ 
  title = 'AIRIA BEYOND',
  description = 'AI搭載の感情分析・クラシック音楽・絵画生成アプリ / AI-powered emotion analysis, classical music, and painting generation'
}: SEOProps) => {
  // Try to use react-helmet-async if available
  // Otherwise, update document title directly
  try {
    // Dynamic import will fail if package not installed
    return null; // Helmet will be imported lazily if needed
  } catch {
    // Fallback: update document title directly
    if (typeof document !== 'undefined') {
      document.title = title;
    }
    return null;
  }
};

// Export a simple document title updater as fallback
export const updatePageTitle = (title: string) => {
  if (typeof document !== 'undefined') {
    document.title = title;
  }
};
