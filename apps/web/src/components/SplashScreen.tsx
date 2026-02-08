import React, { useEffect, useState } from 'react';
import './SplashScreen.css';

const SPLASH_LOGO_SRC = `${import.meta.env.BASE_URL}img/airia-logo.png`;

interface SplashScreenProps {
  onDismiss: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onDismiss }) => {
  const [phase, setPhase] = useState<'enter' | 'ready' | 'exit'>('enter');

  // Calm, short timeline (skip anytime)
  useEffect(() => {
    const timers = [
      window.setTimeout(() => setPhase('ready'), 700),
      window.setTimeout(() => setPhase('exit'), 2600),
      window.setTimeout(() => onDismiss(), 2900),
    ];

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [onDismiss]);

  const handleClick = () => {
    setPhase('exit');
    window.setTimeout(onDismiss, 260);
  };

  return (
    <div 
      className={`splash-screen splash-${phase}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
      aria-label="クリックして開始"
    >
      <div className="splash-bg" aria-hidden="true">
        <div className="splash-orbit" />
        <div className="splash-grain" />
      </div>

      <div className="splash-content">
        <div className="splash-mark" aria-hidden="true">
          <img className="splash-logo" src={SPLASH_LOGO_SRC} alt="" aria-hidden="true" />
        </div>

        <h1 className="splash-title">AIRIA BEYOND</h1>
        <div className="splash-rule" aria-hidden="true" />
        <p className="splash-subtitle">人生をじんわり染め上げる</p>

        <div className="splash-hint" aria-hidden="true">
          {phase === 'ready' ? 'クリックして開始' : ''}
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
