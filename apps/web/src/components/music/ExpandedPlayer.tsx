import React, { useEffect, useMemo, useState } from 'react';
import { PlaybackControls } from './PlaybackControls';
import { SeekBar } from './SeekBar';
import { VolumeControl } from './VolumeControl';
import { QueuePreview } from './QueuePreview';
import { VisualizationCanvas } from './visualizations/VisualizationCanvas';
import { MotifOrbit } from './MotifOrbit';
import type { Album } from '../../contexts/AlbumContext';
import type { VisualizationMode, RepeatMode } from '../../contexts/MusicPlayerContext';
import { useAlbums } from '../../contexts/AlbumContext';
import './ExpandedPlayer.css';

interface ExpandedPlayerProps {
  album: Album | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  canPrevious: boolean;
  canNext: boolean;
  visualizationMode: VisualizationMode;
  queue: Album[];
  queueIndex: number;
  frequencyData: Uint8Array | null;
  timeDomainData: Uint8Array | null;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onVisualizationModeChange: (mode: VisualizationMode) => void;
  onSkipToIndex: (index: number) => void;
  onClose: () => void;
}

export const ExpandedPlayer: React.FC<ExpandedPlayerProps> = ({
  album,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  shuffle,
  repeat,
  canPrevious,
  canNext,
  visualizationMode,
  queue,
  queueIndex,
  frequencyData,
  timeDomainData,
  onPlayPause,
  onPrevious,
  onNext,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onShuffle,
  onRepeat,
  onVisualizationModeChange,
  onSkipToIndex,
  onClose,
}) => {
  const { updateAlbum } = useAlbums();

  const albumId = album?.id || null;
  const [memoDraft, setMemoDraft] = useState('');

  useEffect(() => {
    setMemoDraft(album?.memo || '');
  }, [albumId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        onPlayPause();
      } else if (e.key === 'ArrowLeft') {
        onSeek(Math.max(0, currentTime - 5));
      } else if (e.key === 'ArrowRight') {
        onSeek(Math.min(duration, currentTime + 5));
      } else if (e.key === 'ArrowUp') {
        onVolumeChange(Math.min(1, volume + 0.1));
      } else if (e.key === 'ArrowDown') {
        onVolumeChange(Math.max(0, volume - 0.1));
      } else if (e.key === 'm' || e.key === 'M') {
        onMuteToggle();
      } else if (e.key === 'n' || e.key === 'N') {
        onNext();
      } else if (e.key === 'p' || e.key === 'P') {
        onPrevious();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration, volume, onClose, onPlayPause, onSeek, onVolumeChange, onMuteToggle, onNext, onPrevious]);

  // Get dominant color (simplified)
  const dominantColor = '#D4AF37';

  // Get motif tags
  const motifTags = album?.metadata?.motif_tags || [];

  const memoPlaceholder = useMemo(
    () => 'メモ（ひとこと）。聴きながら思い出したこと、今の気分、景色…',
    []
  );

  return (
    <>
      {/* Backdrop */}
      <div className="expanded-player-backdrop" onClick={onClose} />

      {/* Modal */}
      <div className="expanded-player-modal" role="dialog" aria-modal="true">
        {/* Close button */}
        <button
          className="expanded-player-close"
          onClick={onClose}
          aria-label="Close player"
          title="Close (Esc)"
        >
          X
        </button>

        {/* Minimize button */}
        <button
          className="expanded-player-minimize"
          onClick={onClose}
          aria-label="Minimize player"
          title="Minimize"
        >
          -
        </button>

        {/* Main content */}
        <div className="expanded-player-content">
          {/* Album image section */}
          <div className="expanded-player-album-section">
            <div className="expanded-player-album-container">
              {album && (
                <>
                  <img
                    src={album.imageDataURL}
                    alt={album.title || album.mood}
                    className="expanded-player-album-image"
                  />
                  {/* Motif tags orbiting */}
                  {motifTags.length > 0 && (
                    <MotifOrbit
                      tags={motifTags}
                      centerX={200}
                      centerY={200}
                      isPlaying={isPlaying}
                    />
                  )}
                </>
              )}
            </div>

            {/* Album metadata */}
            {album && (
              <div className="expanded-player-album-meta">
                <h2 className="expanded-player-album-title">{album.title || album.mood}</h2>
                {album.musicMetadata && (
                  <p className="expanded-player-album-details">
                    {album.musicMetadata.key} • {album.musicMetadata.tempo} BPM • {album.musicMetadata.timeSignature}
                  </p>
                )}
                {album.musicMetadata?.character && (
                  <p className="expanded-player-album-character">
                    {album.musicMetadata.character}
                  </p>
                )}

                <div className="expanded-player-memo">
                  <div className="expanded-player-memo-label">メモ</div>
                  <textarea
                    className="expanded-player-memo-input"
                    value={memoDraft}
                    onChange={(e) => setMemoDraft(e.target.value)}
                    onBlur={() => {
                      if (!album) return;
                      const next = memoDraft.trim();
                      if ((album.memo || '') === next) return;
                      updateAlbum(album.id, { memo: next || undefined });
                    }}
                    placeholder={memoPlaceholder}
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Visualization section */}
          <div className="expanded-player-visualization-section">
            <VisualizationCanvas
              mode={visualizationMode}
              frequencyData={frequencyData}
              timeDomainData={timeDomainData}
              isPlaying={isPlaying}
              dominantColor={dominantColor}
              width={800}
              height={200}
            />

            {/* Visualization mode toggle */}
            <div className="visualization-mode-toggle">
              <button
                className={visualizationMode === 'waveform' ? 'active' : ''}
                onClick={() => onVisualizationModeChange('waveform')}
                title="Waveform"
              >
                波形
              </button>
              <button
                className={visualizationMode === 'spectrum' ? 'active' : ''}
                onClick={() => onVisualizationModeChange('spectrum')}
                title="Spectrum Bars"
              >
                バー
              </button>
              <button
                className={visualizationMode === 'radial' ? 'active' : ''}
                onClick={() => onVisualizationModeChange('radial')}
                title="Radial Spectrum"
              >
                円形
              </button>
            </div>
          </div>

          {/* Controls section */}
          <div className="expanded-player-controls-section">
            <PlaybackControls
              isPlaying={isPlaying}
              canPrevious={canPrevious}
              canNext={canNext}
              shuffle={shuffle}
              repeat={repeat}
              onPlayPause={onPlayPause}
              onPrevious={onPrevious}
              onNext={onNext}
              onShuffle={onShuffle}
              onRepeat={onRepeat}
              expanded={true}
            />

            <SeekBar
              currentTime={currentTime}
              duration={duration}
              onSeek={onSeek}
              color={dominantColor}
            />

            <VolumeControl
              volume={volume}
              isMuted={isMuted}
              onVolumeChange={onVolumeChange}
              onMuteToggle={onMuteToggle}
              expanded={true}
            />
          </div>

          {/* Queue preview */}
          <QueuePreview
            queue={queue}
            currentIndex={queueIndex}
            onSkipTo={onSkipToIndex}
          />
        </div>
      </div>
    </>
  );
};
