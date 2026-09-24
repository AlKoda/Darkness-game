export const WORLD_SIZE = 2400;
export const GRID_SIZE = 48;
export const HARVEST_DURATION = 420;

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

export const BUILDING_BOUNDS = {
  campfire: { halfWidth: 18, halfHeight: 14 },
  settlement: { halfWidth: 58, halfHeight: 54 },
  watchtower: { halfWidth: 25, halfHeight: 32 },
  wall: { halfWidth: 32, halfHeight: 12 },
};

export function snapToGrid(value, size = GRID_SIZE) {
  return Math.round(value / size) * size;
}

export function buildingBounds(building) {
  const base = BUILDING_BOUNDS[building.type];
  if (!base) return null;
  const rotated = building.type === 'wall' && building.rotation % 2;
  return {
    x: building.x,
    y: building.y,
    halfWidth: rotated ? base.halfHeight : base.halfWidth,
    halfHeight: rotated ? base.halfWidth : base.halfHeight,
  };
}

export function resourceBounds(resource) {
  if (resource.state === 'destroyed' || resource.state === 'falling') return null;
  if (resource.type === 'tree') {
    return resource.state === 'fallen'
      ? { x: resource.x, y: resource.y + 12, halfWidth: 29, halfHeight: 10 }
      : { x: resource.x, y: resource.y + 12, halfWidth: 17, halfHeight: 17 };
  }
  return { x: resource.x, y: resource.y, halfWidth: 17, halfHeight: 14 };
}

export function overlaps(a, b, padding = 0) {
  return Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth + padding
    && Math.abs(a.y - b.y) < a.halfHeight + b.halfHeight + padding;
}

export function canPlaceBuilding(candidate, resources = [], buildings = [], player = null) {
  const bounds = buildingBounds(candidate);
  if (!bounds) return false;
  if (bounds.x - bounds.halfWidth < 24 || bounds.y - bounds.halfHeight < 24
    || bounds.x + bounds.halfWidth > WORLD_SIZE - 24 || bounds.y + bounds.halfHeight > WORLD_SIZE - 24) return false;
  if (player && overlaps(bounds, { x: player.x, y: player.y, halfWidth: 10, halfHeight: 10 }, 8)) return false;
  return !resources.some(resource => {
    const obstacle = resourceBounds(resource);
    return obstacle && overlaps(bounds, obstacle, 7);
  }) && !buildings.some(building => overlaps(bounds, buildingBounds(building), 7));
}

export function moveWithCollisions(position, dx, dy, obstacles, radius = 10) {
  const result = { x: position.x, y: position.y };
  const collides = (x, y) => obstacles.some(obstacle => obstacle && overlaps(
    { x, y, halfWidth: radius, halfHeight: radius }, obstacle,
  ));
  const nextX = clamp(result.x + dx, radius, WORLD_SIZE - radius);
  if (!collides(nextX, result.y)) result.x = nextX;
  const nextY = clamp(result.y + dy, radius, WORLD_SIZE - radius);
  if (!collides(result.x, nextY)) result.y = nextY;
  return result;
}

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
