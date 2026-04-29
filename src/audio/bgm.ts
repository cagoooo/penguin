// 8-bit Skater's Waltz score (Konami Antarctic Adventure NES tribute).
// Each entry is { f: frequencyHz, d: durationSeconds }. f === 0 represents silence.
import { playTone } from './sounds';

/** Base unit: eighth note in 3/4 time. */
const T = 0.12;

export const SKATERS_WALTZ: ReadonlyArray<{ f: number; d: number }> = [
  // Main Theme (A)
  { f: 392.00, d: T }, { f: 440.00, d: T }, { f: 493.88, d: T },
  { f: 523.25, d: T * 6 },
  { f: 587.33, d: T * 6 },
  { f: 493.88, d: T * 2 }, { f: 392.00, d: T * 4 },
  { f: 392.00, d: T * 6 },

  { f: 349.23, d: T }, { f: 392.00, d: T }, { f: 440.00, d: T },
  { f: 493.88, d: T * 6 },
  { f: 523.25, d: T * 6 },
  { f: 440.00, d: T * 2 }, { f: 349.23, d: T * 4 },
  { f: 349.23, d: T * 6 },

  { f: 329.63, d: T }, { f: 349.23, d: T }, { f: 392.00, d: T },
  { f: 440.00, d: T * 6 },
  { f: 493.88, d: T * 6 },
  { f: 392.00, d: T * 2 }, { f: 329.63, d: T * 4 },
  { f: 329.63, d: T * 6 },

  { f: 293.66, d: T * 2 }, { f: 392.00, d: T * 4 },
  { f: 261.63, d: T * 6 },
  { f: 261.63, d: T * 6 },

  // Bridge (B)
  { f: 392.00, d: T }, { f: 392.00, d: T }, { f: 392.00, d: T },
  { f: 392.00, d: T }, { f: 329.63, d: T }, { f: 261.63, d: T },
  { f: 392.00, d: T * 6 },

  { f: 349.23, d: T }, { f: 349.23, d: T }, { f: 349.23, d: T },
  { f: 349.23, d: T }, { f: 293.66, d: T }, { f: 246.94, d: T },
  { f: 349.23, d: T * 6 },

  { f: 329.63, d: T }, { f: 329.63, d: T }, { f: 329.63, d: T },
  { f: 329.63, d: T }, { f: 261.63, d: T }, { f: 196.00, d: T },
  { f: 329.63, d: T * 6 },

  { f: 293.66, d: T }, { f: 293.66, d: T }, { f: 293.66, d: T },
  { f: 293.66, d: T }, { f: 246.94, d: T }, { f: 196.00, d: T },
  { f: 293.66, d: T * 6 },

  // Descending Theme (C)
  { f: 523.25, d: T * 6 },
  { f: 493.88, d: T * 6 },
  { f: 440.00, d: T * 6 },
  { f: 392.00, d: T * 6 },
  { f: 349.23, d: T * 6 },
  { f: 329.63, d: T * 6 },
  { f: 293.66, d: T * 6 },
  { f: 392.00, d: T * 6 },
  { f: 392.00, d: T * 6 },
];

let bgmTimer: ReturnType<typeof setTimeout> | null = null;
let bgmIndex = 0;

export const startBGM = (): void => {
  if (bgmTimer) return;
  const playNext = () => {
    const note = SKATERS_WALTZ[bgmIndex];
    if (note.f > 0) {
      // Slightly shorter duration (85%) for staccato feel + low volume for square wave
      playTone(note.f, 'square', note.d * 0.85, 0.04);
    }
    bgmIndex = (bgmIndex + 1) % SKATERS_WALTZ.length;
    bgmTimer = setTimeout(playNext, note.d * 1000);
  };
  playNext();
};

export const stopBGM = (): void => {
  if (bgmTimer) {
    clearTimeout(bgmTimer);
    bgmTimer = null;
    bgmIndex = 0;
  }
};
