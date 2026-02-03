import React, { useState, useEffect, useRef } from 'react';
import { getGlobalPlayer } from '../utils/midiPlayer';
import type { Album } from '../contexts/AlbumContext';
import { useMusicPlayer } from '../contexts/MusicPlayerContext';
import './MiniPlayer.css';

interface MiniPlayerProps {
  trackTitle?: string;
  album?: Album; // P4: Support album with music data
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({ trackTitle, album }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // C-1: Music player context for background dye system
  const { setPlaying, setCurrentAlbum } = useMusicPlayer();
  
  // Legacy oscillator refs (for backwards compatibility when no album)
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // P4: MIDI player ref
  const playerRef = useRef(getGlobalPlayer());

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopAudio();
    };
  }, []);

  // Load MIDI when album changes
  useEffect(() => {
    if (album?.musicData) {
      loadMIDI(album.musicData);
      setCurrentAlbum(album.imageUrl, album.title);
    }
  }, [album?.musicData, album?.imageUrl, album?.title]);

  const loadMIDI = async (midiData: string) => {
    try {
      setError(null);
      const player = playerRef.current;
      
      await player.loadMIDI(midiData);
      
      const state = player.getState();
      setDuration(state.duration);
      
      console.log('[MiniPlayer] MIDI loaded successfully');
    } catch (err) {
      console.error('[MiniPlayer] Failed to load MIDI:', err);
      setError('音楽の読み込みに失敗しました');
    }
  };

  const startAudio = async () => {
    try {
      setError(null);
      
      // If we have album music data, use MIDI player
      if (album?.musicData) {
        const player = playerRef.current;
        await player.play();
        setIsPlaying(true);
        setPlaying(true); // C-1: Update context for background dye
        
        // Track progress
        const progressInterval = window.setInterval(() => {
          const state = player.getState();
          setCurrentTime(state.currentTime);
          setDuration(state.duration);
          setProgress((state.currentTime / state.duration) * 100);
          
          if (!state.isPlaying && !state.isPaused) {
            // Playback ended
            clearInterval(progressInterval);
            setIsPlaying(false);
            setPlaying(false); // C-1: Update context
            setProgress(0);
          }
        }, 100);
        
        progressIntervalRef.current = progressInterval;
      } else {
        // Legacy oscillator-based playback
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) {
          console.warn('AudioContext not supported');
          return;
        }
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.5);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillatorRef.current = oscillator;
        gainNodeRef.current = gainNode;

        oscillator.start();
        setIsPlaying(true);
        setPlaying(true); // C-1: Update context

        let currentProgress = 0;
        progressIntervalRef.current = window.setInterval(() => {
          currentProgress = (currentProgress + 0.5) % 100;
          setProgress(currentProgress);
        }, 100);
      }
    } catch (err) {
      console.error('Failed to start audio:', err);
      setError('再生の開始に失敗しました');
    }
  };

  const stopAudio = () => {
    // Stop MIDI player if active
    if (album?.musicData) {
      const player = playerRef.current;
      player.pause();
    }
    
    // Clean up legacy oscillator
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      } catch (error) {
        // Oscillator might already be stopped
      }
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setIsPlaying(false);
    setPlaying(false); // C-1: Update context
    if (!album?.musicData) {
      setProgress(0);
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      startAudio();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!album?.musicData || duration === 0) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const seekTime = percent * duration;
    
    const player = playerRef.current;
    player.seek(seekTime);
    setCurrentTime(seekTime);
    setProgress(percent * 100);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine title
  const displayTitle = album ? 
    `${album.title || album.mood} - ${album.musicMetadata?.key || 'Classical'} ${album.musicMetadata?.tempo || ''}BPM` :
    trackTitle || 'Ambient Mood';

  return (
    <div className="mini-player">
      <div className="mini-player-content">
        <button 
          className="mini-player-button"
          onClick={togglePlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          disabled={!!error}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <div className="mini-player-info">
          <div className="mini-player-title">{displayTitle}</div>
          {album?.musicMetadata && (
            <div className="mini-player-metadata">
              {album.musicMetadata.form} - {album.musicMetadata.character}
            </div>
          )}
          <div 
            className="mini-player-progress"
            onClick={handleSeek}
            style={{ cursor: album?.musicData ? 'pointer' : 'default' }}
          >
            <div 
              className="mini-player-progress-bar"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          {album?.musicData && duration > 0 && (
            <div className="mini-player-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          )}
          {error && (
            <div className="mini-player-error">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MiniPlayer;
