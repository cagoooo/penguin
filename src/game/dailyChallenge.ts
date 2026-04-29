// Daily challenge: a themed twist that everyone playing today shares.
// We don't fully seed every spawn (that'd require refactoring 30+ Math.random
// calls); instead a "theme" applies a small set of multipliers to the existing
// game so each day feels different without compromising determinism.
//
// Themes rotate by day-of-year so they're predictable but cycle.

export type DailyTheme =
  | 'CLASSIC'
  | 'BEAR_DAY'
  | 'ICEBERG_DAY'
  | 'GOLDEN_FISH'
  | 'TIME_BONUS'
  | 'SPEED_DEMON'
  | 'BLIZZARD_FRENZY'
  | 'COMBO_FRENZY';

export interface DailyChallengeConfig {
  theme: DailyTheme;
  /** Display name for UI */
  name: string;
  emoji: string;
  description: string;
  /** Multiplier on bear spawn rate (default 1) */
  bearRate: number;
  /** Multiplier on iceberg spawn rate */
  icebergRate: number;
  /** Multiplier on fish spawn rate */
  fishRate: number;
  /** Forces all fish to be gold (×3 chance) */
  goldFishBoost: boolean;
  /** Multiplier on starting time */
  timeMultiplier: number;
  /** Multiplier on starting speed */
  speedMultiplier: number;
  /** Multiplier on blizzard frequency */
  blizzardRate: number;
  /** Combo levels keep their own multipliers, but score gets a bonus baseline */
  scoreMultiplier: number;
}

const THEMES: readonly DailyChallengeConfig[] = [
  {
    theme: 'CLASSIC',
    name: '經典日',
    emoji: '🐧',
    description: '無特殊修正，純粹比技術',
    bearRate: 1, icebergRate: 1, fishRate: 1, goldFishBoost: false,
    timeMultiplier: 1, speedMultiplier: 1, blizzardRate: 1, scoreMultiplier: 1,
  },
  {
    theme: 'BEAR_DAY',
    name: '北極熊日',
    emoji: '🐻‍❄️',
    description: '北極熊出現率 +50%，撞死可獲 ×2 分',
    bearRate: 1.5, icebergRate: 1, fishRate: 1, goldFishBoost: false,
    timeMultiplier: 1, speedMultiplier: 1, blizzardRate: 1, scoreMultiplier: 1,
  },
  {
    theme: 'ICEBERG_DAY',
    name: '冰山日',
    emoji: '🏔️',
    description: '冰山變多 +50%，多 +30% 起始時間',
    bearRate: 1, icebergRate: 1.5, fishRate: 1, goldFishBoost: false,
    timeMultiplier: 1.3, speedMultiplier: 1, blizzardRate: 1, scoreMultiplier: 1,
  },
  {
    theme: 'GOLDEN_FISH',
    name: '黃金魚日',
    emoji: '✨',
    description: '所有魚都是金魚，分數 ×1.5',
    bearRate: 1, icebergRate: 1, fishRate: 1.3, goldFishBoost: true,
    timeMultiplier: 1, speedMultiplier: 1, blizzardRate: 1, scoreMultiplier: 1.5,
  },
  {
    theme: 'TIME_BONUS',
    name: '時間充裕日',
    emoji: '⏰',
    description: '起始時間 ×1.5，慢慢享受',
    bearRate: 1, icebergRate: 1, fishRate: 1, goldFishBoost: false,
    timeMultiplier: 1.5, speedMultiplier: 1, blizzardRate: 1, scoreMultiplier: 1,
  },
  {
    theme: 'SPEED_DEMON',
    name: '極速日',
    emoji: '⚡',
    description: '起始速度 ×1.5，但時間只有 80%',
    bearRate: 1, icebergRate: 1, fishRate: 1, goldFishBoost: false,
    timeMultiplier: 0.8, speedMultiplier: 1.5, blizzardRate: 1, scoreMultiplier: 1.2,
  },
  {
    theme: 'BLIZZARD_FRENZY',
    name: '暴風雪日',
    emoji: '🌨️',
    description: '從第 1 關就有暴風雪，難度爆表，分數 ×2',
    bearRate: 1, icebergRate: 1, fishRate: 1, goldFishBoost: false,
    timeMultiplier: 1.2, speedMultiplier: 1, blizzardRate: 5, scoreMultiplier: 2,
  },
  {
    theme: 'COMBO_FRENZY',
    name: '連擊狂熱日',
    emoji: '🔥',
    description: '魚變多 ×1.5，所有 combo 倍率再 +1',
    bearRate: 1, icebergRate: 1, fishRate: 1.5, goldFishBoost: false,
    timeMultiplier: 1, speedMultiplier: 1, blizzardRate: 1, scoreMultiplier: 1,
  },
];

/** Returns YYYY-MM-DD in the local timezone. */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Day-of-year, 1-based. */
function dayOfYear(d: Date = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Returns the daily challenge config for the given date (defaults to today). */
export function getDailyChallenge(d: Date = new Date()): DailyChallengeConfig {
  const idx = dayOfYear(d) % THEMES.length;
  return THEMES[idx];
}

const STORAGE_KEY = 'penguin_daily_v1';

interface DailyAttemptRecord {
  date: string;
  attempts: number;
  bestScore: number;
  bestLevel: number;
}

export function loadDailyRecord(): DailyAttemptRecord {
  const today = todayKey();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DailyAttemptRecord;
      if (parsed.date === today) return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return { date: today, attempts: 0, bestScore: 0, bestLevel: 1 };
}

export function saveDailyRecord(rec: DailyAttemptRecord): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
  } catch {
    // ignore quota errors
  }
}

/** Apply a fresh attempt result, returning the updated record. */
export function recordDailyAttempt(score: number, level: number): DailyAttemptRecord {
  const cur = loadDailyRecord();
  const next: DailyAttemptRecord = {
    date: cur.date,
    attempts: cur.attempts + 1,
    bestScore: Math.max(cur.bestScore, score),
    bestLevel: Math.max(cur.bestLevel, level),
  };
  saveDailyRecord(next);
  return next;
}
