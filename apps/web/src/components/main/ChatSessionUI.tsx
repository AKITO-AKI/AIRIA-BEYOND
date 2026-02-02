import React, { useMemo, useState } from 'react';
import { useAlbums } from '../../contexts/AlbumContext';
import { useCausalLog } from '../../contexts/CausalLogContext';
import {
  chatTurn,
  refineGenerationEvent,
  generateImage,
  generateMusic,
  pollJobStatus,
  pollMusicJobStatus,
  ChatMessage,
} from '../../api/imageApi';
import {
  logAlbumStage,
  logError,
} from '../../utils/causalLogging/loggingHelpers';
import './ChatSessionUI.css';

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

  const userOnlyMessages = useMemo(() => messages.filter((m) => m.role === 'user'), [messages]);

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

      // Store as an album
      addAlbum({
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

      logAlbumStage(updateLog, logId, {
        albumId: 'local',
        title: refined?.brief?.theme?.title || '生成アルバム',
      });

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

  return (
    <div className="chatSession">
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
