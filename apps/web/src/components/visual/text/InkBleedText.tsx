import React from 'react';
import './InkBleedText.css';

interface InkBleedTextProps {
  text: string;
  className?: string;
  onComplete?: () => void;
}

const InkBleedText: React.FC<InkBleedTextProps> = ({
  text,
  className = '',
  onComplete,
}) => {
  const handleAnimationEnd = () => {
    onComplete?.();
  };

  return (
    <span
      className={`ink-bleed-text ${className}`}
      onAnimationEnd={handleAnimationEnd}
    >
      {text}
    </span>
  );
};

export default InkBleedText;
