import React from 'react';
import './FeedbackRoom.css';
import { useRoomNavigation } from '../../contexts/RoomNavigationContext';
import { useToast } from '../visual/feedback/ToastContainer';

const FeedbackRoom: React.FC = () => {
  const { navigateToRoom } = useRoomNavigation();
  const { addToast } = useToast();

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

  const [diagLoading, setDiagLoading] = React.useState(false);
  const [diagError, setDiagError] = React.useState<string | null>(null);
  const [diagText, setDiagText] = React.useState<string>('');
  const [attachDiagnostics, setAttachDiagnostics] = React.useState(false);

  const canSubmit = React.useMemo(() => {
    const hasAny =
      title.trim().length > 0 ||
      message.trim().length > 0 ||
      steps.trim().length > 0 ||
      expected.trim().length > 0 ||
      actual.trim().length > 0;
    return hasAny && !isSubmitting;
  }, [actual, expected, isSubmitting, message, steps, title]);

  const fetchDiagnostics = async () => {
    setDiagError(null);
    setDiagLoading(true);
    try {
      const resp = await fetch('/api/diagnostics/image', { method: 'GET' });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json?.message || '診断情報の取得に失敗しました');
      }
      const pretty = JSON.stringify(json, null, 2);
      setDiagText(pretty);
      addToast('success', '診断情報を取得しました。必要ならコピーして送れます。');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '診断情報の取得に失敗しました';
      setDiagError(msg);
      addToast('error', msg);
    } finally {
      setDiagLoading(false);
    }
  };

  const copyDiagnostics = async () => {
    const text = diagText.trim();
    if (!text) {
      addToast('info', '先に「診断情報を取得」を押してください。');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      addToast('success', '診断情報をコピーしました。');
    } catch {
      try {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        addToast('success', '診断情報をコピーしました。');
      } catch {
        addToast('error', 'コピーに失敗しました。手動で選択してコピーしてください。');
      }
    }
  };

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
          diagnostics: attachDiagnostics && diagText.trim().length > 0 ? diagText : undefined,
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

  return (
    <div className="room-content feedback-room">
      <div className="feedback-header" data-no-swipe="true">
        <div className="feedback-header-actions">
          <button className="btn btn-secondary" onClick={() => navigateToRoom('info')}>
            Infoへ
          </button>
        </div>
      </div>

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

      <div className="diagnostics-card" data-no-swipe="true">
        <div className="diagnostics-top">
          <h2 className="diagnostics-title">困ったとき（診断情報）</h2>
          <p className="diagnostics-sub">
            画像生成がうまくいかない時は、診断情報をコピーしてフィードバックに貼り付けると原因特定が早くなります。
          </p>
        </div>
        <div className="diagnostics-actions">
          <button type="button" className="btn btn-secondary" disabled={diagLoading} onClick={() => void fetchDiagnostics()}>
            {diagLoading ? '取得中…' : '診断情報を取得'}
          </button>
          <button type="button" className="btn btn-secondary" disabled={!diagText.trim()} onClick={() => void copyDiagnostics()}>
            コピー
          </button>
          <label className="diagnostics-attach">
            <input type="checkbox" checked={attachDiagnostics} onChange={(e) => setAttachDiagnostics(e.target.checked)} />
            フィードバック送信に添付する（任意）
          </label>
        </div>
        <p className="diagnostics-note">
          ※ 個人情報は含めませんが、接続先URL・エラー概要・最近のジョブ情報が含まれることがあります。
        </p>
        <textarea
          className="diagnostics-textarea"
          value={diagText}
          onChange={(e) => setDiagText(e.target.value)}
          placeholder="ここに診断情報が表示されます（取得ボタンを押してください）"
          rows={7}
        />
        {diagError ? <div className="diagnostics-error">{diagError}</div> : null}
      </div>
    </div>
  );
};

export default FeedbackRoom;
