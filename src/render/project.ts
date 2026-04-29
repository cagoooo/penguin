// Pseudo-3D perspective projection.
//
// Converts world coordinates (x, y, z) into screen coordinates (px, py) plus a
// depth-derived `scale` factor used by all rendering. The optional
// `cumulativeOffsets` array is precomputed each frame so per-segment math runs
// in O(1) instead of O(N).
import { CANVAS_WIDTH, HORIZON_Y } from '../game/constants';

export interface Projected {
  px: number;
  py: number;
  scale: number;
}

export interface CumulativeOffset {
  x: number;
  dx: number;
}

export function project(
  x: number,
  y: number,
  z: number,
  segments: number[],
  segmentOffset: number,
  cumulativeOffsets?: CumulativeOffset[],
): Projected {
  const scale = 1 / (z / 500 + 1);
  const segmentLength = 100;
  let totalXOffset = 0;

  if (cumulativeOffsets && cumulativeOffsets.length > 0) {
    const segIndex = Math.floor(z / segmentLength);
    const cappedIndex = Math.min(segIndex, segments.length - 1);
    const offset = cumulativeOffsets[cappedIndex];

    if (offset) {
      const zInSegment = z - cappedIndex * segmentLength;
      const curvatureScale = 2 / 10000;
      const curvature = segments[cappedIndex] * curvatureScale;

      totalXOffset = offset.x + offset.dx * zInSegment + 0.5 * curvature * zInSegment * zInSegment;
    } else {
      totalXOffset = 0;
    }
  } else {
    // Fallback path — rebuild from scratch (slower; only used when offsets aren't precomputed)
    let currentDx = 0;
    let currentZ = 0;
    const curvatureScale = 2 / 10000;

    for (let i = 0; i < segments.length; i++) {
      const effectiveSegLen = i === 0 ? Math.max(0, segmentLength - segmentOffset) : segmentLength;
      const segZ = currentZ + effectiveSegLen;
      const zInSegment = Math.min(z, segZ) - currentZ;
      if (zInSegment <= 0) break;
      const curvature = segments[i] * curvatureScale;
      totalXOffset += currentDx * zInSegment + 0.5 * curvature * zInSegment * zInSegment;
      currentDx += curvature * zInSegment;
      currentZ = segZ;
      if (z <= segZ) break;
    }
  }

  const px = CANVAS_WIDTH / 2 + (x + totalXOffset) * scale;
  const py = HORIZON_Y + (290 + y) * scale;
  return { px, py, scale };
}
