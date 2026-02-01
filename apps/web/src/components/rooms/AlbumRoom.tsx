import React, { useState, useRef } from 'react';
import { useAlbums } from '../../contexts/AlbumContext';
import { useCausalLog } from '../../contexts/CausalLogContext';
import { PlaybackState, useMusicPlayer } from '../../contexts/MusicPlayerContext';
import { useRoomNavigation } from '../../contexts/RoomNavigationContext';
import { generateImage, pollJobStatus } from '../../api/imageApi';
import { MAX_SEED } from '../../utils/prng';
import ExplainabilityPanel from '../ExplainabilityPanel';
import Aura from '../visual/patterns/Aura';
import { useMouseProximity } from '../visual/interactions/MouseTracker';
import './AlbumRoom.css';

const AlbumRoom: React.FC = () => {
  const { getSelectedAlbum, selectAlbum, addAlbum } = useAlbums();
  const { getLog } = useCausalLog();
  const { state: musicState, requestPlayAlbum } = useMusicPlayer();
  const { navigateToRoom } = useRoomNavigation();
  const album = getSelectedAlbum();
  
  // P5: Get causal log for this album
  const causalLog = album?.causalLogId ? getLog(album.causalLogId) : undefined;
  
  // P3: Regenerate state
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [regenerateSuccess, setRegenerateSuccess] = useState(false);

  // C-4: Aura interactivity
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const mouseProximity = useMouseProximity(imageContainerRef, 300);
  const [hoveredMetadataLayer, setHoveredMetadataLayer] = useState(-1);

  // Extract dominant colors from album (fallback to default gold palette)
  const dominantColors = album?.metadata?.dominantColors || ['#D4AF37', '#F4E5C2', '#B8941E'];
  
  // Check if this album is currently playing
  const isPlaying =
    musicState.playbackState === PlaybackState.PLAYING && musicState.currentAlbum?.id === album?.id;

  const handleBackToGallery = () => {
    selectAlbum(null);
    navigateToRoom('gallery');
  };

  // P3: Regenerate with same parameters but new seed
  const handleRegenerate = async () => {
    if (!album || !album.metadata) {
      setRegenerateError('メタデータが見つかりません');
      return;
    }

    try {
      setIsRegenerating(true);
      setRegenerateError(null);
      setRegenerateSuccess(false);

      // Generate new seed (consistent with session seed generation)
      const newSeed = Math.floor(Math.random() * MAX_SEED);

      // Call image generation with same params but new seed
      const response = await generateImage({
        mood: album.mood,
        duration: album.duration,
        motifTags: album.metadata.motif_tags || [],
        stylePreset: album.metadata.stylePreset,
        seed: newSeed,
        valence: album.metadata.valence,
        arousal: album.metadata.arousal,
        focus: album.metadata.focus,
        confidence: album.metadata.confidence,
      });

      // Poll for result
      const finalStatus = await pollJobStatus(response.jobId, (status) => {
        console.log('Regenerate status:', status);
      });

      if (finalStatus.status === 'succeeded' && finalStatus.resultUrl) {
        // Create new album with regenerated image
        addAlbum({
          mood: album.mood,
          duration: album.duration,
          imageDataURL: finalStatus.resultUrl,
          sessionData: album.sessionData,
          metadata: {
            ...album.metadata,
            seed: newSeed,
          },
        });
        
        // Show success message
        setRegenerateSuccess(true);
        setTimeout(() => setRegenerateSuccess(false), 3000);
      } else {
        throw new Error(finalStatus.errorMessage || '再生成に失敗しました');
      }
    } catch (err) {
      setRegenerateError(err instanceof Error ? err.message : '再生成中にエラーが発生しました');
      console.error('Regenerate error:', err);
    } finally {
      setIsRegenerating(false);
    }
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
        <div className="album-header-left">
          <h1 className="album-title">{album.mood}</h1>
          <p className="album-subtitle">選択したアルバムの詳細</p>
        </div>

        <div className="album-header-actions">
          <button
            className="back-to-gallery-btn"
            onClick={handleBackToGallery}
            aria-label="ギャラリーに戻る"
          >
            ギャラリーへ
          </button>
          <button
            className="btn btn-primary"
            disabled={!album.musicData}
            onClick={() => requestPlayAlbum(album)}
          >
            再生
          </button>
        </div>
      </div>

      <div className="album-details">
        <div className="album-image-container" ref={imageContainerRef}>
          {/* C-4: Aura effect behind album image */}
          <Aura
            dominantColors={dominantColors}
            isPlaying={isPlaying}
            beatAmplitude={0}
            mouseProximity={mouseProximity}
            highlightedLayer={hoveredMetadataLayer}
          />
          <img 
            src={album.imageDataURL} 
            alt={`${album.mood}のセッション画像`}
            className="album-image"
          />
        </div>

        <div className="album-metadata">
          <div className="metadata-section">
            <h3 className="metadata-section-title">基本情報</h3>
            
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
          </div>

          {/* P3: Enhanced metadata display */}
          {album.metadata && (
            <>
              <div className="metadata-section">
                <h3 className="metadata-section-title">感情分析 (IR)</h3>
                
                {album.metadata.valence !== undefined && (
                  <div 
                    className="metadata-item"
                    onMouseEnter={() => setHoveredMetadataLayer(0)}
                    onMouseLeave={() => setHoveredMetadataLayer(-1)}
                  >
                    <span className="metadata-label">Valence</span>
                    <span className="metadata-value">
                      {album.metadata.valence.toFixed(2)} 
                      <span className="metadata-hint">
                        ({album.metadata.valence > 0 ? '明るい' : '暗い'})
                      </span>
                    </span>
                  </div>
                )}

                {album.metadata.arousal !== undefined && (
                  <div 
                    className="metadata-item"
                    onMouseEnter={() => setHoveredMetadataLayer(1)}
                    onMouseLeave={() => setHoveredMetadataLayer(-1)}
                  >
                    <span className="metadata-label">Arousal</span>
                    <span className="metadata-value">
                      {album.metadata.arousal.toFixed(2)}
                      <span className="metadata-hint">
                        ({album.metadata.arousal > 0.6 ? '動的' : '静的'})
                      </span>
                    </span>
                  </div>
                )}

                {album.metadata.focus !== undefined && (
                  <div className="metadata-item">
                    <span className="metadata-label">Focus</span>
                    <span className="metadata-value">
                      {album.metadata.focus.toFixed(2)}
                      <span className="metadata-hint">
                        ({album.metadata.focus > 0.7 ? '明瞭' : '拡散'})
                      </span>
                    </span>
                  </div>
                )}

                {album.metadata.confidence !== undefined && (
                  <div className="metadata-item">
                    <span className="metadata-label">信頼度</span>
                    <span className="metadata-value">
                      {Math.round(album.metadata.confidence * 100)}%
                    </span>
                  </div>
                )}

                {album.metadata.motif_tags && album.metadata.motif_tags.length > 0 && (
                  <div className="metadata-item">
                    <span className="metadata-label">モチーフ</span>
                    <span className="metadata-value metadata-tags">
                      {album.metadata.motif_tags.join(', ')}
                    </span>
                  </div>
                )}
              </div>

              <div className="metadata-section">
                <h3 className="metadata-section-title">生成パラメータ</h3>
                
                {album.metadata.stylePreset && (
                  <div className="metadata-item">
                    <span className="metadata-label">スタイル</span>
                    <span className="metadata-value">{album.metadata.stylePreset}</span>
                  </div>
                )}

                {album.metadata.seed !== undefined && (
                  <div className="metadata-item">
                    <span className="metadata-label">シード</span>
                    <span className="metadata-value metadata-id">{album.metadata.seed}</span>
                  </div>
                )}

                {album.metadata.provider && (
                  <div className="metadata-item">
                    <span className="metadata-label">生成方法</span>
                    <span className="metadata-value">
                      {album.metadata.provider === 'replicate' ? 'Replicate (SDXL)' : 
                       album.metadata.provider === 'local' ? 'ローカル生成' : 
                       album.metadata.provider}
                    </span>
                  </div>
                )}
              </div>

              {/* P4: Music metadata section */}
              {album.musicMetadata && (
                <div className="metadata-section">
                  <h3 className="metadata-section-title">音楽メタデータ</h3>
                  
                  <div className="metadata-item">
                    <span className="metadata-label">調</span>
                    <span className="metadata-value">{album.musicMetadata.key}</span>
                  </div>

                  <div className="metadata-item">
                    <span className="metadata-label">テンポ</span>
                    <span className="metadata-value">{album.musicMetadata.tempo} BPM</span>
                  </div>

                  <div className="metadata-item">
                    <span className="metadata-label">拍子</span>
                    <span className="metadata-value">{album.musicMetadata.timeSignature}</span>
                  </div>

                  <div className="metadata-item">
                    <span className="metadata-label">形式</span>
                    <span className="metadata-value">{album.musicMetadata.form}</span>
                  </div>

                  <div className="metadata-item">
                    <span className="metadata-label">性格</span>
                    <span className="metadata-value">{album.musicMetadata.character}</span>
                  </div>

                  <div className="metadata-item">
                    <span className="metadata-label">生成方法</span>
                    <span className="metadata-value">
                      {album.musicMetadata.provider === 'openai' ? 'OpenAI (GPT-4)' : 
                       album.musicMetadata.provider === 'rule-based' ? 'ルールベース' : 
                       album.musicMetadata.provider}
                    </span>
                  </div>

                  {album.musicData && (
                    <div className="metadata-item">
                      <span className="metadata-label">フォーマット</span>
                      <span className="metadata-value">MIDI ({Math.round(album.musicData.length / 1024)} KB)</span>
                    </div>
                  )}
                </div>
              )}

              {/* P3: Regenerate button */}
              {album.metadata.provider === 'replicate' && (
                <div className="album-actions">
                  <button
                    className="regenerate-btn"
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                  >
                    {isRegenerating ? '再生成中...' : '再生成 (新しいシード)'}
                  </button>
                  {regenerateSuccess && (
                    <div className="regenerate-success">
                      再生成が完了しました。Galleryで新しいアルバムを確認できます。
                    </div>
                  )}
                  {regenerateError && (
                    <div className="regenerate-error">{regenerateError}</div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="metadata-item">
            <span className="metadata-label">アルバムID</span>
            <span className="metadata-value metadata-id">{album.id}</span>
          </div>
        </div>

        {/* P5: Explainability Panel */}
        <ExplainabilityPanel log={causalLog} />
      </div>
    </div>
  );
};

export default AlbumRoom;
