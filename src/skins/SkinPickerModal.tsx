// Lazy-loaded skin picker. Locked skins show a hint about how to unlock them
// (kept generic — "神秘解鎖條件" — for the secret-tier skins so easter egg
// hints aren't given away).

import { motion, AnimatePresence } from 'motion/react';
import { SKINS, isSkinUnlocked, type SkinId } from './skins';
import type { AchievementId } from '../achievements/definitions';

interface Props {
  current: SkinId;
  onSelect: (id: SkinId) => void;
  unlockedAchievements: Set<AchievementId>;
  totalAchievements: number;
  onClose: () => void;
}

export default function SkinPickerModal({
  current, onSelect, unlockedAchievements, totalAchievements, onClose,
}: Props) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 10 }}
          onClick={e => e.stopPropagation()}
          className="bg-gradient-to-b from-[#1a1a3a] to-[#0a0a1a] border-2 border-purple-400/40 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <span>🎨</span> 換造型
            </h2>
            <button
              onClick={onClose}
              className="px-4 py-1 bg-white/10 hover:bg-white/20 rounded-full text-sm transition-all"
            >
              關閉
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SKINS.map(skin => {
              const unlocked = isSkinUnlocked(skin, unlockedAchievements, totalAchievements);
              const selected = current === skin.id;
              return (
                <button
                  key={skin.id}
                  onClick={() => unlocked && onSelect(skin.id)}
                  disabled={!unlocked}
                  className={`p-3 rounded-xl border-2 transition-all text-center ${
                    selected
                      ? 'border-purple-400 bg-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                      : unlocked
                      ? 'border-white/20 bg-white/5 hover:border-purple-400/50 cursor-pointer'
                      : 'border-white/10 bg-white/5 opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div className="text-4xl mb-1">{skin.emoji}</div>
                  <p className="font-bold text-sm">{skin.name}</p>
                  <p className="text-xs opacity-70 mt-0.5">{skin.description}</p>
                  {!unlocked && (
                    <p className="text-[10px] mt-2 opacity-60">🔒 {
                      skin.id === 'golden' ? '解開所有成就' :
                      skin.unlockAchievement === 'level-5' ? '解開冰原行者' :
                      skin.unlockAchievement === 'level-10' ? '解開極地勇者' :
                      '神秘解鎖條件'
                    }</p>
                  )}
                  {selected && (
                    <p className="text-[10px] mt-2 text-purple-300 font-bold">✓ 使用中</p>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-white/40 text-center mt-4">造型只是視覺，不影響玩法</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
