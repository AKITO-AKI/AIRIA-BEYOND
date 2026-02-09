import React from 'react';
import { useAlbums, Album } from '../../contexts/AlbumContext';
import './GalleryRoom.css';

// P3: Provider label mapping utility
const getProviderLabel = (provider?: string): string => {
  if (!provider) return '';
  return provider === 'local' ? 'ローカル' : 'AI生成';
};

// P3: Provider badge display
const getProviderBadge = (provider?: string): string => {
  if (!provider) return '';
  return provider === 'local' ? 'ローカル' : 'AI';
};

const GalleryRoom: React.FC = () => {
  const { albums, selectAlbum } = useAlbums();

  const handleAlbumClick = (albumId: string) => {
    selectAlbum(albumId);
    // Navigation will be handled by clicking on the Album room indicator
  };

  // P3: Format metadata for tooltip
  const formatMetadata = (album: Album): string => {
    const parts: string[] = [];
    
    if (album.metadata) {
      if (album.metadata.motif_tags && album.metadata.motif_tags.length > 0) {
        parts.push(album.metadata.motif_tags.slice(0, 3).join(', '));
      }
      if (album.metadata.stylePreset) {
        parts.push(`Style: ${album.metadata.stylePreset}`);
      }
      if (album.metadata.provider) {
        parts.push(getProviderLabel(album.metadata.provider));
      }
    }
    
    return parts.length > 0 ? parts.join(' • ') : '';
  };

  return (
    <div className="room-content gallery-room">
      <h1 className="room-title">GALLERY</h1>
      <p className="room-subtitle">あなたの感情コレクション</p>
      
      <div className="bookshelf-container">
        {albums.length === 0 ? (
          <div className="empty-shelf">
            <p>まだアルバムがありません</p>
            <p className="empty-shelf-hint">Mainルームでセッションを保存してください</p>
          </div>
        ) : (
          <div className="bookshelf">
            {albums.map((album) => (
              <div
                key={album.id}
                className="book-spine"
                onClick={() => handleAlbumClick(album.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleAlbumClick(album.id);
                  }
                }}
                aria-label={`Album: ${album.mood} - ${new Date(album.createdAt).toLocaleDateString()}`}
                title={formatMetadata(album)}
              >
                <div className="book-spine-content">
                  <div className="book-spine-title">{album.mood}</div>
                  <div className="book-spine-date">
                    {new Date(album.createdAt).toLocaleDateString('ja-JP', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  {/* P3: Show provider badge */}
                  {album.metadata?.provider && (
                    <div className="book-spine-badge">
                      {getProviderBadge(album.metadata.provider)}
                    </div>
                  )}
                </div>
                <div className="book-spine-preview">
                  <img src={album.imageDataURL} alt="" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GalleryRoom;
