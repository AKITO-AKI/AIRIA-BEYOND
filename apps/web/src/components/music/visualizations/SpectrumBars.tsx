/**
 * Frequency Spectrum Bars (周波数バー)
 * Vertical bars with smooth transitions and reflections
 */

export class SpectrumBars {
  private static previousHeights: number[] = [];

  static draw(
    ctx: CanvasRenderingContext2D,
    dataArray: Uint8Array,
    width: number,
    height: number,
    color: string,
    isPlaying: boolean
  ): void {
    const barCount = 64;
    const barWidth = 8;
    const barGap = 2;
    const totalBarWidth = barWidth + barGap;
    const startX = (width - barCount * totalBarWidth) / 2;

    // Group frequency bins into bars
    const binsPerBar = Math.floor(dataArray.length / barCount);
    const barHeights: number[] = [];

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = 0; j < binsPerBar; j++) {
        const index = i * binsPerBar + j;
        if (index < dataArray.length) {
          sum += dataArray[index];
        }
      }
      const average = sum / binsPerBar;
      barHeights.push(average);
    }

    // Smooth transitions (ease-out)
    const smoothedHeights = this.smoothTransitions(barHeights);

    // Create gradient from dominant color to complementary
    const gradient = this.createBarGradient(ctx, color, barCount, totalBarWidth, startX);

    // Draw bars
    for (let i = 0; i < barCount; i++) {
      const x = startX + i * totalBarWidth;
      const barHeight = (smoothedHeights[i] / 255) * (height * 0.4);

      // Main bar
      ctx.fillStyle = gradient;
      this.drawRoundedBar(ctx, x, height / 2 - barHeight, barWidth, barHeight, 4);

      // Reflection (mirrored, faded)
      if (isPlaying) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        this.drawRoundedBar(ctx, x, height / 2 + 2, barWidth, barHeight * 0.5, 4);
        ctx.restore();
      }

      // Subtle shadow
      ctx.shadowBlur = isPlaying ? 4 : 0;
      ctx.shadowColor = color;
    }

    // Reset shadow
    ctx.shadowBlur = 0;

    // Draw particles rising from tallest bars
    if (isPlaying) {
      this.drawParticles(ctx, smoothedHeights, startX, totalBarWidth, height, color);
    }
  }

  private static smoothTransitions(currentHeights: number[]): number[] {
    if (this.previousHeights.length === 0) {
      this.previousHeights = [...currentHeights];
      return currentHeights;
    }

    const smoothed: number[] = [];
    const smoothing = 0.7; // Higher = smoother (less responsive)

    for (let i = 0; i < currentHeights.length; i++) {
      const prev = this.previousHeights[i] || 0;
      const current = currentHeights[i];
      const smoothedValue = prev * smoothing + current * (1 - smoothing);
      smoothed.push(smoothedValue);
    }

    this.previousHeights = smoothed;
    return smoothed;
  }

  private static drawRoundedBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.lineTo(x + width, y + radius);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.fill();
  }

  private static createBarGradient(
    ctx: CanvasRenderingContext2D,
    color: string,
    barCount: number,
    barWidth: number,
    startX: number
  ): CanvasGradient {
    const gradient = ctx.createLinearGradient(
      startX,
      0,
      startX + barCount * barWidth,
      0
    );

    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, this.adjustHue(color, 30));
    gradient.addColorStop(1, this.adjustHue(color, 60));

    return gradient;
  }

  private static drawParticles(
    ctx: CanvasRenderingContext2D,
    heights: number[],
    startX: number,
    barWidth: number,
    canvasHeight: number,
    color: string
  ): void {
    const threshold = 200; // Only show particles for tall bars

    for (let i = 0; i < heights.length; i++) {
      if (heights[i] > threshold) {
        const x = startX + i * barWidth + barWidth / 2;
        const barHeight = (heights[i] / 255) * (canvasHeight * 0.4);
        const y = canvasHeight / 2 - barHeight - 10;

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  private static adjustHue(color: string, degrees: number): string {
    // Simple hue rotation (assumes hex color)
    const num = parseInt(color.replace('#', ''), 16);
    const r = ((num >> 16) & 0xff);
    const g = ((num >> 8) & 0xff);
    const b = (num & 0xff);

    // Convert to HSL, rotate hue, convert back
    // Simplified version - just adjust RGB values
    const factor = 1 + (degrees / 360);
    const newR = Math.min(255, r * factor);
    const newG = Math.min(255, g * factor);
    const newB = Math.min(255, b * factor);

    return `#${((Math.floor(newR) << 16) | (Math.floor(newG) << 8) | Math.floor(newB)).toString(16).padStart(6, '0')}`;
  }
}
