import React, { useEffect, useState } from 'react';
import './RoomTransition.css';

interface RoomTransitionProps {
  isTransitioning: boolean;
  children: React.ReactNode;
}

const RoomTransition: React.FC<RoomTransitionProps> = ({ isTransitioning, children }) => {
  const [phase, setPhase] = useState<'idle' | 'fade-out' | 'fade-in'>('idle');

  useEffect(() => {
    if (isTransitioning) {
      // Start transition sequence
      setPhase('fade-out');
      
      // After fade-out completes, switch to fade-in
      const timer = setTimeout(() => {
        setPhase('fade-in');
        
        // Return to idle after fade-in
        setTimeout(() => {
          setPhase('idle');
        }, 2000);
      }, 1200);

      return () => clearTimeout(timer);
    } else {
      setPhase('idle');
    }
  }, [isTransitioning]);

  return (
    <div className={`room-transition room-transition-${phase}`}>
      {children}
    </div>
  );
};

export default RoomTransition;
