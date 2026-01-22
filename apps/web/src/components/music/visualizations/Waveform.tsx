/**
 * Waveform visualization (波形)
 * Smooth sine-wave-like curve for classical music aesthetic
 */

export class Waveform {
  static draw(
    ctx: CanvasRenderingContext2D,
    dataArray: Uint8Array,
    width: number,
    height: number,
    color: string,
    isPlaying: boolean
  ): void {
    // Apply Gaussian smoothing
    const smoothedData = this.smoothData(dataArray);

    // Draw background grid (like sheet music staff)
    this.drawGrid(ctx, width, height);

    // Draw waveform
    ctx.lineWidth = 3;
    ctx.strokeStyle = this.getGradient(ctx, color, width);
    ctx.shadowBlur = isPlaying ? 8 : 4;
    ctx.shadowColor = color;

    ctx.beginPath();

    const sliceWidth = width / smoothedData.length;
    let x = 0;

    for (let i = 0; i < smoothedData.length; i++) {
      const v = smoothedData[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        // Use bezier curves for smooth appearance
        const xc = (x + sliceWidth * i) / 2;
        const yc = (y + (smoothedData[i - 1] / 128.0 * height) / 2) / 2;
        ctx.quadraticCurveTo(x, (smoothedData[i - 1] / 128.0 * height) / 2, xc, yc);
      }

      x = sliceWidth * i;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Mirror vertically for symmetry
    ctx.save();
    ctx.scale(1, -1);
    ctx.translate(0, -height);
    ctx.stroke();
    ctx.restore();

    // Reset shadow
    ctx.shadowBlur = 0;
  }

  private static smoothData(dataArray: Uint8Array): number[] {
    const smoothed: number[] = [];
    const windowSize = 3; // Gaussian window size

    for (let i = 0; i < dataArray.length; i++) {
      let sum = 0;
      let count = 0;

      for (let j = -windowSize; j <= windowSize; j++) {
        const index = i + j;
        if (index >= 0 && index < dataArray.length) {
          sum += dataArray[index];
          count++;
        }
      }

      smoothed.push(sum / count);
    }

    return smoothed;
  }

  private static drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;

    // Draw horizontal lines (like staff lines)
    const lineCount = 5;
    for (let i = 0; i < lineCount; i++) {
      const y = (height / (lineCount - 1)) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  private static getGradient(
    ctx: CanvasRenderingContext2D,
    color: string,
    width: number
  ): CanvasGradient {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, this.lightenColor(color, 20));
    gradient.addColorStop(1, color);
    return gradient;
  }

  private static lightenColor(color: string, percent: number): string {
    // Simple color lightening (assumes hex color)
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, ((num >> 16) & 0xff) + amt);
    const G = Math.min(255, ((num >> 8) & 0xff) + amt);
    const B = Math.min(255, (num & 0xff) + amt);
    return `#${((R << 16) | (G << 8) | B).toString(16).padStart(6, '0')}`;
  }
}
