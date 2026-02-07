import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAlbums } from '../../contexts/AlbumContext';
import { useCausalLog } from '../../contexts/CausalLogContext';
import { useMusicPlayer } from '../../contexts/MusicPlayerContext';
import { useRoomNavigation } from '../../contexts/RoomNavigationContext';
import {
  chatTurn,
  refineGenerationEvent,
  generateImage,
  generateMusic,
  pollJobStatus,
  pollMusicJobStatus,
  nameAlbumTitle,
  getMusicPreview,
  ChatMessage,
  GenerateMusicRequest,
  RefinedEventResponse,
} from '../../api/imageApi';
import {
  logAlbumStage,
  logError,
} from '../../utils/causalLogging/loggingHelpers';
import { loadOnboardingData, onboardingToChatPayload } from '../../utils/onboardingMusic';
import {
  clearPendingChatGeneration,
  loadPendingChatGeneration,
  savePendingChatGeneration,
} from '../../utils/pendingGeneration';
import { createPlaceholderCoverDataUrl } from '../../utils/placeholderCover';
import './ChatSessionUI.css';
import AlbumTitleModal from '../AlbumTitleModal';
import ConfirmDialog from '../ConfirmDialog';
import { useToast } from '../visual/feedback/ToastContainer';
import { useGenerationOverlay } from '../../contexts/GenerationOverlayContext';

function nowIso() {
  return new Date().toISOString();
}

function makeFallbackCoverDataUrl(refined: RefinedEventResponse, note: string) {
  return createPlaceholderCoverDataUrl({
    title: refined?.brief?.theme?.title,
    mood: refined?.image?.mood,
    seed: refined?.image?.seed,
    note,
  });
}

function getCoverProvider(imageStatus: any | null): string {
  return (
    imageStatus?.effectiveProvider ||
    imageStatus?.provider ||
    (imageStatus?.status === 'succeeded' ? 'image' : 'placeholder')
  );
}

export default function ChatSessionUI() {
  const { albums, addAlbum, selectAlbum } = useAlbums();
  const { createLog, updateLog, getLog } = useCausalLog();
  const { requestPlayAlbum } = useMusicPlayer();
  const { navigateToRoom } = useRoomNavigation();
  const { addToast } = useToast();
  const { setOverlay, clearOverlay } = useGenerationOverlay();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '今日はどんな一日でした？短くても大丈夫。',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recommendations, setRecommendations] = useState<
    Array<{ composer: string; title: string; era?: string; why: string }>
  >([]);

  const [eventSuggested, setEventSuggested] = useState<{ shouldTrigger: boolean; reason: string } | null>(null);
  const [isGeneratingEvent, setIsGeneratingEvent] = useState(false);
  const [generationStatusText, setGenerationStatusText] = useState<string | null>(null);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [generationElapsedSec, setGenerationElapsedSec] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const [hasPendingResume, setHasPendingResume] = useState(false);
  const [generationFailed, setGenerationFailed] = useState(false);
  const pendingToastShownRef = useRef(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [pendingAlbum, setPendingAlbum] = useState<any | null>(null);
  const [pendingLogId, setPendingLogId] = useState<string | null>(null);
  const [isResolvingTitle, setIsResolvingTitle] = useState(false);

  // Recommendation playback (legal preview only)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [previewByKey, setPreviewByKey] = useState<Record<string, any>>({});
  const [previewLoading, setPreviewLoading] = useState<Record<string, boolean>>({});
  const [previewError, setPreviewError] = useState<Record<string, string | null>>({});

  const [isNarrow, setIsNarrow] = useState(false);
  const [sideOpen, setSideOpen] = useState(true);

  const userOnlyMessages = useMemo(() => messages.filter((m) => m.role === 'user'), [messages]);

  const onboardingPayload = useMemo(() => {
    const data = loadOnboardingData();
    return data ? onboardingToChatPayload(data) : null;
  }, []);

  const albumsWithMusic = useMemo(() => albums.filter((a) => a.musicData), [albums]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const update = () => setIsNarrow(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  useEffect(() => {
    // Default: collapse recs on narrow screens.
    if (isNarrow) setSideOpen(false);
    else setSideOpen(true);
  }, [isNarrow]);

  useEffect(() => {
    const pending = loadPendingChatGeneration();
    setHasPendingResume(Boolean(pending));
    if (pending && !pendingToastShownRef.current) {
      pendingToastShownRef.current = true;
      addToast('info', '保留中の生成があります。「生成を再開」で続きを進められます。');
    }
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isGeneratingEvent || !generationStartedAt) return;

    setGenerationElapsedSec(Math.max(0, Math.floor((Date.now() - generationStartedAt) / 1000)));
    const id = window.setInterval(() => {
      setGenerationElapsedSec(Math.max(0, Math.floor((Date.now() - generationStartedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isGeneratingEvent, generationStartedAt]);

  useEffect(() => {
    if (!isGeneratingEvent) {
      clearOverlay('chat');
      return;
    }
    setOverlay('chat', {
      active: true,
      scopeLabel: '対話',
      statusText: generationStatusText,
      elapsedSec: generationElapsedSec,
      onCancel: handleCancelEvent,
    });
  }, [isGeneratingEvent, generationStatusText, generationElapsedSec, setOverlay, clearOverlay]);

  function handleCancelEvent() {
    if (!isGeneratingEvent) return;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGeneratingEvent(false);
    setGenerationStatusText('キャンセルしました');
    setGenerationStartedAt(null);
    setGenerationElapsedSec(0);
    setGenerationFailed(false);
    addToast('info', '生成を中断しました。あとで再開できます。');
  }

  function doDiscardPending() {
    clearPendingChatGeneration();
    setHasPendingResume(false);
    setGenerationStatusText(null);
    setError(null);
    setGenerationFailed(false);
    addToast('info', '保留中の生成を破棄しました。');
  }

  async function handleRetryPendingEvent() {
    const pending = loadPendingChatGeneration();
    if (!pending) return;
    if (isGeneratingEvent) return;

    setError(null);
    setGenerationFailed(false);
    setIsGeneratingEvent(true);
    setGenerationStatusText('再生成を開始しています…');
    setGenerationStartedAt(Date.now());
    setGenerationElapsedSec(0);
    addToast('info', '同じ条件で再生成を開始しました。');

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const refined = pending.refined;
      const fallbackCover = makeFallbackCoverDataUrl(refined, 'Image unavailable');

      let imageJobId: string | null = null;
      try {
        setGenerationStatusText('画像生成を開始しています…');
        const imageJob = await generateImage(refined.image);
        imageJobId = imageJob.jobId;
      } catch (e) {
        imageJobId = null;
        addToast('warning', '画像生成が開始できなかったため、プレースホルダーで続行します。');
        const msg = e instanceof Error ? e.message : 'image job start failed';
        if (pending.causalLogId) logError(updateLog, getLog, pending.causalLogId, 'image-generation-start', msg);
      }

      setGenerationStatusText('作曲を開始しています…');
      const musicReq: GenerateMusicRequest = {
        ...refined.music,
        confidence: refined?.analysisLike?.confidence ?? 0.7,
      };
      const musicJob = await generateMusic(musicReq);

      savePendingChatGeneration({
        ...pending,
        startedAt: Date.now(),
        imageJobId,
        musicJobId: musicJob.jobId,
        coverDataUrl: pending.coverDataUrl || fallbackCover,
      });
      setHasPendingResume(true);

      const imagePromise = imageJobId
        ? pollJobStatus(
            imageJobId,
            (s) => {
              if (s.status === 'queued') setGenerationStatusText('順番待ち…');
              else if (s.status === 'running') setGenerationStatusText('画像を生成中…');
              else if (s.status === 'succeeded') setGenerationStatusText('画像ができました。仕上げ中…');
              else if (s.status === 'failed') setGenerationStatusText('画像生成に失敗しました');
            },
            90,
            2000,
            controller.signal
          ).catch((e) => {
            const msg = e instanceof Error ? e.message : 'image polling failed';
            if (pending.causalLogId) logError(updateLog, getLog, pending.causalLogId, 'image-generation-poll', msg);
            return null;
          })
        : Promise.resolve(null);

      const [imageStatus, musicStatus] = await Promise.all([
        imagePromise,
        pollMusicJobStatus(
          musicJob.jobId,
          (s) => {
            if (s.status === 'queued') setGenerationStatusText('順番待ち…');
            else if (s.status === 'running') setGenerationStatusText('作曲中…');
            else if (s.status === 'succeeded') setGenerationStatusText('作曲ができました。仕上げ中…');
            else if (s.status === 'failed') setGenerationStatusText('作曲に失敗しました');
          },
          90,
          2000,
          controller.signal
        ),
      ]);

      const finalCoverUrl =
        imageStatus?.status === 'succeeded' && imageStatus?.resultUrl ? imageStatus.resultUrl : fallbackCover;
      if (!(imageStatus?.status === 'succeeded' && imageStatus?.resultUrl)) {
        addToast('warning', '画像が取得できなかったため、プレースホルダーで続行します。');
      }
      if (musicStatus.status !== 'succeeded' || !musicStatus.midiData || !musicStatus.result) {
        throw new Error('曲生成に失敗しました');
      }

      const suggestedTitle = refined?.brief?.theme?.title || '';
      setPendingAlbum({
        title: suggestedTitle,
        mood: refined?.image?.mood,
        duration: refined?.image?.duration,
        imageDataURL: finalCoverUrl,
        thumbnailUrl: finalCoverUrl,
        metadata: {
          valence: refined?.analysisLike?.valence,
          arousal: refined?.analysisLike?.arousal,
          focus: refined?.analysisLike?.focus,
          motif_tags: refined?.analysisLike?.motif_tags,
          confidence: refined?.analysisLike?.confidence,
          stylePreset: refined?.image?.stylePreset,
          provider: getCoverProvider(imageStatus),
        },
        musicData: musicStatus.midiData,
        musicFormat: 'midi',
        musicMetadata: {
          key: musicStatus.result.key,
          tempo: musicStatus.result.tempo,
          timeSignature: musicStatus.result.timeSignature,
          form: musicStatus.result.form,
          character: musicStatus.result.character,
          duration: refined?.music?.duration,
          createdAt: nowIso(),
          provider: musicStatus.provider,
        },
        sessionData: {
          brief: refined?.brief,
          recommendations: pending.sessionRecommendations ?? recommendations,
          messages: pending.sessionMessages ?? messages,
        },
        causalLogId: pending.causalLogId ?? undefined,
      });

      setPendingLogId(pending.causalLogId ?? null);
      setIsTitleModalOpen(true);
      setGenerationStatusText(null);
      setGenerationFailed(false);
      addToast('success', '生成が完了しました。タイトルを決めて保存できます。');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setGenerationStatusText('キャンセルしました');
        setGenerationFailed(false);
        return;
      }
      const msg = e instanceof Error ? e.message : '再生成に失敗しました';
      setError(msg);
      setGenerationFailed(true);
      addToast('error', msg);
    } finally {
      setIsGeneratingEvent(false);
      abortRef.current = null;
    }
  }

  async function handleResumeEvent() {
    const pending = loadPendingChatGeneration();
    if (!pending) return;
    if (isGeneratingEvent) return;

    setError(null);
    setGenerationFailed(false);
    setIsGeneratingEvent(true);
    setGenerationStatusText('再開中…');
    setGenerationStartedAt(pending.startedAt || Date.now());
    setGenerationElapsedSec(0);
    addToast('info', '生成を再開しています…');

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const refined = pending.refined;
      const fallbackCover = pending.coverDataUrl || makeFallbackCoverDataUrl(refined, 'Image unavailable');

      const imagePromise = pending.imageJobId
        ? pollJobStatus(
            pending.imageJobId,
            (s) => {
              if (s.status === 'queued') setGenerationStatusText('順番待ち…');
              else if (s.status === 'running') setGenerationStatusText('画像を生成中…');
              else if (s.status === 'succeeded') setGenerationStatusText('画像ができました。仕上げ中…');
              else if (s.status === 'failed') setGenerationStatusText('画像生成に失敗しました');
            },
            90,
            2000,
            controller.signal
          ).catch((e) => {
            const msg = e instanceof Error ? e.message : 'image polling failed';
            if (pending.causalLogId) logError(updateLog, getLog, pending.causalLogId, 'image-generation-poll', msg);
            return null;
          })
        : Promise.resolve(null);

      const [imageStatus, musicStatus] = await Promise.all([
        imagePromise,
        pollMusicJobStatus(
          pending.musicJobId,
          (s) => {
            if (s.status === 'queued') setGenerationStatusText('順番待ち…');
            else if (s.status === 'running') setGenerationStatusText('作曲中…');
            else if (s.status === 'succeeded') setGenerationStatusText('作曲ができました。仕上げ中…');
            else if (s.status === 'failed') setGenerationStatusText('作曲に失敗しました');
          },
          90,
          2000,
          controller.signal
        ),
      ]);

      const finalCoverUrl =
        imageStatus?.status === 'succeeded' && imageStatus?.resultUrl ? imageStatus.resultUrl : fallbackCover;
      if (!(imageStatus?.status === 'succeeded' && imageStatus?.resultUrl)) {
        addToast('warning', '画像が取得できなかったため、プレースホルダーで続行します。');
      }
      if (musicStatus.status !== 'succeeded' || !musicStatus.midiData || !musicStatus.result) {
        throw new Error('曲生成に失敗しました');
      }

      const suggestedTitle = refined?.brief?.theme?.title || '';
      setPendingAlbum({
        title: suggestedTitle,
        mood: refined?.image?.mood,
        duration: refined?.image?.duration,
        imageDataURL: finalCoverUrl,
        thumbnailUrl: finalCoverUrl,
        metadata: {
          valence: refined?.analysisLike?.valence,
          arousal: refined?.analysisLike?.arousal,
          focus: refined?.analysisLike?.focus,
          motif_tags: refined?.analysisLike?.motif_tags,
          confidence: refined?.analysisLike?.confidence,
          stylePreset: refined?.image?.stylePreset,
          provider: getCoverProvider(imageStatus),
        },
        musicData: musicStatus.midiData,
        musicFormat: 'midi',
        musicMetadata: {
          key: musicStatus.result.key,
          tempo: musicStatus.result.tempo,
          timeSignature: musicStatus.result.timeSignature,
          form: musicStatus.result.form,
          character: musicStatus.result.character,
          duration: refined?.music?.duration,
          createdAt: nowIso(),
          provider: musicStatus.provider,
        },
        sessionData: {
          brief: refined?.brief,
          recommendations: pending.sessionRecommendations ?? recommendations,
          messages: pending.sessionMessages ?? messages,
        },
        causalLogId: pending.causalLogId ?? undefined,
      });

      setPendingLogId(pending.causalLogId ?? null);
      setIsTitleModalOpen(true);
      setGenerationStatusText(null);
      setHasPendingResume(true);
      setGenerationFailed(false);
      addToast('success', '生成が完了しました。タイトルを決めて保存できます。');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setGenerationStatusText('キャンセルしました');
        setGenerationFailed(false);
        return;
      }
      const msg = e instanceof Error ? e.message : '再開に失敗しました';
      setError(msg);
      setGenerationFailed(true);
      addToast('error', msg);
    } finally {
      setIsGeneratingEvent(false);
      abortRef.current = null;
    }
  }

  const getRecKey = (r: { composer: string; title: string }) => `${r.composer}::${r.title}`;

  async function ensurePreview(r: { composer: string; title: string }) {
    const key = getRecKey(r);
    if (previewByKey[key]) return previewByKey[key];
    if (previewLoading[key]) return null;

    setPreviewLoading((p) => ({ ...p, [key]: true }));
    setPreviewError((p) => ({ ...p, [key]: null }));

    try {
      const resolved = await getMusicPreview({ composer: r.composer, title: r.title });
      setPreviewByKey((p) => ({ ...p, [key]: resolved }));
      return resolved;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'プレビュー取得に失敗しました';
      setPreviewError((p) => ({ ...p, [key]: msg }));
      return null;
    } finally {
      setPreviewLoading((p) => ({ ...p, [key]: false }));
    }
  }

  async function togglePlayRecommendation(r: { composer: string; title: string }) {
    const key = getRecKey(r);
    const isThisPlaying = playingKey === key;

    if (isThisPlaying) {
      audioRef.current?.pause();
      setPlayingKey(null);
      return;
    }

    const resolved = await ensurePreview(r);
    const previewUrl = resolved?.previewUrl;
    const trackUrl = resolved?.trackUrl;

    if (!previewUrl) {
      if (trackUrl) window.open(trackUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      audioRef.current.pause();
      audioRef.current.src = previewUrl;
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      setPlayingKey(key);

      audioRef.current.onended = () => {
        setPlayingKey((prev) => (prev === key ? null : prev));
      };
    } catch (e) {
      setPreviewError((p) => ({ ...p, [key]: e instanceof Error ? e.message : '再生に失敗しました' }));
    }
  }

  async function handleSend() {
    const content = input.trim();
    if (!content) return;

    setError(null);
    setIsSending(true);

    const nextMessages = [...messages, { role: 'user' as const, content }];
    setMessages(nextMessages);
    setInput('');

    try {
      const resp = await chatTurn({
        messages: nextMessages,
        onboardingData: onboardingPayload ?? undefined,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: resp.assistant_message }]);
      setRecommendations(resp.recommendations ?? []);
      setEventSuggested(resp.event_suggestion ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '送信に失敗しました';
      setError(msg);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'ごめん、いま少し不安定。もう一度だけ送ってみて。' }]);
    } finally {
      setIsSending(false);
    }
  }

  async function handleStartEvent() {
    setError(null);
    setGenerationFailed(false);
    setIsGeneratingEvent(true);
    setGenerationStatusText('準備中…');
    setGenerationStartedAt(Date.now());
    setGenerationElapsedSec(0);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const sessionId = `chat_${Date.now()}`;
    const logId = createLog(sessionId, {
      mood: '穏やか',
      duration: 60,
      timestamp: new Date(),
      customInput: true,
    } as any);

    try {
      setGenerationStatusText('イベントを整えています…');
      const refined = await refineGenerationEvent({
        messages,
        onboardingData: onboardingPayload ?? undefined,
      });

      const fallbackCover = makeFallbackCoverDataUrl(refined, 'Image unavailable');

      // Kick image + music jobs using refined inputs
      let imageJobId: string | null = null;
      try {
        setGenerationStatusText('画像生成を開始しています…');
        const imageJob = await generateImage(refined.image);
        imageJobId = imageJob.jobId;
      } catch (e) {
        imageJobId = null;
        addToast('warning', '画像生成が開始できなかったため、プレースホルダーで続行します。');
        const msg = e instanceof Error ? e.message : 'image job start failed';
        logError(updateLog, getLog, logId, 'image-generation-start', msg);
      }

      setGenerationStatusText('作曲を開始しています…');
      const musicReq: GenerateMusicRequest = {
        ...refined.music,
        confidence: refined?.analysisLike?.confidence ?? 0.7,
      };
      const musicJob = await generateMusic(musicReq);

      savePendingChatGeneration({
        v: 1,
        kind: 'chat',
        startedAt: Date.now(),
        imageJobId,
        musicJobId: musicJob.jobId,
        coverDataUrl: fallbackCover,
        refined,
        sessionMessages: messages,
        sessionRecommendations: recommendations,
        causalLogId: logId,
      });
      setHasPendingResume(true);
      addToast('info', '生成を開始しました。完了まで待つか、あとで再開できます。');

      const imagePromise = imageJobId
        ? pollJobStatus(
            imageJobId,
            (s) => {
              if (s.status === 'queued') setGenerationStatusText('順番待ち…');
              else if (s.status === 'running') setGenerationStatusText('画像を生成中…');
              else if (s.status === 'succeeded') setGenerationStatusText('画像ができました。仕上げ中…');
              else if (s.status === 'failed') setGenerationStatusText('画像生成に失敗しました');
            },
            90,
            2000,
            controller.signal
          ).catch((e) => {
            const msg = e instanceof Error ? e.message : 'image polling failed';
            logError(updateLog, getLog, logId, 'image-generation-poll', msg);
            return null;
          })
        : Promise.resolve(null);

      const [imageStatus, musicStatus] = await Promise.all([
        imagePromise,
        pollMusicJobStatus(
          musicJob.jobId,
          (s) => {
            if (s.status === 'queued') setGenerationStatusText('順番待ち…');
            else if (s.status === 'running') setGenerationStatusText('作曲中…');
            else if (s.status === 'succeeded') setGenerationStatusText('作曲ができました。仕上げ中…');
            else if (s.status === 'failed') setGenerationStatusText('作曲に失敗しました');
          },
          90,
          2000,
          controller.signal
        ),
      ]);

      if (controller.signal.aborted) {
        setGenerationStatusText('キャンセルしました');
        return;
      }

      const finalCoverUrl =
        imageStatus?.status === 'succeeded' && imageStatus?.resultUrl ? imageStatus.resultUrl : fallbackCover;
      if (!(imageStatus?.status === 'succeeded' && imageStatus?.resultUrl)) {
        addToast('warning', '画像が取得できなかったため、プレースホルダーで続行します。');
      }
      if (musicStatus.status !== 'succeeded' || !musicStatus.midiData || !musicStatus.result) {
        throw new Error('曲生成に失敗しました');
      }

      setGenerationStatusText('保存の準備をしています…');
      const suggestedTitle = refined?.brief?.theme?.title || '';
      setPendingAlbum({
        title: suggestedTitle,
        mood: refined.image.mood,
        duration: refined.image.duration,
        imageDataURL: finalCoverUrl,
        thumbnailUrl: finalCoverUrl,
        metadata: {
          valence: refined.analysisLike.valence,
          arousal: refined.analysisLike.arousal,
          focus: refined.analysisLike.focus,
          motif_tags: refined.analysisLike.motif_tags,
          confidence: refined.analysisLike.confidence,
          stylePreset: refined.image.stylePreset,
          provider: getCoverProvider(imageStatus),
        },
        musicData: musicStatus.midiData,
        musicFormat: 'midi',
        musicMetadata: {
          key: musicStatus.result.key,
          tempo: musicStatus.result.tempo,
          timeSignature: musicStatus.result.timeSignature,
          form: musicStatus.result.form,
          character: musicStatus.result.character,
          duration: refined.music.duration,
          createdAt: nowIso(),
          provider: musicStatus.provider,
        },
        sessionData: {
          brief: refined.brief,
          recommendations,
          messages,
        },
        causalLogId: logId,
      });
      setPendingLogId(logId);
      setIsTitleModalOpen(true);

      addToast('success', '生成が完了しました。タイトルを決めて保存できます。');
      setGenerationFailed(false);

      setGenerationStatusText(null);
      setGenerationStartedAt(null);
      setGenerationElapsedSec(0);

      setEventSuggested(null);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '生成イベントを完了したよ。ギャラリーで見返せるように保存した。',
        },
      ]);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setGenerationStatusText('キャンセルしました');
        setGenerationStartedAt(null);
        setGenerationElapsedSec(0);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '生成をキャンセルしたよ。必要ならまた「今すぐ1曲つくる」で再開できる。',
          },
        ]);
        addToast('info', '生成をキャンセルしました。あとで再開できます。');
        setGenerationFailed(false);
        return;
      }

      const msg = e instanceof Error ? e.message : '生成イベントに失敗しました';
      setGenerationStatusText(null);
      setGenerationStartedAt(null);
      setGenerationElapsedSec(0);
      setError(msg);
      addToast('error', msg);
      setGenerationFailed(true);
      logError(updateLog, getLog, logId, 'generation-event', msg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '生成イベントがうまく走らなかった。もう少し会話を続けるか、後でもう一度やってみよう。',
        },
      ]);
    } finally {
      setIsGeneratingEvent(false);
      abortRef.current = null;
    }
  }

  async function finalizeAlbumTitle(userTitle: string) {
    if (!pendingAlbum) {
      setIsTitleModalOpen(false);
      return;
    }
    const trimmed = userTitle.trim();

    try {
      setIsResolvingTitle(true);
      let finalTitle = trimmed;
      if (!finalTitle) {
        try {
          const resp = await nameAlbumTitle({
            mood: pendingAlbum.mood,
            motifTags: pendingAlbum?.metadata?.motif_tags,
            character: pendingAlbum?.musicMetadata?.character,
            brief: pendingAlbum?.sessionData?.brief,
            messages: pendingAlbum?.sessionData?.messages,
          });
          finalTitle = resp.title;
        } catch {
          finalTitle = '';
        }
      }

      const created = addAlbum({ ...pendingAlbum, title: finalTitle || undefined } as any);
      selectAlbum(created.id);
      requestPlayAlbum(created, [created, ...albumsWithMusic]);
      navigateToRoom('music');

      addToast('success', '保存して再生を開始しました。');

      clearPendingChatGeneration();
      setHasPendingResume(false);

      if (pendingLogId) {
        logAlbumStage(updateLog, pendingLogId, {
          albumId: 'local',
          title: finalTitle || pendingAlbum.mood,
        });
      }

      setEventSuggested(null);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '生成イベントを完了したよ。ギャラリーで見返せるように保存した。',
        },
      ]);
    } finally {
      setIsResolvingTitle(false);
      setIsTitleModalOpen(false);
      setPendingAlbum(null);
      setPendingLogId(null);
    }
  }

  return (
    <div className="chatSession">
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
      <AlbumTitleModal
        open={isTitleModalOpen}
        mood={pendingAlbum?.mood || '穏やか'}
        defaultTitle={pendingAlbum?.title}
        onCancel={() => {
          if (isResolvingTitle) return;
          setIsTitleModalOpen(false);
          setPendingAlbum(null);
          setPendingLogId(null);
        }}
        onSubmit={(title) => {
          if (isResolvingTitle) return;
          void finalizeAlbumTitle(title);
        }}
      />

      <div className="chatLayout">
        <div className="chatMain">
          <div className="chatBody">
            {messages.map((m, idx) => (
              <div key={idx} className={`chatMsg ${m.role === 'user' ? 'user' : 'assistant'}`}>
                <div className="chatBubble">{m.content}</div>
              </div>
            ))}
          </div>

          <div className="chatDock" data-no-swipe>
            <div className="chatDockTop" aria-label="生成コントロール">
              <div className="chatDockMeta">
                {generationStatusText ? (
                  <div className="chatMetaPill" aria-live="polite">
                    {generationStatusText}
                    {generationStartedAt ? <span className="chatMetaElapsed">（{generationElapsedSec}s）</span> : null}
                  </div>
                ) : eventSuggested && !eventSuggested.shouldTrigger ? (
                  <div className="chatMetaHint" title={eventSuggested.reason}>
                    {eventSuggested.reason}
                  </div>
                ) : (
                  <div className="chatMetaHint" aria-hidden="true" />
                )}
              </div>

              <div className="chatDockActions" data-no-swipe>
                <button
                  className="chatCancel"
                  onClick={() => setSideOpen((v) => !v)}
                  type="button"
                  title="レコメンドパネルを表示/非表示"
                >
                  {sideOpen ? 'レコメンド非表示' : 'レコメンド表示'}
                </button>
                <button
                  className="chatPrimary"
                  onClick={handleStartEvent}
                  disabled={isGeneratingEvent}
                  title={eventSuggested?.reason || '会話の内容をもとに1曲生成します'}
                  type="button"
                >
                  {isGeneratingEvent ? '生成中…' : eventSuggested?.shouldTrigger ? '生成イベントを開始' : '今すぐ1曲つくる'}
                </button>

                {!isGeneratingEvent && hasPendingResume ? (
                  <button className="chatCancel" onClick={() => void handleResumeEvent()} type="button">
                    再開
                  </button>
                ) : null}

                {!isGeneratingEvent && hasPendingResume && generationFailed ? (
                  <button
                    className="chatCancel"
                    onClick={() => void handleRetryPendingEvent()}
                    type="button"
                    title="同じ条件で生成をやり直します（失敗・停止時向け）"
                  >
                    再生成
                  </button>
                ) : null}

                {isGeneratingEvent ? (
                  <button className="chatCancel" onClick={handleCancelEvent} type="button">
                    キャンセル
                  </button>
                ) : null}

                {!isGeneratingEvent && hasPendingResume ? (
                  <button
                    className="chatCancel"
                    onClick={() => setConfirmDiscardOpen(true)}
                    type="button"
                    title="保留中の生成を破棄します"
                  >
                    破棄
                  </button>
                ) : null}
              </div>
            </div>

            {error ? <div className="chatError">{error}</div> : null}

            <div className="chatComposer">
              <textarea
                className="chatInput"
                placeholder={userOnlyMessages.length === 0 ? '今日のことを一言で' : '続けて話して'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!isSending) handleSend();
                  }
                }}
                rows={2}
              />
              <button className="chatSend" onClick={handleSend} disabled={isSending || !input.trim()}>
                {isSending ? '送信中…' : '送信'}
              </button>
            </div>
          </div>
        </div>

        <aside className={`chatSide ${sideOpen ? 'open' : 'closed'}`} aria-label="レコメンド" aria-hidden={!sideOpen}>
          <div className="chatSideHeader">
            <div className="chatSideTitle">いまのレコメンド</div>
            <div className="chatSideHint">30秒プレビュー（可能な場合）</div>
          </div>

          {recommendations.length > 0 ? (
            <ul className="chatRecsList">
              {recommendations.slice(0, 4).map((r, i) => (
                <li key={i} className="chatRecItem">
                  <div className="chatRecMain">
                    <span className="chatRecComposer">{r.composer}</span>
                    <span className="chatRecSep">—</span>
                    <span className="chatRecTitle">{r.title}</span>
                    {r.era ? <span className="chatRecEra">({r.era})</span> : null}
                  </div>
                  <div className="chatRecWhy">{r.why}</div>

                  <div className="chatRecActions">
                    <button
                      className="chatRecPlay"
                      onClick={() => void togglePlayRecommendation(r)}
                      disabled={Boolean(previewLoading[getRecKey(r)])}
                      data-no-swipe
                    >
                      {playingKey === getRecKey(r) ? '停止' : previewLoading[getRecKey(r)] ? '取得中…' : '再生'}
                    </button>

                    {previewByKey[getRecKey(r)]?.trackUrl ? (
                      <a
                        className="chatRecOpen"
                        href={previewByKey[getRecKey(r)]?.trackUrl}
                        target="_blank"
                        rel="noreferrer"
                        data-no-swipe
                      >
                        開く
                      </a>
                    ) : null}
                  </div>

                  {previewError[getRecKey(r)] ? (
                    <div className="chatRecErr">{previewError[getRecKey(r)]}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="chatRecsEmpty">会話をすると、ここにおすすめが出ます。</div>
          )}
        </aside>
      </div>
    </div>
  );
}
