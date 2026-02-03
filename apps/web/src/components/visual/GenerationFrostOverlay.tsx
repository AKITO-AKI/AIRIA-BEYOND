import React from 'react';
import './GenerationFrostOverlay.css';

type Props = {
  active: boolean;
  statusText?: string | null;
  elapsedSec?: number;
  onCancel?: (() => void) | null;
};

export default function GenerationFrostOverlay({ active, statusText, elapsedSec = 0, onCancel }: Props) {
  if (!active) return null;

  // Frost intensity eases down a bit over time ("gradually generating" feel)
  const t = Math.max(0, Math.min(1, elapsedSec / 22));
  const frost = 0.85 - 0.35 * t; // 0.85 -> 0.50

  return (
    <div className="gen-frost" style={{ ['--frost' as any]: frost }} aria-live="polite" aria-busy="true">
      <div className="gen-frost-surface" />
      <div className="gen-frost-card" role="status">
        <div className="gen-frost-title">生成中</div>
        <div className="gen-frost-status">
          {statusText || '進行中…'}
          <span className="gen-frost-elapsed">（{elapsedSec}s）</span>
        </div>
        {onCancel ? (
          <button className="gen-frost-cancel" onClick={onCancel} type="button">
            キャンセル
          </button>
        ) : null}
      </div>
    </div>
  );
}
