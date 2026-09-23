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
    insideSettlement: false,
  };
}

export const SETTLEMENT_COST = { wood: 8, stone: 6 };
export const BUILDINGS = {
  campfire: { wood: 4, stone: 2 },
  settlement: SETTLEMENT_COST,
  watchtower: { wood: 6, stone: 4 },
  wall: { wood: 2, stone: 2 },
};

export function canAfford(player, type) {
  const cost = BUILDINGS[type];
  return Boolean(cost && player.role === 'human' && player.wood >= cost.wood && player.stone >= cost.stone);
}

export function spendBuilding(player, type) {
  if (!canAfford(player, type)) return false;
  const cost = BUILDINGS[type];
  player.wood -= cost.wood;
  player.stone -= cost.stone;
  return true;
}

export function createResource(type, x, y) {
  return {
    type,
    x,
    y,
    state: type === 'tree' ? 'standing' : 'whole',
    hits: 0,
    stateChangedAt: 0,
    respawnAt: 0,
    shakeUntil: 0,
  };
}

export function strikeResource(resource, now = 0) {
  if (resource.state === 'falling' || resource.state === 'destroyed') return { hit: false };
  resource.hits += 1;
  resource.shakeUntil = now + 160;

  if (resource.type === 'tree' && resource.state === 'standing' && resource.hits >= 3) {
    resource.state = 'falling';
    resource.hits = 0;
    resource.stateChangedAt = now;
    return { hit: true, felled: true };
  }

  if (resource.type === 'tree' && resource.state === 'standing') return { hit: true };

  const requiredHits = resource.type === 'tree' ? 2 : 3;
  if (resource.hits >= requiredHits) {
    resource.state = 'destroyed';
    resource.hits = 0;
    resource.stateChangedAt = now;
    resource.respawnAt = now + 12000;
    return { hit: true, collected: resource.type === 'tree' ? { wood: 4 } : { stone: 3 } };
  }
  return { hit: true };
}

export function updateResourceState(resource, now) {
  if (resource.state === 'falling' && now - resource.stateChangedAt >= 650) {
    resource.state = 'fallen';
    resource.stateChangedAt = now;
  } else if (resource.state === 'destroyed' && now >= resource.respawnAt) {
    resource.state = resource.type === 'tree' ? 'standing' : 'whole';
    resource.hits = 0;
  }
  return resource.state;
}

export function cycleState(elapsed, duration = 120) {
  const progress = (elapsed % duration) / duration;
  const night = progress >= 0.55;
  return { progress, night, secondsLeft: Math.ceil(duration - (elapsed % duration)) };
}

export function canBuildCampfire(player) {
  return canAfford(player, 'campfire');
}

export function spendCampfire(player) {
  return spendBuilding(player, 'campfire');
}

export function canBuildSettlement(player) {
  return canAfford(player, 'settlement');
}

export function spendSettlement(player) {
  return spendBuilding(player, 'settlement');
}
