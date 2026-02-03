import React, { useEffect } from 'react';
import './ConfirmDialog.css';

type Props = {
  open: boolean;
  title: string;
  description?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmTone?: 'primary' | 'danger';
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  cancelLabel = 'キャンセル',
  confirmLabel = '実行',
  confirmTone = 'primary',
  onCancel,
  onConfirm,
}: Props) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onConfirm();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <>
      <div className="confirm-dialog-backdrop" onClick={onCancel} />
      <div className="confirm-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="confirm-dialog-header">
          <div>
            <div className="confirm-dialog-eyebrow">確認</div>
            <h2 className="confirm-dialog-title">{title}</h2>
          </div>
          <button className="confirm-dialog-close" onClick={onCancel} aria-label="閉じる" title="閉じる (Esc)">
            ×
          </button>
        </div>

        {description ? <div className="confirm-dialog-body">{description}</div> : null}

        <div className="confirm-dialog-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={confirmTone === 'danger' ? 'btn btn-primary confirm-dialog-danger' : 'btn btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>

        <div className="confirm-dialog-shortcut">確定: クリック / (Ctrl+Enter)</div>
      </div>
    </>
  );
}
