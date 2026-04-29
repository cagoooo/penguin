// Animated 12-particle flame effect used for fire-mode penguin and "on fire"
// obstacles after they're killed. Particles are teardrop-shaped with a subtle
// inner glow on every third particle.

export function drawFire(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
): void {
  const time = Date.now() / 50;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + time * 0.2;
    const dist = (20 + Math.sin(time + i) * 10) * scale;

    const px = x + Math.cos(angle) * dist;
    const py = y + Math.sin(angle) * dist * 0.5 - (Math.abs(Math.sin(time * 2 + i)) * 40 * scale);

    const size = (15 + Math.sin(time * 3 + i) * 5) * scale;

    // Cycle through fire palette
    const colorRoll = (i + Math.floor(time)) % 3;
    if (colorRoll === 0) ctx.fillStyle = '#FF4500';      // OrangeRed
    else if (colorRoll === 1) ctx.fillStyle = '#FF8C00'; // DarkOrange
    else ctx.fillStyle = '#FFD700';                       // Gold

    // Teardrop shape
    ctx.beginPath();
    ctx.moveTo(px, py + size);
    ctx.bezierCurveTo(px - size, py + size, px - size, py - size, px, py - size * 1.5);
    ctx.bezierCurveTo(px + size, py - size, px + size, py + size, px, py + size);
    ctx.fill();

    // Inner glow on every third particle
    if (i % 3 === 0) {
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(px, py, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
