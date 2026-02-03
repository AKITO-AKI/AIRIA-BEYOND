import React from 'react';
import './InfoRoom.css';
import Dialog from '../ui/Dialog';
import Tooltip from '../ui/Tooltip';
import { useToast } from '../visual/feedback/ToastContainer';

const STORAGE_KEY = 'airia_onboarding_data';
const THEME_STORAGE_KEY = 'airia_theme';

type ThemeChoice = 'system' | 'light' | 'dark' | 'high-contrast';

function applyThemeChoice(choice: ThemeChoice) {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const next = choice === 'system' ? (prefersDark ? 'dark' : 'light') : choice;
  document.documentElement.setAttribute('data-theme', next);
}

const InfoRoom: React.FC = () => {
  const isDev = import.meta.env.DEV;
  const { addToast } = useToast();
  const [themeChoice, setThemeChoice] = React.useState<ThemeChoice>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeChoice | null;
      return stored || 'system';
    } catch {
      return 'system';
    }
  });

  const updateTheme = (choice: ThemeChoice) => {
    setThemeChoice(choice);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
      // ignore
    }
    applyThemeChoice(choice);
  };

  const [showAbout, setShowAbout] = React.useState(false);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitOk, setSubmitOk] = React.useState(false);

  const [category, setCategory] = React.useState('');
  const [rating, setRating] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [steps, setSteps] = React.useState('');
  const [expected, setExpected] = React.useState('');
  const [actual, setActual] = React.useState('');
  const [device, setDevice] = React.useState('');
  const [browser, setBrowser] = React.useState('');
  const [name, setName] = React.useState('');
  const [contact, setContact] = React.useState('');
  const [allowFollowUp, setAllowFollowUp] = React.useState(true);

  const canSubmit = React.useMemo(() => {
    const hasAny =
      title.trim().length > 0 ||
      message.trim().length > 0 ||
      steps.trim().length > 0 ||
      expected.trim().length > 0 ||
      actual.trim().length > 0;
    return hasAny && !isSubmitting;
  }, [actual, expected, isSubmitting, message, steps, title]);

  const submitFeedback = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    setSubmitOk(false);
    setIsSubmitting(true);

    try {
      const resp = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: category || undefined,
          rating: rating || undefined,
          title: title || undefined,
          message: message || undefined,
          steps: steps || undefined,
          expected: expected || undefined,
          actual: actual || undefined,
          device: device || undefined,
          browser: browser || undefined,
          name: name || undefined,
          contact: contact || undefined,
          allowFollowUp,
        }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json?.message || '送信に失敗しました');
      }

      setSubmitOk(true);
      addToast('success', 'フィードバックを送信しました。ありがとうございます。');

      // Keep optional contact/name for convenience; clear the content fields.
      setCategory('');
      setRating('');
      setTitle('');
      setMessage('');
      setSteps('');
      setExpected('');
      setActual('');
      setDevice('');
      setBrowser('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '送信に失敗しました';
      setSubmitError(msg);
      addToast('error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetOnboarding = () => {
    if (!isDev) return;
    const ok = window.confirm('開発用: オンボーディングをリセットしますか？\n次回リロードでオンボーディングが表示されます。');
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  return (
    <div className="room-content info-room">
      <h1 className="room-title">INFO</h1>
      <p className="room-subtitle">このアプリについて / フィードバック</p>

      <div className="feedback-hero" data-no-swipe="true">
        <div className="feedback-hero-top">
          <h2 className="feedback-hero-title">フィードバックを送ってください</h2>
          <p className="feedback-hero-sub">
            不便・バグ・改善案はもちろん、良かった点も歓迎です。<br />
            一部だけの回答でも送信できます。
          </p>
        </div>

        <div className="feedback-grid">
          <div className="feedback-field">
            <label className="feedback-label">カテゴリ</label>
            <select className="feedback-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">未選択</option>
              <option value="bug">バグ</option>
              <option value="ux">使いにくい</option>
              <option value="feature">要望</option>
              <option value="praise">良かった</option>
              <option value="other">その他</option>
            </select>
          </div>

          <div className="feedback-field">
            <label className="feedback-label">気持ち（任意）</label>
            <select className="feedback-input" value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="">未選択</option>
              <option value="great">最高だった</option>
              <option value="good">良かった</option>
              <option value="ok">ふつう</option>
              <option value="frustrating">困った</option>
              <option value="broken">壊れてる</option>
            </select>
          </div>

          <div className="feedback-field feedback-span-2">
            <label className="feedback-label">タイトル（任意）</label>
            <input
              className="feedback-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：再開ボタンが効かない / 背景が綺麗で好き"
            />
          </div>

          <div className="feedback-field feedback-span-2">
            <label className="feedback-label">本文（任意）</label>
            <textarea
              className="feedback-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="気づいたことを自由に。短くてもOK。"
              rows={5}
            />
          </div>

          <div className="feedback-field feedback-span-2">
            <label className="feedback-label">再現手順（任意・バグ向け）</label>
            <textarea
              className="feedback-textarea"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder={'例：\n1) Chatで「今すぐ1曲」\n2) キャンセル\n3) 再開\n→ エラー'}
              rows={4}
            />
          </div>

          <div className="feedback-field feedback-span-2 feedback-split">
            <div className="feedback-field">
              <label className="feedback-label">期待したこと（任意）</label>
              <textarea className="feedback-textarea" value={expected} onChange={(e) => setExpected(e.target.value)} rows={3} />
            </div>
            <div className="feedback-field">
              <label className="feedback-label">実際に起きたこと（任意）</label>
              <textarea className="feedback-textarea" value={actual} onChange={(e) => setActual(e.target.value)} rows={3} />
            </div>
          </div>

          <div className="feedback-field">
            <label className="feedback-label">端末（任意）</label>
            <input className="feedback-input" value={device} onChange={(e) => setDevice(e.target.value)} placeholder="例：iPhone / Windows" />
          </div>
          <div className="feedback-field">
            <label className="feedback-label">ブラウザ（任意）</label>
            <input className="feedback-input" value={browser} onChange={(e) => setBrowser(e.target.value)} placeholder="例：Safari / Chrome" />
          </div>

          <div className="feedback-field">
            <label className="feedback-label">お名前（任意）</label>
            <input className="feedback-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="匿名でもOK" />
          </div>
          <div className="feedback-field">
            <label className="feedback-label">連絡先（任意）</label>
            <input className="feedback-input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="返信が必要な場合だけ" />
          </div>

          <label className="feedback-check feedback-span-2">
            <input type="checkbox" checked={allowFollowUp} onChange={(e) => setAllowFollowUp(e.target.checked)} />
            必要があれば追加で質問してもよい（任意）
          </label>

          <div className="feedback-actions feedback-span-2">
            <button
              type="button"
              className="btn btn-primary feedback-submit"
              disabled={!canSubmit}
              onClick={() => void submitFeedback()}
            >
              {isSubmitting ? '送信中…' : '送信する'}
            </button>
            <div className="feedback-hint">
              {submitOk ? '送信完了。ありがとうございます。' : '※ タイトル/本文/再現手順など、どれか1つでも書けば送信できます。'}
            </div>
            {submitError ? <div className="feedback-error">{submitError}</div> : null}
          </div>
        </div>
      </div>

      <div className="info-card">
        <section className="info-section">
          <h2 className="info-title">目的</h2>
          <p className="info-text">この体験の目的は、「より貴方らしい芸術」を日常の中で生み出せること。</p>
          <p className="info-text">そして、気持ちの変化に合わせて「ずっと寄り添える」相棒になることです。</p>
        </section>

        <section className="info-section" data-no-swipe="true">
          <div className="info-actions">
            <h2 className="info-title">テーマ</h2>
            <Tooltip label="見やすさに合わせて切り替えできます">
              <span className="info-badge" aria-hidden="true">?</span>
            </Tooltip>
          </div>
          <div className="info-actions">
            <div className="theme-toggle" role="group" aria-label="テーマ切り替え">
              {([
                { id: 'system', label: 'システム' },
                { id: 'light', label: 'ライト' },
                { id: 'dark', label: 'ダーク' },
                { id: 'high-contrast', label: '高コントラスト' },
              ] as const).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="theme-button"
                  aria-pressed={themeChoice === option.id}
                  onClick={() => updateTheme(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <p className="info-text">見やすさに合わせて切り替えられます。</p>
        </section>

        <section className="info-section">
          <div className="info-actions">
            <h2 className="info-title">リンク</h2>
            <button
              type="button"
              className="info-reset"
              onClick={() => setShowAbout(true)}
            >
              アプリ情報
            </button>
          </div>
          <ul className="info-list">
            <li>
              <a className="info-link" href="https://github.com/AKITO-AKI/AIRIA-BEYOND" target="_blank" rel="noreferrer">
                GitHub Repository
              </a>
            </li>
          </ul>
        </section>

        {isDev ? (
          <section className="info-section">
            <h2 className="info-title">開発用</h2>
            <button
              onClick={resetOnboarding}
              className="info-reset"
            >
              オンボーディングをリセット
            </button>
          </section>
        ) : null}
      </div>

      <Dialog
        open={showAbout}
        onOpenChange={setShowAbout}
        title="AIRIA BEYOND"
        description="あなたの一日を、作品へ。"
        footer={
          <button className="btn btn-primary" onClick={() => setShowAbout(false)}>
            閉じる
          </button>
        }
      >
        <p className="info-text">
          会話と気分の手がかりから、あなたに合うレコメンドや創作を少しずつ育てていきます。
        </p>
        <p className="info-text">
          まだプレリリース段階です。気づいたことがあれば、ぜひフィードバックを送ってください。
        </p>
      </Dialog>
    </div>
  );
};

export default InfoRoom;
