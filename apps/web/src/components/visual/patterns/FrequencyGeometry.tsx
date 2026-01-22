import React, { useRef, useEffect, useState } from 'react';

interface FrequencyGeometryProps {
  audioData?: {
    bass: number;
    midLow: number;
    mid: number;
    midHigh: number;
    treble: number;
  } | null;
  enabled?: boolean;
}

interface Shape {
  id: number;
  type: 'circle' | 'triangle' | 'hexagon';
  x: number;
  y: number;
  size: number;
  opacity: number;
  rotation: number;
  color: string;
  lifetime: number;
  maxLifetime: number;
  frozen: boolean;
  velocity: { x: number; y: number };
}

const FrequencyGeometry: React.FC<FrequencyGeometryProps> = ({
  audioData = null,
  enabled = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shapesRef = useRef<Shape[]>([]);
  const nextIdRef = useRef(0);
  const animationRef = useRef<number>();
  const [hoveredShape, setHoveredShape] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

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

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Generate new shapes based on audio data
      if (audioData) {
        // Bass → Large circles at bottom
        if (audioData.bass > 50 && Math.random() < 0.1) {
          shapesRef.current.push({
            id: nextIdRef.current++,
            type: 'circle',
            x: Math.random() * canvas.width,
            y: canvas.height * 0.8 + Math.random() * canvas.height * 0.2,
            size: 30 + (audioData.bass / 255) * 50,
            opacity: 0.1,
            rotation: 0,
            color: '#D4AF37',
            lifetime: 0,
            maxLifetime: 3000,
            frozen: false,
            velocity: { x: (Math.random() - 0.5) * 0.5, y: -0.2 },
          });
        }

        // Mid → Medium triangles in middle
        if (audioData.mid > 60 && Math.random() < 0.15) {
          shapesRef.current.push({
            id: nextIdRef.current++,
            type: 'triangle',
            x: Math.random() * canvas.width,
            y: canvas.height * 0.4 + Math.random() * canvas.height * 0.4,
            size: 20 + (audioData.mid / 255) * 30,
            opacity: 0.15,
            rotation: Math.random() * Math.PI * 2,
            color: '#F4E5C2',
            lifetime: 0,
            maxLifetime: 2500,
            frozen: false,
            velocity: { x: (Math.random() - 0.5) * 0.8, y: -0.3 },
          });
        }

        // Treble → Small hexagons at top
        if (audioData.treble > 70 && Math.random() < 0.2) {
          shapesRef.current.push({
            id: nextIdRef.current++,
            type: 'hexagon',
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height * 0.4,
            size: 10 + (audioData.treble / 255) * 20,
            opacity: 0.2,
            rotation: Math.random() * Math.PI * 2,
            color: '#B8941E',
            lifetime: 0,
            maxLifetime: 2000,
            frozen: false,
            velocity: { x: (Math.random() - 0.5) * 1.2, y: -0.5 },
          });
        }
      }

      // Update and draw shapes
      shapesRef.current = shapesRef.current.filter((shape) => {
        shape.lifetime += 16; // ~60fps

        if (shape.lifetime > shape.maxLifetime) {
          return false; // Remove expired shapes
        }

        // Update position if not frozen
        if (!shape.frozen) {
          shape.x += shape.velocity.x;
          shape.y += shape.velocity.y;
          shape.rotation += 0.01;
        }

        // Calculate opacity based on lifetime
        const lifeProgress = shape.lifetime / shape.maxLifetime;
        const fadeOpacity = shape.opacity * (1 - lifeProgress);

        // Draw shape
        ctx.save();
        ctx.globalAlpha = fadeOpacity;
        ctx.translate(shape.x, shape.y);
        ctx.rotate(shape.rotation);

        ctx.strokeStyle = shape.color;
        ctx.lineWidth = 2;
        ctx.fillStyle = `${shape.color}33`;

        switch (shape.type) {
          case 'circle':
            ctx.beginPath();
            ctx.arc(0, 0, shape.size, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fill();
            break;

          case 'triangle':
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
              const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
              const x = Math.cos(angle) * shape.size;
              const y = Math.sin(angle) * shape.size;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
            break;

          case 'hexagon':
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = (i / 6) * Math.PI * 2;
              const x = Math.cos(angle) * shape.size;
              const y = Math.sin(angle) * shape.size;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
            break;
        }

        ctx.restore();

        return true;
      });

      // Limit total shapes for performance
      if (shapesRef.current.length > 50) {
        shapesRef.current = shapesRef.current.slice(-50);
      }

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
  }, [audioData, enabled]);

  const handleClick = (e: React.MouseEvent) => {
    // Create ripple effect at click position
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Add ripple shape
    shapesRef.current.push({
      id: nextIdRef.current++,
      type: 'circle',
      x,
      y,
      size: 0,
      opacity: 0.3,
      rotation: 0,
      color: '#D4AF37',
      lifetime: 0,
      maxLifetime: 1000,
      frozen: true,
      velocity: { x: 0, y: 0 },
    });

    // Animate size increase
    const ripple = shapesRef.current[shapesRef.current.length - 1];
    const interval = setInterval(() => {
      ripple.size += 5;
      if (ripple.size > 100) {
        clearInterval(interval);
      }
    }, 16);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Find closest shape
    let closestShape: Shape | null = null;
    let minDistance = Infinity;

    shapesRef.current.forEach((shape) => {
      const distance = Math.sqrt(
        Math.pow(shape.x - mouseX, 2) + Math.pow(shape.y - mouseY, 2)
      );

      if (distance < shape.size && distance < minDistance) {
        closestShape = shape;
        minDistance = distance;
      }
    });

    if (closestShape) {
      closestShape.frozen = true;
      setHoveredShape(closestShape.id);
      
      // Unfreeze after a delay
      setTimeout(() => {
        closestShape!.frozen = false;
        setHoveredShape(null);
      }, 500);
    }
  };

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
        zIndex: 1,
      }}
      role="img"
      aria-label="周波数幾何学 - 音楽の周波数を視覚化する幾何学模様"
      aria-hidden="true"
    />
  );
};

export default FrequencyGeometry;
