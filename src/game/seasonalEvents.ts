// Seasonal events that auto-activate based on the calendar.
//
// Each event provides:
//   - A subtle banner on the START screen
//   - Optional gameplay tweaks (extra time, fish bonus, etc.)
//
// We keep ranges flexible (a few days each side of the actual holiday) so
// players who pick up the game during the festive week always see the theme.

export type SeasonalEventId =
  | 'none'
  | 'christmas'
  | 'lunar-new-year'
  | 'spring-vacation'
  | 'summer-break'
  | 'mid-autumn'
  | 'halloween';

export interface SeasonalEvent {
  id: SeasonalEventId;
  name: string;
  emoji: string;
  description: string;
  bannerColor: string;     // Tailwind class fragment for gradient
  /** Multiplier applied to all fish points during the event */
  fishBonus: number;
  /** Extra seconds added to starting time */
  timeBonus: number;
}

const NONE: SeasonalEvent = {
  id: 'none', name: '', emoji: '', description: '',
  bannerColor: '', fishBonus: 1, timeBonus: 0,
};

/**
 * Detect the active seasonal event for the given date (defaults to today).
 * Order matters — earlier in the function = higher priority on overlapping ranges.
 */
export function getSeasonalEvent(d: Date = new Date()): SeasonalEvent {
  const m = d.getMonth() + 1; // 1-12
  const day = d.getDate();

  // 🎄 Christmas — Dec 18-31
  if (m === 12 && day >= 18) {
    return {
      id: 'christmas',
      name: '聖誕節限定',
      emoji: '🎄',
      description: '收魚分數 ×1.5，起始時間 +5 秒',
      bannerColor: 'from-red-600/30 to-emerald-600/30 border-red-400',
      fishBonus: 1.5,
      timeBonus: 5,
    };
  }

  // 🧧 Lunar New Year — varies year-to-year. Approximate window: late Jan to mid Feb.
  // Detection: month is Jan (after the 20th) or Feb (before the 20th)
  if ((m === 1 && day >= 20) || (m === 2 && day <= 20)) {
    return {
      id: 'lunar-new-year',
      name: '農曆新年',
      emoji: '🧧',
      description: '收到的紅旗多 50%，分數 ×2',
      bannerColor: 'from-red-600/40 to-yellow-500/30 border-yellow-400',
      fishBonus: 2,
      timeBonus: 0,
    };
  }

  // 🎃 Halloween — Oct 25 to Nov 2
  if ((m === 10 && day >= 25) || (m === 11 && day <= 2)) {
    return {
      id: 'halloween',
      name: '萬聖節',
      emoji: '🎃',
      description: '北極熊 +50% 出現率，撞死獎勵 ×2',
      bannerColor: 'from-orange-600/30 to-purple-700/30 border-orange-400',
      fishBonus: 1,
      timeBonus: 0,
    };
  }

  // 🌕 Mid-Autumn / 中秋 — approximate (Sep 15 to Oct 5)
  if ((m === 9 && day >= 15) || (m === 10 && day <= 5)) {
    return {
      id: 'mid-autumn',
      name: '中秋節',
      emoji: '🌕',
      description: '夜晚天氣機率提高',
      bannerColor: 'from-amber-600/30 to-indigo-700/30 border-amber-400',
      fishBonus: 1,
      timeBonus: 3,
    };
  }

  // 🌸 Spring vacation — Apr 1 to Apr 7 (Tomb Sweeping holiday window in TW)
  if (m === 4 && day >= 1 && day <= 7) {
    return {
      id: 'spring-vacation',
      name: '春假',
      emoji: '🌸',
      description: '時間 +10 秒、放鬆玩',
      bannerColor: 'from-pink-500/30 to-emerald-500/30 border-pink-400',
      fishBonus: 1,
      timeBonus: 10,
    };
  }

  // 🌊 Summer break — Jul 1 to Aug 31
  if ((m === 7) || (m === 8)) {
    return {
      id: 'summer-break',
      name: '暑假',
      emoji: '🌊',
      description: '魚分數 ×1.3，每天好天氣',
      bannerColor: 'from-cyan-500/30 to-yellow-500/30 border-cyan-400',
      fishBonus: 1.3,
      timeBonus: 0,
    };
  }

  return NONE;
}

export function isEventActive(event: SeasonalEvent): boolean {
  return event.id !== 'none';
}
