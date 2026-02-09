import React from 'react';
import { useAlbums } from '../../contexts/AlbumContext';
import { useRoomNavigation } from '../../contexts/RoomNavigationContext';
import { useMusicPlayer } from '../../contexts/MusicPlayerContext';
import AlbumCard from '../gallery/AlbumCard';
import Tabs from '../ui/Tabs';
import './MusicRoom.css';

const MusicRoom: React.FC = () => {
  const { albums, getSelectedAlbum, selectAlbum } = useAlbums();
  const selectedAlbum = getSelectedAlbum();
  const { navigateToRoom } = useRoomNavigation();
  const { requestPlayAlbum } = useMusicPlayer();
  const [tab, setTab] = React.useState('now');
  
  // Get albums with music
  const albumsWithMusic = albums.filter(a => a.musicData);
  
  const nowPanel = selectedAlbum && selectedAlbum.musicData ? (
    <div className="music-panel">
      <AlbumCard
        title={selectedAlbum.title || selectedAlbum.mood}
        mood={selectedAlbum.mood}
        imageUrl={selectedAlbum.imageDataURL}
        meta={`作成日: ${new Date(selectedAlbum.createdAt).toLocaleDateString('ja-JP')}`}
        badges={[
          { label: '再生中', tone: 'success' },
          ...(selectedAlbum.isFavorite ? [{ label: 'お気に入り', tone: 'warning' as const }] : []),
          ...(selectedAlbum.isPublic ? [{ label: '公開', tone: 'info' as const }] : []),
        ]}
      />
      {selectedAlbum.musicMetadata && (
        <div className="music-meta-grid room-card">
          <div className="music-meta-row"><span className="music-meta-label">調</span><span>{selectedAlbum.musicMetadata.key}</span></div>
          <div className="music-meta-row"><span className="music-meta-label">テンポ</span><span>{selectedAlbum.musicMetadata.tempo} BPM</span></div>
          <div className="music-meta-row"><span className="music-meta-label">拍子</span><span>{selectedAlbum.musicMetadata.timeSignature}</span></div>
          <div className="music-meta-row"><span className="music-meta-label">形式</span><span>{selectedAlbum.musicMetadata.form}</span></div>
          <div className="music-meta-row"><span className="music-meta-label">性格</span><span>{selectedAlbum.musicMetadata.character}</span></div>
        </div>
      )}
      <div className="music-actions">
        <button
          className="btn btn-primary"
          onClick={() => requestPlayAlbum(selectedAlbum, albumsWithMusic)}
        >
          再生
        </button>
        <button className="btn" onClick={() => navigateToRoom('gallery')}>
          ギャラリーへ
        </button>
      </div>
    </div>
  ) : (
    <div className="music-empty">
      音楽付きアルバムを選択してください。Mainルームで外部生成を行うと曲付きアルバムが作成されます。
    </div>
  );

  const libraryPanel = (
    <div className="music-panel">
      <div className="room-card">音楽付きアルバム: {albumsWithMusic.length}件</div>
      {albumsWithMusic.length > 0 ? (
        <div className="music-library-grid">
          {albumsWithMusic.map((album) => (
            <button
              key={album.id}
              className="album-card-button"
              onClick={() => {
                selectAlbum(album.id);
                requestPlayAlbum(album, albumsWithMusic);
              }}
            >
              <AlbumCard
                title={album.title || album.mood}
                mood={album.mood}
                imageUrl={album.imageDataURL}
                meta={album.musicMetadata ? `${album.musicMetadata.key} | ${album.musicMetadata.tempo} BPM | ${album.musicMetadata.form}` : undefined}
                badges={[
                  { label: '再生', tone: 'success' },
                  ...(album.isFavorite ? [{ label: 'お気に入り', tone: 'warning' as const }] : []),
                  ...(album.isPublic ? [{ label: '公開', tone: 'info' as const }] : []),
                ]}
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="music-empty">
          音楽を生成するには、Mainルームでセッションを作成し、外部生成を使用してください。
        </div>
      )}
    </div>
  );

  return (
    <div className="room-content music-room">
      <div className="room-header music-header">
        <div className="room-header-actions">
          <button className="btn" onClick={() => navigateToRoom('gallery')}>
            ギャラリーへ
          </button>
        </div>
      </div>

      <Tabs
        items={[
          { id: 'now', label: 'Now Playing', content: nowPanel },
          { id: 'library', label: 'Library', content: libraryPanel },
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel="音楽タブ"
      />
    </div>
  );
};

export default MusicRoom;
