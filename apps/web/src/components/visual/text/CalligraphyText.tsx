import React, { useEffect, useRef } from 'react';

interface CalligraphyTextProps {
  text: string;
  className?: string;
  delay?: number; // Delay between characters in ms
  onComplete?: () => void;
}

const CalligraphyText: React.FC<CalligraphyTextProps> = ({
  text,
  className = '',
  delay = 50,
  onComplete,
}) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const characters = text.split('');
    container.innerHTML = ''; // Clear

    let completedCount = 0;

    characters.forEach((char, index) => {
      const span = document.createElement('span');
      span.textContent = char;
      span.style.opacity = '0';
      span.style.transform = 'translateY(20px)';
      span.style.display = 'inline-block';
      span.style.transition = `all 0.6s cubic-bezier(0.4, 0.0, 0.2, 1) ${index * delay}ms`;

      container.appendChild(span);

      // Trigger animation
      requestAnimationFrame(() => {
        span.style.opacity = '1';
        span.style.transform = 'translateY(0)';
      });

      // Track completion
      span.addEventListener('transitionend', () => {
        completedCount++;
        if (completedCount === characters.length) {
          onComplete?.();
        }
      });
    });
  }, [text, delay, onComplete]);

  return (
    <span ref={containerRef} className={className} />
  );
};

export default CalligraphyText;
