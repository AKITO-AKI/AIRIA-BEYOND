import React from 'react';
import type { Album } from '../../contexts/AlbumContext';
import AlbumCard from '../gallery/AlbumCard';
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
            <AlbumCard
              variant="compact"
              className="queue-album-card"
              title={album.title || album.mood}
              mood={album.mood}
              imageUrl={album.imageDataURL}
              meta={formatDuration(album.musicMetadata?.duration || album.duration)}
              badges={[
                ...(album.musicData ? [{ label: '再生', tone: 'success' as const }] : []),
                ...(album.isFavorite ? [{ label: 'お気に入り', tone: 'warning' as const }] : []),
                ...(album.isPublic ? [{ label: '公開', tone: 'info' as const }] : []),
              ]}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
