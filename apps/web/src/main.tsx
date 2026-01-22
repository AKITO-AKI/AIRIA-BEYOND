import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { AlbumProvider, useAlbums } from './contexts/AlbumContext';
import { CausalLogProvider } from './contexts/CausalLogContext';
import { MusicPlayerProvider, useMusicPlayer } from './contexts/MusicPlayerContext';
import { ToastProvider } from './components/visual/feedback/ToastContainer';
import RoomNavigator from './components/RoomNavigator';
import OnboardingRoom from './components/rooms/OnboardingRoom';
import MainRoom from './components/rooms/MainRoom';
import GalleryRoom from './components/rooms/GalleryRoom';
import AlbumRoom from './components/rooms/AlbumRoom';
import MusicRoom from './components/rooms/MusicRoom';
import SplashScreen from './components/SplashScreen';
import { EnhancedMiniPlayer } from './components/music';
import DebugPanel from './components/DebugPanel';
import BackgroundDyeSystem from './components/visual/BackgroundDyeSystem';
import ClickRipple from './components/visual/interactions/ClickRipple';
import FrequencyGeometry from './components/visual/patterns/FrequencyGeometry';
import './styles.css';
import './components/visual/globalInteractions.css';

const rooms = [
  { id: 'onboarding' as const, name: 'Onboarding', component: <OnboardingRoom /> },
  { id: 'main' as const, name: 'Main', component: <MainRoom /> },
  { id: 'gallery' as const, name: 'Gallery', component: <GalleryRoom /> },
  { id: 'album' as const, name: 'Album', component: <AlbumRoom /> },
  { id: 'music' as const, name: 'Music', component: <MusicRoom /> },
];

const AppContent = () => {
  const [showSplash, setShowSplash] = useState(true);
  const { getSelectedAlbum, albums } = useAlbums();
  const { state: musicState } = useMusicPlayer();
  const selectedAlbum = getSelectedAlbum();
  
  // Create queue from all albums with music data
  const musicQueue = albums.filter(album => album.musicData);

  return (
    <>
      {showSplash && <SplashScreen onDismiss={() => setShowSplash(false)} />}
      {!showSplash && (
        <>
          {/* Phase C-1: Background dye system */}
          <BackgroundDyeSystem 
            albumImageUrl={musicState.currentAlbumImage || selectedAlbum?.imageUrl}
            isPlaying={musicState.isPlaying}
          />
          {/* Phase C-4: Global click ripples */}
          <ClickRipple />
          {/* Phase C-4: Frequency spectrum geometry (ambient audio visualization) */}
          <FrequencyGeometry 
            audioData={null}
            enabled={musicState.isPlaying}
          />
          <RoomNavigator rooms={rooms} initialRoom="main" />
          {/* C-3: Enhanced MiniPlayer with visualizations and expanded UI */}
          <EnhancedMiniPlayer 
            album={selectedAlbum || undefined} 
            queue={musicQueue}
          />
          {/* P5: Debug panel for developers */}
          <DebugPanel />
        </>
      )}
    </>
  );
};

const App = () => {
  return (
    <React.StrictMode>
      <CausalLogProvider>
        <AlbumProvider>
          <MusicPlayerProvider>
            <ToastProvider>
              <AppContent />
            </ToastProvider>
          </MusicPlayerProvider>
        </AlbumProvider>
      </CausalLogProvider>
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);