// All achievements are tracked in localStorage; no backend required.

export type AchievementId =
  | 'first-clear'
  | 'level-5'
  | 'level-10'
  | 'score-100k'
  | 'score-1m'
  | 'god-mode'
  | 'shop-spree'
  | 'fish-feast'
  | 'survivor'
  | 'speedster'
  | 'combo-master'
  | 'warp-master';

export interface AchievementDef {
  id: AchievementId;
  title: string;
  description: string;
  icon: string;
  /** Hidden from the list until unlocked. Players see only "???" so the easter egg
   *  retains its surprise. Description here will only render once unlocked. */
  secret?: boolean;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first-clear', title: '初登南極', description: '通過第 1 關', icon: '🐧' },
  { id: 'level-5', title: '冰原行者', description: '通過第 5 關', icon: '🏔️' },
  { id: 'level-10', title: '極地勇者', description: '通過第 10 關', icon: '🏆' },
  { id: 'score-100k', title: '十萬富翁', description: '單局得分超過 100,000', icon: '💎' },
  { id: 'score-1m', title: '百萬大亨', description: '單局得分超過 1,000,000', icon: '👑' },
  { id: 'god-mode', title: '上古祕技', description: '探索古老的傳說...', icon: '🌟', secret: true },
  { id: 'shop-spree', title: '購物狂', description: '單場購買 5 件以上補給', icon: '🛒' },
  { id: 'fish-feast', title: '魚之饗宴', description: '單局收集 50 條魚', icon: '🐟' },
  { id: 'survivor', title: '南極之心', description: '在第 7 關後仍存活', icon: '❄️' },
  { id: 'speedster', title: '極速企鵝', description: '達到 80 km/h 以上時速', icon: '⚡' },
  { id: 'combo-master', title: '連擊大師', description: '單局達成 30 連擊', icon: '🔥' },
  { id: 'warp-master', title: '時空旅人', description: '進入隱藏房間', icon: '🌟', secret: true },
];

const STORAGE_KEY = 'penguin_achievements_v1';

export function loadUnlockedAchievements(): Set<AchievementId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as AchievementId[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function saveUnlockedAchievements(set: Set<AchievementId>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // Ignore quota errors / privacy mode
  }
}

export function getAchievement(id: AchievementId): AchievementDef | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}
