import React, { useEffect, useMemo, useRef, useState } from 'react';
import OnboardingForm, { OnboardingData } from '../OnboardingForm';
import GeometricCanvas from '../visual/GeometricCanvas';
import '../OnboardingForm.css';
import { useAlbums } from '../../contexts/AlbumContext';
import { useMusicPlayer } from '../../contexts/MusicPlayerContext';
import { generateMusic, pollMusicJobStatus } from '../../api/imageApi';
import {
  createPlaceholderCoverDataUrl,
  onboardingToMusicRequest,
} from '../../utils/onboardingMusic';

type Props = {
  onExit?: () => void;
};

const OnboardingRoom: React.FC<Props> = ({ onExit }) => {
  const { albums, addAlbum, selectAlbum } = useAlbums();
  const { requestPlayAlbum } = useMusicPlayer();
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedData, setCompletedData] = useState<OnboardingData | null>(null);
  const [progress, setProgress] = useState(0);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateStatusText, setGenerateStatusText] = useState<string | null>(null);
  const autoTriggeredRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const albumsWithMusic = useMemo(() => albums.filter((a) => a.musicData), [albums]);

  const handleComplete = (data: OnboardingData) => {
    setCompletedData(data);
    setIsCompleted(true);
  };

  const handleRestart = () => {
    setIsCompleted(false);
    setCompletedData(null);
    setProgress(0);
    setIsGenerating(false);
    setGenerateError(null);
    setGenerateStatusText(null);
    abortRef.current?.abort();
    abortRef.current = null;
    autoTriggeredRef.current = false;
  };

  const buildMood = (data: OnboardingData) => {
    return data.recentMomentEmotion || data.dailyPatternEmotion || '穏やか';
  };

  const handleGenerateAndStart = async () => {
    if (!completedData) return;
    if (isGenerating) return;

    setGenerateError(null);
    setGenerateStatusText('準備中…');
    setIsGenerating(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const mood = buildMood(completedData);
      const seed = `${Date.now()}`;
      const cover = createPlaceholderCoverDataUrl({ title: 'はじめの一曲', mood, seed });

      const req = onboardingToMusicRequest(completedData);
      setGenerateStatusText('作曲を開始しています…');
      const job = await generateMusic({
        ...req,
        seed: Number(seed.slice(-9)),
      } as any);

      setGenerateStatusText('生成中…（1〜2分かかることがあります）');
      const finalStatus = await pollMusicJobStatus(
        job.jobId,
        (s) => {
          if (s.status === 'queued') setGenerateStatusText('順番待ち…');
          else if (s.status === 'running') setGenerateStatusText('生成中…');
          else if (s.status === 'succeeded') setGenerateStatusText('仕上げ中…');
          else if (s.status === 'failed') setGenerateStatusText('失敗しました');
        },
        90,
        2000,
        controller.signal
      );
      if (finalStatus.status !== 'succeeded' || !finalStatus.midiData || !finalStatus.result) {
        throw new Error(finalStatus.errorMessage || finalStatus.error || '曲生成に失敗しました');
      }

      setGenerateStatusText('保存しています…');

      const created = addAlbum({
        title: 'はじめの一曲',
        mood,
        duration: req.duration,
        imageDataURL: cover,
        thumbnailUrl: cover,
        metadata: {
          valence: req.valence,
          arousal: req.arousal,
          focus: req.focus,
          motif_tags: req.motif_tags,
          confidence: req.confidence,
          provider: 'rule-based',
        },
        musicData: finalStatus.midiData,
        musicFormat: 'midi',
        musicMetadata: {
          key: finalStatus.result.key,
          tempo: finalStatus.result.tempo,
          timeSignature: finalStatus.result.timeSignature,
          form: finalStatus.result.form,
          character: finalStatus.result.character,
          duration: req.duration,
          createdAt: new Date().toISOString(),
          provider: finalStatus.provider,
        },
        sessionData: {
          onboarding: completedData,
        },
      } as any);

      selectAlbum(created.id);
      requestPlayAlbum(created, [created, ...albumsWithMusic]);

      // Tell the app to land in Music room after onboarding exits.
      try {
        localStorage.setItem('airia_post_onboarding_room', 'music');
      } catch {
        // ignore
      }

      onExit?.();
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setGenerateStatusText('キャンセルしました');
        return;
      }
      setGenerateError(e instanceof Error ? e.message : '曲生成に失敗しました');
      setGenerateStatusText(null);
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  const handleCancelGenerate = () => {
    if (!isGenerating) return;
    abortRef.current?.abort();
    setIsGenerating(false);
    setGenerateStatusText('キャンセルしました');
  };

  useEffect(() => {
    if (!isCompleted || !completedData) return;
    if (autoTriggeredRef.current) return;
    if (completedData.startMode !== 'create') return;

    autoTriggeredRef.current = true;
    void handleGenerateAndStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleted, completedData]);

  return (
    <div className="room-content onboarding-room" data-no-swipe="true">
      {/* Onboarding only: progress/introspection symbol (backgrounded) */}
      {!isCompleted && (
        <GeometricCanvas
          pattern="polyhedron"
          isActive={true}
          progress={progress}
          layer="background"
          placement="center"
          sizePx={420}
          opacity={0.16}
        />
      )}
      
      <h1 className="room-title">はじめに</h1>
      <p className="room-subtitle">あなたに合う体験へ整えます</p>
      
      {!isCompleted ? (
        <OnboardingForm onComplete={handleComplete} onProgressChange={setProgress} />
      ) : (
        <div className="onboarding-complete">
          <h2 className="blend-text">完了しました！</h2>
          <p className="completion-message">
            ありがとうございます。あなたの回答は保存されました。<br />
            この情報は、より良いセッション体験のために活用されます。
          </p>
          {generateError ? <div className="form-error">{generateError}</div> : null}
          {generateStatusText ? <div className="onboarding-generate-status">{generateStatusText}</div> : null}
          <div className="button-group">
            <button className="btn btn-secondary" onClick={handleRestart}>
              回答を編集
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void handleGenerateAndStart()}
              disabled={isGenerating}
              data-no-swipe
              title="オンボーディング回答から1曲生成して、そのまま再生します"
            >
              {isGenerating ? '1曲生成中…' : '1曲作ってはじめる'}
            </button>
            {isGenerating ? (
              <button className="btn btn-secondary" onClick={handleCancelGenerate} data-no-swipe type="button">
                キャンセル
              </button>
            ) : null}
            <button 
              className="btn btn-primary" 
              onClick={() => {
                if (!completedData) return;
                const dataStr = JSON.stringify(completedData, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'getting_started_profile.json';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              プロフィールをダウンロード
            </button>
            <button
              className="btn btn-success"
              onClick={() => {
                onExit?.();
              }}
            >
              はじめる
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingRoom;
