import React from 'react';
import { useAlbums } from '../../contexts/AlbumContext';
import './AlbumRoom.css';

const AlbumRoom: React.FC = () => {
  const { getSelectedAlbum, selectAlbum } = useAlbums();
  const album = getSelectedAlbum();

  const handleBackToGallery = () => {
    selectAlbum(null);
  };

  if (!album) {
    return (
      <div className="room-content album-room">
        <h1 className="room-title">ALBUM</h1>
        <p className="room-subtitle">アルバム詳細</p>
        <div className="album-empty">
          <p>アルバムが選択されていません</p>
          <p className="album-empty-hint">Galleryからアルバムを選択してください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="room-content album-room">
      <div className="album-header">
        <button 
          className="back-to-gallery-btn"
          onClick={handleBackToGallery}
          aria-label="ギャラリーに戻る"
        >
          ← ギャラリーへ
        </button>
        <h1 className="album-title">{album.mood}</h1>
      </div>

      <div className="album-details">
        <div className="album-image-container">
          <img 
            src={album.imageDataURL} 
            alt={`${album.mood}のセッション画像`}
            className="album-image"
          />
        </div>

        <div className="album-metadata">
          <div className="metadata-item">
            <span className="metadata-label">ムード</span>
            <span className="metadata-value">{album.mood}</span>
          </div>

          <div className="metadata-item">
            <span className="metadata-label">セッション時間</span>
            <span className="metadata-value">{album.duration}秒</span>
          </div>

          <div className="metadata-item">
            <span className="metadata-label">作成日</span>
            <span className="metadata-value">
              {new Date(album.createdAt).toLocaleString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          <div className="metadata-item">
            <span className="metadata-label">アルバムID</span>
            <span className="metadata-value metadata-id">{album.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlbumRoom;
