// Weather overlay — drawn LAST so it sits on top of everything. Supports four
// weather types that share the same lifecycle (active timer + smooth strength
// fade). Only one type is active at any moment.

import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game/constants';

export type WeatherType = 'CLEAR' | 'BLIZZARD' | 'WIND' | 'NIGHT' | 'FOG';

export interface Snowflake {
  x: number; y: number; speed: number; size: number; sway: number;
}

export interface WeatherState {
  weatherType: WeatherType;
  weatherActive: number;   // seconds remaining
  weatherStrength: number; // 0..1 fade
  snowflakes: Snowflake[];
  windPhase: number;
  /** Player position so NIGHT can spotlight them */
  playerScreenX?: number;
  playerScreenY?: number;
  /** Bonus room countdown — when > 0, the weather draw also shows a celebratory tint */
  bonusRoomTime?: number;
  bonusRoomFlash?: number;
}

export function drawWeather(ctx: CanvasRenderingContext2D, state: WeatherState): void {
  // Bonus room visual layer first (rainbow tint + flash on entry)
  if ((state.bonusRoomTime ?? 0) > 0) {
    drawBonusRoom(ctx, state);
  }
  if (state.weatherStrength <= 0.02) return;
  switch (state.weatherType) {
    case 'BLIZZARD': drawBlizzard(ctx, state); break;
    case 'WIND':     drawWind(ctx, state); break;
    case 'NIGHT':    drawNight(ctx, state); break;
    case 'FOG':      drawFog(ctx, state); break;
    case 'CLEAR':    return;
  }

  // Universal warning text in the first half of any storm
  if (state.weatherActive > 2.5) {
    ctx.fillStyle = `rgba(20, 30, 60, ${0.65 * state.weatherStrength})`;
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(weatherWarning(state.weatherType), CANVAS_WIDTH / 2, 60);
  }
}

function weatherWarning(t: WeatherType): string {
  switch (t) {
    case 'BLIZZARD': return '⚠ 暴風雪來襲 ⚠';
    case 'WIND':     return '⚠ 強風來襲 ⚠';
    case 'NIGHT':    return '⚠ 極夜降臨 ⚠';
    case 'FOG':      return '⚠ 大霧瀰漫 ⚠';
    default: return '';
  }
}

// ----- BONUS ROOM ----------------------------------------------------------

function drawBonusRoom(ctx: CanvasRenderingContext2D, state: WeatherState): void {
  const t = Date.now() * 0.001;
  const remaining = state.bonusRoomTime ?? 0;
  const flash = state.bonusRoomFlash ?? 0;

  // Rainbow border pulses
  ctx.save();
  ctx.lineWidth = 8;
  for (let i = 0; i < 6; i++) {
    const hue = (t * 60 + i * 60) % 360;
    ctx.strokeStyle = `hsla(${hue}, 90%, 60%, 0.8)`;
    ctx.lineWidth = 8 - i;
    ctx.strokeRect(i * 4, i * 4, CANVAS_WIDTH - i * 8, CANVAS_HEIGHT - i * 8);
  }
  ctx.restore();

  // Subtle gold sparkle particles
  ctx.fillStyle = `rgba(253, 224, 71, 0.3)`;
  for (let i = 0; i < 30; i++) {
    const x = (Math.sin(t * 2 + i) * 0.5 + 0.5) * CANVAS_WIDTH;
    const y = ((t * 50 + i * 17) % CANVAS_HEIGHT);
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Entry flash (white burst that fades)
  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.5})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // Countdown banner
  ctx.fillStyle = `rgba(255, 255, 255, 0.9)`;
  ctx.font = 'bold 38px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🌟 BONUS ROOM 🌟', CANVAS_WIDTH / 2, 50);

  ctx.fillStyle = `rgba(253, 224, 71, 0.95)`;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`${remaining.toFixed(1)} 秒 · 時間凍結`, CANVAS_WIDTH / 2, 80);
}

// ----- BLIZZARD ------------------------------------------------------------

function drawBlizzard(ctx: CanvasRenderingContext2D, state: WeatherState): void {
  const s = state.weatherStrength;
  ctx.fillStyle = `rgba(220, 230, 245, ${0.45 * s})`;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

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

  const grad = ctx.createRadialGradient(
    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.2,
    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.7,
  );
  grad.addColorStop(0, 'rgba(200, 220, 240, 0)');
  grad.addColorStop(1, `rgba(180, 200, 230, ${0.5 * s})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// ----- WIND -----------------------------------------------------------------

function drawWind(ctx: CanvasRenderingContext2D, state: WeatherState): void {
  const s = state.weatherStrength;
  // Diagonal motion lines drifting right
  ctx.strokeStyle = `rgba(200, 230, 255, ${0.55 * s})`;
  ctx.lineWidth = 1.5;
  const lineCount = 30;
  for (let i = 0; i < lineCount; i++) {
    const baseY = (i / lineCount) * CANVAS_HEIGHT;
    const offset = (state.windPhase * 80 + i * 47) % CANVAS_WIDTH;
    const x1 = offset - 60;
    const x2 = offset + 30;
    const y = baseY + Math.sin(state.windPhase + i) * 10;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
  }
  // Horizontal blue tint
  ctx.fillStyle = `rgba(100, 180, 220, ${0.12 * s})`;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// ----- NIGHT ----------------------------------------------------------------

function drawNight(ctx: CanvasRenderingContext2D, state: WeatherState): void {
  const s = state.weatherStrength;
  // Dark blue overlay
  ctx.fillStyle = `rgba(5, 10, 30, ${0.7 * s})`;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Spotlight around player (fallback to canvas center if not provided)
  const cx = state.playerScreenX ?? CANVAS_WIDTH / 2;
  const cy = state.playerScreenY ?? CANVAS_HEIGHT - 100;
  const radius = 250;
  const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, radius);
  grad.addColorStop(0, `rgba(255, 230, 180, ${0.5 * s})`);
  grad.addColorStop(0.4, `rgba(180, 180, 220, ${0.2 * s})`);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.globalCompositeOperation = 'source-over';

  // A few stars in the dark sky
  ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * s})`;
  const starPositions = [
    [80, 40, 1.5], [200, 30, 2], [350, 60, 1.2], [480, 25, 1.8],
    [620, 55, 1.3], [720, 40, 1.5], [100, 100, 1], [400, 90, 1.2],
  ];
  for (const [x, y, r] of starPositions) {
    const twinkle = 0.5 + 0.5 * Math.sin(performance.now() * 0.002 + (x as number));
    ctx.globalAlpha = (0.7 + 0.3 * twinkle) * s;
    ctx.beginPath();
    ctx.arc(x as number, y as number, r as number, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ----- FOG ------------------------------------------------------------------

function drawFog(ctx: CanvasRenderingContext2D, state: WeatherState): void {
  const s = state.weatherStrength;
  // Distance-based fog: stronger at the horizon, fades toward player
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, `rgba(220, 220, 230, ${0.85 * s})`); // Heavy at top (distant)
  grad.addColorStop(0.4, `rgba(220, 220, 230, ${0.55 * s})`);
  grad.addColorStop(0.7, `rgba(220, 220, 230, ${0.3 * s})`);
  grad.addColorStop(1, `rgba(220, 220, 230, ${0.1 * s})`);   // Light near player
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Subtle drifting fog wisps
  const time = performance.now() * 0.0003;
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 250 + time * 200) % (CANVAS_WIDTH + 200)) - 100;
    const cy = 200 + Math.sin(time * 2 + i) * 30;
    const r = 200;
    const wisp = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    wisp.addColorStop(0, `rgba(255, 255, 255, ${0.3 * s})`);
    wisp.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = wisp;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}
