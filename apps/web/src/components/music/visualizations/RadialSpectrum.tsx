/**
 * Radial Spectrum (円形スペクトラム)
 * Circular visualization radiating from center
 */

export class RadialSpectrum {
  private static rotation = 0;

  static draw(
    ctx: CanvasRenderingContext2D,
    dataArray: Uint8Array,
    width: number,
    height: number,
    color: string,
    isPlaying: boolean
  ): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const innerRadius = Math.min(width, height) * 0.15;
    const maxRadius = Math.min(width, height) * 0.45;

    // Rotate slowly (1 rotation per 60 seconds)
    if (isPlaying) {
      this.rotation += (360 / (60 * 60)); // 60fps * 60 seconds
    }

    // Number of bars
    const barCount = Math.min(dataArray.length, 180);
    const angleStep = (Math.PI * 2) / barCount;

    // Draw radial bars
    for (let i = 0; i < barCount; i++) {
      const value = dataArray[Math.floor(i * (dataArray.length / barCount))];
      const barHeight = (value / 255) * (maxRadius - innerRadius);
      const angle = i * angleStep + this.rotation * (Math.PI / 180);

      const startX = centerX + Math.cos(angle) * innerRadius;
      const startY = centerY + Math.sin(angle) * innerRadius;
      const endX = centerX + Math.cos(angle) * (innerRadius + barHeight);
      const endY = centerY + Math.sin(angle) * (innerRadius + barHeight);

      // Rainbow gradient mapped to frequency
      const hue = (i / barCount) * 360;
      ctx.strokeStyle = `hsla(${hue}, 70%, 60%, 0.8)`;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Particle trails for peaks
      if (isPlaying && value > 200) {
        const particleX = centerX + Math.cos(angle) * (innerRadius + barHeight + 5);
        const particleY = centerY + Math.sin(angle) * (innerRadius + barHeight + 5);

        ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.6)`;
        ctx.beginPath();
        ctx.arc(particleX, particleY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw center circle (for album image placeholder)
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Outer glow pulsing with overall amplitude
    if (isPlaying) {
      const averageAmplitude = this.getAverageAmplitude(dataArray);
      const glowRadius = maxRadius + (averageAmplitude / 255) * 10;

      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 20;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private static getAverageAmplitude(dataArray: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / dataArray.length;
  }
}
