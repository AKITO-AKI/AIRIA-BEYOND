import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
}

export const SEO = ({
  title = 'AIRIA BEYOND',
  description =
    'AI搭載の感情分析・クラシック音楽・絵画生成アプリ / AI-powered emotion analysis, classical music, and painting generation',
}: SEOProps) => {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', description);
  }, [title, description]);

  return null;
};

// Export a simple document title updater as fallback
export const updatePageTitle = (title: string) => {
  if (typeof document !== 'undefined') {
    document.title = title;
  }
};
