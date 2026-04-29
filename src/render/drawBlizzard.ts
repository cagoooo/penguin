// Blizzard overlay — drawn LAST so it sits on top of penguin and obstacles.
// Layers: whiteout veil + drifting snowflakes (mutated in-place) + radial
// vignette to push focus inward + warning text in the first ~half of the storm.

import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game/constants';

export interface Snowflake {
  x: number;
  y: number;
  speed: number;
  size: number;
  sway: number;
}

export interface BlizzardState {
  /** 0..1 fade strength */
  blizzardStrength: number;
  /** Seconds remaining in current storm. >2.5 shows warning text. */
  blizzardActive: number;
  /** Mutated in place each frame. */
  snowflakes: Snowflake[];
}

export function drawBlizzard(
  ctx: CanvasRenderingContext2D,
  state: BlizzardState,
): void {
  if (state.blizzardStrength <= 0.02) return;
  const s = state.blizzardStrength;

  // Whiteout veil
  ctx.fillStyle = `rgba(220, 230, 245, ${0.45 * s})`;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Drifting snowflakes (animation state mutated in place)
  ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * s})`;
  for (const f of state.snowflakes) {
    f.sway += 0.08;
    f.x += Math.sin(f.sway) * 0.8 + 1.5;
    f.y += f.speed;
    if (f.y > CANVAS_HEIGHT) {
      f.y = -10;
      f.x = Math.random() * CANVAS_WIDTH;
    }
    if (f.x > CANVAS_WIDTH) f.x = 0;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vignette
  const grad = ctx.createRadialGradient(
    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.2,
    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.7,
  );
  grad.addColorStop(0, 'rgba(200, 220, 240, 0)');
  grad.addColorStop(1, `rgba(180, 200, 230, ${0.5 * s})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Warning text during the first half of the storm
  if (state.blizzardActive > 2.5) {
    ctx.fillStyle = `rgba(20, 30, 60, ${0.6 * s})`;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ 暴風雪來襲 ⚠', CANVAS_WIDTH / 2, 60);
  }
}
