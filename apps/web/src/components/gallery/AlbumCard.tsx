import React from 'react';
import './AlbumCard.css';

export interface AlbumBadge {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'info';
}

interface AlbumCardProps {
  title: string;
  mood?: string;
  imageUrl: string;
  meta?: string;
  badges?: AlbumBadge[];
  variant?: 'default' | 'compact';
  className?: string;
}

const AlbumCard: React.FC<AlbumCardProps> = ({
  title,
  mood,
  imageUrl,
  meta,
  badges = [],
  variant = 'default',
  className,
}) => {
  return (
    <div className={`album-card album-card-${variant} ${className || ''}`.trim()}>
      <div className="album-card-image">
        <img src={imageUrl} alt={title} loading="lazy" />
      </div>
      <div className="album-card-body">
        <div className="album-card-title">{title}</div>
        {mood && <div className="album-card-mood">{mood}</div>}
        {meta && <div className="album-card-meta">{meta}</div>}
        {badges.length > 0 && (
          <div className="album-card-badges">
            {badges.map((badge) => (
              <span key={badge.label} className={`album-badge tone-${badge.tone || 'default'}`}>
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlbumCard;
