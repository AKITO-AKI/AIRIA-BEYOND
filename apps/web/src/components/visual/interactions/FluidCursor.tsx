import React, { useEffect, useRef, useState } from 'react';

interface FluidCursorProps {
  onSafeZoneChange?: (isSafe: boolean) => void;
  onFocusChange?: (isFocused: boolean) => void;
}

interface Point {
  x: number;
  y: number;
}

const TRAIL_LENGTH = 18;
const MAGNET_RADIUS = 80;
const SAFE_ZONE_RATIO = 0.2;

const FluidCursor: React.FC<FluidCursorProps> = ({ onSafeZoneChange, onFocusChange }) => {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef<Point>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const currentRef = useRef<Point>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const trailRef = useRef<Point[]>([]);
  const animationRef = useRef<number | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isMagnetized, setIsMagnetized] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const supportsHover = window.matchMedia('(hover: hover)').matches;
    const shouldEnable = !reducedMotion && supportsHover;
    setIsEnabled(shouldEnable);

    if (!shouldEnable) return;

    const updateTarget = (event: MouseEvent) => {
      targetRef.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener('mousemove', updateTarget);
    return () => {
      window.removeEventListener('mousemove', updateTarget);
    };
  }, []);

  useEffect(() => {
    if (!isEnabled) return;

    const canvas = trailCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const resize = () => {
      const { innerWidth, innerHeight, devicePixelRatio } = window;
      canvas.width = innerWidth * devicePixelRatio;
      canvas.height = innerHeight * devicePixelRatio;
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      const current = currentRef.current;
      const target = targetRef.current;

      let magnetTarget = target;
      const magnetCandidate = findMagnetTarget(target.x, target.y);
      if (magnetCandidate) {
        magnetTarget = magnetCandidate;
        setIsMagnetized(true);
      } else {
        setIsMagnetized(false);
      }

      current.x += (magnetTarget.x - current.x) * 0.12;
      current.y += (magnetTarget.y - current.y) * 0.12;

      const isSafe = isPointerInSafeZone(target.x, target.y);
      onSafeZoneChange?.(isSafe);

      const focused = isPointerOnInteractive(target.x, target.y);
      onFocusChange?.(focused);

      trailRef.current.unshift({ x: current.x, y: current.y });
      if (trailRef.current.length > TRAIL_LENGTH) {
        trailRef.current.pop();
      }

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.globalCompositeOperation = 'lighter';

      trailRef.current.forEach((point, index) => {
        const alpha = Math.max(0, 1 - index / TRAIL_LENGTH);
        const radius = 18 - index * 0.8;
        const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2.8);
        gradient.addColorStop(0, `rgba(255,255,255,${alpha * 0.28})`);
        gradient.addColorStop(0.4, `rgba(160,200,255,${alpha * 0.18})`);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * 2, 0, Math.PI * 2);
        ctx.fill();
      });

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${current.x}px, ${current.y}px) translate(-50%, -50%)`;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    document.body.classList.add('airia-cursor-active');

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
      document.body.classList.remove('airia-cursor-active');
    };
  }, [isEnabled, onFocusChange, onSafeZoneChange]);

  if (!isEnabled) return null;

  return (
    <>
      <canvas ref={trailCanvasRef} className="airia-cursor-trail" aria-hidden />
      <div
        ref={cursorRef}
        className={`airia-fluid-cursor ${isMagnetized ? 'magnetized' : ''}`}
        aria-hidden
      >
        <span className="cursor-core" />
        <span className="cursor-ring" />
      </div>
    </>
  );
};

const isPointerOnInteractive = (x: number, y: number) => {
  const element = document.elementFromPoint(x, y);
  if (!element) return false;
  return Boolean(element.closest('button, a, input, select, textarea, [data-focus-reactive]'));
};

const isPointerInSafeZone = (x: number, y: number) => {
  const { innerWidth: width, innerHeight: height } = window;
  const marginX = width * SAFE_ZONE_RATIO;
  const marginY = height * SAFE_ZONE_RATIO;
  return x < marginX || x > width - marginX || y < marginY || y > height - marginY;
};

const findMagnetTarget = (x: number, y: number): Point | null => {
  const elements = Array.from(document.querySelectorAll<HTMLElement>('button, select, [data-magnet="true"]'));
  let closest: Point | null = null;
  let closestDistance = MAGNET_RADIUS;

  elements.forEach((el) => {
    if (el.hasAttribute('disabled')) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(centerX - x, centerY - y);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = { x: centerX, y: centerY };
    }
  });

  return closest;
};

export default FluidCursor;
