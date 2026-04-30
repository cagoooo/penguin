// Shared game types used across renderer + game loop.

export type ObstacleType =
  | 'CRACK' | 'SEAL' | 'HOLE'
  | 'FISH' | 'FLAG' | 'BLUE_FLAG' | 'JUMPING_FISH' | 'RAINBOW_FLAG'
  | 'SHOP_STATION' | 'ICE_PATCH' | 'SNOWDRIFT'
  | 'POLAR_BEAR' | 'ICEBERG'
  | 'WARP_FLAG' // 0.5%-chance hidden bonus-room portal (L5+)
  | 'SNOWBALL'; // L20 boss-only projectile from the Penguin King

export interface Obstacle {
  id: number;
  z: number; // Distance from player (0 to 2000)
  lane: number; // -1 (left), 0 (center), 1 (right)
  type: ObstacleType;
  collected?: boolean;
  onFire?: boolean;
  /** Dynamic lane offset (-1.5..1.5) for moving obstacles like POLAR_BEAR. */
  laneOffset?: number;
  /** Walking animation phase for POLAR_BEAR. */
  walkPhase?: number;
  fishY?: number;
  fishVy?: number;
  fishVx?: number;
  fishLaneOffset?: number;
  fishLaneDirection?: number;
  fishJumped?: boolean;
  color?: string;
}
