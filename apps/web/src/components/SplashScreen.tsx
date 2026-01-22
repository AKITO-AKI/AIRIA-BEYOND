import React, { useEffect, useState } from 'react';
import './SplashScreen.css';

interface SplashScreenProps {
  onDismiss: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Auto-dismiss after 2 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300); // Wait for fade-out animation
    }, 2000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleClick = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <div 
      className={`splash-screen ${!isVisible ? 'splash-screen-fade-out' : ''}`}
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
        <div className="splash-spectrum-bg" aria-hidden="true">
          <div className="spectrum-bar" style={{ animationDelay: '0s' }}></div>
          <div className="spectrum-bar" style={{ animationDelay: '0.1s' }}></div>
          <div className="spectrum-bar" style={{ animationDelay: '0.2s' }}></div>
          <div className="spectrum-bar" style={{ animationDelay: '0.3s' }}></div>
          <div className="spectrum-bar" style={{ animationDelay: '0.4s' }}></div>
          <div className="spectrum-bar" style={{ animationDelay: '0.5s' }}></div>
          <div className="spectrum-bar" style={{ animationDelay: '0.6s' }}></div>
        </div>
        <h1 className="splash-logo">AIRIA BEYOND</h1>
        <p className="splash-tagline">感情の記録、時を超える</p>
      </div>
    </div>
  );
};

export default SplashScreen;
