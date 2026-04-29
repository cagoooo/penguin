// Renderer for all 8 obstacle types + collectibles + shop station.
//
// Each obstacle is drawn at world (lane * 150, 0, z), translated/scaled into
// the canvas via project(). The renderer reads from gameRef-shaped state
// passed in as `env` so we don't need to import App's heavyweight ref.

import type { Obstacle } from '../game/types';
import { project, type CumulativeOffset } from './project';
import { drawFire } from './drawFire';

export interface ObstaclesEnv {
  curveSegments: number[];
  segmentOffset: number;
  cumulativeOffsets: CumulativeOffset[];
}

export function drawObstacles(
  ctx: CanvasRenderingContext2D,
  obstacles: Obstacle[],
  env: ObstaclesEnv,
): void {
  // Sort back-to-front for proper layering
  obstacles.sort((a, b) => b.z - a.z).forEach(obs => {
    if (obs.collected && !obs.onFire) return;

    // Stationary part — translated to lane × z position
    const { px, py, scale } = project(
      obs.lane * 150, 0, obs.z,
      env.curveSegments, env.segmentOffset, env.cumulativeOffsets,
    );

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(scale, scale);

    drawSingleObstacle(ctx, obs);
    ctx.restore();

    // JUMPING_FISH has a moving part (the fish itself flies in an arc above
    // the hole). Draw separately because it has its own world coordinates.
    if (obs.type === 'JUMPING_FISH' && !obs.collected) {
      drawJumpingFishMover(ctx, obs, env);
    }
  });
}

function drawSingleObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
  switch (obs.type) {
    case 'CRACK':       drawCrack(ctx); break;
    case 'HOLE':
    case 'JUMPING_FISH': drawHole(ctx); break;
    case 'ICEBERG':     drawIceberg(ctx, obs); break;
    case 'POLAR_BEAR':  drawPolarBear(ctx, obs); break;
    case 'SEAL':        drawSeal(ctx, obs); break;
    case 'FISH':        drawFish(ctx, obs); break;
    case 'FLAG':
    case 'BLUE_FLAG':
    case 'RAINBOW_FLAG': drawFlag(ctx, obs); break;
    case 'WARP_FLAG':   drawWarpFlag(ctx); break;
    case 'SHOP_STATION': drawShopStation(ctx); break;
    case 'ICE_PATCH':   drawIcePatch(ctx); break;
    case 'SNOWDRIFT':   drawSnowdrift(ctx); break;
  }
}

// --- Individual obstacle drawers (factored from App.tsx) ------------------

function drawCrack(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#2a5bb5';
  ctx.fillRect(-150, 0, 300, 15);
  ctx.fillStyle = '#4d88ff';
  ctx.fillRect(-150, -5, 300, 10);
  ctx.fillStyle = '#000';

  ctx.beginPath();
  ctx.moveTo(-150, -5);
  ctx.lineTo(-170, -2);
  ctx.lineTo(-155, 0);
  ctx.lineTo(-175, 3);
  ctx.lineTo(-150, 5);
  ctx.lineTo(-150, 15);
  ctx.lineTo(-175, 13);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(150, -5);
  ctx.lineTo(170, -2);
  ctx.lineTo(155, 0);
  ctx.lineTo(175, 3);
  ctx.lineTo(150, 5);
  ctx.lineTo(150, 15);
  ctx.lineTo(175, 13);
  ctx.closePath();
  ctx.fill();
}

function drawHole(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.ellipse(0, -1, 62, 16, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a3a7a';
  ctx.beginPath();
  ctx.ellipse(0, 4, 58, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4d88ff';
  ctx.beginPath();
  ctx.ellipse(0, 0, 60, 15, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawIceberg(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
  ctx.fillStyle = 'rgba(40, 60, 120, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 110, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // Iceberg silhouette
  ctx.fillStyle = '#cfe6ff';
  ctx.beginPath();
  ctx.moveTo(-100, 5);
  ctx.lineTo(-80, -50);
  ctx.lineTo(-55, -20);
  ctx.lineTo(-30, -110);
  ctx.lineTo(-5, -55);
  ctx.lineTo(20, -135);
  ctx.lineTo(45, -65);
  ctx.lineTo(70, -90);
  ctx.lineTo(95, -25);
  ctx.lineTo(100, 5);
  ctx.closePath();
  ctx.fill();

  // Sun-lit highlight
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-30, -110);
  ctx.lineTo(20, -135);
  ctx.lineTo(0, -85);
  ctx.lineTo(-15, -85);
  ctx.closePath();
  ctx.fill();

  // Shadow side
  ctx.fillStyle = 'rgba(80, 120, 180, 0.45)';
  ctx.beginPath();
  ctx.moveTo(20, -135);
  ctx.lineTo(70, -90);
  ctx.lineTo(45, -65);
  ctx.closePath();
  ctx.fill();

  // Outline
  ctx.strokeStyle = '#5982bd';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-100, 5);
  ctx.lineTo(-80, -50);
  ctx.lineTo(-55, -20);
  ctx.lineTo(-30, -110);
  ctx.lineTo(-5, -55);
  ctx.lineTo(20, -135);
  ctx.lineTo(45, -65);
  ctx.lineTo(70, -90);
  ctx.lineTo(95, -25);
  ctx.lineTo(100, 5);
  ctx.stroke();

  if (obs.onFire) drawFire(ctx, 0, -50, 1.5);
}

function drawPolarBear(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
  const offsetX = (obs.laneOffset ?? 0) * 150;
  ctx.save();
  ctx.translate(offsetX, 0);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 45, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  const phase = obs.walkPhase ?? 0;
  const bob = Math.sin(phase) * 3;
  ctx.translate(0, -bob);

  // Body
  ctx.fillStyle = '#f5f5f0';
  ctx.beginPath();
  ctx.ellipse(0, -25, 42, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.beginPath();
  ctx.ellipse(0, -65, 30, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears (outer)
  ctx.beginPath();
  ctx.arc(-18, -88, 8, 0, Math.PI * 2);
  ctx.arc(18, -88, 8, 0, Math.PI * 2);
  ctx.fill();
  // Ears (inner)
  ctx.fillStyle = '#d4b8a0';
  ctx.beginPath();
  ctx.arc(-18, -88, 4, 0, Math.PI * 2);
  ctx.arc(18, -88, 4, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.fillStyle = '#fafaf2';
  ctx.beginPath();
  ctx.ellipse(0, -55, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.arc(-10, -68, 3, 0, Math.PI * 2);
  ctx.arc(10, -68, 3, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(0, -55, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (alternating walk)
  ctx.fillStyle = '#f5f5f0';
  const legA = Math.sin(phase) * 6;
  const legB = Math.sin(phase + Math.PI) * 6;
  ctx.beginPath();
  ctx.ellipse(-22, 0 + legA, 10, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(22, 0 + legB, 10, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(-32, 0 + legB, 10, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(32, 0 + legA, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Outline
  ctx.strokeStyle = '#c4c4b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, -25, 42, 28, 0, 0, Math.PI * 2);
  ctx.stroke();

  if (obs.onFire) drawFire(ctx, 0, -40, 1.3);
  ctx.restore();
}

function drawSeal(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.ellipse(0, -1, 62, 16, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#4d88ff';
  ctx.beginPath();
  ctx.ellipse(0, 0, 60, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  if (obs.z >= 2000) return;
  const emergence = Math.max(0, Math.min(1, (2000 - obs.z) / 1200));
  const sealY = 40 - (emergence * 55);
  const showHands = obs.z < 1000;

  ctx.save();
  ctx.beginPath();
  ctx.rect(-100, -150, 200, 155);
  ctx.clip();

  ctx.translate(0, sealY);
  ctx.fillStyle = '#C04040';

  ctx.beginPath();
  ctx.ellipse(0, 10, 35, 25, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, -15, 25, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#000';
  ctx.fillRect(-12, -22, 6, 3);
  ctx.fillRect(6, -22, 6, 3);

  // Mouth
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000';
  ctx.moveTo(0, -15);
  ctx.lineTo(0, -8);
  ctx.moveTo(-8, -10);
  ctx.quadraticCurveTo(0, -5, 8, -10);
  ctx.stroke();

  if (showHands) {
    ctx.fillStyle = '#C04040';
    ctx.beginPath();
    ctx.ellipse(-40, 15, 20, 10, 0.3, 0, Math.PI * 2);
    ctx.ellipse(40, 15, 20, 10, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (obs.onFire) drawFire(ctx, 0, 0, 1.2);
  ctx.restore();
}

function drawFish(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
  ctx.save();
  ctx.translate(0, -30);
  ctx.fillStyle = obs.color || '#FF6347';
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.quadraticCurveTo(0, -12, -15, -4);
  ctx.lineTo(-15, 4);
  ctx.quadraticCurveTo(0, 12, 20, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-15, 0);
  ctx.lineTo(-28, -10);
  ctx.lineTo(-24, 0);
  ctx.lineTo(-28, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(10, -3, 2.5, 0, Math.PI * 2);
  ctx.fill();
  if (obs.onFire) drawFire(ctx, 0, 0, 0.7);
  ctx.restore();
}

function drawFlag(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(-5, -60, 5, 60);
  if (obs.type === 'FLAG') ctx.fillStyle = obs.color || '#FF0000';
  else if (obs.type === 'BLUE_FLAG') ctx.fillStyle = '#0000FF';
  else {
    const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#8B00FF'];
    ctx.fillStyle = colors[Math.floor(Date.now() / 100) % colors.length];
  }
  ctx.beginPath();
  ctx.moveTo(0, -60);
  ctx.lineTo(30, -45);
  ctx.lineTo(0, -30);
  ctx.fill();
}

function drawWarpFlag(ctx: CanvasRenderingContext2D): void {
  // Animated rainbow vortex on a tall pole — clearly different from regular flags
  const t = Date.now() * 0.005;

  // Pole
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(-3, -90, 6, 90);

  // Spiraling rainbow ring
  const rings = ['#FF1493', '#FF7F00', '#FFFF00', '#00FF7F', '#1E90FF', '#9400D3'];
  for (let i = 0; i < 6; i++) {
    const angle = t + i * (Math.PI / 3);
    const r = 30 - i * 3;
    ctx.fillStyle = rings[i];
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 8, -55 + Math.sin(angle) * 8, r, 0, Math.PI * 2);
    ctx.globalAlpha = 0.6;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Bright center
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, -55, 8, 0, Math.PI * 2);
  ctx.fill();

  // Sparkles
  ctx.fillStyle = '#fde047';
  for (let i = 0; i < 4; i++) {
    const a = t * 1.5 + i * (Math.PI / 2);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 35, -55 + Math.sin(a) * 35, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawShopStation(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  // Main hut
  ctx.fillStyle = '#C0C0C0';
  ctx.fillRect(-100, -120, 200, 120);
  // Roof
  ctx.beginPath();
  ctx.fillStyle = '#E00';
  ctx.moveTo(-110, -120);
  ctx.lineTo(0, -160);
  ctx.lineTo(110, -120);
  ctx.fill();
  // Window
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(-60, -80, 40, 40);
  // Door
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(20, -70, 40, 70);
  // SHOP sign
  ctx.fillStyle = '#FFFF00';
  ctx.fillRect(-30, -110, 60, 20);
  ctx.fillStyle = '#000';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SHOP', 0, -96);
  ctx.restore();
}

function drawIcePatch(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 80);
  grad.addColorStop(0, 'rgba(100, 200, 255, 0.6)');
  grad.addColorStop(0.7, 'rgba(150, 220, 255, 0.4)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 80, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-20, -5, 30, 5, 0.2, 0, Math.PI);
  ctx.stroke();
}

function drawSnowdrift(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(-100, 0);
  ctx.quadraticCurveTo(-50, -40, 0, -35);
  ctx.quadraticCurveTo(60, -45, 100, 0);
  ctx.fill();
  ctx.fillStyle = '#E0F0FF';
  ctx.beginPath();
  ctx.moveTo(-40, -10);
  ctx.quadraticCurveTo(0, -25, 40, -10);
  ctx.quadraticCurveTo(0, -15, -40, -10);
  ctx.fill();
}

function drawJumpingFishMover(
  ctx: CanvasRenderingContext2D,
  obs: Obstacle,
  env: ObstaclesEnv,
): void {
  const fishX = obs.lane * 150 + (obs.fishLaneOffset || 0) * 150;
  const fishY = obs.fishY || 0;
  const fishProj = project(fishX, fishY, obs.z, env.curveSegments, env.segmentOffset, env.cumulativeOffsets);

  // Shadow on the ground
  const shadowProj = project(fishX, 0, obs.z, env.curveSegments, env.segmentOffset, env.cumulativeOffsets);
  ctx.save();
  ctx.translate(shadowProj.px, shadowProj.py);
  ctx.scale(shadowProj.scale, shadowProj.scale);
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 25, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Fish in flight
  ctx.save();
  ctx.translate(fishProj.px, fishProj.py);
  ctx.scale(fishProj.scale, fishProj.scale);
  ctx.rotate((obs.fishVy ?? 0) / 15 * 0.5);
  ctx.fillStyle = obs.color || '#FF6347';
  ctx.beginPath();
  ctx.moveTo(25, 0);
  ctx.quadraticCurveTo(0, -15, -20, -5);
  ctx.lineTo(-20, 5);
  ctx.quadraticCurveTo(0, 15, 25, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.lineTo(-35, -12);
  ctx.lineTo(-30, 0);
  ctx.lineTo(-35, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(12, -4, 3, 0, Math.PI * 2);
  ctx.fill();
  if (obs.onFire) drawFire(ctx, 0, 0, 0.8);
  ctx.restore();
}
