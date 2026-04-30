import { describe, it, expect } from 'vitest';
import { BGM_TRACKS, getBgmTrack, SKATERS_WALTZ, CARMEN_TOREADOR, KALINKA } from './bgm';

describe('BGM tracks', () => {
  it('exposes 3 tracks', () => {
    expect(BGM_TRACKS).toHaveLength(3);
  });

  it('every track has notes with positive durations', () => {
    for (const track of BGM_TRACKS) {
      expect(track.notes.length).toBeGreaterThan(0);
      for (const note of track.notes) {
        expect(note.d).toBeGreaterThan(0);
        expect(note.f).toBeGreaterThanOrEqual(0); // 0 = silence
      }
    }
  });

  it('track ids match exposed constants', () => {
    expect(getBgmTrack('skaters-waltz').notes).toBe(SKATERS_WALTZ);
    expect(getBgmTrack('carmen').notes).toBe(CARMEN_TOREADOR);
    expect(getBgmTrack('kalinka').notes).toBe(KALINKA);
  });

  it('falls back to first track for unknown id', () => {
    const fallback = getBgmTrack('not-a-real-track');
    expect(fallback).toBe(BGM_TRACKS[0]);
  });

  it('every track has Chinese display name + description', () => {
    for (const track of BGM_TRACKS) {
      expect(track.name.length).toBeGreaterThan(0);
      expect(track.description.length).toBeGreaterThan(0);
    }
  });
});
