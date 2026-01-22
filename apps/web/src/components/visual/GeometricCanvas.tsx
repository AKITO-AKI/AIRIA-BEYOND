import React, { useEffect, useState } from 'react';
import Spiral from './patterns/Spiral';
import LissajousCurve from './patterns/LissajousCurve';
import Ripples from './patterns/Ripples';

export type GeometricPatternType = 'spiral' | 'lissajous' | 'ripples' | 'none';

interface GeometricCanvasProps {
  pattern: GeometricPatternType;
  isActive?: boolean;
  triggerRipple?: number;
}

const GeometricCanvas: React.FC<GeometricCanvasProps> = ({ 
  pattern, 
  isActive = false,
  triggerRipple 
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Check for reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(motionQuery.matches);

    checkMobile();
    window.addEventListener('resize', checkMobile);

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      window.removeEventListener('resize', checkMobile);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  // Disable 3D patterns on mobile or if reduced motion is preferred
  if (isMobile || prefersReducedMotion || pattern === 'none') {
    return null;
  }

  return (
    <>
      {pattern === 'spiral' && <Spiral isActive={isActive} />}
      {pattern === 'lissajous' && <LissajousCurve isActive={isActive} />}
      {pattern === 'ripples' && <Ripples isActive={isActive} triggerRipple={triggerRipple} />}
    </>
  );
};

export default GeometricCanvas;
