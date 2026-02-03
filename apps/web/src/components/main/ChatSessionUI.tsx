import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAlbums } from '../../contexts/AlbumContext';
import { useCausalLog } from '../../contexts/CausalLogContext';
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
} from '../../api/imageApi';
import {
  logAlbumStage,
  logError,
} from '../../utils/causalLogging/loggingHelpers';
import './ChatSessionUI.css';
import AlbumTitleModal from '../AlbumTitleModal';

function nowIso() {
  return new Date().toISOString();
}

export default function ChatSessionUI() {
  const { addAlbum } = useAlbums();
  const { createLog, updateLog, getLog } = useCausalLog();

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

  const userOnlyMessages = useMemo(() => messages.filter((m) => m.role === 'user'), [messages]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

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
      const resp = await chatTurn({ messages: nextMessages });
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
    setIsGeneratingEvent(true);

    const sessionId = `chat_${Date.now()}`;
    const logId = createLog(sessionId, {
      mood: '穏やか',
      duration: 60,
      timestamp: new Date(),
      customInput: true,
    } as any);

    try {
      const refined = await refineGenerationEvent({ messages });

      // Kick image + music jobs using refined inputs
      const imageJob = await generateImage(refined.image);
      const musicJob = await generateMusic(refined.music as any);

      const [imageStatus, musicStatus] = await Promise.all([
        pollJobStatus(imageJob.jobId),
        pollMusicJobStatus(musicJob.jobId),
      ]);

      if (imageStatus.status !== 'succeeded' || !imageStatus.resultUrl) {
        throw new Error('画像生成に失敗しました');
      }
      if (musicStatus.status !== 'succeeded' || !musicStatus.midiData || !musicStatus.result) {
        throw new Error('曲生成に失敗しました');
      }

      const suggestedTitle = refined?.brief?.theme?.title || '';
      setPendingAlbum({
        title: suggestedTitle,
        mood: refined.image.mood,
        duration: refined.image.duration,
        imageDataURL: imageStatus.resultUrl,
        thumbnailUrl: imageStatus.resultUrl,
        metadata: {
          valence: refined.analysisLike.valence,
          arousal: refined.analysisLike.arousal,
          focus: refined.analysisLike.focus,
          motif_tags: refined.analysisLike.motif_tags,
          confidence: refined.analysisLike.confidence,
          stylePreset: refined.image.stylePreset,
          provider: 'replicate',
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

      setEventSuggested(null);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '生成イベントを完了したよ。ギャラリーで見返せるように保存した。',
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '生成イベントに失敗しました';
      setError(msg);
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

      addAlbum({ ...pendingAlbum, title: finalTitle || undefined } as any);

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
      <div className="chatHeader">
        <div className="chatTitle">
          <div className="chatTitleMain">対話</div>
          <div className="chatTitleSub">話すだけで、レコメンドと創作が進む</div>
        </div>
        <div className="chatHeaderRight">
          {eventSuggested?.shouldTrigger ? (
            <button
              className="chatPrimary"
              onClick={handleStartEvent}
              disabled={isGeneratingEvent}
              data-no-swipe
            >
              {isGeneratingEvent ? '生成中…' : '生成イベントを開始'}
            </button>
          ) : null}
        </div>
      </div>

      {eventSuggested && !eventSuggested.shouldTrigger ? (
        <div className="chatHint">{eventSuggested.reason}</div>
      ) : null}

      <div className="chatBody">
        {messages.map((m, idx) => (
          <div key={idx} className={`chatMsg ${m.role === 'user' ? 'user' : 'assistant'}`}>
            <div className="chatBubble">{m.content}</div>
          </div>
        ))}

        {recommendations.length > 0 ? (
          <details className="chatRecsInline" data-no-swipe open>
            <summary className="chatRecsSummary">いまのレコメンド</summary>
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
                      title="プレビューがある場合は30秒再生します"
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
          </details>
        ) : null}
      </div>

      <div className="chatDock" data-no-swipe>
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
  );
}
