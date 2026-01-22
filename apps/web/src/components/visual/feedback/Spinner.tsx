import React from 'react';
import './Spinner.css';

interface SpinnerProps {
  size?: number;
  color?: string;
  'aria-label'?: string;
}

const Spinner: React.FC<SpinnerProps> = ({
  size = 50,
  color = '#D4AF37',
  'aria-label': ariaLabel = '読み込み中',
}) => {
  return (
    <div className="spinner-container" role="status" aria-label={ariaLabel}>
      <svg
        className="spinner"
        viewBox="0 0 50 50"
        width={size}
        height={size}
        aria-hidden="true"
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray="89, 200"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 25 25"
            to="360 25 25"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </div>
  );
};

export default Spinner;
