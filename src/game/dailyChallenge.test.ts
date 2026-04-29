import { describe, it, expect, beforeEach } from 'vitest';
import { getDailyChallenge, todayKey, recordDailyAttempt, loadDailyRecord } from './dailyChallenge';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem = (k: string) => this.store.get(k) ?? null;
  setItem = (k: string, v: string) => void this.store.set(k, v);
  removeItem = (k: string) => void this.store.delete(k);
  clear = () => this.store.clear();
}
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

describe('daily challenge', () => {
  beforeEach(() => localStorage.clear());

  it('returns a valid theme for any date', () => {
    const cfg = getDailyChallenge(new Date('2026-04-29'));
    expect(cfg.theme).toBeTruthy();
    expect(cfg.name.length).toBeGreaterThan(0);
    expect(cfg.bearRate).toBeGreaterThan(0);
    expect(cfg.scoreMultiplier).toBeGreaterThan(0);
  });

  it('same date always returns the same theme (deterministic)', () => {
    const a = getDailyChallenge(new Date('2026-04-29'));
    const b = getDailyChallenge(new Date('2026-04-29'));
    expect(a.theme).toBe(b.theme);
  });

  it('different dates can return different themes', () => {
    const themes = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 3, i + 1); // April 2026
      themes.add(getDailyChallenge(d).theme);
    }
    expect(themes.size).toBeGreaterThan(1); // at least 2 different themes in 30 days
  });

  it('todayKey produces YYYY-MM-DD format', () => {
    const key = todayKey(new Date('2026-04-29T15:30:00'));
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(key).toBe('2026-04-29');
  });

  it('record is empty at first', () => {
    const r = loadDailyRecord();
    expect(r.attempts).toBe(0);
    expect(r.bestScore).toBe(0);
    expect(r.bestLevel).toBe(1);
  });

  it('record tracks attempts and best score', () => {
    const r1 = recordDailyAttempt(5000, 3);
    expect(r1.attempts).toBe(1);
    expect(r1.bestScore).toBe(5000);
    expect(r1.bestLevel).toBe(3);

    const r2 = recordDailyAttempt(3000, 5);
    expect(r2.attempts).toBe(2);
    expect(r2.bestScore).toBe(5000); // kept higher
    expect(r2.bestLevel).toBe(5); // higher level

    const r3 = recordDailyAttempt(8000, 2);
    expect(r3.attempts).toBe(3);
    expect(r3.bestScore).toBe(8000); // new high
    expect(r3.bestLevel).toBe(5); // kept higher
  });
});
