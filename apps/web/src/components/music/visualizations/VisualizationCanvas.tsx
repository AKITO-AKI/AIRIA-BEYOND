import React, { useRef, useEffect } from 'react';
import type { VisualizationMode } from '../../../contexts/MusicPlayerContext';
import { Waveform } from './Waveform';
import { SpectrumBars } from './SpectrumBars';
import { RadialSpectrum } from './RadialSpectrum';

interface VisualizationCanvasProps {
  mode: VisualizationMode;
  frequencyData: Uint8Array | null;
  timeDomainData: Uint8Array | null;
  isPlaying: boolean;
  dominantColor?: string;
  width?: number;
  height?: number;
  mini?: boolean;
}

export const VisualizationCanvas: React.FC<VisualizationCanvasProps> = ({
  mode,
  frequencyData,
  timeDomainData,
  isPlaying,
  dominantColor = '#D4AF37',
  width = 800,
  height = 200,
  mini = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size (with DPI scaling)
    const dpr = mini ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const targetFPS = mini ? 30 : 60;
    const frameInterval = 1000 / targetFPS;

    const render = (timestamp: number) => {
      // Throttle to target FPS
      if (timestamp - lastFrameTimeRef.current < frameInterval) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }
      lastFrameTimeRef.current = timestamp;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Render based on mode
      if (mode === 'waveform' && timeDomainData) {
        Waveform.draw(ctx, timeDomainData, width, height, dominantColor, isPlaying);
      } else if (mode === 'spectrum' && frequencyData) {
        SpectrumBars.draw(ctx, frequencyData, width, height, dominantColor, isPlaying);
      } else if (mode === 'radial' && frequencyData) {
        RadialSpectrum.draw(ctx, frequencyData, width, height, dominantColor, isPlaying);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [mode, frequencyData, timeDomainData, isPlaying, dominantColor, width, height, mini]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        margin: '0 auto',
        borderRadius: mini ? '4px' : '8px',
      }}
    />
  );
};
