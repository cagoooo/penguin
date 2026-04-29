// Lightweight Vibration API wrapper. Tied to the audio mute toggle so users get
// a single "all feedback off" switch. Silently no-ops on iOS Safari (no Vibration API)
// and on desktop browsers — patterns won't error.

import { mutedRef } from '../audio/sounds';

function vibrate(pattern: number | number[]): void {
  if (mutedRef.current) return;
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw when the page hasn't been interacted with yet
  }
}

export const haptic = {
  /** Tiny tap — fish pickup, button press */
  light: () => vibrate(15),
  /** Medium thump — jump, lane change confirmed */
  medium: () => vibrate(35),
  /** Heavier — collision, stumble */
  strong: () => vibrate(80),
  /** 3-pulse celebration — flag pickup, achievement unlock */
  triple: () => vibrate([25, 40, 25, 40, 25]),
  /** Long buzz — game over */
  gameOver: () => vibrate([100, 60, 200]),
  /** Stop any ongoing pattern */
  cancel: () => vibrate(0),
};
