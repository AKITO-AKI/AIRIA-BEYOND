// Analytics initialization - only loads at runtime if packages are available
// This file uses dynamic imports that won't fail at build time

export function initAnalytics() {
  if (!import.meta.env.PROD) {
    console.log('[Analytics] Skipping in development mode');
    return;
  }

  // Try to load Vercel Analytics
  const analyticsScript = document.createElement('script');
  analyticsScript.type = 'module';
  analyticsScript.innerHTML = `
    try {
      const { inject } = await import('https://cdn.jsdelivr.net/npm/@vercel/analytics@1/dist/index.mjs');
      inject();
      console.log('[Analytics] Loaded successfully');
    } catch (e) {
      console.log('[Analytics] Package not available');
    }
  `;
  
  // Try to load Speed Insights
  const speedScript = document.createElement('script');
  speedScript.type = 'module';
  speedScript.innerHTML = `
    try {
      const { injectSpeedInsights } = await import('https://cdn.jsdelivr.net/npm/@vercel/speed-insights@1/dist/index.mjs');
      injectSpeedInsights();
      console.log('[Speed Insights] Loaded successfully');
    } catch (e) {
      console.log('[Speed Insights] Package not available');
    }
  `;
  
  document.head.appendChild(analyticsScript);
  document.head.appendChild(speedScript);
}
