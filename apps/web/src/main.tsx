import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { AlbumProvider, useAlbums } from './contexts/AlbumContext';
import { CausalLogProvider } from './contexts/CausalLogContext';
import { MusicPlayerProvider, useMusicPlayer } from './contexts/MusicPlayerContext';
import { ToastProvider } from './components/visual/feedback/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import RoomNavigator from './components/RoomNavigator';
import OnboardingRoom from './components/rooms/OnboardingRoom';
import MainRoom from './components/rooms/MainRoom';
import GalleryRoom from './components/rooms/GalleryRoom';
import AlbumRoom from './components/rooms/AlbumRoom';
import MusicRoom from './components/rooms/MusicRoom';
import SocialRoom from './components/rooms/SocialRoom';
import InfoRoom from './components/rooms/InfoRoom';
import SplashScreen from './components/SplashScreen';
import { EnhancedMiniPlayer } from './components/music';
import PlaybackBackdrop from './components/music/PlaybackBackdrop';
import { initSentry } from './lib/sentry';
import { initWebVitals } from './lib/vitals';
import { initAnalytics } from './lib/analytics';
import { loadPendingOnboardingGeneration } from './utils/pendingGeneration';
import './styles.css';
import './components/visual/globalInteractions.css';

// Initialize monitoring in production
if (import.meta.env.PROD) {
  initSentry();
  initWebVitals();
  initAnalytics();
}

const ONBOARDING_STORAGE_KEY = 'airia_onboarding_data';
const THEME_STORAGE_KEY = 'airia_theme';
const POST_ONBOARDING_ROOM_KEY = 'airia_post_onboarding_room';

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

function consumePostOnboardingRoom(): 'main' | 'gallery' | 'album' | 'music' | 'social' | 'info' | null {
  try {
    const raw = localStorage.getItem(POST_ONBOARDING_ROOM_KEY);
    if (!raw) return null;
    localStorage.removeItem(POST_ONBOARDING_ROOM_KEY);
    const room = String(raw);
    return ['main', 'gallery', 'album', 'music', 'social', 'info'].includes(room) ? (room as any) : null;
  } catch {
    return null;
  }
}

const AppContent = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [hasOnboarded, setHasOnboarded] = useState(() => {
    try {
      return isOnboardingCompleted();
    } catch {
      return false;
    }
  });
  const { getSelectedAlbum, albums } = useAlbums();
  const { state: musicState } = useMusicPlayer();
  const selectedAlbum = getSelectedAlbum();

  useEffect(() => {
    applyThemePreference();
  }, []);
  
  // Create queue from all albums with music data
  const musicQueue = albums.filter(album => album.musicData);

  const rooms = hasOnboarded
    ? [
        { id: 'main' as const, name: 'Main', component: <MainRoom /> },
        { id: 'gallery' as const, name: 'Gallery', component: <GalleryRoom /> },
        { id: 'album' as const, name: 'Album', component: <AlbumRoom /> },
        { id: 'music' as const, name: 'Music', component: <MusicRoom /> },
        { id: 'social' as const, name: 'Social', component: <SocialRoom /> },
        { id: 'info' as const, name: 'Info', component: <InfoRoom /> },
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
            <RoomNavigator key={hasOnboarded ? 'onboarded' : 'needs-onboarding'} rooms={rooms} initialRoom={initialRoom} />
            {/* C-3: Enhanced MiniPlayer with visualizations and expanded UI */}
            <EnhancedMiniPlayer album={selectedAlbum || undefined} queue={musicQueue} />
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
          <AlbumProvider>
            <MusicPlayerProvider>
              <ToastProvider>
                <AppContent />
              </ToastProvider>
            </MusicPlayerProvider>
          </AlbumProvider>
        </CausalLogProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
