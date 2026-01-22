import React from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div className="empty-state">
      {icon && (
        <div className="empty-icon">
          {icon}
        </div>
      )}
      <h2 className="empty-title">{title}</h2>
      <p className="empty-description">{description}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="empty-cta-button">
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
