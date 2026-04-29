// Core game constants. Tweak these to rebalance.

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

/** Y-coordinate of the horizon line. Anything above is sky/mountains. */
export const HORIZON_Y = 250;

/** Player physics. */
export const MAX_SPEED = 40;
export const ACCELERATION = 0.1;
export const FRICTION = 0.05;
export const GRAVITY = 0.9;
export const JUMP_FORCE = -14;

/** Distance & timing. */
export const BASE_LEVEL_DISTANCE = 4200;
export const LEVEL_DISTANCE_MULTIPLIER = 1.15;
export const BASE_LEVEL_TIME_SECONDS = 30;

/** Lane positions in world units. -1 = left, 0 = center, 1 = right. */
export const LANE_PIXELS = 150;
