import React from 'react';
import ReactDOM from 'react-dom/client';
import RoomNavigator from './components/RoomNavigator';
import OnboardingRoom from './components/rooms/OnboardingRoom';
import MainRoom from './components/rooms/MainRoom';
import GalleryRoom from './components/rooms/GalleryRoom';
import AlbumRoom from './components/rooms/AlbumRoom';
import MusicRoom from './components/rooms/MusicRoom';
import './styles.css';

const rooms = [
  { id: 'onboarding' as const, name: 'Onboarding', component: <OnboardingRoom /> },
  { id: 'main' as const, name: 'Main', component: <MainRoom /> },
  { id: 'gallery' as const, name: 'Gallery', component: <GalleryRoom /> },
  { id: 'album' as const, name: 'Album', component: <AlbumRoom /> },
  { id: 'music' as const, name: 'Music', component: <MusicRoom /> },
];

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RoomNavigator rooms={rooms} initialRoom="main" />
  </React.StrictMode>,
);