import React from 'react';
import type { Album } from '../../contexts/AlbumContext';
import './QueuePreview.css';

interface QueuePreviewProps {
  queue: Album[];
  currentIndex: number;
  onSkipTo: (index: number) => void;
}

export const QueuePreview: React.FC<QueuePreviewProps> = ({
  queue,
  currentIndex,
  onSkipTo,
}) => {
  // Show next 3 tracks
  const upcomingTracks = queue.slice(currentIndex + 1, currentIndex + 4);

  if (upcomingTracks.length === 0) {
    return null;
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="queue-preview">
      <div className="queue-label">Up Next</div>
      <div className="queue-items">
        {upcomingTracks.map((album, i) => (
          <div
            key={album.id}
            className="queue-item"
            onClick={() => onSkipTo(currentIndex + i + 1)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSkipTo(currentIndex + i + 1);
              }
            }}
          >
            <img
              src={album.imageDataURL}
              alt={album.title || album.mood}
              className="queue-thumbnail"
            />
            <div className="queue-info">
              <div className="queue-title">{album.title || album.mood}</div>
              <div className="queue-duration">
                {formatDuration(album.musicMetadata?.duration || album.duration)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
