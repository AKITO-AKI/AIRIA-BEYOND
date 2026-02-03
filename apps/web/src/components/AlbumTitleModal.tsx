import React, { useEffect, useMemo, useState } from 'react';
import './AlbumTitleModal.css';

type Props = {
  open: boolean;
  mood: string;
  defaultTitle?: string;
  onCancel: () => void;
  onSubmit: (title: string) => void;
};

export default function AlbumTitleModal({ open, mood, defaultTitle, onCancel, onSubmit }: Props) {
  const [title, setTitle] = useState(defaultTitle ?? '');

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle ?? '');
  }, [open, defaultTitle]);

  const hint = useMemo(() => {
    if (title.trim().length > 0) return 'そのまま保存されます。';
    return '空のまま保存すると、AIがタイトルを提案します。';
  }, [title]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit(title);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel, onSubmit, title]);

  if (!open) return null;

  return (
    <>
      <div className="album-title-backdrop" onClick={onCancel} />
      <div className="album-title-modal" role="dialog" aria-modal="true" aria-label="アルバムタイトルの設定">
        <div className="album-title-header">
          <div>
            <div className="album-title-eyebrow">アルバムのタイトル</div>
            <h2 className="album-title-heading">作品に名前をつけよう</h2>
            <p className="album-title-sub">ムード: {mood}</p>
          </div>
          <button className="album-title-close" onClick={onCancel} aria-label="閉じる" title="閉じる (Esc)">
            ×
          </button>
        </div>

        <div className="album-title-body">
          <label className="album-title-label" htmlFor="album-title-input">
            タイトル（空でもOK）
          </label>
          <input
            id="album-title-input"
            className="album-title-input"
            value={title}
            placeholder="例：雨上がりの余白"
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <div className="album-title-hint">{hint}</div>
          <div className="album-title-shortcut">保存: クリック / (Ctrl+Enter)</div>
        </div>

        <div className="album-title-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            キャンセル
          </button>
          <button className="btn btn-primary" onClick={() => onSubmit(title)}>
            保存
          </button>
        </div>
      </div>
    </>
  );
}
