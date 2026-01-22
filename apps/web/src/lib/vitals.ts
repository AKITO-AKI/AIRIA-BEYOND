// Web Vitals tracking for performance monitoring
// Install web-vitals: npm install web-vitals
// This module will be loaded only if web-vitals is installed

export function initWebVitals() {
  if (!import.meta.env.PROD) {
    return;
  }
  
  // Use Function constructor to create dynamic import that won't be parsed at build time
  try {
    const importWebVitals = new Function('return import("web-vitals")');
    importWebVitals()
      .then((webVitals: any) => {
        const sendToAnalytics = (metric: any) => {
          console.log('[Web Vitals]', metric);
          // Can be extended to send to analytics service
        };
        
        webVitals.onCLS(sendToAnalytics);
        webVitals.onFID(sendToAnalytics);
        webVitals.onFCP(sendToAnalytics);
        webVitals.onLCP(sendToAnalytics);
        webVitals.onTTFB(sendToAnalytics);
      })
      .catch(() => {
        // web-vitals not installed, skip
        console.log('[Web Vitals] Package not installed, skipping');
      });
  } catch {
    console.log('[Web Vitals] Failed to initialize');
  }
}
