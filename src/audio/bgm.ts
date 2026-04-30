// 8-bit BGM tracks. Each entry is { f: frequencyHz, d: durationSeconds }.
// f === 0 represents silence. Multi-track: SKATERS_WALTZ (default) plus a
// rotating selection that the player can switch via the BGM picker.
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

// ---- TRACK 2: Carmen 〈鬥牛士進行曲〉 — bold 4/4 march ------------------
// Bizet 1875. Public domain. Punchier 8-bit feel for 緊張 levels.
const M = 0.16; // March: quarter-note base
export const CARMEN_TOREADOR: ReadonlyArray<{ f: number; d: number }> = [
  // Phrase A
  { f: 261.63, d: M * 0.5 }, { f: 293.66, d: M * 0.5 },
  { f: 329.63, d: M }, { f: 261.63, d: M },
  { f: 329.63, d: M * 0.5 }, { f: 392.00, d: M * 0.5 },
  { f: 329.63, d: M }, { f: 261.63, d: M },
  // Triplet flourish
  { f: 392.00, d: M * 0.5 }, { f: 349.23, d: M * 0.5 },
  { f: 329.63, d: M }, { f: 293.66, d: M },
  { f: 261.63, d: M * 2 },
  // Phrase B (echo, higher)
  { f: 523.25, d: M * 0.5 }, { f: 587.33, d: M * 0.5 },
  { f: 659.25, d: M }, { f: 523.25, d: M },
  { f: 659.25, d: M * 0.5 }, { f: 783.99, d: M * 0.5 },
  { f: 659.25, d: M }, { f: 523.25, d: M },
  { f: 783.99, d: M * 0.5 }, { f: 698.46, d: M * 0.5 },
  { f: 659.25, d: M }, { f: 587.33, d: M },
  { f: 523.25, d: M * 2 },
  // Climax
  { f: 392.00, d: M }, { f: 440.00, d: M },
  { f: 493.88, d: M }, { f: 523.25, d: M * 2 },
  { f: 0, d: M },
];

// ---- TRACK 3: 〈卡林卡〉 — Russian folk classic ------------------------
// Trad. 1860. Public domain. Speeds up at the end (we keep linear here).
const K = 0.14;
export const KALINKA: ReadonlyArray<{ f: number; d: number }> = [
  { f: 261.63, d: K }, { f: 261.63, d: K }, { f: 261.63, d: K * 2 },
  { f: 246.94, d: K }, { f: 220.00, d: K }, { f: 196.00, d: K * 2 },
  { f: 261.63, d: K }, { f: 261.63, d: K }, { f: 261.63, d: K * 2 },
  { f: 246.94, d: K }, { f: 220.00, d: K }, { f: 196.00, d: K * 2 },
  // Refrain
  { f: 392.00, d: K }, { f: 392.00, d: K }, { f: 440.00, d: K * 2 },
  { f: 493.88, d: K }, { f: 440.00, d: K }, { f: 392.00, d: K * 2 },
  { f: 349.23, d: K }, { f: 349.23, d: K }, { f: 392.00, d: K * 2 },
  { f: 440.00, d: K }, { f: 392.00, d: K }, { f: 349.23, d: K * 2 },
  // Energetic outro
  { f: 261.63, d: K * 0.5 }, { f: 329.63, d: K * 0.5 },
  { f: 392.00, d: K * 0.5 }, { f: 523.25, d: K * 0.5 },
  { f: 659.25, d: K * 2 },
  { f: 0, d: K },
];

export type BgmTrackId = 'skaters-waltz' | 'carmen' | 'kalinka';
export interface BgmTrack {
  id: BgmTrackId;
  name: string;
  description: string;
  notes: ReadonlyArray<{ f: number; d: number }>;
}
export const BGM_TRACKS: readonly BgmTrack[] = [
  { id: 'skaters-waltz', name: '溜冰圓舞曲', description: 'Konami NES 經典致敬', notes: SKATERS_WALTZ },
  { id: 'carmen', name: '鬥牛士進行曲', description: '比才《卡門》 · 緊張刺激', notes: CARMEN_TOREADOR },
  { id: 'kalinka', name: '卡林卡', description: '俄羅斯民謠 · 加速感', notes: KALINKA },
];

const STORAGE_KEY = 'penguin_bgm_v1';
export function loadBgmTrack(): BgmTrackId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && BGM_TRACKS.some(t => t.id === raw)) return raw as BgmTrackId;
  } catch { /* ignore */ }
  return 'skaters-waltz';
}
export function saveBgmTrack(id: BgmTrackId): void {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
}
export function getBgmTrack(id: BgmTrackId | string): BgmTrack {
  return BGM_TRACKS.find(t => t.id === id) ?? BGM_TRACKS[0];
}

let bgmTimer: ReturnType<typeof setTimeout> | null = null;
let bgmIndex = 0;
let bgmCurrentTrack: BgmTrackId = 'skaters-waltz';

export const startBGM = (trackId?: BgmTrackId): void => {
  if (bgmTimer) return;
  const id = trackId ?? loadBgmTrack();
  bgmCurrentTrack = id;
  const track = getBgmTrack(id).notes;
  const playNext = () => {
    const note = track[bgmIndex];
    if (note.f > 0) {
      playTone(note.f, 'square', note.d * 0.85, 0.04);
    }
    bgmIndex = (bgmIndex + 1) % track.length;
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

/** Switch tracks live. Stops current, starts the new one from the top. */
export const switchBGM = (id: BgmTrackId): void => {
  saveBgmTrack(id);
  if (bgmCurrentTrack === id && bgmTimer) return;
  const wasPlaying = bgmTimer !== null;
  stopBGM();
  if (wasPlaying) startBGM(id);
};
