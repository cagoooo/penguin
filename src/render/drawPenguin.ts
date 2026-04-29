// Penguin renderer — body, head, wings, feet (with stumble/jump/skateboard
// variants), propeller (when flying), fire effect (when invincible), and skin
// accessory overlay.

import { project, type CumulativeOffset } from './project';
import { drawFire } from './drawFire';
import { drawSkinAccessories, type SkinId } from '../skins/skins';

export interface PenguinDrawState {
  /** Current player coords (x = lateral, y = vertical, with negative = up) */
  x: number;
  y: number;
  isJumping: boolean;
  vy: number;
  animFrame: number;
  stumbleTime: number;
}

export interface PenguinDrawEnv {
  curveSegments: number[];
  segmentOffset: number;
  cumulativeOffsets: CumulativeOffset[];
  hasSkateboard: boolean;
  propellerTime: number;
  fireTime: number;
}

export function drawPenguin(
  ctx: CanvasRenderingContext2D,
  p: PenguinDrawState,
  env: PenguinDrawEnv,
  skinId: SkinId,
): void {
  const { px, py, scale } = project(p.x, p.y, 100, env.curveSegments, env.segmentOffset, env.cumulativeOffsets);

  ctx.save();
  ctx.translate(px, py);
  ctx.scale(scale, scale);

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 40, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  const waddle = Math.sin(p.animFrame) * 8;
  const isJumping = p.y < 0;

  if (!isJumping) {
    ctx.rotate(waddle * Math.PI / 180);
  }

  drawBody(ctx, p, env, isJumping);
  drawHeadHighlight(ctx);
  drawWings(ctx, p, isJumping);
  drawFeet(ctx, p, isJumping);

  // Skin accessories (red scarf / sunglasses / crown / golden sheen)
  drawSkinAccessories(ctx, skinId, {
    isJumping,
    hasSkateboard: env.hasSkateboard && !p.isJumping && p.stumbleTime <= 0,
    animFrame: p.animFrame,
  });

  if (env.propellerTime > 0) drawPropeller(ctx, p);
  if (env.fireTime > 0) drawFire(ctx, 0, -20, 1);

  ctx.restore();
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  p: PenguinDrawState,
  env: PenguinDrawEnv,
  isJumping: boolean,
): void {
  ctx.fillStyle = '#000';
  if (env.hasSkateboard && !p.isJumping && p.stumbleTime <= 0) {
    // Skateboard pose: horizontal
    ctx.save();
    ctx.translate(0, -10);
    // Board
    ctx.fillStyle = '#FF4500';
    ctx.fillRect(-45, 0, 90, 8);
    // Wheels
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-30, 8, 5, 0, Math.PI * 2);
    ctx.arc(30, 8, 5, 0, Math.PI * 2);
    ctx.fill();
    // Penguin lying on board
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, -15, 50, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.beginPath();
    if (isJumping) {
      ctx.ellipse(0, -45, 30, 50, 0, 0, Math.PI * 2);
    } else {
      ctx.ellipse(0, -40, 35, 45, 0, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

function drawHeadHighlight(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.ellipse(-12, -72, 8, 4, -Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawWings(
  ctx: CanvasRenderingContext2D,
  p: PenguinDrawState,
  isJumping: boolean,
): void {
  ctx.fillStyle = '#000';
  const wingWobble = isJumping
    ? Math.sin(Date.now() / 50) * 40
    : Math.sin(p.animFrame) * 15;

  // Left wing
  ctx.beginPath();
  ctx.moveTo(-30, -50);
  ctx.quadraticCurveTo(-60, -40 + wingWobble, -30, -20);
  ctx.fill();

  // Right wing
  ctx.beginPath();
  ctx.moveTo(30, -50);
  ctx.quadraticCurveTo(60, -40 + wingWobble, 30, -20);
  ctx.fill();
}

function drawFeet(
  ctx: CanvasRenderingContext2D,
  p: PenguinDrawState,
  isJumping: boolean,
): void {
  ctx.fillStyle = '#FFD700';

  if (p.stumbleTime > 0) {
    ctx.beginPath();
    ctx.ellipse(-18, -5, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(18, -25, 12, 8, 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (isJumping) {
    // Tucked feet
    ctx.beginPath();
    ctx.ellipse(-15, -15, 10, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(15, -15, 10, 6, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Alternating waddle
    const leftFootY = Math.sin(p.animFrame) > 0 ? -10 : -5;
    const rightFootY = Math.sin(p.animFrame) <= 0 ? -10 : -5;
    ctx.beginPath();
    ctx.ellipse(-18, leftFootY, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(18, rightFootY, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPropeller(
  ctx: CanvasRenderingContext2D,
  p: PenguinDrawState,
): void {
  ctx.save();
  ctx.translate(0, -85);
  const propAngle = p.animFrame * 2;
  ctx.rotate(propAngle);
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(-30, -2, 60, 4);
  ctx.fillRect(-2, -30, 4, 60);
  ctx.restore();
  // Shaft
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(-2, -85, 4, 15);
}
