import { describe, it, expect, beforeEach } from 'vitest';
import { saveGame, loadSavedGame, clearSavedGame } from './savedGame';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem = (k: string) => this.store.get(k) ?? null;
  setItem = (k: string, v: string) => void this.store.set(k, v);
  removeItem = (k: string) => void this.store.delete(k);
  clear = () => this.store.clear();
}
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

const fresh = {
  level: 5,
  score: 12345,
  time: 30,
  distance: 1500,
  speed: 35,
  lives: 1,
  fishCollected: 20,
  shopPurchases: 2,
  comboCount: 7,
};

describe('savedGame', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a normal save', () => {
    saveGame(fresh);
    const loaded = loadSavedGame();
    expect(loaded).not.toBeNull();
    expect(loaded?.level).toBe(5);
    expect(loaded?.score).toBe(12345);
    expect(loaded?.fishCollected).toBe(20);
  });

  it('returns null when nothing is saved', () => {
    expect(loadSavedGame()).toBeNull();
  });

  it('refuses to save trivial init state', () => {
    saveGame({ ...fresh, level: 1, score: 0, fishCollected: 0 });
    expect(loadSavedGame()).toBeNull();
  });

  it('clamps tampered values to sane ranges', () => {
    // Manually inject a tampered save with absurd values
    localStorage.setItem('penguin_saved_game_v1', JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      level: 9999,
      score: 999_999_999_999,
      time: 99999,
      distance: -100,
      speed: 100000,
      lives: 999,
      fishCollected: 5,
      shopPurchases: 5,
      comboCount: 5,
    }));
    const loaded = loadSavedGame();
    expect(loaded?.level).toBeLessThanOrEqual(999);
    expect(loaded?.score).toBeLessThanOrEqual(100_000_000);
    expect(loaded?.distance).toBeGreaterThanOrEqual(0);
    expect(loaded?.lives).toBeLessThanOrEqual(99);
  });

  it('discards saves older than 24 hours', () => {
    localStorage.setItem('penguin_saved_game_v1', JSON.stringify({
      version: 1,
      savedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      ...fresh,
    }));
    expect(loadSavedGame()).toBeNull();
  });

  it('discards saves with wrong schema version', () => {
    localStorage.setItem('penguin_saved_game_v1', JSON.stringify({
      version: 99,
      savedAt: new Date().toISOString(),
      ...fresh,
    }));
    expect(loadSavedGame()).toBeNull();
  });

  it('handles malformed JSON gracefully', () => {
    localStorage.setItem('penguin_saved_game_v1', 'not-json');
    expect(loadSavedGame()).toBeNull();
  });

  it('clearSavedGame removes the entry', () => {
    saveGame(fresh);
    expect(loadSavedGame()).not.toBeNull();
    clearSavedGame();
    expect(loadSavedGame()).toBeNull();
  });
});
