/**
 * Canvas Renderer for Abstract Generative Art
 * 
 * Generates deterministic abstract images based on session IR data.
 * Uses mood to select color palettes and duration to influence complexity.
 */

import { SeededRandom } from './prng';

interface SessionData {
  mood_choice: string;
  duration_sec: number;
  seed: number;
}

// Color palettes for each mood
const MOOD_PALETTES: Record<string, string[]> = {
  '穏やか': ['#a8d5e2', '#6fb3d9', '#8bb8e8', '#c7e5f0', '#5a9bc5'], // Calm blues
  '嬉しい': ['#ffd966', '#ffb347', '#ff9999', '#ffcc99', '#ffe699'], // Happy warm colors
  '不安': ['#9b9b9b', '#7a7a7a', '#5c5c5c', '#4a4a4a', '#8a8a8a'], // Anxious grays
  '疲れ': ['#8b7d6b', '#a89f91', '#9c8d7e', '#b5a894', '#7d6e5d']  // Tired earth tones
};

/**
 * Generates an abstract PNG image from session data
 * @param sessionData The session IR data
 * @param width Canvas width in pixels
 * @param height Canvas height in pixels
 * @returns Canvas element with rendered image
 */
export function generateAbstractImage(
  sessionData: SessionData,
  width: number = 800,
  height: number = 600
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  const rng = new SeededRandom(sessionData.seed);
  const palette = MOOD_PALETTES[sessionData.mood_choice] || MOOD_PALETTES['穏やか'];
  
  // Complexity based on duration (30s = simple, 180s = complex)
  const complexity = Math.floor((sessionData.duration_sec / 30) * 5) + 3;
  const shapeCount = complexity * 8;
  
  // Background
  ctx.fillStyle = '#0b0f17';
  ctx.fillRect(0, 0, width, height);
  
  // Generate abstract shapes
  for (let i = 0; i < shapeCount; i++) {
    const color = palette[rng.nextInt(0, palette.length)];
    const opacity = rng.nextFloat(0.1, 0.4);
    
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    
    // Randomly choose shape type
    const shapeType = rng.nextInt(0, 3);
    
    if (shapeType === 0) {
      // Circle
      const x = rng.nextFloat(0, width);
      const y = rng.nextFloat(0, height);
      const radius = rng.nextFloat(20, 100);
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (shapeType === 1) {
      // Rectangle
      const x = rng.nextFloat(0, width);
      const y = rng.nextFloat(0, height);
      const w = rng.nextFloat(30, 150);
      const h = rng.nextFloat(30, 150);
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rng.nextFloat(0, Math.PI * 2));
      ctx.fillRect(-w/2, -h/2, w, h);
      ctx.restore();
    } else {
      // Triangle
      const x = rng.nextFloat(0, width);
      const y = rng.nextFloat(0, height);
      const size = rng.nextFloat(30, 120);
      
      ctx.beginPath();
      ctx.moveTo(x, y - size/2);
      ctx.lineTo(x + size/2, y + size/2);
      ctx.lineTo(x - size/2, y + size/2);
      ctx.closePath();
      ctx.fill();
    }
  }
  
  // Add some noise/texture for visual interest
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < width * height / 100; i++) {
    const x = rng.nextInt(0, width);
    const y = rng.nextInt(0, height);
    const brightness = rng.nextInt(200, 255);
    ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
    ctx.fillRect(x, y, 1, 1);
  }
  
  ctx.globalAlpha = 1.0;
  
  return canvas;
}

/**
 * Converts a canvas to a data URL for preview
 */
export function canvasToDataURL(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

/**
 * Triggers download of canvas as PNG file
 */
export function downloadCanvasAsPNG(canvas: HTMLCanvasElement, filename: string = 'session_image.png'): void {
  const dataURL = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = filename;
  link.click();
}
