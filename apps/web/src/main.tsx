import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { AlbumProvider, useAlbums } from './contexts/AlbumContext';
import { CausalLogProvider } from './contexts/CausalLogContext';
import RoomNavigator from './components/RoomNavigator';
import OnboardingRoom from './components/rooms/OnboardingRoom';
import MainRoom from './components/rooms/MainRoom';
import GalleryRoom from './components/rooms/GalleryRoom';
import AlbumRoom from './components/rooms/AlbumRoom';
import MusicRoom from './components/rooms/MusicRoom';
import SplashScreen from './components/SplashScreen';
import MiniPlayer from './components/MiniPlayer';
import DebugPanel from './components/DebugPanel';
import './styles.css';

const rooms = [
  { id: 'onboarding' as const, name: 'Onboarding', component: <OnboardingRoom /> },
  { id: 'main' as const, name: 'Main', component: <MainRoom /> },
  { id: 'gallery' as const, name: 'Gallery', component: <GalleryRoom /> },
  { id: 'album' as const, name: 'Album', component: <AlbumRoom /> },
  { id: 'music' as const, name: 'Music', component: <MusicRoom /> },
];

const AppContent = () => {
  const [showSplash, setShowSplash] = useState(true);
  const { getSelectedAlbum } = useAlbums();
  const selectedAlbum = getSelectedAlbum();

  return (
    <>
      {showSplash && <SplashScreen onDismiss={() => setShowSplash(false)} />}
      {!showSplash && (
        <>
          <RoomNavigator rooms={rooms} initialRoom="main" />
          {/* P4: Pass selected album to MiniPlayer for music playback */}
          <MiniPlayer album={selectedAlbum || undefined} />
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
          <AppContent />
        </AlbumProvider>
      </CausalLogProvider>
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);