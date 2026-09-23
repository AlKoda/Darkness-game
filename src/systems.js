export const WORLD_SIZE = 2400;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createPlayer(role = 'human') {
  return {
    role,
    x: WORLD_SIZE / 2,
    y: WORLD_SIZE / 2,
    speed: role === 'monster' ? 190 : 170,
    health: 100,
    wood: 0,
    stone: 0,
    essence: 0,
    level: 1,
  };
}

export function cycleState(elapsed, duration = 120) {
  const progress = (elapsed % duration) / duration;
  const night = progress >= 0.55;
  return { progress, night, secondsLeft: Math.ceil(duration - (elapsed % duration)) };
}

export function canBuildCampfire(player) {
  return player.role === 'human' && player.wood >= 4 && player.stone >= 2;
}

export function spendCampfire(player) {
  if (!canBuildCampfire(player)) return false;
  player.wood -= 4;
  player.stone -= 2;
  return true;
}
