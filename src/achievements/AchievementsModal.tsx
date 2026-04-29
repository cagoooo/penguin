// Lazy-loaded achievements list. Hidden ("secret") achievements that haven't
// been unlocked render as "???" so easter-egg hints stay hidden.

import { motion, AnimatePresence } from 'motion/react';
import { Trophy } from 'lucide-react';
import type { AchievementDef, AchievementId } from './definitions';

interface Props {
  unlocked: Set<AchievementId>;
  all: readonly AchievementDef[];
  onClose: () => void;
}

export default function AchievementsModal({ unlocked, all, onClose }: Props) {
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
          className="bg-gradient-to-b from-[#1a1a3a] to-[#0a0a1a] border-2 border-blue-500/40 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Trophy className="text-yellow-400" /> 成就 ({unlocked.size}/{all.length})
            </h2>
            <button
              onClick={onClose}
              className="px-4 py-1 bg-white/10 hover:bg-white/20 rounded-full text-sm transition-all"
            >
              關閉
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {all.map(a => {
              const isUnlocked = unlocked.has(a.id);
              const hideContent = !!a.secret && !isUnlocked;
              return (
                <div
                  key={a.id}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    isUnlocked
                      ? 'border-yellow-400/50 bg-yellow-500/10'
                      : 'border-white/10 bg-white/5 opacity-50'
                  }`}
                >
                  <div className={`text-3xl mb-1 ${isUnlocked ? '' : 'grayscale'}`}>
                    {hideContent ? '❓' : a.icon}
                  </div>
                  <p className="font-bold text-sm">{hideContent ? '???' : a.title}</p>
                  <p className="text-xs opacity-70">{hideContent ? '???' : a.description}</p>
                  {!isUnlocked && <p className="text-[10px] mt-1 opacity-50">🔒 未解鎖</p>}
                </div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
