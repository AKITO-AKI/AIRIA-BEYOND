import React from 'react';
import './FloatingText.css';

interface FloatingTextProps {
  text: string;
  className?: string;
  duration?: number; // Animation duration in seconds
}

const FloatingText: React.FC<FloatingTextProps> = ({
  text,
  className = '',
  duration = 3,
}) => {
  return (
    <span
      className={`floating-text ${className}`}
      style={{ animationDuration: `${duration}s` }}
    >
      {text}
    </span>
  );
};

export default FloatingText;
