import React from 'react';
import type { Album } from '../../contexts/AlbumContext';
import './SpotifySquareDock.css';

interface SpotifySquareDockProps {
  album: Album | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onExpand: () => void;
}

export const SpotifySquareDock: React.FC<SpotifySquareDockProps> = ({
  album,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onExpand,
}) => {
  if (!album) return null;

  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="spotify-square-dock"
      role="button"
      tabIndex={0}
      aria-label="プレイヤーを開く"
      onClick={onExpand}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onExpand();
        }
      }}
      data-no-swipe
    >
      <img
        className="spotify-square-dock-art"
        src={album.imageDataURL}
        alt={album.title || album.mood}
        draggable={false}
      />

      <div className="spotify-square-dock-overlay" aria-hidden="true" />

      <button
        className="spotify-square-dock-play"
        onClick={(e) => {
          stop(e);
          onPlayPause();
        }}
        onMouseDown={stop}
        onTouchStart={stop}
        aria-label={isPlaying ? '一時停止' : '再生'}
        title={isPlaying ? '一時停止' : '再生'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <div className="spotify-square-dock-progress" aria-hidden="true">
        <div className="spotify-square-dock-progressFill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      <div className="spotify-square-dock-hint" aria-hidden="true">
        <div className="spotify-square-dock-title">{album.title || album.mood}</div>
      </div>
    </div>
  );
};
