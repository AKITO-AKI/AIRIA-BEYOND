import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import type { Album } from './AlbumContext';

export enum PlaybackState {
  STOPPED = 'STOPPED',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  LOADING = 'LOADING',
}

export type RepeatMode = 'off' | 'all' | 'one';
export type VisualizationMode = 'waveform' | 'spectrum' | 'radial';

interface MusicPlayerState {
  // Playback state
  playbackState: PlaybackState;
  currentAlbum: Album | null;
  currentAlbumImage?: string;
  currentTrackTitle?: string;
  
  // Queue management
  queue: Album[];
  queueIndex: number;
  
  // Playback controls
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  
  // UI state
  isExpanded: boolean;
  visualizationMode: VisualizationMode;
}

interface MusicPlayerContextType {
  state: MusicPlayerState;
  
  // Legacy methods (for backward compatibility)
  setPlaying: (playing: boolean) => void;
  setCurrentAlbum: (imageUrl?: string, title?: string) => void;
  
  // Enhanced methods
  setPlaybackState: (state: PlaybackState) => void;
  setCurrentAlbumFull: (album: Album | null) => void;
  setQueue: (queue: Album[], startIndex?: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleExpanded: () => void;
  setVisualizationMode: (mode: VisualizationMode) => void;
  
  // Playback actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  skipToIndex: (index: number) => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(undefined);

const DEFAULT_VOLUME = 0.7;

export const MusicPlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<MusicPlayerState>({
    playbackState: PlaybackState.STOPPED,
    currentAlbum: null,
    currentAlbumImage: undefined,
    currentTrackTitle: undefined,
    queue: [],
    queueIndex: -1,
    currentTime: 0,
    duration: 0,
    volume: DEFAULT_VOLUME,
    isMuted: false,
    shuffle: false,
    repeat: 'off',
    isExpanded: false,
    visualizationMode: 'waveform',
  });

  // Legacy methods
  const setPlaying = useCallback((playing: boolean) => {
    setState(prev => ({ 
      ...prev, 
      playbackState: playing ? PlaybackState.PLAYING : PlaybackState.PAUSED 
    }));
  }, []);

  const setCurrentAlbum = useCallback((imageUrl?: string, title?: string) => {
    setState(prev => ({ 
      ...prev, 
      currentAlbumImage: imageUrl,
      currentTrackTitle: title 
    }));
  }, []);

  // Enhanced methods
  const setPlaybackState = useCallback((playbackState: PlaybackState) => {
    setState(prev => ({ ...prev, playbackState }));
  }, []);

  const setCurrentAlbumFull = useCallback((album: Album | null) => {
    setState(prev => ({
      ...prev,
      currentAlbum: album,
      currentAlbumImage: album?.imageDataURL,
      currentTrackTitle: album?.mood,
    }));
  }, []);

  const setQueue = useCallback((queue: Album[], startIndex = 0) => {
    setState(prev => ({
      ...prev,
      queue,
      queueIndex: startIndex,
      currentAlbum: queue[startIndex] || null,
      currentAlbumImage: queue[startIndex]?.imageDataURL,
      currentTrackTitle: queue[startIndex]?.mood,
    }));
  }, []);

  const setCurrentTime = useCallback((time: number) => {
    setState(prev => ({ ...prev, currentTime: time }));
  }, []);

  const setDuration = useCallback((duration: number) => {
    setState(prev => ({ ...prev, duration }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setState(prev => ({ ...prev, volume: clampedVolume }));
  }, []);

  const toggleMute = useCallback(() => {
    setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  const toggleShuffle = useCallback(() => {
    setState(prev => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const cycleRepeat = useCallback(() => {
    setState(prev => {
      const modes: RepeatMode[] = ['off', 'all', 'one'];
      const currentIndex = modes.indexOf(prev.repeat);
      const nextIndex = (currentIndex + 1) % modes.length;
      return { ...prev, repeat: modes[nextIndex] };
    });
  }, []);

  const toggleExpanded = useCallback(() => {
    setState(prev => ({ ...prev, isExpanded: !prev.isExpanded }));
  }, []);

  const setVisualizationMode = useCallback((mode: VisualizationMode) => {
    setState(prev => ({ ...prev, visualizationMode: mode }));
  }, []);

  // Playback actions
  const play = useCallback(() => {
    setState(prev => ({ ...prev, playbackState: PlaybackState.PLAYING }));
  }, []);

  const pause = useCallback(() => {
    setState(prev => ({ ...prev, playbackState: PlaybackState.PAUSED }));
  }, []);

  const stop = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      playbackState: PlaybackState.STOPPED,
      currentTime: 0,
    }));
  }, []);

  const next = useCallback(() => {
    setState(prev => {
      if (prev.queue.length === 0) return prev;
      
      let nextIndex = prev.queueIndex + 1;
      
      // Handle repeat modes
      if (nextIndex >= prev.queue.length) {
        if (prev.repeat === 'all') {
          nextIndex = 0;
        } else {
          return { ...prev, playbackState: PlaybackState.STOPPED };
        }
      }
      
      const nextAlbum = prev.queue[nextIndex];
      return {
        ...prev,
        queueIndex: nextIndex,
        currentAlbum: nextAlbum,
        currentAlbumImage: nextAlbum.imageDataURL,
        currentTrackTitle: nextAlbum.mood,
        currentTime: 0,
      };
    });
  }, []);

  const previous = useCallback(() => {
    setState(prev => {
      if (prev.queue.length === 0) return prev;
      
      // If more than 3 seconds into the track, restart it
      if (prev.currentTime > 3) {
        return { ...prev, currentTime: 0 };
      }
      
      let prevIndex = prev.queueIndex - 1;
      
      // Handle repeat modes
      if (prevIndex < 0) {
        if (prev.repeat === 'all') {
          prevIndex = prev.queue.length - 1;
        } else {
          return prev;
        }
      }
      
      const prevAlbum = prev.queue[prevIndex];
      return {
        ...prev,
        queueIndex: prevIndex,
        currentAlbum: prevAlbum,
        currentAlbumImage: prevAlbum.imageDataURL,
        currentTrackTitle: prevAlbum.mood,
        currentTime: 0,
      };
    });
  }, []);

  const skipToIndex = useCallback((index: number) => {
    setState(prev => {
      if (index < 0 || index >= prev.queue.length) return prev;
      
      const targetAlbum = prev.queue[index];
      return {
        ...prev,
        queueIndex: index,
        currentAlbum: targetAlbum,
        currentAlbumImage: targetAlbum.imageDataURL,
        currentTrackTitle: targetAlbum.mood,
        currentTime: 0,
      };
    });
  }, []);

  return (
    <MusicPlayerContext.Provider value={{
      state,
      setPlaying,
      setCurrentAlbum,
      setPlaybackState,
      setCurrentAlbumFull,
      setQueue,
      setCurrentTime,
      setDuration,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      toggleExpanded,
      setVisualizationMode,
      play,
      pause,
      stop,
      next,
      previous,
      skipToIndex,
    }}>
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
