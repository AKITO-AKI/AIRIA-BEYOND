import React, { useState, useEffect, useRef } from 'react';
import './MiniPlayer.css';

interface MiniPlayerProps {
  trackTitle?: string;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({ trackTitle = 'Ambient Mood' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const startAudio = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Create oscillator for ambient tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(220, audioContext.currentTime); // A3 note
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.5); // Gentle fade in

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillatorRef.current = oscillator;
      gainNodeRef.current = gainNode;

      oscillator.start();

      // Start progress animation
      let currentProgress = 0;
      progressIntervalRef.current = window.setInterval(() => {
        currentProgress = (currentProgress + 0.5) % 100;
        setProgress(currentProgress);
      }, 100);
    } catch (error) {
      console.error('Failed to start audio:', error);
    }
  };

  const stopAudio = () => {
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

    setProgress(0);
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
    } else {
      startAudio();
      setIsPlaying(true);
    }
  };

  return (
    <div className="mini-player">
      <div className="mini-player-content">
        <button 
          className="mini-player-button"
          onClick={togglePlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <div className="mini-player-info">
          <div className="mini-player-title">{trackTitle}</div>
          <div className="mini-player-progress">
            <div 
              className="mini-player-progress-bar"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MiniPlayer;
