import React from 'react';
import { useAlbums } from '../../contexts/AlbumContext';
import { useMusicPlayer } from '../../contexts/MusicPlayerContext';
import { useRoomNavigation } from '../../contexts/RoomNavigationContext';
import BookshelfCanvas from '../gallery/BookshelfCanvas';
import AlbumCard from '../gallery/AlbumCard';
import EmptyState from '../visual/feedback/EmptyState';
import GeometricCanvas from '../visual/GeometricCanvas';
import Popover from '../ui/Popover';
import Menu from '../ui/Menu';
import Tabs from '../ui/Tabs';
import SegmentedControl from '../ui/SegmentedControl';
import './GalleryRoom.css';

const GalleryRoom: React.FC = () => {
  const { albums, selectAlbum } = useAlbums();
  const { getSelectedAlbum } = useAlbums();
  const selectedAlbum = getSelectedAlbum();
  const { requestPlayAlbum } = useMusicPlayer();
  const { navigateToRoom } = useRoomNavigation();
  const [viewTab, setViewTab] = React.useState('shelf');
  const [filterMode, setFilterMode] = React.useState<'all' | 'public' | 'private' | 'favorite'>('all');
  const [sortMode, setSortMode] = React.useState<'new' | 'popular' | 'duration'>('new');
  
  const handleAlbumClick = (albumId: string) => {
    selectAlbum(albumId);
  };

  const musicQueue = React.useMemo(() => albums.filter(a => a.musicData), [albums]);
  const canOpen = Boolean(selectedAlbum);
  const canPlay = Boolean(selectedAlbum?.musicData);

  const sortLabel = sortMode === 'popular' ? '人気順' : sortMode === 'duration' ? '長さ順' : '新しい順';

  const shelfContent = (
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

      <div className="gallery-actionbar room-card" data-no-swipe="true" aria-label="選択中アルバムの操作">
        <div className="gallery-selection">
          <div className="gallery-selection-label">選択中</div>
          <div className="gallery-selection-value">
            {selectedAlbum ? (selectedAlbum.title || selectedAlbum.mood) : '未選択'}
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
          <button
            className="btn"
            disabled={!canOpen}
            onClick={() => navigateToRoom('social')}
          >
            公開
          </button>
          <Popover
            triggerClassName="btn"
            trigger={<span>その他</span>}
            placement="top"
          >
            <Menu
              items={[
                {
                  id: 'open',
                  label: 'アルバム詳細へ',
                  onSelect: () => navigateToRoom('album'),
                },
                {
                  id: 'publish',
                  label: 'SNSに公開',
                  onSelect: () => navigateToRoom('social'),
                },
                {
                  id: 'play',
                  label: '再生',
                  onSelect: () => {
                    if (!selectedAlbum) return;
                    requestPlayAlbum(selectedAlbum, musicQueue);
                  },
                },
              ]}
            />
          </Popover>
        </div>
      </div>
    </div>
  );

  const focusContent = (
    <div className="gallery-focus">
      {selectedAlbum ? (
        <div className="gallery-focus-card room-card">
          <AlbumCard
            title={selectedAlbum.title || selectedAlbum.mood}
            mood={selectedAlbum.mood}
            imageUrl={selectedAlbum.imageDataURL}
            meta={`作成日: ${new Date(selectedAlbum.createdAt).toLocaleDateString('ja-JP')}`}
            badges={[
              { label: selectedAlbum.musicData ? '再生可能' : '音声なし', tone: selectedAlbum.musicData ? 'success' : 'default' },
            ]}
          />
          <div className="gallery-focus-actions">
            <button className="btn btn-primary" onClick={() => navigateToRoom('album')}>
              詳細へ
            </button>
            <button
              className="btn btn-primary"
              disabled={!selectedAlbum.musicData}
              onClick={() => requestPlayAlbum(selectedAlbum, musicQueue)}
            >
              再生
            </button>
            <button className="btn" onClick={() => navigateToRoom('social')}>
              公開
            </button>
          </div>
        </div>
      ) : (
        <div className="gallery-focus-empty room-card">
          <div className="gallery-selection-label">アルバム未選択</div>
          <div className="gallery-selection-value">棚から選択すると詳細が表示されます。</div>
        </div>
      )}
    </div>
  );

  const tabs = [
    { id: 'shelf', label: 'Shelf', content: shelfContent },
    { id: 'focus', label: 'Focus', content: focusContent },
  ];

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

      <div className="gallery-toolbar room-card" data-no-swipe="true">
        <div className="gallery-toolbar-left">
          <SegmentedControl
            value={filterMode}
            onChange={(value) => setFilterMode(value)}
            ariaLabel="表示フィルター"
            options={[
              { id: 'all', label: 'すべて' },
              { id: 'public', label: '公開' },
              { id: 'private', label: '非公開' },
              { id: 'favorite', label: 'お気に入り' },
            ]}
          />
        </div>
        <div className="gallery-toolbar-right">
          <Popover
            triggerClassName="btn"
            trigger={<span>並び替え: {sortLabel}</span>}
            placement="bottom"
          >
            <Menu
              items={[
                { id: 'new', label: '新しい順', onSelect: () => setSortMode('new') },
                { id: 'popular', label: '人気順', onSelect: () => setSortMode('popular') },
                { id: 'duration', label: '長さ順', onSelect: () => setSortMode('duration') },
              ]}
            />
          </Popover>
        </div>
      </div>
      
      <Tabs items={tabs} value={viewTab} onChange={setViewTab} ariaLabel="ギャラリー表示" />
    </div>
  );
};

export default GalleryRoom;
