import React, { useEffect, useRef, useState } from 'react';
import { useAlbums } from '../../contexts/AlbumContext';
import { useCausalLog } from '../../contexts/CausalLogContext';
import { PlaybackState, useMusicPlayer } from '../../contexts/MusicPlayerContext';
import { useRoomNavigation } from '../../contexts/RoomNavigationContext';
import { generateImage, pollJobStatus } from '../../api/imageApi';
import { MAX_SEED } from '../../utils/prng';
import ExplainabilityPanel from '../ExplainabilityPanel';
import Aura from '../visual/patterns/Aura';
import { useMouseProximity } from '../visual/interactions/MouseTracker';
import Popover from '../ui/Popover';
import Menu from '../ui/Menu';
import AlbumCard from '../gallery/AlbumCard';
import './AlbumRoom.css';

const AlbumRoom: React.FC = () => {
  const { getSelectedAlbum, selectAlbum, addAlbum, updateAlbum } = useAlbums();
  const { getLog } = useCausalLog();
  const { state: musicState, requestPlayAlbum } = useMusicPlayer();
  const { navigateToRoom } = useRoomNavigation();
  const album = getSelectedAlbum();

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const [memoDraft, setMemoDraft] = useState('');

  useEffect(() => {
    setMemoDraft(album?.memo || '');
  }, [album?.id]);
  
  // P5: Get causal log for this album
  const causalLog = album?.causalLogId ? getLog(album.causalLogId) : undefined;

  const safeJsonPreview = (value: unknown, maxChars = 2400) => {
    try {
      const text = JSON.stringify(value, null, 2) ?? '';
      if (text.length <= maxChars) return text;
      return `${text.slice(0, maxChars)}\n…(truncated)`;
    } catch {
      return '';
    }
  };
  
  // P3: Regenerate state
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [regenerateSuccess, setRegenerateSuccess] = useState(false);

  // C-4: Aura interactivity
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const mouseProximity = useMouseProximity(imageContainerRef, 300);
  const [hoveredMetadataLayer, setHoveredMetadataLayer] = useState(-1);

  // C-4+: Subtle tilt + shimmer for album artwork
  const handleTiltMove = (e: React.MouseEvent) => {
    const el = imageContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / Math.max(1, rect.width);
    const py = (e.clientY - rect.top) / Math.max(1, rect.height);
    const clampedX = Math.max(0, Math.min(1, px));
    const clampedY = Math.max(0, Math.min(1, py));

    const rotY = (clampedX - 0.5) * 10; // left/right
    const rotX = (0.5 - clampedY) * 7;  // up/down

    el.style.setProperty('--tilt-x', `${rotX.toFixed(2)}deg`);
    el.style.setProperty('--tilt-y', `${rotY.toFixed(2)}deg`);
    el.style.setProperty('--shine-x', `${(clampedX * 100).toFixed(1)}%`);
    el.style.setProperty('--shine-y', `${(clampedY * 100).toFixed(1)}%`);
  };

  const handleTiltLeave = () => {
    const el = imageContainerRef.current;
    if (!el) return;
    el.style.setProperty('--tilt-x', `0deg`);
    el.style.setProperty('--tilt-y', `0deg`);
    el.style.setProperty('--shine-x', `50%`);
    el.style.setProperty('--shine-y', `45%`);
  };

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
        <div className="album-empty">
          <p>アルバムが選択されていません</p>
          <p className="album-empty-hint">Galleryからアルバムを選択してください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="room-content album-room">
      <div className="album-header room-header">
        <div className="album-header-left">
          <h1 className="album-title">{album.title || album.mood}</h1>
          <p className="album-subtitle">ムード: {album.mood} ・ 選択したアルバムの詳細</p>
        </div>

        <div className="album-header-actions room-header-actions">
          <button
            className="btn back-to-gallery-btn"
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
          <button
            className="btn"
            onClick={() => navigateToRoom('social')}
          >
            公開
          </button>
          <Popover
            triggerClassName="btn"
            trigger={<span>操作</span>}
            placement="bottom"
            triggerAriaHaspopup="menu"
          >
            {({ close }) => (
              <Menu
                items={[
                  {
                    id: 'gallery',
                    label: 'ギャラリーへ戻る',
                    onSelect: () => {
                      navigateToRoom('gallery');
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
                      requestPlayAlbum(album);
                      close();
                    },
                  },
                  {
                    id: 'favorite',
                    label: album.isFavorite ? 'お気に入り解除' : 'お気に入り登録',
                    onSelect: () => {
                      updateAlbum(album.id, { isFavorite: !album.isFavorite });
                      close();
                    },
                  },
                  {
                    id: 'public',
                    label: album.isPublic ? '非公開にする' : '公開にする',
                    onSelect: () => {
                      updateAlbum(album.id, { isPublic: !album.isPublic });
                      close();
                    },
                  },
                ]}
              />
            )}
          </Popover>
        </div>
      </div>

      <div className="album-details">
        <div className="album-media">
          <div
            className={`album-image-container ${isPlaying ? 'is-playing' : ''}`}
            ref={imageContainerRef}
            onMouseMove={handleTiltMove}
            onMouseLeave={handleTiltLeave}
          >
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
        </div>

        <div className="album-metadata">
          <div className="album-meta-card" data-no-swipe="true">
            <div className="album-meta-title">作品情報</div>
            <div className="album-meta-grid">
              <div className="album-meta-k">タイトル</div>
              <div className="album-meta-v">{album.title || album.mood}</div>
              <div className="album-meta-k">作成</div>
              <div className="album-meta-v">{album.createdAt ? formatDateTime(album.createdAt) : ''}</div>
              <div className="album-meta-k">公開</div>
              <div className="album-meta-v">{album.isPublic ? '公開' : '非公開'}</div>
              <div className="album-meta-k">お気に入り</div>
              <div className="album-meta-v">{album.isFavorite ? 'Yes' : 'No'}</div>
              <div className="album-meta-k">長さ</div>
              <div className="album-meta-v">{album.duration ? `${album.duration} sec` : ''}</div>
              <div className="album-meta-k">ムード</div>
              <div className="album-meta-v">{album.mood}</div>
              <div className="album-meta-k">ID</div>
              <div className="album-meta-v album-meta-id">{album.id}</div>
            </div>
          </div>

          <div className="album-summary-card">
            <AlbumCard
              variant="compact"
              title={album.title || album.mood}
              mood={album.mood}
              imageUrl={album.imageDataURL}
              meta={`作成日: ${new Date(album.createdAt).toLocaleDateString('ja-JP')}`}
              badges={[
                { label: album.musicData ? '再生可能' : '音声なし', tone: album.musicData ? 'success' : 'default' },
                ...(album.isPublic ? [{ label: '公開中', tone: 'info' as const }] : []),
                ...(album.isFavorite ? [{ label: 'お気に入り', tone: 'warning' as const }] : []),
              ]}
            />
          </div>

          <section className="metadata-section" aria-label="アルバムメモ">
            <h2 className="metadata-section-title">メモ（ひとこと）</h2>
            <textarea
              className="album-memo-input"
              value={memoDraft}
              onChange={(e) => setMemoDraft(e.target.value)}
              onBlur={() => {
                const next = memoDraft.trim();
                if ((album.memo || '') === next) return;
                updateAlbum(album.id, { memo: next || undefined });
              }}
              placeholder="この作品にひとこと。気づき、風景、だれにも見せないメモでも。"
              rows={3}
            />
            <div className="album-memo-hint">フォーカスが外れると自動で保存します。</div>
          </section>

          {/* P3: Enhanced metadata display */}
          {album.metadata && (
            <>
              <div className="metadata-section">
                <h3 className="metadata-section-title">分析結果 (IR)</h3>
                
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
                <h3 className="metadata-section-title">生成情報</h3>
                
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

              {(album.metadata.prompt || album.metadata.negativePrompt) && (
                <details className="metadata-section album-details-toggle">
                  <summary className="metadata-section-title">プロンプト</summary>
                  {album.metadata.prompt ? (
                    <div className="album-text-block">
                      <div className="album-text-label">Prompt</div>
                      <pre className="album-text-pre">{album.metadata.prompt}</pre>
                    </div>
                  ) : null}
                  {album.metadata.negativePrompt ? (
                    <div className="album-text-block">
                      <div className="album-text-label">Negative</div>
                      <pre className="album-text-pre">{album.metadata.negativePrompt}</pre>
                    </div>
                  ) : null}
                </details>
              )}

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

          {album.sessionData ? (
            <details className="metadata-section album-details-toggle">
              <summary className="metadata-section-title">セッションデータ（概要）</summary>
              <div className="album-text-block">
                <div className="album-text-label">Keys</div>
                <div className="album-text-inline">
                  {typeof album.sessionData === 'object' && album.sessionData !== null
                    ? Object.keys(album.sessionData).slice(0, 24).join(', ')
                    : typeof album.sessionData}
                </div>
              </div>
              <div className="album-text-block">
                <div className="album-text-label">Preview</div>
                <pre className="album-text-pre">{safeJsonPreview(album.sessionData)}</pre>
              </div>
            </details>
          ) : null}

          {(album.causalLogId || causalLog) ? (
            <div className="metadata-section">
              <h3 className="metadata-section-title">因果ログ</h3>
              <div className="metadata-item">
                <span className="metadata-label">Log ID</span>
                <span className="metadata-value metadata-id">{album.causalLogId || ''}</span>
              </div>
              {causalLog ? (
                <>
                  <div className="metadata-item">
                    <span className="metadata-label">成功</span>
                    <span className="metadata-value">{causalLog.success ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="metadata-item">
                    <span className="metadata-label">総所要時間</span>
                    <span className="metadata-value">{Math.round((causalLog.totalDuration || 0) * 10) / 10} sec</span>
                  </div>
                  {causalLog.errors && causalLog.errors.length > 0 ? (
                    <div className="metadata-item">
                      <span className="metadata-label">エラー</span>
                      <span className="metadata-value">{causalLog.errors.length} 件</span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* P5: Explainability Panel */}
        <ExplainabilityPanel log={causalLog} />
      </div>
    </div>
  );
};

export default AlbumRoom;
