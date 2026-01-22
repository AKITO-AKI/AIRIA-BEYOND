import React, { useEffect, useState, useRef } from 'react';
import './SplashScreen.css';

interface SplashScreenProps {
  onDismiss: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [phase, setPhase] = useState<'fade-in' | 'title' | 'subtitle' | 'hold' | 'fade-out'>('fade-in');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Golden spiral animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 600 * dpr;
    canvas.height = 600 * dpr;
    canvas.style.width = '300px';
    canvas.style.height = '300px';
    ctx.scale(dpr, dpr);

    let rotation = 0;
    let pulse = 0;

    const drawGoldenSpiral = () => {
      ctx.clearRect(0, 0, 600, 600);
      ctx.save();
      
      ctx.translate(300, 300);
      ctx.rotate(rotation);
      
      // Golden ratio
      const phi = 1.618;
      const pulseFactor = 1 + Math.sin(pulse) * 0.1;
      
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 2 * pulseFactor;
      ctx.shadowBlur = 20 * pulseFactor;
      ctx.shadowColor = '#D4AF37';
      
      ctx.beginPath();
      
      // Draw golden spiral using Fibonacci sequence
      let a = 0;
      let b = 1;
      const scale = 3;
      
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 2;
        const radius = b * scale;
        
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        if (i === 0) {
          ctx.moveTo(0, 0);
        }
        
        // Draw arc
        ctx.arc(x, y, radius, angle, angle + Math.PI / 2, false);
        
        // Next Fibonacci number
        [a, b] = [b, a + b];
      }
      
      ctx.stroke();
      ctx.restore();
      
      rotation += 0.003;
      pulse += 0.05;
      
      animationFrameRef.current = requestAnimationFrame(drawGoldenSpiral);
    };

    drawGoldenSpiral();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Orchestrated timeline
  useEffect(() => {
    const timeline = [
      { delay: 0, action: () => setPhase('fade-in') },
      { delay: 3000, action: () => setPhase('title') },
      { delay: 5000, action: () => setPhase('subtitle') },
      { delay: 6000, action: () => setPhase('hold') },
      { delay: 8000, action: () => setPhase('fade-out') },
      { delay: 10000, action: () => {
        setIsVisible(false);
        setTimeout(onDismiss, 500);
      }},
    ];

    const timers = timeline.map(({ delay, action }) =>
      setTimeout(action, delay)
    );

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [onDismiss]);

  const handleClick = () => {
    setPhase('fade-out');
    setIsVisible(false);
    setTimeout(onDismiss, 500);
  };

  return (
    <div 
      className={`splash-screen splash-${phase} ${!isVisible ? 'splash-screen-fade-out' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
      aria-label="Splash screen - click to continue"
    >
      <div className="splash-content">
        {/* Golden spiral canvas */}
        <canvas 
          ref={canvasRef} 
          className="golden-spiral-canvas"
          aria-hidden="true"
        />
        
        {/* Title with calligraphy effect */}
        <h1 className="splash-logo splash-title">
          {'AIRIA BEYOND'.split('').map((char, i) => (
            <span 
              key={i} 
              className="splash-char"
              style={{ 
                animationDelay: `${3 + i * 0.05}s`,
                display: char === ' ' ? 'inline' : 'inline-block'
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </h1>
        
        {/* Subtitle */}
        <p className="splash-tagline splash-subtitle">
          人生をじんわり染め上げる
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
