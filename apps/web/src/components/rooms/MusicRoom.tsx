import React from 'react';
import { useAlbums } from '../../contexts/AlbumContext';

const MusicRoom: React.FC = () => {
  const { albums, getSelectedAlbum } = useAlbums();
  const selectedAlbum = getSelectedAlbum();
  
  // Get albums with music
  const albumsWithMusic = albums.filter(a => a.musicData);
  
  return (
    <div className="room-content">
      <h1 className="room-title">MUSIC</h1>
      <p className="room-subtitle">Mainルームで生成した楽曲の再生・管理</p>
      
      <div className="music-info">
        {selectedAlbum && selectedAlbum.musicData ? (
          <div className="current-track">
            <h2>現在選択中のトラック</h2>
            <div className="track-details">
              <p><strong>アルバム:</strong> {selectedAlbum.mood}</p>
              {selectedAlbum.musicMetadata && (
                <>
                  <p><strong>調:</strong> {selectedAlbum.musicMetadata.key}</p>
                  <p><strong>テンポ:</strong> {selectedAlbum.musicMetadata.tempo} BPM</p>
                  <p><strong>拍子:</strong> {selectedAlbum.musicMetadata.timeSignature}</p>
                  <p><strong>形式:</strong> {selectedAlbum.musicMetadata.form}</p>
                  <p><strong>性格:</strong> {selectedAlbum.musicMetadata.character}</p>
                </>
              )}
            </div>
            <p className="music-hint">右下のミニプレイヤーで再生できます</p>
          </div>
        ) : (
          <div className="no-selection">
            <p>音楽付きアルバムを選択してください</p>
            <p className="music-hint">Mainルームで外部生成を行うと曲付きアルバムが作成されます。</p>
          </div>
        )}
        
        <div className="music-library">
          <h2>音楽ライブラリ</h2>
          <p>音楽付きアルバム: {albumsWithMusic.length}件</p>
          
          {albumsWithMusic.length > 0 ? (
            <ul className="music-list">
              {albumsWithMusic.map((album) => (
                <li key={album.id} className={selectedAlbum?.id === album.id ? 'selected' : ''}>
                  <span className="music-title">{album.mood}</span>
                  {album.musicMetadata && (
                    <span className="music-meta">
                      {album.musicMetadata.key} | {album.musicMetadata.tempo} BPM | {album.musicMetadata.form}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="music-hint">
              音楽を生成するには、Mainルームでセッションを作成し、外部生成を使用してください。
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MusicRoom;
