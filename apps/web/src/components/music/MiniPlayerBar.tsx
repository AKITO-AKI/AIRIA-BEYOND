import React, { useState } from 'react';
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
  const [isDocked, setIsDocked] = useState(false);
  const displayTitle = album
    ? `${album.mood} - ${album.musicMetadata?.key || 'Classical'} ${album.musicMetadata?.tempo || ''}BPM`
    : 'No track playing';

  return (
    <>
      <div className={`mini-player-bar ${isDocked ? 'is-docked' : ''}`}>
        <div className="mini-player-bar-content">
          {/* Album thumbnail */}
          {album && (
            <img
              src={album.imageDataURL}
              alt={album.mood}
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
          <div className="mini-player-controls-section">
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
          <div className="mini-player-volume-section">
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
            onClick={onExpand}
            aria-label="Expand player"
            title="Expand player"
          >
            ⌃
          </button>
        </div>
      </div>
      <button
        className={`mini-player-dock ${isDocked ? 'is-docked' : ''}`}
        type="button"
        onClick={() => setIsDocked((prev) => !prev)}
        aria-pressed={isDocked}
        aria-label={isDocked ? 'プレイヤーを表示' : 'プレイヤーを隠す'}
      >
        {isDocked ? 'PLAYER' : 'HIDE'}
      </button>
    </>
  );
};
