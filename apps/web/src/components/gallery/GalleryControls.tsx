import React from 'react';
import './GalleryControls.css';

export type SortMode = 'time' | 'mood' | 'duration';
export type ViewMode = '3d' | 'grid';

interface GalleryControlsProps {
  constellationEnabled: boolean;
  onConstellationToggle: () => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const GalleryControls: React.FC<GalleryControlsProps> = ({
  constellationEnabled,
  onConstellationToggle,
  sortMode,
  onSortChange,
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div className="gallery-controls">
      <div className="control-group">
        <label className="control-label">
          <input
            type="checkbox"
            checked={constellationEnabled}
            onChange={onConstellationToggle}
          />
          <span className="control-icon">🌌</span>
          <span className="control-text">星座を表示</span>
        </label>
      </div>

      <div className="control-group">
        <span className="control-label-text">並び替え:</span>
        <div className="control-buttons">
          <button
            className={`control-button ${sortMode === 'time' ? 'active' : ''}`}
            onClick={() => onSortChange('time')}
          >
            時間順
          </button>
          <button
            className={`control-button ${sortMode === 'mood' ? 'active' : ''}`}
            onClick={() => onSortChange('mood')}
          >
            感情順
          </button>
          <button
            className={`control-button ${sortMode === 'duration' ? 'active' : ''}`}
            onClick={() => onSortChange('duration')}
          >
            長さ順
          </button>
        </div>
      </div>

      <div className="control-group">
        <span className="control-label-text">表示:</span>
        <div className="control-buttons">
          <button
            className={`control-button ${viewMode === '3d' ? 'active' : ''}`}
            onClick={() => onViewModeChange('3d')}
          >
            3D書棚
          </button>
          <button
            className={`control-button ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => onViewModeChange('grid')}
          >
            グリッド
          </button>
        </div>
      </div>
    </div>
  );
};

export default GalleryControls;
