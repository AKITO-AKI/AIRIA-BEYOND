import { useState, useEffect } from 'react';

interface MousePosition {
  x: number;
  y: number;
}

export const useMousePosition = (): MousePosition => {
  const [mousePos, setMousePos] = useState<MousePosition>({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return mousePos;
};

export const useScrollParallax = (layer: number = 1): number => {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      // Different layers move at different speeds
      const parallaxSpeed = 0.1 * layer;
      setOffset(scrollY * parallaxSpeed);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [layer]);

  return offset;
};

export const useMouseProximity = (
  targetRef: React.RefObject<HTMLElement>,
  maxDistance: number = 200
): number => {
  const [proximity, setProximity] = useState(0);
  const mousePos = useMousePosition();

  useEffect(() => {
    if (!targetRef.current) return;

    const rect = targetRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const distance = Math.sqrt(
      Math.pow(mousePos.x - centerX, 2) + Math.pow(mousePos.y - centerY, 2)
    );

    // Proximity: 1 when mouse is at center, 0 when distance >= maxDistance
    const proximity = Math.max(0, 1 - distance / maxDistance);
    setProximity(proximity);
  }, [mousePos, targetRef, maxDistance]);

  return proximity;
};
