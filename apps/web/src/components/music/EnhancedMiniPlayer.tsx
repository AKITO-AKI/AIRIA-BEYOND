import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { getGlobalPlayer } from '../../utils/midiPlayer';
import type { Album } from '../../contexts/AlbumContext';
import { useMusicPlayer, PlaybackState } from '../../contexts/MusicPlayerContext';
import { MiniPlayerBar } from './MiniPlayerBar';
import { ExpandedPlayer } from './ExpandedPlayer';
import './EnhancedMiniPlayer.css';

interface EnhancedMiniPlayerProps {
  album?: Album;
  queue?: Album[];
}

export const EnhancedMiniPlayer: React.FC<EnhancedMiniPlayerProps> = ({ 
  album, 
  queue = [] 
}) => {
  const {
    state,
    setPlaybackState,
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
    next,
    previous,
    skipToIndex,
    setQueue,
    setCurrentAlbumFull,
  } = useMusicPlayer();

  const playerRef = useRef(getGlobalPlayer());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array | null>(null);
  const timeDataRef = useRef<Uint8Array | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  const [frequencyData, setFrequencyData] = useState<Uint8Array | null>(null);
  const [timeDomainData, setTimeDomainData] = useState<Uint8Array | null>(null);

  // Initialize Tone.js analyser
  useEffect(() => {
    const initAnalyser = async () => {
      try {
        // Ensure Tone.js context is started
        await Tone.start();
        
        // Create analyser node
        const analyser = Tone.context.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        
        // Connect Tone.js destination to analyser
        Tone.getDestination().connect(analyser);
        
        analyserRef.current = analyser;
        frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);
        timeDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      } catch (error) {
        console.error('Failed to initialize analyser:', error);
      }
    };

    initAnalyser();

    return () => {
      // Cleanup
      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch (e) {
          // Already disconnected
        }
      }
    };
  }, []);

  // Initialize queue when albums change
  useEffect(() => {
    if (queue.length > 0) {
      const startIndex = album ? queue.findIndex(a => a.id === album.id) : 0;
      setQueue(queue, Math.max(0, startIndex));
    } else if (album) {
      setQueue([album], 0);
    }
  }, [album, queue, setQueue]);

  // Load MIDI when current album changes
  useEffect(() => {
    const currentAlbum = state.currentAlbum || album;
    if (currentAlbum?.musicData) {
      loadMIDI(currentAlbum);
      setCurrentAlbumFull(currentAlbum);
    }
  }, [state.currentAlbum?.id, album?.id]);

  // Update visualization data when playing
  useEffect(() => {
    if (state.playbackState === PlaybackState.PLAYING && analyserRef.current) {
      const updateVisualization = () => {
        if (!analyserRef.current || !frequencyDataRef.current || !timeDataRef.current) return;
        
        analyserRef.current.getByteFrequencyData(frequencyDataRef.current);
        analyserRef.current.getByteTimeDomainData(timeDataRef.current);
        
        setFrequencyData(new Uint8Array(frequencyDataRef.current));
        setTimeDomainData(new Uint8Array(timeDataRef.current));
      };

      const interval = setInterval(updateVisualization, 16); // ~60fps
      return () => clearInterval(interval);
    }
  }, [state.playbackState]);

  const loadMIDI = async (albumToLoad: Album) => {
    try {
      const player = playerRef.current;
      await player.loadMIDI(albumToLoad.musicData!);
      
      const playerState = player.getState();
      setDuration(playerState.duration);
    } catch (err) {
      console.error('[EnhancedMiniPlayer] Failed to load MIDI:', err);
    }
  };

  const startPlayback = async () => {
    try {
      setPlaybackState(PlaybackState.LOADING);
      
      const player = playerRef.current;
      await player.play();
      
      play();
      
      // Track progress
      const progressInterval = window.setInterval(() => {
        const playerState = player.getState();
        setCurrentTime(playerState.currentTime);
        setDuration(playerState.duration);
        
        if (!playerState.isPlaying && !playerState.isPaused) {
          // Playback ended
          clearInterval(progressInterval);
          handleTrackEnd();
        }
      }, 100);
      
      progressIntervalRef.current = progressInterval;
    } catch (err) {
      console.error('Failed to start playback:', err);
      setPlaybackState(PlaybackState.STOPPED);
    }
  };

  const pausePlayback = () => {
    const player = playerRef.current;
    player.pause();
    pause();
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const handleTrackEnd = () => {
    if (state.repeat === 'one') {
      // Repeat current track
      seekTo(0);
      startPlayback();
    } else {
      // Go to next track
      handleNext();
    }
  };

  const handlePlayPause = () => {
    if (state.playbackState === PlaybackState.PLAYING) {
      pausePlayback();
    } else {
      startPlayback();
    }
  };

  const handleNext = () => {
    next();
    // Playback will auto-start from useEffect
    setTimeout(() => startPlayback(), 100);
  };

  const handlePrevious = () => {
    previous();
    // Playback will auto-start from useEffect
    setTimeout(() => startPlayback(), 100);
  };

  const seekTo = (time: number) => {
    const player = playerRef.current;
    player.seek(time);
    setCurrentTime(time);
  };

  const handleVolumeChange = (volume: number) => {
    setVolume(volume);
    // Apply to Tone.js master volume
    // Note: Tone.js uses decibel scale, this is simplified
  };

  const handleSkipToIndex = (index: number) => {
    skipToIndex(index);
    setTimeout(() => startPlayback(), 100);
  };

  const canPrevious = state.queueIndex > 0 || state.repeat === 'all';
  const canNext = state.queueIndex < state.queue.length - 1 || state.repeat === 'all';

  const isPlaying = state.playbackState === PlaybackState.PLAYING;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  return (
    <>
      {!state.isExpanded && (
        <MiniPlayerBar
          album={state.currentAlbum}
          isPlaying={isPlaying}
          currentTime={state.currentTime}
          duration={state.duration}
          volume={state.volume}
          isMuted={state.isMuted}
          canPrevious={canPrevious}
          canNext={canNext}
          frequencyData={frequencyData}
          timeDomainData={timeDomainData}
          onPlayPause={handlePlayPause}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onSeek={seekTo}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={toggleMute}
          onExpand={toggleExpanded}
        />
      )}

      {state.isExpanded && (
        <ExpandedPlayer
          album={state.currentAlbum}
          isPlaying={isPlaying}
          currentTime={state.currentTime}
          duration={state.duration}
          volume={state.volume}
          isMuted={state.isMuted}
          shuffle={state.shuffle}
          repeat={state.repeat}
          canPrevious={canPrevious}
          canNext={canNext}
          visualizationMode={state.visualizationMode}
          queue={state.queue}
          queueIndex={state.queueIndex}
          frequencyData={frequencyData}
          timeDomainData={timeDomainData}
          onPlayPause={handlePlayPause}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onSeek={seekTo}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={toggleMute}
          onShuffle={toggleShuffle}
          onRepeat={cycleRepeat}
          onVisualizationModeChange={setVisualizationMode}
          onSkipToIndex={handleSkipToIndex}
          onClose={toggleExpanded}
        />
      )}
    </>
  );
};
