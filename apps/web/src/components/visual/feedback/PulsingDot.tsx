import React from 'react';
import './PulsingDot.css';

interface PulsingDotProps {
  size?: number;
  color?: string;
}

const PulsingDot: React.FC<PulsingDotProps> = ({
  size = 12,
  color = '#D4AF37',
}) => {
  return (
    <div className="pulse-container" style={{ width: size, height: size }}>
      <div
        className="pulse-dot"
        style={{
          width: size,
          height: size,
          background: color,
        }}
      />
      <div
        className="pulse-ring"
        style={{
          width: size,
          height: size,
          borderColor: color,
        }}
      />
    </div>
  );
};

export default PulsingDot;
