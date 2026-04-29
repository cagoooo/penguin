// Build-time generator for the OG share preview (public/og-image.png) and
// the favicon (public/favicon-512.png + ICO entry). Run via:
//
//   node scripts/generate-og-image.mjs
//
// Outputs:
//   public/og-image.png         1200×630 social-share card
//   public/og-image-square.png  1200×1200 square fallback (LINE inline)
//
// We use English title + emoji to dodge CJK font availability issues across
// build environments. The SVG favicon is hand-crafted so we keep the existing
// public/favicon.svg.

import { Canvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

// ------------------- shared drawing primitives -----------------------------

function drawBackground(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0a1a4a');
  g.addColorStop(0.6, '#1a3a8a');
  g.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Snowy ground
  ctx.fillStyle = '#e8f4ff';
  ctx.beginPath();
  ctx.ellipse(w / 2, h + 80, w * 0.7, 140, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawAurora(ctx, w) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(0, 255, 136, 0)');
  g.addColorStop(0.5, 'rgba(0, 255, 170, 0.4)');
  g.addColorStop(1, 'rgba(0, 136, 255, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 130);
  ctx.quadraticCurveTo(w * 0.3, 50, w * 0.5, 110);
  ctx.quadraticCurveTo(w * 0.7, 170, w, 90);
  ctx.lineTo(w, 200);
  ctx.quadraticCurveTo(w * 0.7, 240, w * 0.5, 180);
  ctx.quadraticCurveTo(w * 0.3, 130, 0, 220);
  ctx.closePath();
  ctx.fill();
}

function drawStars(ctx) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  const stars = [
    [80, 60, 2.5], [180, 40, 1.8], [320, 70, 2.2], [430, 50, 1.5],
    [580, 90, 2], [780, 70, 2.3], [920, 50, 1.7], [1080, 90, 2.1],
    [1130, 40, 1.5], [50, 180, 1.5], [870, 30, 2], [1020, 130, 1.6],
  ];
  for (const [x, y, r] of stars) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPenguin(ctx, cx, cy, sizeMul = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(sizeMul, sizeMul);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 200, 130, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.ellipse(0, 50, 130, 165, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, 75, 88, 120, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.ellipse(0, -110, 110, 100, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, -90, 70, 65, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath(); ctx.arc(-30, -115, 13, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(30, -115, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-26, -119, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(34, -119, 4, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#ffae00';
  ctx.beginPath();
  ctx.moveTo(-22, -78);
  ctx.lineTo(22, -78);
  ctx.lineTo(0, -45);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#0a0a0a';
  ctx.save();
  ctx.translate(-115, 50);
  ctx.rotate(-0.25);
  ctx.beginPath();
  ctx.ellipse(0, 0, 25, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(115, 50);
  ctx.rotate(0.25);
  ctx.beginPath();
  ctx.ellipse(0, 0, 25, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#ffae00';
  ctx.beginPath(); ctx.ellipse(-40, 200, 38, 17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(40, 200, 38, 17, 0, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ------------------- 1200×630 OG card --------------------------------------

function buildOgCard() {
  const W = 1200, H = 630;
  const canvas = new Canvas(W, H);
  const ctx = canvas.getContext('2d');

  drawBackground(ctx, W, H);
  drawAurora(ctx, W);
  drawStars(ctx);
  drawPenguin(ctx, 230, 360, 1);

  // Title
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 88px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Penguin', 480, 140);
  ctx.fillStyle = '#67e8f9';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText('Antarctic Adventure', 480, 210);

  ctx.fillStyle = 'rgba(180, 220, 255, 0.7)';
  ctx.font = '24px sans-serif';
  ctx.fillText('A Konami 1983 Tribute · 阿凱老師 × antarctic', 480, 250);

  // Stat box
  const boxX = 480, boxY = 310, boxW = 660, boxH = 200;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  roundRect(ctx, boxX, boxY, boxW, boxH, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 3 hero stats
  const stats = [
    { label: 'OBSTACLES', value: '7+' },
    { label: 'POWERUPS', value: '16' },
    { label: 'ACHIEVEMENTS', value: '10' },
  ];
  stats.forEach((s, i) => {
    const x = boxX + 30 + i * 220;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '20px sans-serif';
    ctx.fillText(s.label, x, boxY + 50);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText(s.value, x, boxY + 130);
  });

  // CTA / footer
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('Play Free in Browser', 480, 555);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = '20px sans-serif';
  ctx.fillText('cagoooo.github.io/penguin', 480, 590);

  return canvas.toBuffer('image/png');
}

// ------------------- 1200×1200 square (LINE inline) ------------------------

function buildSquareCard() {
  const W = 1200, H = 1200;
  const canvas = new Canvas(W, H);
  const ctx = canvas.getContext('2d');
  drawBackground(ctx, W, H);
  drawAurora(ctx, W);
  drawStars(ctx);
  drawPenguin(ctx, W / 2, H / 2 - 80, 1.4);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 110px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PENGUIN', W / 2, H - 200);
  ctx.fillStyle = '#67e8f9';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('ANTARCTIC ADVENTURE', W / 2, H - 120);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '32px sans-serif';
  ctx.fillText('cagoooo.github.io/penguin', W / 2, H - 60);

  return canvas.toBuffer('image/png');
}

// ------------------- 512×512 favicon master --------------------------------

function buildFavicon() {
  const S = 512;
  const canvas = new Canvas(S, S);
  const ctx = canvas.getContext('2d');

  // Rounded square background
  const r = 72;
  ctx.fillStyle = '#0a1a4a';
  roundRect(ctx, 0, 0, S, S, r);
  ctx.fill();

  // Aurora glow
  const grad = ctx.createRadialGradient(S / 2, S * 0.35, S * 0.1, S / 2, S * 0.35, S * 0.7);
  grad.addColorStop(0, 'rgba(103, 232, 249, 0.4)');
  grad.addColorStop(1, 'rgba(103, 232, 249, 0)');
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, S, S, r);
  ctx.fill();

  // Snowy bottom
  ctx.fillStyle = '#e8f4ff';
  ctx.beginPath();
  ctx.ellipse(S / 2, S + 30, S * 0.7, 80, 0, 0, Math.PI * 2);
  ctx.fill();

  // Penguin
  drawPenguin(ctx, S / 2, S * 0.6, 1.4);

  return canvas.toBuffer('image/png');
}

// ------------------- main --------------------------------------------------

const outputs = [
  { path: 'public/og-image.png', buf: buildOgCard() },
  { path: 'public/og-image-square.png', buf: buildSquareCard() },
  { path: 'public/icon-512.png', buf: buildFavicon() },
];

for (const { path, buf } of outputs) {
  const full = resolve(root, path);
  writeFileSync(full, buf);
  const kb = (buf.length / 1024).toFixed(1);
  console.log(`✓ ${path} (${kb} KB)`);
}

console.log('\nDone. Commit the generated files.');
