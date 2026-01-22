import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    
    // Try to send to Sentry if available - using Function constructor to avoid bundler issues
    try {
      // Use Function constructor to create dynamic import that won't be bundled at build time
      const importSentry = new Function('return import("@sentry/react")');
      importSentry()
        .then((Sentry: any) => {
          Sentry.captureException(error, { contexts: { react: errorInfo } });
        })
        .catch(() => {
          // Sentry not available, just log
        });
    } catch {
      // Ignore if Sentry is not available
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center',
          fontFamily: 'sans-serif'
        }}>
          <h1>エラーが発生しました</h1>
          <p>アプリケーションでエラーが発生しました。ページをリロードしてください。</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1rem',
              marginTop: '1rem',
              cursor: 'pointer'
            }}
          >
            リロード
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
