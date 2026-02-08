// Analytics initialization - only loads at runtime if packages are available
// This file uses dynamic imports that won't fail at build time

export function initAnalytics() {
  if (!import.meta.env.PROD) {
    console.log('[Analytics] Skipping in development mode');
    return;
  }

  // Vercel Analytics / Speed Insights load a local script under /_vercel/*.
  // On non-Vercel hosting (GitHub Pages, local static hosting, etc.) that path returns HTML/404,
  // which surfaces as: "Unexpected token '<'" in the console.
  //
  // Enable explicitly via `VITE_ENABLE_VERCEL_ANALYTICS=1` (recommended),
  // or rely on a best-effort hostname heuristic.
  const isVercelHostname = (() => {
    try {
      const host = String(window.location.hostname || '').toLowerCase();
      return host.endsWith('.vercel.app') || host.endsWith('.now.sh');
    } catch {
      return false;
    }
  })();

  const enabled =
    String((import.meta as any).env?.VITE_ENABLE_VERCEL_ANALYTICS || '').trim() === '1' ||
    isVercelHostname;

  if (!enabled) {
    console.log('[Analytics] Vercel analytics disabled (non-Vercel host)');
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
