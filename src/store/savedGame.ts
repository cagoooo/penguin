// Persists mid-game state so a player who accidentally closes the tab can
// resume from where they left off.
//
// IMPORTANT — anti-cheat constraint:
//   The saved blob is editable from DevTools, so we MUST NOT trust client-side
//   stored values for the leaderboard. We sanitize on load (cap values to
//   reasonable ranges) and we DELETE the save when GAME_OVER fires — meaning
//   any score that ends up uploaded to Firestore had to come from a single
//   played-through session.

import { STORAGE_KEYS } from './settings';

export interface SavedGame {
  /** ISO timestamp; saves older than 24h are discarded on load */
  savedAt: string;
  level: number;
  score: number;
  time: number;
  distance: number;
  speed: number;
  lives: number;
  fishCollected: number;
  shopPurchases: number;
  comboCount: number;
  /** sanity check — version field so future schema changes don't restore stale data */
  version: 1;
}

const MAX_LEVEL = 999;
const MAX_SCORE = 100_000_000;
const MAX_TIME = 999;
const MAX_DISTANCE = 100_000;
const MAX_LIVES = 99;

export function saveGame(s: Omit<SavedGame, 'savedAt' | 'version'>): void {
  if (typeof localStorage === 'undefined') return;
  // Don't persist a "trivial" save (e.g. the very first frame after init)
  if (s.score <= 0 && s.level <= 1 && s.fishCollected <= 0) return;
  const payload: SavedGame = {
    ...s,
    savedAt: new Date().toISOString(),
    version: 1,
  };
  try {
    localStorage.setItem(STORAGE_KEYS.savedGame, JSON.stringify(payload));
  } catch {
    // Quota / private mode — silently ignore
  }
}

export function loadSavedGame(): SavedGame | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.savedGame);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedGame>;

    // Schema check
    if (parsed.version !== 1) return null;

    // Discard saves older than 24 hours
    if (parsed.savedAt) {
      const age = Date.now() - new Date(parsed.savedAt).getTime();
      if (age > 24 * 60 * 60 * 1000 || age < 0) return null;
    } else {
      return null;
    }

    // Sanitize all numeric fields against tampering
    return {
      version: 1,
      savedAt: parsed.savedAt,
      level: clamp(parsed.level, 1, MAX_LEVEL),
      score: clamp(parsed.score, 0, MAX_SCORE),
      time: clamp(parsed.time, 0, MAX_TIME),
      distance: clamp(parsed.distance, 0, MAX_DISTANCE),
      speed: clamp(parsed.speed, 0, 200),
      lives: clamp(parsed.lives, 0, MAX_LIVES),
      fishCollected: clamp(parsed.fishCollected, 0, 99999),
      shopPurchases: clamp(parsed.shopPurchases, 0, 99),
      comboCount: clamp(parsed.comboCount, 0, 9999),
    };
  } catch {
    return null;
  }
}

export function clearSavedGame(): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(STORAGE_KEYS.savedGame); } catch { /* ignore */ }
}

function clamp(v: unknown, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : min;
  return Math.max(min, Math.min(max, n));
}
