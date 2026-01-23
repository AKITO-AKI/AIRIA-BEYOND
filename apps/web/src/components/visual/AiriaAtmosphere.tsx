import React, { useEffect, useRef } from 'react';

interface AtmosphericBackdropProps {
  mode: 'glass' | 'dust';
  isPaused?: boolean;
  focusIntensity?: number;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
}

const PARTICLE_COUNT = 220;
const DEPTH = 800;

const AtmosphericBackdrop: React.FC<AtmosphericBackdropProps> = ({
  mode,
  isPaused = false,
  focusIntensity = 0,
}) => {
  const glassCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dustCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
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

    if (particlesRef.current.length === 0) {
      particlesRef.current = new Array(PARTICLE_COUNT).fill(null).map(() => ({
        x: (Math.random() - 0.5) * window.innerWidth,
        y: (Math.random() - 0.5) * window.innerHeight,
        z: Math.random() * DEPTH,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        vz: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 1.6 + 0.6,
      }));
    }

    const drawGlass = (t: number) => {
      const { innerWidth: width, innerHeight: height } = window;
      glassCtx.clearRect(0, 0, width, height);
      glassCtx.save();
      glassCtx.globalCompositeOperation = 'screen';

      const waves = 6;
      for (let i = 0; i < waves; i += 1) {
        const phase = t * 0.0006 + i;
        const amplitude = 18 + i * 6;
        const opacity = 0.05 + i * 0.01;
        const gradient = glassCtx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, `rgba(255,255,255,${opacity})`);
        gradient.addColorStop(0.5, `rgba(160,170,190,${opacity * 0.9})`);
        gradient.addColorStop(1, `rgba(255,255,255,${opacity})`);
        glassCtx.strokeStyle = gradient;
        glassCtx.lineWidth = 1.2;

        glassCtx.beginPath();
        for (let x = 0; x <= width; x += 18) {
          const y =
            height * 0.4 +
            Math.sin(x * 0.01 + phase) * amplitude +
            Math.cos(x * 0.02 + phase * 0.7) * (amplitude * 0.4) +
            i * 22;
          glassCtx.lineTo(x, y);
        }
        glassCtx.stroke();
      }

      glassCtx.restore();

      const radial = glassCtx.createRadialGradient(
        width * 0.5,
        height * 0.4,
        40,
        width * 0.5,
        height * 0.4,
        width * 0.8
      );
      radial.addColorStop(0, `rgba(255,255,255,${0.18 + focusIntensity * 0.2})`);
      radial.addColorStop(0.6, 'rgba(150,160,180,0.08)');
      radial.addColorStop(1, 'rgba(255,255,255,0)');
      glassCtx.fillStyle = radial;
      glassCtx.fillRect(0, 0, width, height);
    };

    const drawDust = () => {
      const { innerWidth: width, innerHeight: height } = window;
      dustCtx.clearRect(0, 0, width, height);
      dustCtx.save();
      dustCtx.globalCompositeOperation = 'lighter';

      const particles = particlesRef.current;
      const driftScale = isPaused ? 0.2 : 1;

      particles.forEach((p) => {
        p.vx += (Math.random() - 0.5) * 0.01 * driftScale;
        p.vy += (Math.random() - 0.5) * 0.01 * driftScale;
        p.vz += (Math.random() - 0.5) * 0.02 * driftScale;

        p.x += p.vx * driftScale;
        p.y += p.vy * driftScale;
        p.z += p.vz * driftScale;

        if (p.z < 0) p.z = DEPTH;
        if (p.z > DEPTH) p.z = 0;

        const perspective = 0.6 + p.z / DEPTH;
        const screenX = width / 2 + p.x / perspective;
        const screenY = height / 2 + p.y / perspective;

        if (screenX < -100 || screenX > width + 100 || screenY < -100 || screenY > height + 100) {
          p.x = (Math.random() - 0.5) * width;
          p.y = (Math.random() - 0.5) * height;
          p.z = Math.random() * DEPTH;
        }

        const depthBlur = Math.max(0, (1 - p.z / DEPTH) * 6);
        const alpha = 0.08 + (1 - p.z / DEPTH) * 0.4;
        dustCtx.filter = `blur(${depthBlur}px)`;
        const radius = p.size * (1.2 + (1 - p.z / DEPTH) * 2.4);

        const gradient = dustCtx.createRadialGradient(
          screenX,
          screenY,
          0,
          screenX,
          screenY,
          radius * 6
        );
        gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
        gradient.addColorStop(0.4, `rgba(180,200,255,${alpha * 0.35})`);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        dustCtx.fillStyle = gradient;
        dustCtx.beginPath();
        dustCtx.arc(screenX, screenY, radius * 5, 0, Math.PI * 2);
        dustCtx.fill();
      });

      dustCtx.filter = 'none';
      dustCtx.restore();
    };

    const render = () => {
      timeRef.current += 1;
      const t = timeRef.current;
      drawGlass(t);
      if (mode === 'dust') {
        drawDust();
      } else {
        dustCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
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
