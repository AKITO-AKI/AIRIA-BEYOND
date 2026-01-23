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
  const IconPlay = () => (
    <svg viewBox="0 0 24 24" className="control-icon-svg" aria-hidden="true">
      <polygon points="8,6 8,18 18,12" />
    </svg>
  );

  const IconPause = () => (
    <svg viewBox="0 0 24 24" className="control-icon-svg" aria-hidden="true">
      <rect x="7" y="6" width="4" height="12" rx="1" />
      <rect x="13" y="6" width="4" height="12" rx="1" />
    </svg>
  );

  const IconPrev = () => (
    <svg viewBox="0 0 24 24" className="control-icon-svg" aria-hidden="true">
      <rect x="6" y="6" width="2" height="12" rx="1" />
      <polygon points="18,6 10,12 18,18" />
    </svg>
  );

  const IconNext = () => (
    <svg viewBox="0 0 24 24" className="control-icon-svg" aria-hidden="true">
      <polygon points="6,6 14,12 6,18" />
      <rect x="16" y="6" width="2" height="12" rx="1" />
    </svg>
  );

  const IconShuffle = () => (
    <svg viewBox="0 0 24 24" className="control-icon-svg" aria-hidden="true">
      <path d="M4 7h6l4 4 2-2 4 4" />
      <path d="M4 17h6l4-4 2 2 4-4" />
    </svg>
  );

  const IconRepeat = () => (
    <svg viewBox="0 0 24 24" className="control-icon-svg" aria-hidden="true">
      <path d="M7 7h10v4" />
      <path d="M17 17H7v-4" />
      <path d="M17 7l3 3-3 3" />
      <path d="M7 17l-3-3 3-3" />
    </svg>
  );

  return (
    <div className={`playback-controls ${expanded ? 'expanded' : ''}`}>
      {expanded && (
        <button
          className={`control-button secondary ${shuffle ? 'active' : ''}`}
          onClick={onShuffle}
          aria-label="Shuffle"
          title="Shuffle"
        >
          <IconShuffle />
        </button>
      )}
      
      <button
        className="control-button"
        onClick={onPrevious}
        disabled={!canPrevious}
        aria-label="Previous"
        title="Previous track"
      >
        <IconPrev />
      </button>

      <button
        className="control-button primary"
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <IconPause /> : <IconPlay />}
      </button>

      <button
        className="control-button"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next"
        title="Next track"
      >
        <IconNext />
      </button>

      {expanded && (
        <button
          className={`control-button secondary ${repeat !== 'off' ? 'active' : ''}`}
          onClick={onRepeat}
          aria-label={`Repeat: ${repeat}`}
          title={`Repeat: ${repeat}`}
        >
          <IconRepeat />
          {repeat === 'one' && <span className="repeat-indicator">1</span>}
        </button>
      )}
    </div>
  );
};
