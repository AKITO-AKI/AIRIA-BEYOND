import React from 'react';
import { useAlbums } from '../../contexts/AlbumContext';
import './GalleryRoom.css';

const GalleryRoom: React.FC = () => {
  const { albums, selectAlbum } = useAlbums();

  const handleAlbumClick = (albumId: string) => {
    selectAlbum(albumId);
    // Navigation will be handled by clicking on the Album room indicator
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
              >
                <div className="book-spine-content">
                  <div className="book-spine-title">{album.mood}</div>
                  <div className="book-spine-date">
                    {new Date(album.createdAt).toLocaleDateString('ja-JP', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
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
