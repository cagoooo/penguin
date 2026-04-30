import { describe, it, expect } from 'vitest';
import { getSeasonalEvent, isEventActive } from './seasonalEvents';

describe('seasonal events', () => {
  it('Christmas window: Dec 18-31', () => {
    expect(getSeasonalEvent(new Date(2026, 11, 25)).id).toBe('christmas');
    expect(getSeasonalEvent(new Date(2026, 11, 18)).id).toBe('christmas');
    expect(getSeasonalEvent(new Date(2026, 11, 31)).id).toBe('christmas');
    expect(getSeasonalEvent(new Date(2026, 11, 17)).id).toBe('none');
  });

  it('Lunar New Year window: Jan 20+ or Feb up to 20', () => {
    expect(getSeasonalEvent(new Date(2026, 0, 20)).id).toBe('lunar-new-year');
    expect(getSeasonalEvent(new Date(2026, 1, 5)).id).toBe('lunar-new-year');
    expect(getSeasonalEvent(new Date(2026, 1, 20)).id).toBe('lunar-new-year');
    expect(getSeasonalEvent(new Date(2026, 0, 19)).id).toBe('none');
    expect(getSeasonalEvent(new Date(2026, 1, 21)).id).toBe('none');
  });

  it('Halloween window: Oct 25 - Nov 2', () => {
    expect(getSeasonalEvent(new Date(2026, 9, 25)).id).toBe('halloween');
    expect(getSeasonalEvent(new Date(2026, 9, 31)).id).toBe('halloween');
    expect(getSeasonalEvent(new Date(2026, 10, 2)).id).toBe('halloween');
    expect(getSeasonalEvent(new Date(2026, 10, 3)).id).toBe('none');
  });

  it('Summer break: July + August', () => {
    expect(getSeasonalEvent(new Date(2026, 6, 1)).id).toBe('summer-break');
    expect(getSeasonalEvent(new Date(2026, 7, 31)).id).toBe('summer-break');
    expect(getSeasonalEvent(new Date(2026, 5, 30)).id).toBe('none');
    expect(getSeasonalEvent(new Date(2026, 8, 1)).id).toBe('none');
  });

  it('regular days return none', () => {
    // March 15 — no event
    expect(getSeasonalEvent(new Date(2026, 2, 15)).id).toBe('none');
    expect(isEventActive(getSeasonalEvent(new Date(2026, 2, 15)))).toBe(false);
  });

  it('active events expose all required fields', () => {
    const xmas = getSeasonalEvent(new Date(2026, 11, 25));
    expect(xmas.name.length).toBeGreaterThan(0);
    expect(xmas.emoji.length).toBeGreaterThan(0);
    expect(xmas.fishBonus).toBeGreaterThan(0);
    expect(xmas.timeBonus).toBeGreaterThanOrEqual(0);
    expect(xmas.bannerColor.length).toBeGreaterThan(0);
  });

  it('isEventActive guards correctly', () => {
    expect(isEventActive(getSeasonalEvent(new Date(2026, 11, 25)))).toBe(true);
    expect(isEventActive(getSeasonalEvent(new Date(2026, 5, 1)))).toBe(false);
  });
});
