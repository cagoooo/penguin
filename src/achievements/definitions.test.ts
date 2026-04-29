import { describe, it, expect, beforeEach } from 'vitest';
import {
  ACHIEVEMENTS,
  getAchievement,
  loadUnlockedAchievements,
  saveUnlockedAchievements,
} from './definitions';

// Stub localStorage for Node test env
class MemoryStorage {
  private store = new Map<string, string>();
  getItem = (k: string) => this.store.get(k) ?? null;
  setItem = (k: string, v: string) => void this.store.set(k, v);
  removeItem = (k: string) => void this.store.delete(k);
  clear = () => this.store.clear();
}
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

describe('achievements', () => {
  beforeEach(() => localStorage.clear());

  it('has 10 unique achievements with non-empty titles', () => {
    expect(ACHIEVEMENTS).toHaveLength(10);
    const ids = new Set(ACHIEVEMENTS.map(a => a.id));
    expect(ids.size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.icon.length).toBeGreaterThan(0);
    }
  });

  it('getAchievement looks up by id', () => {
    expect(getAchievement('first-clear')?.title).toBe('初登南極');
    expect(getAchievement('god-mode')?.icon).toBe('🌟');
  });

  it('round-trips saved achievements', () => {
    const initial = loadUnlockedAchievements();
    expect(initial.size).toBe(0);

    const set = new Set<'first-clear' | 'god-mode'>(['first-clear', 'god-mode']);
    saveUnlockedAchievements(set);

    const reloaded = loadUnlockedAchievements();
    expect(reloaded.size).toBe(2);
    expect(reloaded.has('first-clear')).toBe(true);
    expect(reloaded.has('god-mode')).toBe(true);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('penguin_achievements_v1', 'not-json');
    expect(() => loadUnlockedAchievements()).not.toThrow();
    expect(loadUnlockedAchievements().size).toBe(0);
  });
});
