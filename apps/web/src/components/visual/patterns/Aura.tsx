import React, { useRef, useEffect, useState } from 'react';

interface AuraProps {
  dominantColors?: string[];
  isPlaying?: boolean;
  beatAmplitude?: number; // 0-1, from audio analyser
  mouseProximity?: number; // 0-1, distance from mouse
  highlightedLayer?: number; // -1 for none, 0-4 for specific layer
}

const Aura: React.FC<AuraProps> = ({
  dominantColors = ['#D4AF37', '#F4E5C2', '#B8941E'],
  isPlaying = false,
  beatAmplitude = 0,
  mouseProximity = 0,
  highlightedLayer = -1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const ringsRef = useRef<Array<{
    radius: number;
    maxRadius: number;
    color: string;
    phase: number;
    phaseSpeed: number;
  }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const updateSize = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // Initialize rings
    const numRings = Math.min(5, dominantColors.length + 2);
    ringsRef.current = Array.from({ length: numRings }, (_, i) => ({
      radius: 50 + i * 30,
      maxRadius: 200 + i * 50,
      color: dominantColors[i % dominantColors.length] || '#D4AF37',
      phase: (i * Math.PI * 2) / numRings, // Stagger phases
      phaseSpeed: 0.0005 + i * 0.0002,
    }));

    // Animation loop
    let lastTime = 0;
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Update and draw each ring
      ringsRef.current.forEach((ring, index) => {
        // Update phase
        ring.phase += ring.phaseSpeed * deltaTime;

        // Calculate radius with pulsing effect
        const pulseCycle = Math.sin(ring.phase);
        const pulseAmount = 20 + (isPlaying ? beatAmplitude * 30 : 0);
        const currentRadius = ring.radius + pulseCycle * pulseAmount;

        // Calculate opacity
        const baseOpacity = 0.1;
        const maxOpacity = 0.3;
        const proximityBoost = mouseProximity * 0.2;
        const highlightBoost = highlightedLayer === index ? 0.3 : 0;
        const beatBoost = isPlaying ? beatAmplitude * 0.15 : 0;
        
        const opacity = Math.min(
          maxOpacity,
          baseOpacity + proximityBoost + highlightBoost + beatBoost
        );

        // Create radial gradient
        const gradient = ctx.createRadialGradient(
          centerX,
          centerY,
          currentRadius - 20,
          centerX,
          centerY,
          currentRadius + 20
        );

        gradient.addColorStop(0, `${ring.color}00`);
        gradient.addColorStop(0.5, `${ring.color}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`);
        gradient.addColorStop(1, `${ring.color}00`);

        // Draw ring
        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = 'lighter'; // Additive blending
        ctx.beginPath();
        ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', updateSize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [dominantColors, isPlaying, beatAmplitude, mouseProximity, highlightedLayer]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
      role="img"
      aria-label="アルバムのオーラ - 感情的な雰囲気を表現する光の輪"
    />
  );
};

export default Aura;
