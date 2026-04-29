import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACHIEVEMENTS,
  type AchievementDef,
  type AchievementId,
  getAchievement,
  loadUnlockedAchievements,
  saveUnlockedAchievements,
} from './definitions';

export interface AchievementToast {
  id: number;
  achievement: AchievementDef;
}

let toastCounter = 0;

export function useAchievements() {
  const [unlocked, setUnlocked] = useState<Set<AchievementId>>(() => loadUnlockedAchievements());
  const [toasts, setToasts] = useState<AchievementToast[]>([]);
  const unlockedRef = useRef(unlocked);

  // Keep ref in sync with state (post-render only)
  useEffect(() => {
    unlockedRef.current = unlocked;
  }, [unlocked]);

  const unlock = useCallback((id: AchievementId) => {
    if (unlockedRef.current.has(id)) return false;
    const def = getAchievement(id);
    if (!def) return false;
    const next = new Set(unlockedRef.current);
    next.add(id);
    unlockedRef.current = next;
    setUnlocked(next);
    saveUnlockedAchievements(next);
    const toastId = ++toastCounter;
    setToasts(prev => [...prev, { id: toastId, achievement: def }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 4000);
    return true;
  }, []);

  // Sync from localStorage on mount in case another tab unlocked something
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'penguin_achievements_v1') {
        setUnlocked(loadUnlockedAchievements());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { unlocked, unlock, toasts, all: ACHIEVEMENTS };
}
