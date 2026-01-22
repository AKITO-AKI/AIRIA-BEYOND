import React, { useRef, useState } from 'react';
import './SeekBar.css';

interface SeekBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  color?: string;
}

export const SeekBar: React.FC<SeekBarProps> = ({
  currentTime,
  duration,
  onSeek,
  color = '#4a90e2',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (clientX: number) => {
    if (!trackRef.current || duration === 0) return;

    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const seekTime = percent * duration;

    onSeek(seekTime);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleSeek(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      handleSeek(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="seek-bar-container">
      <span className="seek-time current">{formatTime(currentTime)}</span>
      <div
        ref={trackRef}
        className="seek-track"
        onMouseDown={handleMouseDown}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
      >
        <div
          className="seek-progress"
          style={{
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${color}cc, ${color})`,
          }}
        >
          <div className="seek-thumb" />
        </div>
      </div>
      <span className="seek-time total">{formatTime(duration)}</span>
    </div>
  );
};
