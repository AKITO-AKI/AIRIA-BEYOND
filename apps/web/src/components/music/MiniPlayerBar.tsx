import React from 'react';
import { PlaybackControls } from './PlaybackControls';
import { SeekBar } from './SeekBar';
import { VolumeControl } from './VolumeControl';
import { VisualizationCanvas } from './visualizations/VisualizationCanvas';
import type { Album } from '../../contexts/AlbumContext';
import './MiniPlayerBar.css';

interface MiniPlayerBarProps {
  album: Album | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  canPrevious: boolean;
  canNext: boolean;
  frequencyData: Uint8Array | null;
  timeDomainData: Uint8Array | null;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onExpand: () => void;
}

export const MiniPlayerBar: React.FC<MiniPlayerBarProps> = ({
  album,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  canPrevious,
  canNext,
  frequencyData,
  timeDomainData,
  onPlayPause,
  onPrevious,
  onNext,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onExpand,
}) => {
  const displayTitle = album
    ? `${album.title || album.mood} - ${album.musicMetadata?.key || 'Classical'} ${album.musicMetadata?.tempo || ''}BPM`
    : 'No track playing';

  const hasTrack = Boolean(album);

  const handleRootClick = () => {
    if (!hasTrack) return;
    onExpand();
  };

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`mini-player-bar ${hasTrack ? 'has-track' : 'empty'}`}
      role="button"
      tabIndex={hasTrack ? 0 : -1}
      aria-label={hasTrack ? '再生バーを開く' : '再生バー'}
      onClick={handleRootClick}
      onKeyDown={(e) => {
        if (!hasTrack) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onExpand();
        }
      }}
      data-no-swipe
    >
      <div className="mini-player-bar-content">
        {/* Album thumbnail */}
        {album && (
          <img
            src={album.imageDataURL}
            alt={album.title || album.mood}
            className="mini-player-thumbnail"
          />
        )}

        {/* Track info */}
        <div className="mini-player-info-section">
          <div className="mini-player-track-title">{displayTitle}</div>
          {album?.musicMetadata && (
            <div className="mini-player-track-meta">
              {album.musicMetadata.form} - {album.musicMetadata.character}
            </div>
          )}
        </div>

        {/* Playback controls */}
        <div className="mini-player-controls-section" onClick={stop} onMouseDown={stop} onTouchStart={stop}>
          <PlaybackControls
            isPlaying={isPlaying}
            canPrevious={canPrevious}
            canNext={canNext}
            shuffle={false}
            repeat="off"
            onPlayPause={onPlayPause}
            onPrevious={onPrevious}
            onNext={onNext}
            onShuffle={() => {}}
            onRepeat={() => {}}
          />
          <SeekBar
            currentTime={currentTime}
            duration={duration}
            onSeek={onSeek}
          />
        </div>

        {/* Volume control */}
        <div className="mini-player-volume-section" onClick={stop} onMouseDown={stop} onTouchStart={stop}>
          <VolumeControl
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={onVolumeChange}
            onMuteToggle={onMuteToggle}
          />
        </div>

        {/* Mini visualization */}
        <div className="mini-player-visualization-section">
          <VisualizationCanvas
            mode="waveform"
            frequencyData={frequencyData}
            timeDomainData={timeDomainData}
            isPlaying={isPlaying}
            width={100}
            height={40}
            mini={true}
          />
        </div>

        {/* Expand button */}
        <button
          className="mini-player-expand-button"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          aria-label="Expand player"
          title="Expand player"
        >
          詳細
        </button>
      </div>
    </div>
  );
};
