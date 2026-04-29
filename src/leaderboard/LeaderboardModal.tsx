// Lazy-loaded leaderboard modal. Pulls Firebase + the live subscription hook
// into its own chunk so the main bundle stays lean.

import { motion, AnimatePresence } from 'motion/react';
import { Trophy } from 'lucide-react';
import { useLeaderboard } from './useLeaderboard';

interface Props {
  onClose: () => void;
}

export default function LeaderboardModal({ onClose }: Props) {
  const { entries, loading, error } = useLeaderboard(true, 10);

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
          className="bg-gradient-to-b from-[#1a1a3a] to-[#0a0a1a] border-2 border-cyan-400/40 rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Trophy className="text-cyan-300" /> 全球排行榜
            </h2>
            <button
              onClick={onClose}
              className="px-4 py-1 bg-white/10 hover:bg-white/20 rounded-full text-sm transition-all"
            >
              關閉
            </button>
          </div>
          {loading && <p className="text-white/50 text-center py-8">載入中...</p>}
          {error && (
            <p className="text-red-300 text-sm py-4">⚠️ 連線失敗：{error.message}</p>
          )}
          {!loading && !error && entries.length === 0 && (
            <p className="text-white/50 text-center py-8">還沒有人上榜，當第一個吧！</p>
          )}
          {entries.length > 0 && (
            <ol className="space-y-1">
              {entries.map((entry, idx) => (
                <li
                  key={entry.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                    idx === 0
                      ? 'bg-yellow-500/20 border border-yellow-400/40'
                      : idx === 1
                      ? 'bg-gray-300/15 border border-gray-300/30'
                      : idx === 2
                      ? 'bg-orange-500/15 border border-orange-400/30'
                      : 'bg-white/5'
                  }`}
                >
                  <span className="font-mono w-7 text-center font-bold opacity-70 text-sm">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </span>
                  <span className="flex-1 truncate font-medium text-sm">{entry.name}</span>
                  <span className="text-xs opacity-60">L{entry.level}</span>
                  <span className="font-mono font-bold text-sm tabular-nums">
                    {entry.score.toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
