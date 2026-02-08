import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { getGlobalPlayer } from '../../utils/midiPlayer';
import type { Album } from '../../contexts/AlbumContext';
import { useMusicPlayer, PlaybackState } from '../../contexts/MusicPlayerContext';
import { SpotifySquareDock } from './SpotifySquareDock';
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
  const pendingPlayRequestIdRef = useRef(0);
  const handledPlayRequestIdRef = useRef(0);

  const [audioUnlocked, setAudioUnlocked] = useState(() => {
    try {
      return Tone.context.state === 'running';
    } catch {
      return false;
    }
  });

  const [frequencyData, setFrequencyData] = useState<Uint8Array | null>(null);
  const [timeDomainData, setTimeDomainData] = useState<Uint8Array | null>(null);

  const ensureAnalyser = React.useCallback(() => {
    try {
      if (analyserRef.current) return;

      const analyser = Tone.context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      // Connect Tone.js destination to analyser for visualizations.
      Tone.getDestination().connect(analyser);

      analyserRef.current = analyser;
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      timeDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch (error) {
      console.error('[EnhancedMiniPlayer] Failed to initialize analyser:', error);
    }
  }, []);

  // Unlock AudioContext on first user gesture (autoplay policy).
  // IMPORTANT: do not call Tone.start() in a mount effect.
  useEffect(() => {
    let cancelled = false;

    const maybeAutoplayPending = async () => {
      const currentAlbum = state.currentAlbum || album;
      const requestId = pendingPlayRequestIdRef.current;

      if (!currentAlbum?.musicData) return;
      if (requestId === 0 || requestId === handledPlayRequestIdRef.current) return;

      try {
        await loadMIDI(currentAlbum);
        if (cancelled) return;
        await startPlayback();
        handledPlayRequestIdRef.current = requestId;
      } catch (err) {
        console.error('[EnhancedMiniPlayer] Pending autoplay failed after unlock:', err);
      }
    };

    const unlock = async () => {
      try {
        await Tone.start();
        if (cancelled) return;
        const running = Tone.context.state === 'running';
        setAudioUnlocked(running);
        if (running) {
          ensureAnalyser();
          await maybeAutoplayPending();
        }
      } catch (error) {
        console.warn('[EnhancedMiniPlayer] Audio unlock failed:', error);
      }
    };

    // If already running, ensure analyser and we're done.
    try {
      if (Tone.context.state === 'running') {
        setAudioUnlocked(true);
        ensureAnalyser();
        return;
      }
    } catch {
      // ignore
    }

    const handler = () => {
      // Fire-and-forget; also remove listeners.
      void unlock();
      window.removeEventListener('pointerdown', handler, true);
      window.removeEventListener('keydown', handler, true);
    };

    window.addEventListener('pointerdown', handler, true);
    window.addEventListener('keydown', handler, true);

    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', handler, true);
      window.removeEventListener('keydown', handler, true);

      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch {
          // ignore
        }
        analyserRef.current = null;
      }
    };
  }, [album, ensureAnalyser, state.currentAlbum, state.playRequestId]);

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

  // Autoplay requests (from Gallery / other UIs)
  useEffect(() => {
    if (state.playRequestId > 0) {
      pendingPlayRequestIdRef.current = state.playRequestId;
    }
  }, [state.playRequestId]);

  useEffect(() => {
    const currentAlbum = state.currentAlbum || album;
    const requestId = pendingPlayRequestIdRef.current;
    if (!currentAlbum?.musicData) return;
    if (requestId === 0 || requestId === handledPlayRequestIdRef.current) return;

    // If audio isn't unlocked yet, wait for the first user gesture.
    if (!audioUnlocked) return;

    let cancelled = false;
    (async () => {
      try {
        await loadMIDI(currentAlbum);
        if (cancelled) return;
        await startPlayback();
        handledPlayRequestIdRef.current = requestId;
      } catch (err) {
        console.error('[EnhancedMiniPlayer] Autoplay failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.currentAlbum?.id, album?.id, state.playRequestId, audioUnlocked]);

  // Update visualization data when playing
  useEffect(() => {
    if (state.playbackState === PlaybackState.PLAYING && analyserRef.current) {
      let animationFrameId: number;
      
      const updateVisualization = () => {
        if (!analyserRef.current || !frequencyDataRef.current || !timeDataRef.current) return;
        
        analyserRef.current.getByteFrequencyData(frequencyDataRef.current);
        analyserRef.current.getByteTimeDomainData(timeDataRef.current);
        
        setFrequencyData(new Uint8Array(frequencyDataRef.current));
        setTimeDomainData(new Uint8Array(timeDataRef.current));
        
        animationFrameId = requestAnimationFrame(updateVisualization);
      };

      animationFrameId = requestAnimationFrame(updateVisualization);
      
      return () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
      };
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

      // Ensure AudioContext is running (user gesture is required by browsers).
      await Tone.start();
      if (Tone.context.state !== 'running') {
        setPlaybackState(PlaybackState.PAUSED);
        throw new Error('AudioContext is not running (user gesture required)');
      }

      ensureAnalyser();
      
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
    // Allow state update to propagate before starting playback
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        startPlayback();
      });
    });
  };

  const handlePrevious = () => {
    previous();
    // Allow state update to propagate before starting playback
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        startPlayback();
      });
    });
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
    // Allow state update to propagate before starting playback
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        startPlayback();
      });
    });
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
        <SpotifySquareDock
          album={state.currentAlbum}
          isPlaying={isPlaying}
          currentTime={state.currentTime}
          duration={state.duration}
          onPlayPause={handlePlayPause}
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
