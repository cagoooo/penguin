import { describe, it, expect } from 'vitest';
import { COMBO_TIERS, getComboTier, comboMultiplier, justEnteredNewTier } from './combo';

describe('combo system', () => {
  it('tiers are ordered by minCount ascending', () => {
    for (let i = 1; i < COMBO_TIERS.length; i++) {
      expect(COMBO_TIERS[i].minCount).toBeGreaterThan(COMBO_TIERS[i - 1].minCount);
    }
  });

  it('multipliers strictly increase per tier', () => {
    for (let i = 1; i < COMBO_TIERS.length; i++) {
      expect(COMBO_TIERS[i].multiplier).toBeGreaterThan(COMBO_TIERS[i - 1].multiplier);
    }
  });

  it('zero combo gives ×1 multiplier', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(4)).toBe(1);
  });

  it('combo tiers fire at the right thresholds', () => {
    expect(comboMultiplier(5)).toBe(2);
    expect(comboMultiplier(9)).toBe(2);
    expect(comboMultiplier(10)).toBe(3);
    expect(comboMultiplier(20)).toBe(5);
    expect(comboMultiplier(30)).toBe(8);
    expect(comboMultiplier(50)).toBe(15);
    expect(comboMultiplier(999)).toBe(15); // Caps at top tier
  });

  it('detects tier crossings', () => {
    expect(justEnteredNewTier(4, 5)?.label).toBe('NICE!');
    expect(justEnteredNewTier(9, 10)?.label).toBe('GREAT!');
    expect(justEnteredNewTier(5, 6)).toBeNull();
    expect(justEnteredNewTier(0, 0)).toBeNull();
    expect(justEnteredNewTier(49, 50)?.label).toBe('GODLIKE!!!');
  });

  it('getComboTier always returns a tier (no undefined)', () => {
    expect(getComboTier(0)).toBeTruthy();
    expect(getComboTier(99999)).toBeTruthy();
  });
});
