import React from 'react';
import { useAlbums } from '../../contexts/AlbumContext';
import { useMusicPlayer } from '../../contexts/MusicPlayerContext';
import { useRoomNavigation } from '../../contexts/RoomNavigationContext';
import BookshelfCanvas from '../gallery/BookshelfCanvas';
import EmptyState from '../visual/feedback/EmptyState';
import GeometricCanvas from '../visual/GeometricCanvas';
import './GalleryRoom.css';

const GalleryRoom: React.FC = () => {
  const { albums, selectAlbum } = useAlbums();
  const { getSelectedAlbum } = useAlbums();
  const selectedAlbum = getSelectedAlbum();
  const { requestPlayAlbum } = useMusicPlayer();
  const { navigateToRoom } = useRoomNavigation();
  
  const handleAlbumClick = (albumId: string) => {
    selectAlbum(albumId);
  };

  const musicQueue = React.useMemo(() => albums.filter(a => a.musicData), [albums]);
  const canOpen = Boolean(selectedAlbum);
  const canPlay = Boolean(selectedAlbum?.musicData);

  return (
    <div className="room-content gallery-room">
      <GeometricCanvas
        pattern="polyhedron"
        isActive={false}
        layer="background"
        placement="topRight"
        sizePx={360}
        opacity={0.08}
      />
      <h1 className="room-title">GALLERY</h1>
      <p className="room-subtitle">スクロールで時間を辿り、クリックで選ぶ</p>
      
      <div className="bookshelf-container">
        <div className={`gallery-shelf-stage ${albums.length === 0 ? 'empty' : ''}`}>
          <BookshelfCanvas
            albums={albums}
            onBookClick={handleAlbumClick}
            constellationEnabled={false}
          />
          {albums.length === 0 && (
            <div className="empty-shelf-overlay">
              <EmptyState
                title="まだアルバムがありません"
                description="Mainルームでセッションを開始すると、棚にアルバムが生まれます。"
                actionLabel="セッションを始める"
                onAction={() => navigateToRoom('main')}
                icon={<span className="empty-icon-shape" aria-hidden="true" />}
              />
            </div>
          )}
        </div>

        <div className="gallery-actionbar" aria-label="選択中アルバムの操作">
          <div className="gallery-selection">
            <div className="gallery-selection-label">選択中</div>
            <div className="gallery-selection-value">
              {selectedAlbum ? selectedAlbum.mood : '未選択'}
            </div>
          </div>

          <div className="gallery-actions">
            <button
              className="btn btn-primary"
              disabled={!canOpen}
              onClick={() => navigateToRoom('album')}
            >
              開く
            </button>
            <button
              className="btn btn-primary"
              disabled={!canPlay || !selectedAlbum}
              onClick={() => {
                if (!selectedAlbum) return;
                requestPlayAlbum(selectedAlbum, musicQueue);
              }}
            >
              再生
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GalleryRoom;
