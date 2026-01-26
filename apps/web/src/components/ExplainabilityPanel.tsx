/**
 * P5: Explainability Panel
 * Displays "Why this image?" and "Why this music?" with reasoning
 */

import React from 'react';
import { CausalLog } from '../../types/causalLog';
import './ExplainabilityPanel.css';

interface ExplainabilityPanelProps {
  log: CausalLog | undefined;
}

const ExplainabilityPanel: React.FC<ExplainabilityPanelProps> = ({ log }) => {
  if (!log) {
    return (
      <div className="explainability-panel">
        <h3 className="explainability-title">Liner Notes / 解説</h3>
        <p className="explainability-hint">このアルバムの解説データがありません</p>
      </div>
    );
  }

  const formatDuration = (ms: number): string => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  return (
    <div className="explainability-panel">
      <h3 className="explainability-title">Liner Notes / 解説</h3>

      {/* Timeline Overview */}
      {log.analysis && (
        <div className="explainability-section timeline-section">
          <h4 className="section-title">生成フロー</h4>
          <div className="timeline">
            <div className="timeline-item">
              <span className="timeline-label">入力</span>
              <span className="timeline-value">
                {new Date(log.input.timestamp).toLocaleTimeString('ja-JP')}
              </span>
            </div>
            {log.analysis && (
              <div className="timeline-item">
                <span className="timeline-label">解析</span>
                <span className="timeline-value">
                  {formatDuration(log.analysis.duration)} ({log.analysis.provider})
                </span>
              </div>
            )}
            {log.imageGeneration && (
              <div className="timeline-item">
                <span className="timeline-label">画像生成</span>
                <span className="timeline-value">
                  {formatDuration(log.imageGeneration.duration)} ({log.imageGeneration.provider})
                </span>
              </div>
            )}
            {log.musicGeneration && (
              <div className="timeline-item">
                <span className="timeline-label">音楽生成</span>
                <span className="timeline-value">
                  {formatDuration(log.musicGeneration.duration)} ({log.musicGeneration.provider})
                </span>
              </div>
            )}
            {log.album && (
              <div className="timeline-item">
                <span className="timeline-label">完成</span>
                <span className="timeline-value">
                  合計: {formatDuration(log.totalDuration)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analysis Explanation */}
      {log.analysis && (
        <div className="explainability-section">
          <h4 className="section-title">感情分析</h4>
          <div className="analysis-explanation">
            <div className="ir-values">
              <div className="ir-value">
                <span className="ir-label">Valence:</span>
                <div className="ir-gauge">
                  <div 
                    className="ir-gauge-fill" 
                    style={{ 
                      width: `${((log.analysis.intermediateRepresentation.valence + 1) / 2) * 100}%`,
                      backgroundColor: log.analysis.intermediateRepresentation.valence > 0 ? '#4caf50' : '#f44336'
                    }}
                  />
                </div>
                <span className="ir-number">{log.analysis.intermediateRepresentation.valence.toFixed(2)}</span>
              </div>
              <div className="ir-value">
                <span className="ir-label">Arousal:</span>
                <div className="ir-gauge">
                  <div 
                    className="ir-gauge-fill" 
                    style={{ 
                      width: `${log.analysis.intermediateRepresentation.arousal * 100}%`,
                      backgroundColor: '#2196f3'
                    }}
                  />
                </div>
                <span className="ir-number">{log.analysis.intermediateRepresentation.arousal.toFixed(2)}</span>
              </div>
              <div className="ir-value">
                <span className="ir-label">Focus:</span>
                <div className="ir-gauge">
                  <div 
                    className="ir-gauge-fill" 
                    style={{ 
                      width: `${log.analysis.intermediateRepresentation.focus * 100}%`,
                      backgroundColor: '#ff9800'
                    }}
                  />
                </div>
                <span className="ir-number">{log.analysis.intermediateRepresentation.focus.toFixed(2)}</span>
              </div>
            </div>
            <div className="motif-tags">
              <strong>モチーフタグ:</strong>{' '}
              {log.analysis.intermediateRepresentation.motif_tags.join('、')}
            </div>
            <div className="reasoning-text">
              <strong>理由:</strong> {log.analysis.reasoning}
            </div>
          </div>
        </div>
      )}

      {/* Image Explanation */}
      {log.imageGeneration && (
        <div className="explainability-section">
          <h4 className="section-title">なぜこの絵？</h4>
          <div className="image-explanation">
            <p className="reasoning-text">{log.imageGeneration.reasoning}</p>
            <div className="image-details">
              <div className="detail-item">
                <span className="detail-label">スタイル:</span>
                <span className="detail-value">{log.imageGeneration.stylePreset}</span>
              </div>
              {log.imageGeneration.seed && (
                <div className="detail-item">
                  <span className="detail-label">Seed:</span>
                  <span className="detail-value">{log.imageGeneration.seed}</span>
                </div>
              )}
              <div className="detail-item">
                <span className="detail-label">モデル:</span>
                <span className="detail-value">{log.imageGeneration.model}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Music Explanation */}
      {log.musicGeneration && (
        <div className="explainability-section">
          <h4 className="section-title">なぜこの曲？</h4>
          <div className="music-explanation">
            <p className="reasoning-text">{log.musicGeneration.reasoning}</p>
            <div className="music-details">
              {log.musicGeneration.structure && typeof log.musicGeneration.structure === 'object' && (
                <>
                  {(log.musicGeneration.structure as any).key && (
                    <div className="detail-item">
                      <span className="detail-label">調:</span>
                      <span className="detail-value">{(log.musicGeneration.structure as any).key}</span>
                    </div>
                  )}
                  {(log.musicGeneration.structure as any).tempo && (
                    <div className="detail-item">
                      <span className="detail-label">テンポ:</span>
                      <span className="detail-value">{(log.musicGeneration.structure as any).tempo} BPM</span>
                    </div>
                  )}
                  {(log.musicGeneration.structure as any).timeSignature && (
                    <div className="detail-item">
                      <span className="detail-label">拍子:</span>
                      <span className="detail-value">{(log.musicGeneration.structure as any).timeSignature}</span>
                    </div>
                  )}
                  {(log.musicGeneration.structure as any).form && (
                    <div className="detail-item">
                      <span className="detail-label">形式:</span>
                      <span className="detail-value">{(log.musicGeneration.structure as any).form}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Errors (if any) */}
      {log.errors && log.errors.length > 0 && (
        <div className="explainability-section error-section">
          <h4 className="section-title">エラー</h4>
          <div className="errors-list">
            {log.errors.map((err, idx) => (
              <div key={idx} className="error-item">
                <span className="error-stage">{err.stage}:</span>
                <span className="error-message">{err.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExplainabilityPanel;
