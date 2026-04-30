import { describe, it, expect, beforeEach } from 'vitest';
import {
  STORAGE_KEYS,
  exportSettings,
  exportSettingsJson,
  importSettings,
  clearAllSettings,
} from './settings';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem = (k: string) => this.store.get(k) ?? null;
  setItem = (k: string, v: string) => void this.store.set(k, v);
  removeItem = (k: string) => void this.store.delete(k);
  clear = () => this.store.clear();
  get length() { return this.store.size; }
  key = (i: number) => Array.from(this.store.keys())[i] ?? null;
}
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

describe('settings store', () => {
  beforeEach(() => localStorage.clear());

  it('exports nothing when storage is empty', () => {
    expect(exportSettings()).toEqual({});
  });

  it('exports only registered keys', () => {
    localStorage.setItem(STORAGE_KEYS.bestScore, '12345');
    localStorage.setItem(STORAGE_KEYS.muted, '1');
    localStorage.setItem('some_other_app_key', 'should-be-ignored');

    const out = exportSettings();
    expect(out[STORAGE_KEYS.bestScore]).toBe('12345');
    expect(out[STORAGE_KEYS.muted]).toBe('1');
    expect(out.some_other_app_key).toBeUndefined();
  });

  it('exports as valid JSON wrapped with metadata', () => {
    localStorage.setItem(STORAGE_KEYS.bestScore, '999');
    const json = exportSettingsJson();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.settings[STORAGE_KEYS.bestScore]).toBe('999');
    expect(typeof parsed.exportedAt).toBe('string');
  });

  it('round-trips export → import', () => {
    localStorage.setItem(STORAGE_KEYS.bestScore, '5555');
    localStorage.setItem(STORAGE_KEYS.playerName, '阿凱');
    const json = exportSettingsJson();

    localStorage.clear();
    expect(localStorage.getItem(STORAGE_KEYS.bestScore)).toBeNull();

    const ok = importSettings(json);
    expect(ok).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.bestScore)).toBe('5555');
    expect(localStorage.getItem(STORAGE_KEYS.playerName)).toBe('阿凱');
  });

  it('importSettings rejects garbage gracefully', () => {
    expect(importSettings('not-json')).toBe(false);
    expect(importSettings('{}')).toBe(false);
    expect(importSettings('{"settings":null}')).toBe(false);
  });

  it('importSettings ignores unknown keys', () => {
    importSettings(JSON.stringify({
      settings: { evil_key: 'lol', [STORAGE_KEYS.bestScore]: '777' },
    }));
    expect(localStorage.getItem('evil_key')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.bestScore)).toBe('777');
  });

  it('clearAllSettings wipes only registered keys', () => {
    localStorage.setItem(STORAGE_KEYS.bestScore, '1');
    localStorage.setItem(STORAGE_KEYS.muted, '0');
    localStorage.setItem('preserved_other_app', 'keep-me');

    clearAllSettings();
    expect(localStorage.getItem(STORAGE_KEYS.bestScore)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.muted)).toBeNull();
    expect(localStorage.getItem('preserved_other_app')).toBe('keep-me');
  });
});
