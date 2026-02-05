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
  const { albums, selectAlbum, updateAlbum } = useAlbums();
  const { getSelectedAlbum } = useAlbums();
  const selectedAlbum = getSelectedAlbum();
  const { requestPlayAlbum } = useMusicPlayer();
  const { navigateToRoom } = useRoomNavigation();
  const [viewTab, setViewTab] = React.useState('shelf');
  const [filterMode, setFilterMode] = React.useState<'all' | 'public' | 'private' | 'favorite'>('all');
  const [sortMode, setSortMode] = React.useState<'new' | 'popular' | 'duration'>('new');
  const [badgePriority, setBadgePriority] = React.useState<'public' | 'favorite'>('public');
  
  const handleAlbumClick = (albumId: string) => {
    selectAlbum(albumId);
  };

  const handleAlbumOpen = (albumId: string) => {
    selectAlbum(albumId);
    navigateToRoom('album');
  };

  const musicQueue = React.useMemo(() => albums.filter(a => a.musicData), [albums]);
  const canOpen = Boolean(selectedAlbum);
  const canPlay = Boolean(selectedAlbum?.musicData);

  const filteredAlbums = React.useMemo(() => {
    const base = albums.filter((album) => {
      if (filterMode === 'public') return album.isPublic;
      if (filterMode === 'private') return !album.isPublic;
      if (filterMode === 'favorite') return album.isFavorite;
      return true;
    });

    const scorePopular = (album: typeof albums[number]) => {
      const durationScore = Number(album.duration || 0);
      const playableScore = album.musicData ? 1000 : 0;
      return playableScore + durationScore;
    };

    return base.slice().sort((a, b) => {
      if (sortMode === 'duration') return (b.duration || 0) - (a.duration || 0);
      if (sortMode === 'popular') return scorePopular(b) - scorePopular(a);
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }, [albums, filterMode, sortMode]);

  const sortLabel = sortMode === 'popular' ? '人気順' : sortMode === 'duration' ? '長さ順' : '新しい順';

  const shelfContent = (
    <div className="bookshelf-container">
      <div className={`gallery-shelf-stage ${filteredAlbums.length === 0 ? 'empty' : ''}`}>
        <div className="gallery-shelf-hint" aria-hidden="true">
          <span className="gallery-shelf-hint-pill">HINT</span>
          <span className="gallery-shelf-hint-text">右クリックで表紙 / 背表紙を切り替え（保存されます）</span>
        </div>
        <BookshelfCanvas
          albums={filteredAlbums}
          onBookClick={handleAlbumClick}
          onBookOpen={handleAlbumOpen}
          constellationEnabled={false}
        />
        {filteredAlbums.length === 0 && (
          <div className="empty-shelf-overlay">
            <EmptyState
              title="該当するアルバムがありません"
              description="フィルタ条件を変えるか、Mainルームでセッションを開始してください。"
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
            triggerAriaHaspopup="menu"
          >
            {({ close }) => (
              <Menu
                items={[
                  {
                    id: 'open',
                    label: 'アルバム詳細へ',
                    onSelect: () => {
                      navigateToRoom('album');
                      close();
                    },
                  },
                  {
                    id: 'publish',
                    label: 'SNSに公開',
                    onSelect: () => {
                      navigateToRoom('social');
                      close();
                    },
                  },
                  {
                    id: 'play',
                    label: '再生',
                    onSelect: () => {
                      if (!selectedAlbum) return;
                      requestPlayAlbum(selectedAlbum, musicQueue);
                      close();
                    },
                  },
                  {
                    id: 'favorite',
                    label: selectedAlbum?.isFavorite ? 'お気に入り解除' : 'お気に入り登録',
                    onSelect: () => {
                      if (!selectedAlbum) return;
                      updateAlbum(selectedAlbum.id, { isFavorite: !selectedAlbum.isFavorite });
                      close();
                    },
                  },
                  {
                    id: 'public',
                    label: selectedAlbum?.isPublic ? '非公開にする' : '公開にする',
                    onSelect: () => {
                      if (!selectedAlbum) return;
                      updateAlbum(selectedAlbum.id, { isPublic: !selectedAlbum.isPublic });
                      close();
                    },
                  },
                ]}
              />
            )}
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
              ...(selectedAlbum.isPublic ? [{ label: '公開中', tone: 'info' as const }] : []),
              ...(selectedAlbum.isFavorite ? [{ label: 'お気に入り', tone: 'warning' as const }] : []),
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
          <div className="gallery-filter-tags">
            <span className="filter-tag">{filterMode === 'all' ? '全件' : filterMode === 'public' ? '公開のみ' : filterMode === 'private' ? '非公開のみ' : 'お気に入り'}</span>
            <span className="filter-tag">{sortLabel}</span>
            <span className="filter-tag">バッジ優先: {badgePriority === 'public' ? '公開' : 'お気に入り'}</span>
          </div>
        </div>
        <div className="gallery-toolbar-right">
          <SegmentedControl
            value={badgePriority}
            onChange={(value) => setBadgePriority(value)}
            ariaLabel="バッジ優先"
            options={[
              { id: 'public', label: '公開優先' },
              { id: 'favorite', label: 'お気に入り優先' },
            ]}
          />
          <Popover
            triggerClassName="btn"
            trigger={<span>並び替え: {sortLabel}</span>}
            placement="bottom"
            triggerAriaHaspopup="menu"
          >
            {({ close }) => (
              <Menu
                items={[
                  { id: 'new', label: '新しい順', onSelect: () => { setSortMode('new'); close(); } },
                  { id: 'popular', label: '人気順', onSelect: () => { setSortMode('popular'); close(); } },
                  { id: 'duration', label: '長さ順', onSelect: () => { setSortMode('duration'); close(); } },
                ]}
              />
            )}
          </Popover>
        </div>
      </div>
      
      <Tabs items={tabs} value={viewTab} onChange={setViewTab} ariaLabel="ギャラリー表示" />
    </div>
  );
};

export default GalleryRoom;
