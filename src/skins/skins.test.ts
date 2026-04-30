import { describe, it, expect } from 'vitest';
import { SKINS, getSkin, isSkinUnlocked } from './skins';
import type { AchievementId } from '../achievements/definitions';

describe('skins', () => {
  it('default skin always exists and is unlocked', () => {
    const def = getSkin('default');
    expect(def.id).toBe('default');
    expect(isSkinUnlocked(def, new Set(), 10)).toBe(true);
  });

  it('returns default for unknown skin id', () => {
    expect(getSkin('not-a-skin').id).toBe('default');
  });

  it('skins map to achievements correctly', () => {
    const scarf = getSkin('red-scarf');
    expect(scarf.unlockAchievement).toBe('level-5');

    const empty = new Set<AchievementId>();
    expect(isSkinUnlocked(scarf, empty, 10)).toBe(false);

    const withL5 = new Set<AchievementId>(['level-5']);
    expect(isSkinUnlocked(scarf, withL5, 10)).toBe(true);
  });

  it('golden requires ALL achievements', () => {
    const golden = getSkin('golden');
    const partial = new Set<AchievementId>(['level-5', 'level-10', 'god-mode']);
    expect(isSkinUnlocked(golden, partial, 10)).toBe(false);

    const allThirteen = new Set<AchievementId>([
      'first-clear', 'level-5', 'level-10', 'score-100k', 'score-1m',
      'god-mode', 'shop-spree', 'fish-feast', 'survivor', 'speedster',
      'combo-master', 'warp-master', 'king-slayer',
    ]);
    expect(isSkinUnlocked(golden, allThirteen, 13)).toBe(true);
  });

  it('all skins have unique ids', () => {
    const ids = new Set(SKINS.map(s => s.id));
    expect(ids.size).toBe(SKINS.length);
  });
});
