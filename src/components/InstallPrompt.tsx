// PWA "install to home screen" CTA.
//
// Lifecycle:
//   1. Browser fires `beforeinstallprompt` when the page meets PWA install
//      criteria (HTTPS + manifest + SW + not already installed).
//   2. We capture the event (call preventDefault to keep it in our pocket).
//   3. After the player has hit GAME_OVER or LEVEL_CLEAR at least once we show
//      a small toast with an install button.
//   4. Click → fire prompt.prompt(). User accepts or dismisses.
//   5. Either way: dismiss the toast and remember (so we don't nag).
//
// Already-installed users (display-mode: standalone) never see this.

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone } from 'lucide-react';
import { STORAGE_KEYS } from '../store/settings';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface Props {
  /** True when player just hit GAME_OVER or LEVEL_CLEAR at least once. */
  triggerVisible: boolean;
}

export default function InstallPrompt({ triggerVisible }: Props) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Capture the install prompt the moment the browser offers it
  useEffect(() => {
    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      // Stop showing once installed
      setDeferredPrompt(null);
      try { localStorage.setItem(STORAGE_KEYS.installPromptShown, 'installed'); } catch { /* ignore */ }
    };
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Already installed (running as PWA) — never show
  const isStandalone = typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
     // iOS Safari standalone marker
     (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

  // Previously dismissed
  const previouslySeen = (() => {
    try { return localStorage.getItem(STORAGE_KEYS.installPromptShown); } catch { return null; }
  })();

  const show = !!deferredPrompt && triggerVisible && !dismissed && !isStandalone && previouslySeen !== 'installed';

  const onInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      try { localStorage.setItem(STORAGE_KEYS.installPromptShown, choice.outcome); } catch { /* ignore */ }
    } catch (err) {
      console.warn('[install] prompt failed', err);
    }
    setDeferredPrompt(null);
    setDismissed(true);
  };

  const onDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(STORAGE_KEYS.installPromptShown, 'dismissed'); } catch { /* ignore */ }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1900] pointer-events-auto"
        >
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 border-2 border-white/30 backdrop-blur-md rounded-full px-4 py-2 sm:px-5 sm:py-3 shadow-2xl flex items-center gap-3">
            <Smartphone size={22} className="text-white" />
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm font-bold text-white">📱 加到主畫面</span>
              <span className="text-[10px] text-white/80">下次點圖示秒開、可離線玩</span>
            </div>
            <button
              onClick={onInstall}
              className="ml-2 px-3 py-1.5 bg-white text-emerald-700 hover:bg-emerald-50 rounded-full font-bold text-xs sm:text-sm transition-all active:scale-95 shadow"
            >
              安裝
            </button>
            <button
              onClick={onDismiss}
              aria-label="不要"
              className="text-white/70 hover:text-white text-lg leading-none px-1"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
