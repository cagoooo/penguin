// Environment renderer — sky, sun, clouds, aurora, parallax mountains/icebergs,
// ice ground, road, sea, road lines, goal gate. Everything that's "not the
// player and not the obstacles".

import { CANVAS_WIDTH, CANVAS_HEIGHT, HORIZON_Y, MAX_SPEED } from '../game/constants';
import { project, type CumulativeOffset } from './project';

// --- Static decoration shapes (built once in App and passed in) -----------

export interface CloudData {
  x: number;
  y: number;
  width: number;
  speed: number;
}

export interface AuroraData {
  x: number;
  width: number;
  height: number;
  color: string;
  speed: number;
  offset: number;
}

export interface MountainData {
  x: number;
  width: number;
  height: number;
  color: string;
  layer: number;
  isIceberg: boolean;
}

// --- The slice of gameRef the environment renderer needs ------------------

export interface EnvDrawState {
  bgOffset: number;
  curve: number;
  speed: number;
  distance: number;
  seaTransition: number;
  seaType: 'NONE' | 'LEFT' | 'RIGHT';
  curveSegments: number[];
  segmentOffset: number;
  cumulativeOffsets: CumulativeOffset[];
}

export function drawEnvironment(
  ctx: CanvasRenderingContext2D,
  state: EnvDrawState,
  decorations: {
    clouds: CloudData[];
    auroras: AuroraData[];
    mountains: MountainData[];
  },
): void {
  drawSky(ctx);
  drawSun(ctx);
  drawClouds(ctx, decorations.clouds, state.bgOffset);
  drawAurora(ctx, decorations.auroras, state.curve, state.bgOffset);
  drawMountains(ctx, decorations.mountains, state.curve, state.bgOffset, state.speed);
  drawIceGround(ctx);
  drawIceHillShadows(ctx, state);
  drawRoad(ctx, state);
  drawSea(ctx, state);
  drawRoadLines(ctx, state);
  drawGoalGate(ctx, state);
}

function drawSky(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON_Y);
}

function drawSun(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#FFFACD';
  ctx.beginPath();
  ctx.arc(100, 80, 40, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds(
  ctx: CanvasRenderingContext2D,
  clouds: CloudData[],
  bgOffset: number,
): void {
  clouds.forEach((cloud, index) => {
    const drift = Date.now() * 0.02;
    const cloudX = (cloud.x + bgOffset * 0.5 + drift * (0.5 + index * 0.1)) % 2000;
    const finalX = cloudX < 0 ? cloudX + 2000 : cloudX;
    const cx = finalX - 1000 + CANVAS_WIDTH / 2;
    const cy = cloud.y;

    ctx.save();
    for (let i = 0; i < 5; i++) {
      const offsetX = (i - 2) * (cloud.width * 0.4);
      const offsetY = Math.sin(i + index) * 5;
      const radius = cloud.width * (0.7 + Math.sin(i * 1.5 + index) * 0.1);

      const grad = ctx.createRadialGradient(
        cx + offsetX, cy + offsetY, 0,
        cx + offsetX, cy + offsetY, radius,
      );
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.4)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx + offsetX, cy + offsetY, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

function drawAurora(
  ctx: CanvasRenderingContext2D,
  auroras: AuroraData[],
  curve: number,
  bgOffset: number,
): void {
  const time = performance.now() * 0.001;
  ctx.save();
  auroras.forEach((aurora, i) => {
    const parallaxFactor = 0.05;
    const auroraX = (aurora.x - curve * 2 * parallaxFactor - bgOffset * parallaxFactor) % 3000;
    const finalX = auroraX < -1500 ? auroraX + 3000 : auroraX > 1500 ? auroraX - 3000 : auroraX;

    ctx.fillStyle = aurora.color;
    ctx.globalAlpha = 0.3 + Math.sin(time + i) * 0.1;

    ctx.beginPath();
    const baseWidth = aurora.width;
    const xPos = CANVAS_WIDTH / 2 + finalX;

    ctx.moveTo(xPos, 0);
    for (let y = 0; y <= aurora.height; y += 20) {
      const waveX = Math.sin(y * 0.01 + time + i) * 20;
      ctx.lineTo(xPos + waveX + baseWidth, y);
    }
    for (let y = aurora.height; y >= 0; y -= 20) {
      const waveX = Math.sin(y * 0.01 + time + i) * 20;
      ctx.lineTo(xPos + waveX, y);
    }
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}

function drawMountains(
  ctx: CanvasRenderingContext2D,
  mountains: MountainData[],
  curve: number,
  bgOffset: number,
  speed: number,
): void {
  mountains.forEach(mtn => {
    const parallaxFactor = (mtn.layer + 0.5) * 0.25 + (speed / MAX_SPEED) * 0.2;
    const mtnX = (mtn.x - curve * 5 * parallaxFactor - bgOffset * parallaxFactor) % 3000;
    const finalX = mtnX < -1500 ? mtnX + 3000 : mtnX > 1500 ? mtnX - 3000 : mtnX;

    ctx.fillStyle = mtn.color;
    ctx.beginPath();
    if (mtn.isIceberg) {
      ctx.moveTo(CANVAS_WIDTH / 2 + finalX, HORIZON_Y);
      ctx.lineTo(CANVAS_WIDTH / 2 + finalX + 20, HORIZON_Y - mtn.height);
      ctx.lineTo(CANVAS_WIDTH / 2 + finalX + mtn.width - 20, HORIZON_Y - mtn.height);
      ctx.lineTo(CANVAS_WIDTH / 2 + finalX + mtn.width, HORIZON_Y);
    } else {
      ctx.moveTo(CANVAS_WIDTH / 2 + finalX, HORIZON_Y);
      ctx.lineTo(CANVAS_WIDTH / 2 + finalX + mtn.width / 2, HORIZON_Y - mtn.height);
      ctx.lineTo(CANVAS_WIDTH / 2 + finalX + mtn.width, HORIZON_Y);
    }
    ctx.fill();

    if (!mtn.isIceberg) {
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2 + finalX + mtn.width / 2, HORIZON_Y - mtn.height);
      ctx.lineTo(CANVAS_WIDTH / 2 + finalX + mtn.width, HORIZON_Y);
      ctx.lineTo(CANVAS_WIDTH / 2 + finalX + mtn.width / 2 + 10, HORIZON_Y);
      ctx.fill();
    }
  });
}

function drawIceGround(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#F0F8FF';
  ctx.fillRect(0, HORIZON_Y, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON_Y);
}

function drawIceHillShadows(ctx: CanvasRenderingContext2D, s: EnvDrawState): void {
  ctx.strokeStyle = '#D0E0F0';
  ctx.lineWidth = 1;
  const shadowSpacing = 60;
  const shadowOffset = (s.distance * 10) % shadowSpacing;
  for (let z = 15000; z > 0; z -= shadowSpacing) {
    const effectiveZ = z + shadowOffset;
    if (effectiveZ > 2000 && z % (shadowSpacing * 2) !== 0) continue;
    if (effectiveZ > 5000 && z % (shadowSpacing * 4) !== 0) continue;

    const { py } = project(0, 0, effectiveZ, s.curveSegments, s.segmentOffset, s.cumulativeOffsets);
    if (py < HORIZON_Y) continue;

    ctx.beginPath();
    const roadLeft = project(-300, 0, effectiveZ, s.curveSegments, s.segmentOffset, s.cumulativeOffsets);
    for (let x = -2000; x < -300; x += 100) {
      const p1 = project(x, 0, effectiveZ, s.curveSegments, s.segmentOffset, s.cumulativeOffsets);
      const p2 = project(x + 50, 0, effectiveZ, s.curveSegments, s.segmentOffset, s.cumulativeOffsets);
      ctx.moveTo(p1.px, py);
      ctx.lineTo(Math.min(p2.px, roadLeft.px), py);
    }

    const roadRight = project(300, 0, effectiveZ, s.curveSegments, s.segmentOffset, s.cumulativeOffsets);
    for (let x = 300; x < 2000; x += 100) {
      const p1 = project(x + 50, 0, effectiveZ, s.curveSegments, s.segmentOffset, s.cumulativeOffsets);
      const p2 = project(x + 100, 0, effectiveZ, s.curveSegments, s.segmentOffset, s.cumulativeOffsets);
      ctx.moveTo(Math.max(p1.px, roadRight.px), py);
      ctx.lineTo(p2.px, py);
    }
    ctx.stroke();
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, s: EnvDrawState): void {
  ctx.fillStyle = '#E0F0FF';
  ctx.beginPath();

  for (let z = 0; z <= 15000; z += (z < 2000 ? 50 : z < 5000 ? 200 : 500)) {
    const { px, py } = project(-300, 0, z, s.curveSegments, s.segmentOffset, s.cumulativeOffsets);
    if (z === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  for (let z = 15000; z >= 0; z -= (z < 2000 ? 50 : z < 5000 ? 200 : 500)) {
    const { px, py } = project(300, 0, z, s.curveSegments, s.segmentOffset, s.cumulativeOffsets);
    ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawSea(ctx: CanvasRenderingContext2D, s: EnvDrawState): void {
  if (s.seaTransition <= 0.01) return;
  ctx.fillStyle = '#0000FF';
  const seaSide = s.seaType === 'LEFT' ? -1 : 1;

  ctx.beginPath();
  for (let z = 0; z <= 15000; z += (z < 2000 ? 50 : 500)) {
    const edgeX = seaSide * 300;
    const { px, py } = project(edgeX, 0, z, s.curveSegments, s.segmentOffset, s.cumulativeOffsets);

    const transitionOffset = (1 - s.seaTransition) * 1000 * seaSide;
    if (z === 0) ctx.moveTo(px + transitionOffset, py);
    else ctx.lineTo(px + transitionOffset, py);
  }
  ctx.lineTo(seaSide === 1 ? CANVAS_WIDTH : 0, HORIZON_Y);
  ctx.lineTo(seaSide === 1 ? CANVAS_WIDTH : 0, CANVAS_HEIGHT);
  ctx.closePath();
  ctx.fill();
}

function drawRoadLines(ctx: CanvasRenderingContext2D, s: EnvDrawState): void {
  ctx.strokeStyle = '#B0C4DE';
  ctx.lineWidth = 2;
  const lineSpacing = 200;
  const offset = (s.distance * 10) % lineSpacing;
  for (let z = 15000; z > 0; z -= (z < 2000 ? 100 : 400)) {
    const p1 = project(-300, 0, z + offset, s.curveSegments, s.segmentOffset, s.cumulativeOffsets);
    const p2 = project(300, 0, z + offset, s.curveSegments, s.segmentOffset, s.cumulativeOffsets);
    ctx.beginPath();
    ctx.moveTo(p1.px, p1.py);
    ctx.lineTo(p2.px, p2.py);
    ctx.stroke();
  }
}

function drawGoalGate(ctx: CanvasRenderingContext2D, s: EnvDrawState): void {
  if (s.distance >= 1000) return;
  const { px, py, scale } = project(0, 0, s.distance * 10, s.curveSegments, s.segmentOffset, s.cumulativeOffsets);
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(scale, scale);

  ctx.fillStyle = '#8B4513';
  ctx.fillRect(-250, -300, 60, 300);
  ctx.fillRect(190, -300, 60, 300);

  ctx.fillStyle = '#A0522D';
  ctx.fillRect(-260, -320, 520, 40);

  ctx.fillStyle = '#FFF';
  ctx.fillRect(-150, -280, 300, 60);
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 4;
  ctx.strokeRect(-150, -280, 300, 60);

  ctx.fillStyle = '#8B4513';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('石門國小', 0, -240);

  ctx.restore();
}
