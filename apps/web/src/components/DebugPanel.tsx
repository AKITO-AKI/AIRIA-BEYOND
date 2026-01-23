/**
 * P5: Debug Panel
 * Developer view for causal logs with export and management functions
 */

import React, { useState } from 'react';
import { useCausalLog } from '../contexts/CausalLogContext';
import './DebugPanel.css';

const DebugPanel: React.FC = () => {
  const { logs, clearAllLogs, deleteLog, exportLog } = useCausalLog();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const handleExportLog = (logId: string) => {
    try {
      const json = exportLog(logId);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `causal-log-${logId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export log:', error);
      alert('ログのエクスポートに失敗しました');
    }
  };

  const handleExportAllLogs = () => {
    try {
      const json = JSON.stringify(logs, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `causal-logs-all-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export all logs:', error);
      alert('全ログのエクスポートに失敗しました');
    }
  };

  const handleClearAll = () => {
    if (window.confirm('すべてのログを削除してもよろしいですか？この操作は元に戻せません。')) {
      clearAllLogs();
      setExpandedLogId(null);
    }
  };

  const handleDeleteLog = (logId: string) => {
    if (window.confirm('このログを削除してもよろしいですか？')) {
      deleteLog(logId);
      if (expandedLogId === logId) {
        setExpandedLogId(null);
      }
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="debug-panel">
      <button 
        className="debug-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="開発者デバッグパネル"
      >
        {isOpen ? 'CLOSE' : 'DEV'}
      </button>

      {isOpen && (
        <div className="debug-panel-content">
          <div className="debug-header">
            <h3>デバッグパネル（P5）</h3>
            <div className="debug-actions">
              <button 
                className="debug-btn" 
                onClick={handleExportAllLogs}
                disabled={logs.length === 0}
              >
                全ログエクスポート
              </button>
              <button 
                className="debug-btn danger" 
                onClick={handleClearAll}
                disabled={logs.length === 0}
              >
                全ログ削除
              </button>
            </div>
          </div>

          <div className="debug-stats">
            <div className="stat-item">
              <span className="stat-label">総ログ数:</span>
              <span className="stat-value">{logs.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">成功:</span>
              <span className="stat-value success">
                {logs.filter(log => log.success).length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">失敗:</span>
              <span className="stat-value error">
                {logs.filter(log => !log.success).length}
              </span>
            </div>
          </div>

          <div className="debug-logs-list">
            {logs.length === 0 ? (
              <div className="debug-empty">ログがありません</div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="debug-log-item">
                  <div 
                    className="debug-log-summary"
                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                  >
                    <div className="log-summary-left">
                      <span className={`log-status ${log.success ? 'success' : 'error'}`}>
                        {log.success ? 'OK' : 'NG'}
                      </span>
                      <span className="log-id">{log.sessionId.slice(0, 12)}...</span>
                      <span className="log-time">
                        {new Date(log.createdAt).toLocaleString('ja-JP')}
                      </span>
                    </div>
                    <div className="log-summary-right">
                      <span className="log-duration">{formatDuration(log.totalDuration)}</span>
                      <span className="log-expand">{expandedLogId === log.id ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {expandedLogId === log.id && (
                    <div className="debug-log-details">
                      <div className="log-details-section">
                        <h4>入力</h4>
                        <pre>{JSON.stringify(log.input, null, 2)}</pre>
                      </div>

                      {log.analysis && (
                        <div className="log-details-section">
                          <h4>解析 ({log.analysis.provider})</h4>
                          <pre>{JSON.stringify(log.analysis, null, 2)}</pre>
                        </div>
                      )}

                      {log.imageGeneration && (
                        <div className="log-details-section">
                          <h4>画像生成 ({log.imageGeneration.provider})</h4>
                          <pre>{JSON.stringify({
                            ...log.imageGeneration,
                            resultUrl: log.imageGeneration.resultUrl.substring(0, 50) + '...'
                          }, null, 2)}</pre>
                        </div>
                      )}

                      {log.musicGeneration && (
                        <div className="log-details-section">
                          <h4>音楽生成 ({log.musicGeneration.provider})</h4>
                          <pre>{JSON.stringify(log.musicGeneration, null, 2)}</pre>
                        </div>
                      )}

                      {log.album && (
                        <div className="log-details-section">
                          <h4>アルバム</h4>
                          <pre>{JSON.stringify(log.album, null, 2)}</pre>
                        </div>
                      )}

                      {log.errors && log.errors.length > 0 && (
                        <div className="log-details-section error">
                          <h4>エラー</h4>
                          <pre>{JSON.stringify(log.errors, null, 2)}</pre>
                        </div>
                      )}

                      <div className="log-actions">
                        <button 
                          className="debug-btn small"
                          onClick={() => handleExportLog(log.id)}
                        >
                          JSONエクスポート
                        </button>
                        <button 
                          className="debug-btn small danger"
                          onClick={() => handleDeleteLog(log.id)}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;
