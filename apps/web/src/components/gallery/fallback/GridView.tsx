import React from 'react';
import { Album } from '../../../contexts/AlbumContext';
import './GridView.css';

interface GridViewProps {
  albums: Album[];
  onAlbumClick: (albumId: string) => void;
}

const GridView: React.FC<GridViewProps> = ({ albums, onAlbumClick }) => {
  const getProviderBadge = (provider?: string): string => {
    if (!provider) return '';
    return provider === 'replicate' ? 'AI' : 'ローカル';
  };

  return (
    <div className="grid-view">
      {albums.map((album) => (
        <div
          key={album.id}
          className="grid-card"
          onClick={() => onAlbumClick(album.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onAlbumClick(album.id);
            }
          }}
        >
          <div className="grid-card-image">
            <img src={album.imageDataURL} alt={album.mood} />
            {album.metadata?.provider && (
              <div className="grid-card-badge">
                {getProviderBadge(album.metadata.provider)}
              </div>
            )}
          </div>
          <div className="grid-card-content">
            <h3 className="grid-card-title">{album.mood}</h3>
            <p className="grid-card-date">
              {new Date(album.createdAt).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            {album.musicMetadata?.duration && (
              <p className="grid-card-duration">
                ♪ {Math.floor(album.musicMetadata.duration)}秒
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default GridView;
