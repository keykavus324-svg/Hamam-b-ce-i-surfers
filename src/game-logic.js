export const LANES = [-2.35, 0, 2.35];
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function moveLane(currentLane, direction) {
  return clamp(currentLane + Math.sign(direction), 0, LANES.length - 1);
}

export function scoreRun(distance, crumbs) {
  return Math.floor(distance) + crumbs * 25;
}

export function canAvoid(obstacleType, jumpTime, slideTime) {
  if (obstacleType === 'jump') return jumpTime > 0.22;
  if (obstacleType === 'slide') return slideTime > 0.16;
  return false;
}

export function nextSpawnDelay(rng = Math.random, difficulty = 1) {
  return Math.max(0.72, (1.48 + rng() * 0.5) / Math.min(difficulty, 1.8));
}
