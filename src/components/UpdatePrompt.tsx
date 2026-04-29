// PWA update / offline-ready toast.
//
// Per the `pwa-cache-bust` skill workflow, after locking down network-first
// for navigations we still want a visible cue when a new version is ready —
// so users with the page open know to click "更新" to get the latest code.
//
// vite-plugin-pwa exposes `useRegisterSW` which fires:
//   - offlineReady === true  ON FIRST INSTALL (page now works offline)
//   - needRefresh   === true  WHEN A NEW SW IS WAITING
// Calling updateServiceWorker(true) skipWaiting + reloads the page.

import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'motion/react';

export default function UpdatePrompt() {
  const [dismissed, setDismissed] = useState(false);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, reg) {
      // Poll every 60s for an updated SW so long-running tabs catch new builds
      if (!reg) return;
      setInterval(() => {
        reg.update().catch(() => {
          /* network might be flaky — try again later */
        });
      }, 60_000);
    },
    onRegisterError(err) {
      console.warn('[pwa] SW registration failed', err);
    },
  });

  // `show` is derived state — no setState-in-effect needed
  const show = !dismissed && (offlineReady || needRefresh);

  // Auto-hide the "ready offline" cue after 5s; the update cue stays until clicked
  useEffect(() => {
    if (!offlineReady || needRefresh || dismissed) return;
    const t = setTimeout(() => {
      setOfflineReady(false);
    }, 5000);
    return () => clearTimeout(t);
  }, [offlineReady, needRefresh, dismissed, setOfflineReady]);

  const close = () => {
    setDismissed(true);
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[2000] pointer-events-auto"
        >
          {needRefresh ? (
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 border-2 border-white/30 backdrop-blur-md rounded-full px-4 py-2 sm:px-5 sm:py-3 shadow-2xl flex items-center gap-3">
              <span className="text-2xl animate-pulse">✨</span>
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-bold text-white">新版本已就緒</span>
                <span className="text-[10px] text-white/80">點擊「更新」載入最新內容</span>
              </div>
              <button
                onClick={() => updateServiceWorker(true)}
                className="ml-2 px-3 py-1.5 bg-white text-blue-700 hover:bg-blue-50 rounded-full font-bold text-xs sm:text-sm transition-all active:scale-95 shadow"
              >
                更新
              </button>
              <button
                onClick={close}
                aria-label="關閉"
                className="text-white/70 hover:text-white text-lg leading-none px-1"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="bg-emerald-600/90 border-2 border-white/30 backdrop-blur-md rounded-full px-4 py-2 shadow-2xl flex items-center gap-2 text-white text-xs sm:text-sm">
              <span>✅</span>
              <span className="font-bold">已可離線遊玩</span>
              <button
                onClick={close}
                aria-label="關閉"
                className="text-white/70 hover:text-white text-lg leading-none px-1"
              >
                ×
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
