// Pure combo logic. The "combo" is the player's running streak of fish
// collected without hitting any obstacle. Higher combos multiply points.

export interface ComboTier {
  /** Minimum streak to enter this tier. */
  minCount: number;
  /** Score multiplier applied to fish/flag points. */
  multiplier: number;
  /** Label to flash on screen. */
  label: string;
  /** HUD chip color (Tailwind class fragment). */
  color: string;
}

/** Tiers in ascending order — pick the largest whose minCount <= count. */
export const COMBO_TIERS: readonly ComboTier[] = [
  { minCount: 0,  multiplier: 1,  label: '',           color: '' },
  { minCount: 5,  multiplier: 2,  label: 'NICE!',      color: 'text-green-300 border-green-400/50' },
  { minCount: 10, multiplier: 3,  label: 'GREAT!',     color: 'text-yellow-300 border-yellow-400/60' },
  { minCount: 20, multiplier: 5,  label: 'AMAZING!',   color: 'text-orange-300 border-orange-400/60' },
  { minCount: 30, multiplier: 8,  label: 'INSANE!',    color: 'text-red-300 border-red-400/70' },
  { minCount: 50, multiplier: 15, label: 'GODLIKE!!!', color: 'text-pink-300 border-pink-400/80' },
];

/** Returns the active tier for a given combo count. */
export function getComboTier(count: number): ComboTier {
  let tier = COMBO_TIERS[0];
  for (const t of COMBO_TIERS) {
    if (count >= t.minCount) tier = t;
  }
  return tier;
}

/** Returns the multiplier applied to a fish/flag pickup at the given combo count. */
export function comboMultiplier(count: number): number {
  return getComboTier(count).multiplier;
}

/** Returns true if this count just crossed into a new tier (for animation triggers). */
export function justEnteredNewTier(prevCount: number, newCount: number): ComboTier | null {
  const prev = getComboTier(prevCount);
  const next = getComboTier(newCount);
  return next.minCount > prev.minCount ? next : null;
}
