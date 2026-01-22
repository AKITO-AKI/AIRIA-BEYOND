import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MusicPlayerState {
  isPlaying: boolean;
  currentAlbumImage?: string;
  currentTrackTitle?: string;
}

interface MusicPlayerContextType {
  state: MusicPlayerState;
  setPlaying: (playing: boolean) => void;
  setCurrentAlbum: (imageUrl?: string, title?: string) => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(undefined);

export const MusicPlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<MusicPlayerState>({
    isPlaying: false,
    currentAlbumImage: undefined,
    currentTrackTitle: undefined,
  });

  const setPlaying = (playing: boolean) => {
    setState(prev => ({ ...prev, isPlaying: playing }));
  };

  const setCurrentAlbum = (imageUrl?: string, title?: string) => {
    setState(prev => ({ 
      ...prev, 
      currentAlbumImage: imageUrl,
      currentTrackTitle: title 
    }));
  };

  return (
    <MusicPlayerContext.Provider value={{ state, setPlaying, setCurrentAlbum }}>
      {children}
    </MusicPlayerContext.Provider>
  );
};

export const useMusicPlayer = () => {
  const context = useContext(MusicPlayerContext);
  if (!context) {
    throw new Error('useMusicPlayer must be used within MusicPlayerProvider');
  }
  return context;
};
