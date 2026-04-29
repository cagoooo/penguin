// Lazy AudioContext + tone synthesizer + sound effects.
// Module-level mutedRef survives re-renders and is shared with React state via setMuted.

import { haptic } from '../utils/haptics';

let audioCtx: AudioContext | null = null;

export const mutedRef = { current: false };
export const pausedRef = { current: false };

export const initAudio = (): void => {
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

export const playTone = (
  freq: number,
  type: OscillatorType,
  duration: number,
  volume: number = 0.1,
): void => {
  if (!audioCtx || mutedRef.current) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
};

export const sounds = {
  jump: () => {
    playTone(400, 'square', 0.2);
    haptic.medium();
  },
  fish: () => {
    playTone(800, 'sine', 0.1);
    setTimeout(() => playTone(1200, 'sine', 0.1), 50);
    haptic.light();
  },
  flag: () => {
    playTone(600, 'square', 0.1);
    setTimeout(() => playTone(900, 'square', 0.1), 50);
    setTimeout(() => playTone(1200, 'square', 0.1), 100);
    haptic.triple();
  },
  powerup: () => {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => playTone(500 + i * 200, 'sawtooth', 0.1, 0.05), i * 50);
    }
    haptic.triple();
  },
  hit: () => {
    playTone(100, 'sawtooth', 0.3, 0.2);
    haptic.strong();
  },
  clear: () => {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((n, i) => setTimeout(() => playTone(n, 'square', 0.3), i * 150));
    haptic.triple();
  },
  gameOver: () => {
    const notes = [440, 349.23, 329.63, 261.63];
    notes.forEach((n, i) => setTimeout(() => playTone(n, 'sawtooth', 0.5), i * 200));
    haptic.gameOver();
  },
  propeller: () => {
    playTone(60, 'sawtooth', 0.05, 0.15);
    // No haptic — too frequent, would buzz constantly while flying
  },
  start: () => {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((n, i) => setTimeout(() => playTone(n, 'square', 0.06, 0.06), i * 50));
    setTimeout(() => playTone(783.99, 'square', 0.6, 0.06), 200);
    haptic.light();
  },
  warn: () => {
    playTone(880, 'sine', 0.1, 0.05);
    haptic.light();
  },
};
