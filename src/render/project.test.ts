import { describe, it, expect } from 'vitest';
import { project } from './project';

describe('project (pseudo-3D)', () => {
  const flat = Array.from({ length: 150 }, () => 0);
  const offsets = Array.from({ length: 151 }, () => ({ x: 0, dx: 0 }));

  it('returns horizon-aligned coords at z=0', () => {
    const p = project(0, 0, 0, flat, 0, offsets);
    expect(p.scale).toBe(1);
    expect(p.px).toBe(400); // CANVAS_WIDTH / 2
  });

  it('scale shrinks with distance', () => {
    const near = project(0, 0, 100, flat, 0, offsets);
    const far = project(0, 0, 1000, flat, 0, offsets);
    expect(far.scale).toBeLessThan(near.scale);
  });

  it('positive x moves player to the right of center', () => {
    const p = project(100, 0, 100, flat, 0, offsets);
    expect(p.px).toBeGreaterThan(400);
  });

  it('negative x moves player to the left of center', () => {
    const p = project(-100, 0, 100, flat, 0, offsets);
    expect(p.px).toBeLessThan(400);
  });

  it('falls back gracefully without precomputed offsets', () => {
    const p = project(0, 0, 100, flat, 0);
    expect(p.scale).toBeGreaterThan(0);
    expect(p.px).toBeCloseTo(400, 0);
  });
});
