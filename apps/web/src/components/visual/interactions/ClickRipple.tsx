import React, { useEffect, useRef, useState } from 'react';

interface Ripple {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  startTime: number;
  duration: number;
}

interface ClickRippleProps {
  color?: string;
  maxRadius?: number;
  duration?: number;
}

const ClickRipple: React.FC<ClickRippleProps> = ({
  color = 'rgba(212, 175, 55, 1)', // Gold
  maxRadius = 200,
  duration = 1500,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const nextIdRef = useRef(0);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const updateSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // Handle click
    const handleClick = (e: MouseEvent) => {
      ripplesRef.current.push({
        id: nextIdRef.current++,
        x: e.clientX,
        y: e.clientY,
        radius: 0,
        maxRadius,
        opacity: 1,
        startTime: Date.now(),
        duration,
      });
    };

    window.addEventListener('click', handleClick);

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const now = Date.now();

      // Update and draw ripples
      ripplesRef.current = ripplesRef.current.filter((ripple) => {
        const elapsed = now - ripple.startTime;
        const progress = elapsed / ripple.duration;

        if (progress >= 1) {
          return false; // Remove completed ripples
        }

        // Ease out function
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
        
        ripple.radius = ripple.maxRadius * easeOut(progress);
        ripple.opacity = 1 - progress;

        // Draw ripple
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
        
        // Apply opacity to color (assume rgba format or convert)
        ctx.strokeStyle = `rgba(212, 175, 55, ${ripple.opacity})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        return true;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('click', handleClick);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [color, maxRadius, duration]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
      aria-hidden="true"
    />
  );
};

export default ClickRipple;
