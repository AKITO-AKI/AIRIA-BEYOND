import React, { useEffect, useState } from 'react';
import Spiral from './patterns/Spiral';
import LissajousCurve from './patterns/LissajousCurve';
import Ripples from './patterns/Ripples';
import Polyhedron from './patterns/Polyhedron';
import StringVibration from './patterns/StringVibration';

export type GeometricPatternType = 'spiral' | 'lissajous' | 'ripples' | 'polyhedron' | 'stringVibration' | 'none';
export type GeometricLayer = 'foreground' | 'background';
export type GeometricPlacement = 'center' | 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft';

interface GeometricCanvasProps {
  pattern: GeometricPatternType;
  isActive?: boolean;
  triggerRipple?: number;
  progress?: number; // For polyhedron loading
  dominantColor?: string; // For polyhedron color
  layer?: GeometricLayer; // For polyhedron placement/z-order
  placement?: GeometricPlacement; // For polyhedron placement
  sizePx?: number; // For polyhedron size
  opacity?: number; // For polyhedron opacity
  audioData?: {
    bass: number;
    midLow: number;
    mid: number;
    midHigh: number;
    treble: number;
  } | null; // For string vibration
  valence?: number;
  arousal?: number;
  onComplete?: () => void; // For polyhedron completion
}

const GeometricCanvas: React.FC<GeometricCanvasProps> = ({ 
  pattern, 
  isActive = false,
  triggerRipple,
  progress = 0,
  dominantColor = '#D4AF37',
  layer = 'foreground',
  placement = 'center',
  sizePx,
  opacity,
  audioData = null,
  valence = 0,
  arousal = 0.5,
  onComplete,
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
      {pattern === 'polyhedron' && (
        <Polyhedron
          isActive={isActive}
          progress={progress}
          dominantColor={dominantColor}
          onComplete={onComplete}
          layer={layer}
          placement={placement}
          sizePx={sizePx}
          opacity={opacity}
        />
      )}
      {pattern === 'stringVibration' && (
        <StringVibration
          isActive={isActive}
          audioData={audioData}
          valence={valence}
          arousal={arousal}
        />
      )}
    </>
  );
};

export default GeometricCanvas;
