// Penguin cosmetic skins. Each skin is unlocked by reaching an achievement
// (or default). Skins layer on top of the base penguin draw — the base body
// stays the same, skins just add accessories or color overlays.

import type { AchievementId } from '../achievements/definitions';

export type SkinId = 'default' | 'red-scarf' | 'sunglasses' | 'golden' | 'crown';

export interface SkinDef {
  id: SkinId;
  name: string;
  emoji: string;
  description: string;
  /** Achievement that unlocks this skin. `null` = always unlocked. */
  unlockAchievement: AchievementId | null;
}

export const SKINS: readonly SkinDef[] = [
  {
    id: 'default',
    name: '經典企鵝',
    emoji: '🐧',
    description: '最初的夥伴',
    unlockAchievement: null,
  },
  {
    id: 'red-scarf',
    name: '紅領巾',
    emoji: '🧣',
    description: '冰原行者的禦寒裝備',
    unlockAchievement: 'level-5',
  },
  {
    id: 'sunglasses',
    name: '酷企鵝',
    emoji: '😎',
    description: '極地的太陽超刺眼',
    unlockAchievement: 'level-10',
  },
  {
    id: 'crown',
    name: '王者企鵝',
    emoji: '👑',
    description: '上古祕技的傳說',
    unlockAchievement: 'god-mode',
  },
  {
    id: 'golden',
    name: '黃金企鵝',
    emoji: '✨',
    description: '達成所有成就才能解鎖',
    unlockAchievement: null, // Special: requires ALL achievements
  },
];

const STORAGE_KEY = 'penguin_skin_v1';

export function getSkin(id: SkinId | string): SkinDef {
  return SKINS.find(s => s.id === id) ?? SKINS[0];
}

export function loadSkin(): SkinId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && SKINS.some(s => s.id === raw)) {
      return raw as SkinId;
    }
  } catch {
    // Ignore storage errors
  }
  return 'default';
}

export function saveSkin(id: SkinId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Ignore quota errors
  }
}

/** "golden" requires the player to have unlocked every other achievement. */
export function isSkinUnlocked(skin: SkinDef, unlocked: Set<AchievementId>, totalAchievements: number): boolean {
  if (skin.id === 'default') return true;
  if (skin.id === 'golden') return unlocked.size >= totalAchievements;
  if (skin.unlockAchievement === null) return true;
  return unlocked.has(skin.unlockAchievement);
}

// ---- Canvas drawing --------------------------------------------------------

interface DrawCtx {
  isJumping: boolean;
  hasSkateboard: boolean;
  animFrame: number;
}

/**
 * Layer skin-specific decorations on top of the already-drawn base penguin.
 * Called inside the same save/translate/scale block as the body — coords are
 * relative to penguin centre at (0, 0).
 */
export function drawSkinAccessories(
  ctx: CanvasRenderingContext2D,
  skinId: SkinId,
  d: DrawCtx,
): void {
  switch (skinId) {
    case 'default':
      return;

    case 'red-scarf':
      drawRedScarf(ctx, d);
      return;

    case 'sunglasses':
      drawSunglasses(ctx, d);
      return;

    case 'crown':
      drawCrown(ctx, d);
      return;

    case 'golden':
      drawGoldenSheen(ctx, d);
      drawCrown(ctx, d); // Bonus: golden also gets a crown
      return;
  }
}

function drawRedScarf(ctx: CanvasRenderingContext2D, d: DrawCtx): void {
  if (d.hasSkateboard) return; // Hide while in horizontal skateboard pose
  const yBase = d.isJumping ? -25 : -20;
  // Wraparound at the neck
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.ellipse(0, yBase, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Trailing tail with subtle wind sway
  const sway = Math.sin(d.animFrame * 0.3) * 4;
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.moveTo(8, yBase);
  ctx.quadraticCurveTo(20 + sway, yBase + 12, 18 + sway, yBase + 26);
  ctx.lineTo(10 + sway, yBase + 24);
  ctx.quadraticCurveTo(12, yBase + 12, 0, yBase + 4);
  ctx.closePath();
  ctx.fill();
  // White stripe
  ctx.strokeStyle = '#fef2f2';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-20, yBase + 1);
  ctx.lineTo(20, yBase + 1);
  ctx.stroke();
}

function drawSunglasses(ctx: CanvasRenderingContext2D, d: DrawCtx): void {
  if (d.hasSkateboard) return;
  const eyeY = d.isJumping ? -75 : -65;
  ctx.fillStyle = '#0a0a0a';
  // Left lens
  ctx.beginPath();
  ctx.ellipse(-9, eyeY, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Right lens
  ctx.beginPath();
  ctx.ellipse(9, eyeY, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Bridge
  ctx.strokeStyle = '#0a0a0a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-2, eyeY);
  ctx.lineTo(2, eyeY);
  ctx.stroke();
  // Reflective highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.ellipse(-11, eyeY - 2, 2, 1.5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(7, eyeY - 2, 2, 1.5, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrown(ctx: CanvasRenderingContext2D, d: DrawCtx): void {
  if (d.hasSkateboard) return;
  const cy = d.isJumping ? -100 : -90;
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.moveTo(-15, cy + 10);
  ctx.lineTo(-15, cy);
  ctx.lineTo(-10, cy + 5);
  ctx.lineTo(-5, cy - 5);
  ctx.lineTo(0, cy + 5);
  ctx.lineTo(5, cy - 5);
  ctx.lineTo(10, cy + 5);
  ctx.lineTo(15, cy);
  ctx.lineTo(15, cy + 10);
  ctx.closePath();
  ctx.fill();
  // Outline
  ctx.strokeStyle = '#a16207';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Jewel
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(0, cy + 6, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawGoldenSheen(ctx: CanvasRenderingContext2D, d: DrawCtx): void {
  if (d.hasSkateboard) return;
  // Translucent gold gradient over the body so the silhouette still reads
  const gradient = ctx.createLinearGradient(0, -85, 0, 0);
  gradient.addColorStop(0, 'rgba(253, 224, 71, 0.55)');
  gradient.addColorStop(0.5, 'rgba(250, 204, 21, 0.35)');
  gradient.addColorStop(1, 'rgba(180, 130, 30, 0.25)');
  ctx.fillStyle = gradient;
  // Trace the same ellipse(s) as the body
  ctx.beginPath();
  if (d.isJumping) {
    ctx.ellipse(0, -45, 30, 50, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(0, -40, 35, 45, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  // Sparkle
  const sparkleAlpha = (Math.sin(d.animFrame * 0.5) + 1) / 2;
  ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + sparkleAlpha * 0.4})`;
  ctx.beginPath();
  ctx.arc(15, -55, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-12, -30, 1.5, 0, Math.PI * 2);
  ctx.fill();
}
