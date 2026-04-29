import { describe, it, expect } from 'vitest';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HORIZON_Y,
  MAX_SPEED,
  ACCELERATION,
  GRAVITY,
  JUMP_FORCE,
  BASE_LEVEL_DISTANCE,
  LEVEL_DISTANCE_MULTIPLIER,
  LANE_PIXELS,
} from './constants';

describe('game constants', () => {
  it('canvas dimensions are sane', () => {
    expect(CANVAS_WIDTH).toBeGreaterThan(0);
    expect(CANVAS_HEIGHT).toBeGreaterThan(0);
    expect(HORIZON_Y).toBeGreaterThan(0);
    expect(HORIZON_Y).toBeLessThan(CANVAS_HEIGHT);
  });

  it('physics: gravity pulls down, jump pushes up', () => {
    expect(GRAVITY).toBeGreaterThan(0);
    expect(JUMP_FORCE).toBeLessThan(0);
  });

  it('player can reach a positive max speed', () => {
    expect(MAX_SPEED).toBeGreaterThan(0);
    expect(ACCELERATION).toBeGreaterThan(0);
  });

  it('level distance grows by ~15% per level', () => {
    expect(LEVEL_DISTANCE_MULTIPLIER).toBeCloseTo(1.15, 3);
    // After 5 levels distance should roughly double
    const after5 = BASE_LEVEL_DISTANCE * LEVEL_DISTANCE_MULTIPLIER ** 5;
    expect(after5).toBeGreaterThan(BASE_LEVEL_DISTANCE);
    expect(after5).toBeLessThan(BASE_LEVEL_DISTANCE * 3);
  });

  it('lanes are spaced wide enough for the penguin (~40 wide) to fit', () => {
    expect(LANE_PIXELS).toBeGreaterThan(40);
  });
});
