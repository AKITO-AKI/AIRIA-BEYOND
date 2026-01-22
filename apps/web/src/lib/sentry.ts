// Sentry error tracking initialization
// Install @sentry/react: npm install @sentry/react
// This module will be loaded only if Sentry is installed and configured

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn) {
    console.log('[Sentry] DSN not configured, skipping initialization');
    return;
  }
  
  // Use Function constructor to create dynamic import that won't be parsed at build time
  try {
    const importSentry = new Function('return import("@sentry/react")');
    importSentry()
      .then((Sentry: any) => {
        Sentry.init({
          dsn,
          environment: import.meta.env.MODE,
          tracesSampleRate: 0.1,
          integrations: [
            Sentry.browserTracingIntegration(),
          ],
        });
        console.log('[Sentry] Initialized successfully');
      })
      .catch(() => {
        console.log('[Sentry] Package not installed, skipping');
      });
  } catch {
    console.log('[Sentry] Failed to initialize');
  }
}
