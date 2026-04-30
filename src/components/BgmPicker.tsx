// Tiny inline BGM track picker. Lives next to the other START-screen buttons.
// Hover/click reveals the 3 tracks; pick one and it switches live.

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Music } from 'lucide-react';
import { BGM_TRACKS, switchBGM, type BgmTrackId } from '../audio/bgm';

interface Props {
  current: BgmTrackId;
  onChange: (id: BgmTrackId) => void;
}

export default function BgmPicker({ current, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const currentTrack = BGM_TRACKS.find(t => t.id === current) ?? BGM_TRACKS[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/30 rounded-full font-bold text-sm transition-all flex items-center gap-2"
      >
        <Music size={16} />
        音樂：{currentTrack.name}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Click-away */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 min-w-[240px] bg-gradient-to-b from-[#1a1a3a] to-[#0a0a1a] border-2 border-white/20 rounded-xl p-2 shadow-2xl"
            >
              {BGM_TRACKS.map(track => (
                <button
                  key={track.id}
                  onClick={() => {
                    onChange(track.id);
                    switchBGM(track.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                    current === track.id
                      ? 'bg-blue-500/30 border border-blue-400/50'
                      : 'hover:bg-white/10'
                  }`}
                >
                  <p className="font-bold text-sm">
                    {current === track.id && '✓ '}{track.name}
                  </p>
                  <p className="text-[10px] opacity-60">{track.description}</p>
                </button>
              ))}
              <p className="text-[9px] opacity-40 text-center mt-2">遊戲中也能切換</p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
