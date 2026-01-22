import React, { useEffect, useRef, useState } from 'react';
import './MotifOrbit.css';

interface OrbitingTag {
  text: string;
  radius: number;
  speed: number; // degrees per second
  angle: number; // current angle in degrees
  scale: number;
  opacity: number;
}

interface MotifOrbitProps {
  tags: string[];
  centerX: number;
  centerY: number;
  isPlaying: boolean;
}

export const MotifOrbit: React.FC<MotifOrbitProps> = ({
  tags,
  centerX,
  centerY,
  isPlaying,
}) => {
  const [orbitingTags, setOrbitingTags] = useState<OrbitingTag[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // Initialize orbiting tags
    const radii = [220, 260, 300, 340, 380];
    const speeds = [12, 10, 8, 6, 4]; // Degrees per second (slower = inner)
    const startAngles = tags.map((_, i) => (360 / tags.length) * i);

    const initialized = tags.slice(0, 5).map((tag, i) => ({
      text: tag,
      radius: radii[i] || 300,
      speed: speeds[i] || 8,
      angle: startAngles[i] || 0,
      scale: 1,
      opacity: 0.6,
    }));

    setOrbitingTags(initialized);
  }, [tags]);

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const animate = () => {
      const now = Date.now();
      const deltaTime = (now - lastTimeRef.current) / 1000; // Convert to seconds
      lastTimeRef.current = now;

      setOrbitingTags(prev =>
        prev.map((tag, i) => {
          // Update angle
          let newAngle = tag.angle + tag.speed * deltaTime;
          newAngle = newAngle % 360;

          // Pulsing scale (0.95 to 1.05, 3s cycle, offset per tag)
          const pulseOffset = (i * 0.5);
          const pulseValue = Math.sin((now / 3000 + pulseOffset) * Math.PI * 2) * 0.05;
          const newScale = 1 + pulseValue;

          // Pulsing opacity (0.4 to 0.7, synchronized with scale)
          const opacityValue = 0.55 + Math.sin((now / 3000 + pulseOffset) * Math.PI * 2) * 0.15;

          return {
            ...tag,
            angle: newAngle,
            scale: newScale,
            opacity: opacityValue,
          };
        })
      );

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  return (
    <div className="motif-orbit">
      {orbitingTags.map((tag, i) => {
        const x = centerX + tag.radius * Math.cos(toRadians(tag.angle));
        const y = centerY + tag.radius * Math.sin(toRadians(tag.angle));

        return (
          <div
            key={`${tag.text}-${i}`}
            className="motif-tag"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              transform: `translate(-50%, -50%) scale(${tag.scale})`,
              opacity: tag.opacity,
            }}
          >
            {tag.text}
          </div>
        );
      })}
    </div>
  );
};
