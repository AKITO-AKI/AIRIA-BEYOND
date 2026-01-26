import React, { useEffect, useRef } from 'react';

interface AtmosphericBackdropProps {
  mode: 'glass' | 'dust';
  isPaused?: boolean;
  focusIntensity?: number;
}

const AtmosphericBackdrop: React.FC<AtmosphericBackdropProps> = ({
  mode,
  isPaused = false,
  focusIntensity = 0,
}) => {
  const glassCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dustCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const glassCanvas = glassCanvasRef.current;
    const dustCanvas = dustCanvasRef.current;
    if (!glassCanvas || !dustCanvas) return;

    const glassCtx = glassCanvas.getContext('2d');
    const dustCtx = dustCanvas.getContext('2d');
    if (!glassCtx || !dustCtx) return;

    const resize = () => {
      const { innerWidth, innerHeight, devicePixelRatio } = window;
      [glassCanvas, dustCanvas].forEach((canvas) => {
        canvas.width = innerWidth * devicePixelRatio;
        canvas.height = innerHeight * devicePixelRatio;
        canvas.style.width = `${innerWidth}px`;
        canvas.style.height = `${innerHeight}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        }
      });
    };

    resize();
    window.addEventListener('resize', resize);

    const drawGlass = (t: number) => {
      const { innerWidth: width, innerHeight: height } = window;
      glassCtx.clearRect(0, 0, width, height);
      glassCtx.save();
      glassCtx.globalCompositeOperation = 'source-over';

      const radial = glassCtx.createRadialGradient(
        width * 0.5,
        height * 0.45,
        40,
        width * 0.5,
        height * 0.45,
        width * 0.9
      );
      radial.addColorStop(0, `rgba(255,255,255,${0.16 + focusIntensity * 0.2})`);
      radial.addColorStop(0.5, 'rgba(0,0,0,0.04)');
      radial.addColorStop(1, 'rgba(0,0,0,0)');
      glassCtx.fillStyle = radial;
      glassCtx.fillRect(0, 0, width, height);

      const lineOpacity = 0.04 + focusIntensity * 0.06;
      glassCtx.strokeStyle = `rgba(0,0,0,${lineOpacity})`;
      glassCtx.lineWidth = 1;

      glassCtx.beginPath();
      for (let x = 0; x <= width; x += 120) {
        const offset = Math.sin(t * 0.0004 + x * 0.01) * 12;
        glassCtx.moveTo(x, 0);
        glassCtx.lineTo(x + offset, height);
      }
      glassCtx.stroke();

      glassCtx.restore();
    };

    const drawSacredGeometry = (t: number) => {
      const { innerWidth: width, innerHeight: height } = window;
      dustCtx.clearRect(0, 0, width, height);
      dustCtx.save();
      dustCtx.globalCompositeOperation = 'source-over';
      dustCtx.translate(width / 2, height / 2);

      const base = Math.min(width, height) * 0.34;
      const pulse = 1 + Math.sin(t * 0.0004) * 0.015;
      const rotation = (t * 0.0002) * (isPaused ? 0.2 : 1);

      const drawPolygon = (sides: number, radius: number, rotate: number) => {
        dustCtx.save();
        dustCtx.rotate(rotate);
        dustCtx.beginPath();
        for (let i = 0; i <= sides; i += 1) {
          const angle = (Math.PI * 2 * i) / sides;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          if (i === 0) {
            dustCtx.moveTo(x, y);
          } else {
            dustCtx.lineTo(x, y);
          }
        }
        dustCtx.stroke();
        dustCtx.restore();
      };

      const lineAlpha = 0.08 + focusIntensity * 0.18;
      dustCtx.strokeStyle = `rgba(0,0,0,${lineAlpha})`;
      dustCtx.lineWidth = 1;

      for (let ring = 0; ring < 4; ring += 1) {
        const radius = base * (0.35 + ring * 0.2) * pulse;
        dustCtx.beginPath();
        dustCtx.arc(0, 0, radius, 0, Math.PI * 2);
        dustCtx.stroke();
      }

      drawPolygon(6, base * 0.92 * pulse, rotation);
      drawPolygon(6, base * 0.62 * pulse, rotation + Math.PI / 6);
      drawPolygon(3, base * 0.52 * pulse, rotation + Math.PI / 2);
      drawPolygon(12, base * 0.35 * pulse, rotation / 2);

      dustCtx.save();
      dustCtx.rotate(-rotation * 1.2);
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6;
        dustCtx.beginPath();
        dustCtx.moveTo(0, 0);
        dustCtx.lineTo(Math.cos(angle) * base, Math.sin(angle) * base);
        dustCtx.stroke();
      }
      dustCtx.restore();

      dustCtx.restore();
    };

    const render = () => {
      timeRef.current += 1;
      const t = timeRef.current;
      drawGlass(t);
      drawSacredGeometry(t);
      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [mode, isPaused, focusIntensity]);

  return (
    <div className={`airia-atmosphere ${mode}`} aria-hidden>
      <canvas ref={glassCanvasRef} className="airia-glass-canvas" />
      <canvas ref={dustCanvasRef} className="airia-dust-canvas" />
    </div>
  );
};

export default AtmosphericBackdrop;
