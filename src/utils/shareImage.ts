// Generate a 1200×630 social-share PNG for the player's run, using only
// vanilla Canvas (no html2canvas dep). Layout matches the OG image dimensions
// so it looks right when shared to LINE / Facebook / Threads.

interface ShareOpts {
  score: number;
  level: number;
  name?: string;
  isNewRecord?: boolean;
  bestScore?: number;
  achievementsCount?: number;
  achievementsTotal?: number;
}

const W = 1200;
const H = 630;

/** Render the share card to a Blob (PNG). */
export async function generateShareImage(opts: ShareOpts): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not supported');

  drawBackground(ctx);
  drawAurora(ctx);
  drawStars(ctx);
  drawPenguin(ctx, 230, 360);
  drawTitle(ctx, opts);
  drawScoreCard(ctx, opts);
  drawFooter(ctx);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png',
      0.95,
    );
  });
}

/**
 * Try Web Share API with a file attachment first; fall back to direct download.
 * Some browsers (notably iOS Safari) accept text+URL but not files — we detect that.
 */
export async function shareScore(blob: Blob, opts: ShareOpts): Promise<'shared' | 'downloaded'> {
  const filename = `penguin-${opts.score}.png`;
  const file = new File([blob], filename, { type: 'image/png' });
  const text = `我在「南極大冒險」拿到 ${opts.score.toLocaleString()} 分！🐧`;
  const url = 'https://cagoooo.github.io/penguin/';

  const shareData: ShareData & { files?: File[] } = { title: '南極大冒險', text, url };

  // Prefer file sharing when the browser supports it
  if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
    const dataWithFile = { ...shareData, files: [file] };
    if ((navigator.canShare as (d: typeof dataWithFile) => boolean)(dataWithFile)) {
      try {
        await (navigator.share as (d: typeof dataWithFile) => Promise<void>)(dataWithFile);
        return 'shared';
      } catch (err) {
        // User cancelled or share rejected — fall through to download
        if ((err as { name?: string })?.name === 'AbortError') {
          return 'shared'; // treat user-cancel as success
        }
      }
    } else if (navigator.share) {
      // Without file support, share text + URL only
      try {
        await navigator.share(shareData);
        return 'shared';
      } catch {
        // fall through
      }
    }
  }

  // Fallback: trigger a download
  const dataUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(dataUrl), 1000);
  return 'downloaded';
}

// ---- Drawing helpers -------------------------------------------------------

function drawBackground(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, '#0a1a4a');
  gradient.addColorStop(0.6, '#1a3a8a');
  gradient.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // Snow ground
  ctx.fillStyle = '#e8f4ff';
  ctx.beginPath();
  ctx.ellipse(W / 2, H + 80, W * 0.7, 140, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawAurora(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, 'rgba(0, 255, 136, 0)');
  grad.addColorStop(0.5, 'rgba(0, 255, 170, 0.4)');
  grad.addColorStop(1, 'rgba(0, 136, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 130);
  ctx.quadraticCurveTo(W * 0.3, 50, W * 0.5, 110);
  ctx.quadraticCurveTo(W * 0.7, 170, W, 90);
  ctx.lineTo(W, 200);
  ctx.quadraticCurveTo(W * 0.7, 240, W * 0.5, 180);
  ctx.quadraticCurveTo(W * 0.3, 130, 0, 220);
  ctx.closePath();
  ctx.fill();
}

function drawStars(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  const starPositions = [
    [80, 60, 2.5], [180, 40, 1.8], [320, 70, 2.2],
    [430, 50, 1.5], [580, 90, 2], [780, 70, 2.3],
    [920, 50, 1.7], [1080, 90, 2.1], [1130, 40, 1.5],
    [50, 180, 1.5], [870, 30, 2], [1020, 130, 1.6],
  ];
  for (const [x, y, r] of starPositions) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPenguin(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 200, 130, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body (black)
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.ellipse(0, 50, 130, 165, 0, 0, Math.PI * 2);
  ctx.fill();
  // White belly
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, 75, 88, 120, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head (black)
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.ellipse(0, -110, 110, 100, 0, 0, Math.PI * 2);
  ctx.fill();
  // Face white
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, -90, 70, 65, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath(); ctx.arc(-30, -115, 13, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(30, -115, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-26, -119, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(34, -119, 4, 0, Math.PI * 2); ctx.fill();
  // Beak
  ctx.fillStyle = '#ffae00';
  ctx.beginPath();
  ctx.moveTo(-22, -78);
  ctx.lineTo(22, -78);
  ctx.lineTo(0, -45);
  ctx.closePath();
  ctx.fill();
  // Wings
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
  // Feet
  ctx.fillStyle = '#ffae00';
  ctx.beginPath(); ctx.ellipse(-40, 200, 38, 17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(40, 200, 38, 17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawTitle(ctx: CanvasRenderingContext2D, opts: ShareOpts): void {
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 60px "Helvetica Neue", "Microsoft JhengHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('南極大冒險', 480, 110);

  ctx.fillStyle = 'rgba(180, 220, 255, 0.7)';
  ctx.font = '22px "Microsoft JhengHei", sans-serif';
  ctx.fillText('PENGUIN ANTARCTIC ADVENTURE', 480, 145);

  if (opts.name) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '28px "Microsoft JhengHei", sans-serif';
    ctx.fillText(`玩家：${opts.name}`, 480, 185);
  }

  if (opts.isNewRecord) {
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 32px "Microsoft JhengHei", sans-serif';
    ctx.fillText('✨ NEW RECORD ✨', 480, opts.name ? 230 : 200);
  }
}

function drawScoreCard(ctx: CanvasRenderingContext2D, opts: ShareOpts): void {
  // Score box
  const boxX = 480;
  const boxY = 270;
  const boxW = 660;
  const boxH = 240;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  roundRect(ctx, boxX, boxY, boxW, boxH, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // SCORE
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '20px "Microsoft JhengHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', boxX + 30, boxY + 50);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 96px ui-monospace, "SF Mono", Consolas, monospace';
  ctx.fillText(opts.score.toLocaleString(), boxX + 30, boxY + 140);

  // LEVEL  +  BEST
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '20px "Microsoft JhengHei", sans-serif';
  ctx.fillText('LEVEL', boxX + 30, boxY + 180);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 38px ui-monospace, monospace';
  ctx.fillText(`L${opts.level}`, boxX + 30, boxY + 215);

  if (opts.bestScore && opts.bestScore > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '20px "Microsoft JhengHei", sans-serif';
    ctx.fillText('BEST', boxX + 220, boxY + 180);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 38px ui-monospace, monospace';
    ctx.fillText(opts.bestScore.toLocaleString(), boxX + 220, boxY + 215);
  }

  if (opts.achievementsCount !== undefined && opts.achievementsTotal !== undefined) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '20px "Microsoft JhengHei", sans-serif';
    ctx.fillText('ACHIEVEMENTS', boxX + 460, boxY + 180);
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 38px ui-monospace, monospace';
    ctx.fillText(`${opts.achievementsCount}/${opts.achievementsTotal}`, boxX + 460, boxY + 215);
  }
}

function drawFooter(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = '22px "Microsoft JhengHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('cagoooo.github.io/penguin', 480, 580);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = '18px "Microsoft JhengHei", sans-serif';
  ctx.fillText('Made by 阿凱老師 × antarctic', 480, 605);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
