import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { AlbumProvider, useAlbums } from './contexts/AlbumContext';
import { CausalLogProvider } from './contexts/CausalLogContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MusicPlayerProvider, useMusicPlayer } from './contexts/MusicPlayerContext';
import { ToastProvider } from './components/visual/feedback/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import RoomNavigator from './components/RoomNavigator';
import OnboardingRoom from './components/rooms/OnboardingRoom';
import AuthRoom from './components/rooms/AuthRoom';
import LandingRoom from './components/rooms/LandingRoom';
import LegalRoom from './components/rooms/LegalRoom';
import MainRoom from './components/rooms/MainRoom';
import GalleryRoom from './components/rooms/GalleryRoom';
import AlbumRoom from './components/rooms/AlbumRoom';
import MusicRoom from './components/rooms/MusicRoom';
import SocialRoom from './components/rooms/SocialRoom';
import MyPageRoom from './components/rooms/MyPageRoom';
import SettingsRoom from './components/rooms/SettingsRoom';
import AdminRoom from './components/rooms/AdminRoom';
import InfoRoom from './components/rooms/InfoRoom';
import FeedbackRoom from './components/rooms/FeedbackRoom';
import SplashScreen from './components/SplashScreen';
import { EnhancedMiniPlayer } from './components/music';
import PlaybackBackdrop from './components/music/PlaybackBackdrop';
import { initSentry } from './lib/sentry';
import { initWebVitals } from './lib/vitals';
import { initAnalytics } from './lib/analytics';
import { loadPendingOnboardingGeneration } from './utils/pendingGeneration';
import './styles.css';
import './components/visual/globalInteractions.css';
import { getAdminToken } from './api/adminApi';

// Initialize monitoring in production
if (import.meta.env.PROD) {
  initSentry();
  initWebVitals();
  initAnalytics();
}

const ONBOARDING_STORAGE_KEY = 'airia_onboarding_data';
const THEME_STORAGE_KEY = 'airia_theme';
const POST_ONBOARDING_ROOM_KEY = 'airia_post_onboarding_room';
const PREAUTH_VIEW_KEY = 'airia_preauth_view_v1';

type PreAuthView = 'landing' | 'auth' | 'terms' | 'privacy';

function viewFromHash(): PreAuthView | null {
  try {
    const hash = String(window.location.hash || '').trim().toLowerCase();
    if (hash === '#terms') return 'terms';
    if (hash === '#privacy') return 'privacy';
    if (hash === '#login') return 'auth';
    if (hash === '#signup') return 'auth';
    return null;
  } catch {
    return null;
  }
}

function applyThemePreference() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const choice = stored || 'system';
    const next = choice === 'system' ? (prefersDark ? 'dark' : 'light') : choice;
    document.documentElement.setAttribute('data-theme', next);
  } catch {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

function isOnboardingCompleted(): boolean {
  try {
    // If an onboarding-triggered music generation is pending, keep the user in onboarding
    // so they can resume polling and complete the save+autoplay flow.
    if (loadPendingOnboardingGeneration()) return false;
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.completedAt);
  } catch {
    return false;
  }
}

function consumePostOnboardingRoom():
  | 'main'
  | 'gallery'
  | 'album'
  | 'music'
  | 'social'
  | 'me'
  | 'settings'
  | 'admin'
  | 'info'
  | 'feedback'
  | null {
  try {
    const raw = localStorage.getItem(POST_ONBOARDING_ROOM_KEY);
    if (!raw) return null;
    localStorage.removeItem(POST_ONBOARDING_ROOM_KEY);
    const room = String(raw);
    return ['main', 'gallery', 'album', 'music', 'social', 'me', 'settings', 'admin', 'info', 'feedback'].includes(room)
      ? (room as any)
      : null;
  } catch {
    return null;
  }
}

const AppContent = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [preAuthView, setPreAuthView] = useState<PreAuthView>(() => {
    try {
      const byHash = viewFromHash();
      if (byHash) return byHash;
      const raw = sessionStorage.getItem(PREAUTH_VIEW_KEY);
      return raw === 'auth' || raw === 'terms' || raw === 'privacy' ? (raw as PreAuthView) : 'landing';
    } catch {
      return 'landing';
    }
  });
  const [hasOnboarded, setHasOnboarded] = useState(() => {
    try {
      return isOnboardingCompleted();
    } catch {
      return false;
    }
  });
  const { getSelectedAlbum, albums } = useAlbums();
  const { state: musicState } = useMusicPlayer();
  const { user: authUser, loading: authLoading } = useAuth();
  const selectedAlbum = getSelectedAlbum();

  useEffect(() => {
    const handler = () => {
      const next = viewFromHash();
      if (next) {
        setPreAuthView(next);
        try {
          sessionStorage.setItem(PREAUTH_VIEW_KEY, next);
        } catch {
          // ignore
        }
        return;
      }

      // If hash is cleared, fall back to remembered landing/auth (but never stick to legal views).
      try {
        const raw = sessionStorage.getItem(PREAUTH_VIEW_KEY);
        const fallback: PreAuthView = raw === 'auth' ? 'auth' : 'landing';
        setPreAuthView(fallback);
        sessionStorage.setItem(PREAUTH_VIEW_KEY, fallback);
      } catch {
        setPreAuthView('landing');
      }
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const showAuth = React.useCallback(() => {
    setPreAuthView('auth');
    try {
      sessionStorage.setItem(PREAUTH_VIEW_KEY, 'auth');
      window.location.hash = '#login';
    } catch {
      // ignore
    }
  }, []);

  const showLanding = React.useCallback(() => {
    setPreAuthView('landing');
    try {
      sessionStorage.setItem(PREAUTH_VIEW_KEY, 'landing');
      window.location.hash = '';
    } catch {
      // ignore
    }
  }, []);

  const showTerms = React.useCallback(() => {
    setPreAuthView('terms');
    try {
      sessionStorage.setItem(PREAUTH_VIEW_KEY, 'terms');
      window.location.hash = '#terms';
    } catch {
      // ignore
    }
  }, []);

  const showPrivacy = React.useCallback(() => {
    setPreAuthView('privacy');
    try {
      sessionStorage.setItem(PREAUTH_VIEW_KEY, 'privacy');
      window.location.hash = '#privacy';
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    applyThemePreference();
  }, []);
  
  // Create queue from all albums with music data
  const musicQueue = albums.filter(album => album.musicData);

  const adminEnabled = Boolean(getAdminToken() || String(import.meta.env.VITE_ADMIN_ENABLED || '').toLowerCase() === 'true');

  const rooms = hasOnboarded
    ? [
        { id: 'main' as const, name: 'Main', component: <MainRoom /> },
        { id: 'gallery' as const, name: 'Gallery', component: <GalleryRoom /> },
        { id: 'album' as const, name: 'Album', component: <AlbumRoom /> },
        { id: 'music' as const, name: 'Music', component: <MusicRoom /> },
        { id: 'social' as const, name: 'Social', component: <SocialRoom /> },
        { id: 'me' as const, name: 'My', component: <MyPageRoom /> },
        { id: 'settings' as const, name: 'Settings', component: <SettingsRoom /> },
        ...(adminEnabled ? [{ id: 'admin' as const, name: 'Admin', component: <AdminRoom /> }] : []),
        { id: 'info' as const, name: 'Info', component: <InfoRoom /> },
        { id: 'feedback' as const, name: 'Feedback', component: <FeedbackRoom /> },
      ]
    : [
        {
          id: 'onboarding' as const,
          name: 'はじめに',
          component: (
            <OnboardingRoom
              onExit={() => {
                // Re-check storage (in case of partial saves)
                setHasOnboarded(isOnboardingCompleted());
              }}
            />
          ),
        },
      ];

  const initialRoom = hasOnboarded
    ? ((consumePostOnboardingRoom() ?? 'main') as const)
    : ('onboarding' as const);

  return (
    <>
      {showSplash && <SplashScreen onDismiss={() => setShowSplash(false)} />}
      {!showSplash && (
        <>
          <PlaybackBackdrop />
          <div className="app-ui-layer">
            {authLoading ? (
              <div style={{ padding: 24, opacity: 0.8 }}>Loading...</div>
            ) : !authUser ? (
              <div className="preauth-shell">
                {preAuthView === 'auth' ? (
                  <AuthRoom onBack={showLanding} />
                ) : preAuthView === 'terms' ? (
                  <LegalRoom kind="terms" onBack={showLanding} onStart={showAuth} />
                ) : preAuthView === 'privacy' ? (
                  <LegalRoom kind="privacy" onBack={showLanding} onStart={showAuth} />
                ) : (
                  <LandingRoom onStart={showAuth} onOpenTerms={showTerms} onOpenPrivacy={showPrivacy} />
                )}
              </div>
            ) : (
              <>
                <RoomNavigator
                  key={hasOnboarded ? 'onboarded' : 'needs-onboarding'}
                  rooms={rooms}
                  initialRoom={initialRoom}
                />
                {/* C-3: Enhanced MiniPlayer with visualizations and expanded UI */}
                <EnhancedMiniPlayer album={selectedAlbum || undefined} queue={musicQueue} />
              </>
            )}
          </div>
        </>
      )}
    </>
  );
};

const App = () => {
  return (
    <React.StrictMode>
      <ErrorBoundary>
        <CausalLogProvider>
          <AuthProvider>
            <AlbumProvider>
              <MusicPlayerProvider>
                <ToastProvider>
                  <AppContent />
                </ToastProvider>
              </MusicPlayerProvider>
            </AlbumProvider>
          </AuthProvider>
        </CausalLogProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
