import React from 'react';
import './PlaybackControls.css';

interface PlaybackControlsProps {
  isPlaying: boolean;
  canPrevious: boolean;
  canNext: boolean;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  expanded?: boolean;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  canPrevious,
  canNext,
  shuffle,
  repeat,
  onPlayPause,
  onPrevious,
  onNext,
  onShuffle,
  onRepeat,
  expanded = false,
}) => {
  const getRepeatIcon = () => {
    if (repeat === 'one') return '🔂';
    if (repeat === 'all') return '🔁';
    return '🔁';
  };

  return (
    <div className={`playback-controls ${expanded ? 'expanded' : ''}`}>
      {expanded && (
        <button
          className={`control-button secondary ${shuffle ? 'active' : ''}`}
          onClick={onShuffle}
          aria-label="Shuffle"
          title="Shuffle"
        >
          🔀
        </button>
      )}
      
      <button
        className="control-button"
        onClick={onPrevious}
        disabled={!canPrevious}
        aria-label="Previous"
        title="Previous track"
      >
        ⏮
      </button>

      <button
        className="control-button primary"
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <button
        className="control-button"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next"
        title="Next track"
      >
        ⏭
      </button>

      {expanded && (
        <button
          className={`control-button secondary ${repeat !== 'off' ? 'active' : ''}`}
          onClick={onRepeat}
          aria-label={`Repeat: ${repeat}`}
          title={`Repeat: ${repeat}`}
        >
          {getRepeatIcon()}
          {repeat === 'one' && <span className="repeat-indicator">1</span>}
        </button>
      )}
    </div>
  );
};
