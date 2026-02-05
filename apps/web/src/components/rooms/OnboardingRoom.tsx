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
import {
  clearPendingOnboardingGeneration,
  loadPendingOnboardingGeneration,
  savePendingOnboardingGeneration,
} from '../../utils/pendingGeneration';
import ConfirmDialog from '../ConfirmDialog';
import { useToast } from '../visual/feedback/ToastContainer';
import { useGenerationOverlay } from '../../contexts/GenerationOverlayContext';

type Props = {
  onExit?: () => void;
};

const OnboardingRoom: React.FC<Props> = ({ onExit }) => {
  const { albums, addAlbum, selectAlbum } = useAlbums();
  const { requestPlayAlbum } = useMusicPlayer();
  const { addToast } = useToast();
  const { setOverlay, clearOverlay } = useGenerationOverlay();
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedData, setCompletedData] = useState<OnboardingData | null>(null);
  const [progress, setProgress] = useState(0);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateStatusText, setGenerateStatusText] = useState<string | null>(null);
  const [generateStartedAt, setGenerateStartedAt] = useState<number | null>(null);
  const [generateElapsedSec, setGenerateElapsedSec] = useState(0);
  const [hasPendingResume, setHasPendingResume] = useState(false);
  const autoTriggeredRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const pendingToastShownRef = useRef(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const albumsWithMusic = useMemo(() => albums.filter((a) => a.musicData), [albums]);

  useEffect(() => {
    const pending = loadPendingOnboardingGeneration();
    setHasPendingResume(Boolean(pending));
    if (pending && !pendingToastShownRef.current) {
      pendingToastShownRef.current = true;
      addToast('info', '保留中の生成があります。「生成を再開」で続きを進められます。');
    }
  }, []);

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
    setGenerateStartedAt(null);
    setGenerateElapsedSec(0);
    abortRef.current?.abort();
    abortRef.current = null;
    clearPendingOnboardingGeneration();
    setHasPendingResume(false);
    autoTriggeredRef.current = false;
  };

  useEffect(() => {
    if (!isGenerating || !generateStartedAt) return;

    setGenerateElapsedSec(Math.max(0, Math.floor((Date.now() - generateStartedAt) / 1000)));
    const id = window.setInterval(() => {
      setGenerateElapsedSec(Math.max(0, Math.floor((Date.now() - generateStartedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isGenerating, generateStartedAt]);

  const buildMood = (data: OnboardingData) => {
    return data.recentMomentEmotion || data.dailyPatternEmotion || '穏やか';
  };

  const resumePendingIfAny = async () => {
    if (!completedData) return;
    if (isGenerating) return;

    const pending = loadPendingOnboardingGeneration();
    if (!pending) return;

    setGenerateError(null);
    setGenerateStatusText('再開中…');
    setIsGenerating(true);
    setGenerateStartedAt(pending.startedAt || Date.now());
    setGenerateElapsedSec(0);
    addToast('info', '生成を再開しています…');

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const finalStatus = await pollMusicJobStatus(
        pending.musicJobId,
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
        title: pending.title,
        mood: pending.mood,
        duration: pending.request.duration,
        imageDataURL: pending.coverDataUrl,
        thumbnailUrl: pending.coverDataUrl,
        metadata: {
          valence: pending.request.valence,
          arousal: pending.request.arousal,
          focus: pending.request.focus,
          motif_tags: pending.request.motif_tags,
          confidence: pending.request.confidence,
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
          duration: pending.request.duration,
          createdAt: new Date().toISOString(),
          provider: finalStatus.provider,
        },
        sessionData: {
          onboarding: completedData,
        },
      } as any);

      selectAlbum(created.id);
      requestPlayAlbum(created, [created, ...albumsWithMusic]);

      clearPendingOnboardingGeneration();
      setHasPendingResume(false);
      addToast('success', '生成が完了しました。保存して再生します。');

      try {
        localStorage.setItem('airia_post_onboarding_room', 'music');
      } catch {
        // ignore
      }

      onExit?.();
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setGenerateStatusText('キャンセルしました');
        addToast('info', '生成をキャンセルしました。あとで再開できます。');
        return;
      }
      setGenerateError(e instanceof Error ? e.message : '曲生成に失敗しました');
      setGenerateStatusText(null);
      addToast('error', e instanceof Error ? e.message : '曲生成に失敗しました');
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  const retryPendingGeneration = async () => {
    if (isGenerating) return;
    if (!completedData) return;
    const pending = loadPendingOnboardingGeneration();
    if (!pending) return;

    setGenerateError(null);
    setGenerateStatusText('再生成を開始しています…');
    setIsGenerating(true);
    setGenerateStartedAt(Date.now());
    setGenerateElapsedSec(0);
    addToast('info', '同じ条件で再生成を開始しました。');

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const job = await generateMusic(pending.request as any);

      savePendingOnboardingGeneration({
        ...pending,
        startedAt: Date.now(),
        musicJobId: job.jobId,
      });
      setHasPendingResume(true);

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
        title: pending.title,
        mood: pending.mood,
        duration: pending.request.duration,
        imageDataURL: pending.coverDataUrl,
        thumbnailUrl: pending.coverDataUrl,
        metadata: {
          valence: pending.request.valence,
          arousal: pending.request.arousal,
          focus: pending.request.focus,
          motif_tags: pending.request.motif_tags,
          confidence: pending.request.confidence,
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
          duration: pending.request.duration,
          createdAt: new Date().toISOString(),
          provider: finalStatus.provider,
        },
        sessionData: {
          onboarding: completedData,
        },
      } as any);

      selectAlbum(created.id);
      requestPlayAlbum(created, [created, ...albumsWithMusic]);

      clearPendingOnboardingGeneration();
      setHasPendingResume(false);
      addToast('success', '生成が完了しました。保存して再生します。');

      try {
        localStorage.setItem('airia_post_onboarding_room', 'music');
      } catch {
        // ignore
      }

      onExit?.();
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setGenerateStatusText('キャンセルしました');
        addToast('info', '生成をキャンセルしました。あとで再開できます。');
        return;
      }
      const msg = e instanceof Error ? e.message : '曲生成に失敗しました';
      setGenerateError(msg);
      setGenerateStatusText(null);
      addToast('error', msg);
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  const handleGenerateAndStart = async () => {
    if (!completedData) return;
    if (isGenerating) return;

    setGenerateError(null);
    setGenerateStatusText('準備中…');
    setIsGenerating(true);

    setGenerateStartedAt(Date.now());
    setGenerateElapsedSec(0);

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

      savePendingOnboardingGeneration({
        v: 1,
        kind: 'onboarding',
        startedAt: Date.now(),
        musicJobId: job.jobId,
        request: {
          ...req,
          seed: Number(seed.slice(-9)),
        },
        mood,
        title: 'はじめの一曲',
        coverDataUrl: cover,
      });
      setHasPendingResume(true);
      addToast('info', '生成を開始しました。完了まで待つか、あとで再開できます。');

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

      clearPendingOnboardingGeneration();
      setHasPendingResume(false);
      addToast('success', '生成が完了しました。保存して再生します。');

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
        setGenerateStartedAt(null);
        setGenerateElapsedSec(0);
        addToast('info', '生成をキャンセルしました。あとで再開できます。');
        return;
      }
      setGenerateError(e instanceof Error ? e.message : '曲生成に失敗しました');
      setGenerateStatusText(null);
      setGenerateStartedAt(null);
      setGenerateElapsedSec(0);
      addToast('error', e instanceof Error ? e.message : '曲生成に失敗しました');
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
    setGenerateStartedAt(null);
    setGenerateElapsedSec(0);
    addToast('info', '生成を中断しました。あとで再開できます。');
  };

  const doDiscardPending = () => {
    clearPendingOnboardingGeneration();
    setHasPendingResume(false);
    setGenerateStatusText(null);
    setGenerateError(null);
    addToast('info', '保留中の生成を破棄しました。');
  };

  const handleCancelGeneration = () => {
    if (!isGenerating) return;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
    setGenerateStatusText('キャンセルしました');
    setGenerateStartedAt(null);
    setGenerateElapsedSec(0);
    addToast('info', '生成をキャンセルしました。あとで再開できます。');
  };

  useEffect(() => {
    if (!isGenerating) {
      clearOverlay('onboarding');
      return;
    }
    setOverlay('onboarding', {
      active: true,
      scopeLabel: 'はじめに',
      statusText: generateStatusText,
      elapsedSec: generateElapsedSec,
      onCancel: handleCancelGeneration,
    });
  }, [isGenerating, generateStatusText, generateElapsedSec, setOverlay, clearOverlay]);

  useEffect(() => {
    if (!isCompleted || !completedData) return;
    if (autoTriggeredRef.current) return;
    if (completedData.startMode !== 'create') return;

    autoTriggeredRef.current = true;
    // If a generation is pending (refresh/cancel), resume it. Otherwise start new.
    if (loadPendingOnboardingGeneration()) {
      void resumePendingIfAny();
    } else {
      void handleGenerateAndStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleted, completedData]);

  return (
    <div className="room-content onboarding-room" data-no-swipe="true">
      <ConfirmDialog
        open={confirmDiscardOpen}
        title="保留中の生成を破棄しますか？"
        description={'中断した生成を破棄します。\nこの生成は再開できなくなります。'}
        cancelLabel="キャンセル"
        confirmLabel="破棄する"
        confirmTone="danger"
        onCancel={() => setConfirmDiscardOpen(false)}
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          doDiscardPending();
        }}
      />
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
          {generateStatusText ? (
            <div className="onboarding-generate-status">
              {generateStatusText}
              {generateStartedAt ? <span className="onboarding-generate-elapsed">（{generateElapsedSec}s）</span> : null}
            </div>
          ) : null}
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
            {!isGenerating && hasPendingResume ? (
              <button className="btn btn-secondary" onClick={() => void resumePendingIfAny()} data-no-swipe type="button">
                生成を再開
              </button>
            ) : null}
            {!isGenerating && hasPendingResume && Boolean(generateError) ? (
              <button
                className="btn btn-secondary"
                onClick={() => void retryPendingGeneration()}
                data-no-swipe
                type="button"
                title="失敗・停止した場合に、同じ条件で作り直します"
              >
                再生成
              </button>
            ) : null}
            {!isGenerating && hasPendingResume ? (
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmDiscardOpen(true)}
                data-no-swipe
                type="button"
                title="保留中の生成を破棄します"
              >
                破棄
              </button>
            ) : null}
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
