// First-time-only PLAYING overlay that explains controls.
//
// Sequence (each pulses for ~3s, then fades):
//   1. ←→ 切換車道
//   2. ↑ 跳躍（or 點擊）
//   3. 長按加速 (mobile only)
//
// Once the player has finished a single tutorial, we set
// STORAGE_KEYS.onboardingDone so they never see it again.

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, ArrowUp, Smartphone } from 'lucide-react';
import { STORAGE_KEYS } from '../store/settings';

interface Props {
  /** Only show during PLAYING (caller passes gameState === 'PLAYING') */
  active: boolean;
}

type Step = 'lanes' | 'jump' | 'hold' | 'done';

export default function OnboardingHints({ active }: Props) {
  const [step, setStep] = useState<Step>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.onboardingDone) === '1' ? 'done' : 'lanes';
    } catch {
      return 'done';
    }
  });

  useEffect(() => {
    if (!active || step === 'done') return;
    const transitions: Record<Exclude<Step, 'done'>, Step> = {
      lanes: 'jump',
      jump: 'hold',
      hold: 'done',
    };
    const t = setTimeout(() => {
      const next = transitions[step];
      setStep(next);
      if (next === 'done') {
        try { localStorage.setItem(STORAGE_KEYS.onboardingDone, '1'); } catch { /* private mode */ }
      }
    }, 3500);
    return () => clearTimeout(t);
  }, [active, step]);

  if (!active || step === 'done') return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
      <AnimatePresence mode="wait">
        {step === 'lanes' && (
          <motion.div
            key="lanes"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-black/65 backdrop-blur-md border-2 border-white/30 rounded-2xl px-6 py-4 flex flex-col items-center gap-2"
          >
            <div className="flex items-center gap-3 text-3xl sm:text-4xl">
              <motion.span animate={{ x: [-8, 0, -8] }} transition={{ repeat: Infinity, duration: 1 }}>
                <ChevronLeft size={40} />
              </motion.span>
              <span className="text-base sm:text-lg font-bold">切換車道</span>
              <motion.span animate={{ x: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1 }}>
                <ChevronRight size={40} />
              </motion.span>
            </div>
            <p className="text-[10px] sm:text-xs opacity-70">鍵盤 ←→ · 手機左右滑</p>
          </motion.div>
        )}
        {step === 'jump' && (
          <motion.div
            key="jump"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-black/65 backdrop-blur-md border-2 border-blue-300/40 rounded-2xl px-6 py-4 flex flex-col items-center gap-2"
          >
            <motion.div animate={{ y: [-6, 0, -6] }} transition={{ repeat: Infinity, duration: 0.9 }}>
              <ArrowUp size={44} className="text-blue-300" />
            </motion.div>
            <span className="text-base sm:text-lg font-bold">跳躍</span>
            <p className="text-[10px] sm:text-xs opacity-70">鍵盤 ↑ / Space · 手機上滑或點擊</p>
          </motion.div>
        )}
        {step === 'hold' && (
          <motion.div
            key="hold"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-black/65 backdrop-blur-md border-2 border-yellow-300/40 rounded-2xl px-6 py-4 flex flex-col items-center gap-2"
          >
            <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.9 }}>
              <Smartphone size={40} className="text-yellow-300" />
            </motion.div>
            <span className="text-base sm:text-lg font-bold">長按加速</span>
            <p className="text-[10px] sm:text-xs opacity-70">按住畫面持續加速；放開減速</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
