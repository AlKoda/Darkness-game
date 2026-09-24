import {
  BUILDINGS, GRID_SIZE, HARVEST_DURATION, WORLD_SIZE, buildingBounds, canAfford,
  canPlaceBuilding, createPlayer, createResource, cycleState, moveWithCollisions,
  resourceBounds, snapToGrid, spendBuilding, strikeResource, updateResourceState,
} from './systems.js';
import { ART_DATA } from './art-data.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const ui = {
  hero: document.querySelector('#hero'), hud: document.querySelector('#hud'), event: document.querySelector('#event'),
  role: document.querySelector('#role-label'), portrait: document.querySelector('#portrait'), health: document.querySelector('#health-bar'),
  wood: document.querySelector('#wood'), stone: document.querySelector('#stone'), essence: document.querySelector('#essence'), essenceWrap: document.querySelector('#essence-wrap'),
  cycle: document.querySelector('#cycle-label'), cycleBar: document.querySelector('#cycle-bar'), clock: document.querySelector('#clock'),
  objective: document.querySelector('#objective'), buildbar: document.querySelector('#buildbar'), buildHint: document.querySelector('#build-hint'),
};
const assetPaths = {
  human: ART_DATA.human, monster: './public/assets/characters/monster.svg',
  tree: ART_DATA.tree, rock: ART_DATA.rock, ground: ART_DATA.ground,
  campfire: ART_DATA.campfire, settlement: ART_DATA.settlement,
  watchtower: './public/assets/buildings/watchtower.svg', wall: './public/assets/buildings/wall.svg',
};
const sprites = {};
function removeSheetBackdrop(image) {
  const buffer = document.createElement('canvas');
  buffer.width = image.naturalWidth; buffer.height = image.naturalHeight;
  const bufferCtx = buffer.getContext('2d', { willReadFrequently: true });
  bufferCtx.drawImage(image, 0, 0);
  const pixels = bufferCtx.getImageData(0, 0, buffer.width, buffer.height);
  const seen = new Uint8Array(buffer.width * buffer.height); const queue = [];
  const add = (x, y) => { const point = y * buffer.width + x; if (!seen[point]) { seen[point] = 1; queue.push(point); } };
  for (let x = 0; x < buffer.width; x += 1) { add(x, 0); add(x, buffer.height - 1); }
  for (let y = 0; y < buffer.height; y += 1) { add(0, y); add(buffer.width - 1, y); }
  while (queue.length) {
    const point = queue.pop(); const offset = point * 4;
    const dark = Math.max(pixels.data[offset], pixels.data[offset + 1], pixels.data[offset + 2]) < 28;
    if (!dark) continue;
    pixels.data[offset + 3] = 0;
    const x = point % buffer.width; const y = Math.floor(point / buffer.width);
    if (x) add(x - 1, y); if (x + 1 < buffer.width) add(x + 1, y);
    if (y) add(x, y - 1); if (y + 1 < buffer.height) add(x, y + 1);
  }
  bufferCtx.putImageData(pixels, 0, 0); return buffer;
}
Object.entries(assetPaths).forEach(([name, src]) => {
  const image = new Image(); sprites[name] = image;
  image.addEventListener('load', () => { if (ART_DATA[name]) sprites[name] = removeSheetBackdrop(image); }, { once: true });
  image.src = src;
});

let player = null; let startedAt = 0; let lastTime = performance.now();
let camera = { x: 0, y: 0 }; let facing = { x: 0, y: 1 }; let action = null; let placement = null;
const keys = new Set(); const buildings = [];
const particles = Array.from({ length: 70 }, (_, i) => ({ x: (i * 349) % WORLD_SIZE, y: (i * 197) % WORLD_SIZE, s: i % 3 + 1 }));
const resources = Array.from({ length: 90 }, (_, i) => createResource(i % 3 ? 'tree' : 'rock', 100 + (i * 277) % (WORLD_SIZE - 200), 100 + (i * 431) % (WORLD_SIZE - 200)));

function resize() {
  const dpr = Math.min(devicePixelRatio, 2); canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
}
function showEvent(title, copy) {
  document.querySelector('#event-title').textContent = title; document.querySelector('#event-copy').textContent = copy;
  ui.event.classList.remove('hidden'); clearTimeout(showEvent.timer); showEvent.timer = setTimeout(() => ui.event.classList.add('hidden'), 2600);
}
function start(role) {
  player = createPlayer(role); startedAt = performance.now(); ui.hero.classList.add('leaving');
  setTimeout(() => { ui.hero.classList.add('hidden'); ui.hud.classList.remove('hidden'); }, 450);
  ui.role.textContent = role === 'human' ? 'HUMAN · LEVEL 1' : 'MONSTER · WHELP'; ui.portrait.textContent = role === 'human' ? 'H' : 'M';
  ui.portrait.className = `portrait ${role}`; ui.essenceWrap.style.display = role === 'monster' ? '' : 'none'; ui.buildbar.classList.toggle('hidden', role !== 'human');
  showEvent(role === 'human' ? 'A FIRE AWAITS' : 'THE HUNT BEGINS', role === 'human' ? 'Gather supplies, then build on the grid.' : 'Absorb essence. Evolve.');
}
function nearestResource() {
  let nearest = null; let distance = 72;
  for (const resource of resources) {
    if (resource.state === 'destroyed' || resource.state === 'falling') continue;
    const d = Math.hypot(resource.x - player.x, resource.y - player.y);
    if (d < distance) { nearest = resource; distance = d; }
  }
  return nearest;
}
function completeHarvest(now) {
  if (!action || action.kind !== 'harvest' || now < action.endsAt) return;
  const target = action.target; action = null;
  if (target.state === 'destroyed' || target.state === 'falling' || Math.hypot(target.x - player.x, target.y - player.y) > 78) return;
  const result = strikeResource(target, now);
  if (result.felled) showEvent('TIMBER!', 'The trunk is down. Chop it twice to collect wood.');
  if (!result.collected) return;
  if (player.role === 'human') { player.wood += result.collected.wood || 0; player.stone += result.collected.stone || 0; }
  else player.essence += target.type === 'tree' ? 1 : 2;
  showEvent(result.collected.wood ? 'WOOD COLLECTED' : 'STONE COLLECTED', result.collected.wood ? '+4 wood — gathered after the final swing.' : '+3 stone — gathered after the final strike.');
}
function interact() {
  if (!player || action || placement) return;
  const home = buildings.find(b => b.type === 'settlement' && Math.hypot(b.x - player.x, b.y - player.y) < 82);
  if (home && player.role === 'human') { player.insideSettlement = !player.insideSettlement; showEvent(player.insideSettlement ? 'WELCOME HOME' : 'BACK TO THE WILD', player.insideSettlement ? 'Sheltered and slowly healing.' : 'Your settlement will be waiting.'); return; }
  const target = nearestResource(); if (!target) return;
  action = { kind: 'harvest', target, startedAt: performance.now(), endsAt: performance.now() + HARVEST_DURATION };
}
function beginPlacement(type) {
  if (!player || player.role !== 'human') return;
  if (!canAfford(player, type)) { const c = BUILDINGS[type]; showEvent('MORE MATERIALS NEEDED', `${c.wood} wood + ${c.stone} stone required.`); return; }
  const distance = type === 'settlement' ? 96 : 72;
  placement = { type, x: snapToGrid(player.x + facing.x * distance), y: snapToGrid(player.y + facing.y * distance), rotation: 0 };
  ui.buildHint.classList.remove('hidden');
}
function cancelPlacement() { placement = null; ui.buildHint.classList.add('hidden'); }
function placedBounds() { return buildings.map(buildingBounds); }
function placementValid() { return placement && canPlaceBuilding(placement, resources, buildings, player); }
function confirmPlacement() {
  if (!placement) return;
  if (!placementValid()) { showEvent('BLOCKED', 'Move the blueprint to a clear grid tile.'); return; }
  if (!spendBuilding(player, placement.type)) { cancelPlacement(); return; }
  const built = { ...placement, foundedAt: performance.now(), phase: performance.now() % 6000 }; buildings.push(built);
  showEvent(`${placement.type.toUpperCase()} BUILT`, 'Placed securely on the building grid.'); cancelPlacement();
}
function obstacleBounds() { return [...resources.map(resourceBounds).filter(Boolean), ...placedBounds()]; }
function update(dt, now) {
  if (!player) return; resources.forEach(resource => updateResourceState(resource, now)); completeHarvest(now);
  let dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  let dy = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  if (dx && dy) { dx *= .707; dy *= .707; } if (dx || dy) facing = { x: dx, y: dy };
  if (!player.insideSettlement && !action) Object.assign(player, moveWithCollisions(player, dx * player.speed * dt, dy * player.speed * dt, obstacleBounds()));
  else if (player.insideSettlement) player.health = Math.min(100, player.health + dt * 5);
  camera.x += (player.x - innerWidth / 2 - camera.x) * Math.min(1, dt * 7); camera.y += (player.y - innerHeight / 2 - camera.y) * Math.min(1, dt * 7);
  const cycle = cycleState((now - startedAt) / 1000); const fires = buildings.filter(b => b.type === 'campfire'); const towers = buildings.filter(b => b.type === 'watchtower');
  if (cycle.night && player.role === 'human' && !player.insideSettlement && !fires.some(f => Math.hypot(f.x - player.x, f.y - player.y) < 145) && !towers.some(t => Math.hypot(t.x - player.x, t.y - player.y) < 190)) player.health = Math.max(0, player.health - dt * 2.5);
  ui.health.style.width = `${player.health}%`; ui.wood.textContent = player.wood; ui.stone.textContent = player.stone; ui.essence.textContent = player.essence;
  document.querySelectorAll('[data-build]').forEach(button => button.classList.toggle('unaffordable', !canAfford(player, button.dataset.build)));
  ui.cycle.textContent = cycle.night ? 'NIGHT HAS FALLEN' : cycle.progress > .4 ? 'DUSK APPROACHES' : 'DAYLIGHT'; ui.cycleBar.style.width = `${cycle.progress * 100}%`;
  ui.clock.textContent = `${String(Math.floor(cycle.secondsLeft / 60)).padStart(2, '0')}:${String(cycle.secondsLeft % 60).padStart(2, '0')}`;
  const homes = buildings.filter(b => b.type === 'settlement');
  if (player.role === 'human') ui.objective.innerHTML = placement ? `<small>BUILD MODE</small><b>${placement.type.toUpperCase()}</b><span>${placementValid() ? 'Clear · click or Enter to place' : 'Blocked · choose another tile'}</span>` : homes.length ? `<small>HOME STATUS</small><b>${player.insideSettlement ? 'SAFE INSIDE' : 'SETTLEMENT BUILT'}</b><span>${player.insideSettlement ? 'Resting · health regenerating' : 'Return to the door and press E'}</span>` : `<small>NEXT GOAL</small><b>FOUND A SETTLEMENT</b><span>${player.wood}/8 wood · ${player.stone}/6 stone</span>`;
  else ui.objective.classList.add('hidden');
}
function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
function sprite(name, x, y, w, h, alpha = 1) { const img = sprites[name]; if (!img.complete || !img.naturalWidth) return false; ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(img, Math.round(x - w / 2), Math.round(y - h / 2), w, h); ctx.restore(); return true; }
function sheetSprite(name, column, row, cellWidth, cellHeight, x, y, width, height, alpha = 1, flip = false) {
  const img = sprites[name]; const ready = img && (img.complete || img instanceof HTMLCanvasElement) && (img.naturalWidth || img.width);
  if (!ready) return false;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, column * cellWidth, row * cellHeight, cellWidth, cellHeight, Math.round(-width / 2), Math.round(-height / 2), width, height);
  ctx.restore(); return true;
}
function footprint(bounds, color = 'rgba(199,174,117,.28)') { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(Math.round(bounds.x - bounds.halfWidth), Math.round(bounds.y - bounds.halfHeight), bounds.halfWidth * 2, bounds.halfHeight * 2); }
function drawResource(resource, now) {
  const shake = now < resource.shakeUntil ? Math.sin(now * .15) * 2 : 0; const bounds = resourceBounds(resource); if (bounds) footprint(bounds, 'rgba(115,151,125,.28)');
  if (resource.type === 'rock') sheetSprite('rock', Math.min(7, resource.hits * 2), 0, 64, 64, resource.x + shake, resource.y - 6, 58, 58);
  else if (resource.state === 'fallen') sheetSprite('tree', 4 + (Math.floor(resource.x) % 4), 2, 64, 64, resource.x, resource.y + 5, 70, 70);
  else { const fall = resource.state === 'falling' ? Math.min(1, (now - resource.stateChangedAt) / 650) : 0; ctx.save(); ctx.translate(resource.x + shake, resource.y + 20); ctx.rotate(fall * Math.PI / 2); sheetSprite('tree', Math.floor(resource.x / 10) % 8, 0, 64, 64, 0, -20, 70, 70); ctx.restore(); }
}
function drawBuilding(building, now, ghost = false) {
  const bounds = buildingBounds(building); footprint(bounds, ghost ? (placementValid() ? '#79c58b' : '#d05e55') : 'rgba(209,177,109,.35)');
  if (building.type === 'campfire') { if (!ghost) { ctx.fillStyle = 'rgba(239,166,70,.11)'; ctx.beginPath(); ctx.arc(building.x, building.y, 145, 0, Math.PI * 2); ctx.fill(); } sheetSprite('campfire', ghost ? 2 : 1 + Math.floor(now / 90) % 6, 0, 64, 64, building.x, building.y - 5, 58, 58, ghost ? .55 : 1); }
  if (building.type === 'settlement') sheetSprite('settlement', 0, 0, 128, 128, building.x, building.y - 22, 128, 128, ghost ? .55 : 1);
  if (building.type === 'watchtower') sheetSprite('settlement', 2, 1, 128, 128, building.x, building.y - 32, 104, 104, ghost ? .55 : 1);
  if (building.type === 'wall') { ctx.save(); ctx.translate(building.x, building.y); if (building.rotation % 2) ctx.rotate(Math.PI / 2); sprite('wall', 0, -5, 64, 48, ghost ? .55 : 1); ctx.restore(); }
}
function drawPlayer(now) {
  const moving = [...keys].some(k => ['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(k));
  const direction = Math.abs(facing.x) > Math.abs(facing.y) ? (facing.x > 0 ? 2 : 1) : (facing.y > 0 ? 0 : 3);
  const frame = action ? Math.min(7, Math.floor((now - action.startedAt) / (HARVEST_DURATION / 8))) : moving ? Math.floor(now / 90) % 8 : Math.floor(now / 260) % 8;
  if (player.role === 'human') sheetSprite('human', frame, action ? 4 : moving ? 1 : 0, 64, 64, player.x, player.y - 16, 64, 64, 1, facing.x < 0);
  else { const img = sprites.monster; if (img.complete && img.naturalWidth) ctx.drawImage(img, (frame % 4) * 32, direction * 40, 32, 40, Math.round(player.x - 16), Math.round(player.y - 25), 32, 40); }
  if (action) { const progress = Math.min(1, (now - action.startedAt) / HARVEST_DURATION); ctx.strokeStyle = '#e6bd6b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(player.x, player.y - 31, 13, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); ctx.stroke(); }
}
function drawPrompt(now) {
  if (!player || player.insideSettlement || placement || action) return; const home = buildings.find(b => b.type === 'settlement' && Math.hypot(b.x - player.x, b.y - player.y) < 82); const resource = nearestResource(); if (!home && !resource) return;
  const x = player.x, y = player.y - 42 + Math.sin(now / 220) * 2; rect(x - 48, y - 9, 96, 18, '#090d12dd'); ctx.fillStyle = '#e8dfc8'; ctx.font = '8px "Press Start 2P"'; ctx.textAlign = 'center';
  ctx.fillText(home ? '[E] ENTER' : resource.type === 'tree' && resource.state === 'fallen' ? '[E] CHOP LOG' : resource.type === 'tree' ? '[E] CHOP' : '[E] MINE', x, y + 3); ctx.textAlign = 'start';
}
function render(now) {
  const cycle = cycleState(player ? (now - startedAt) / 1000 : 48); const nightAlpha = player && cycle.night ? Math.min(.72, .38 + (cycle.progress - .55)) : .08;
  ctx.clearRect(0, 0, innerWidth, innerHeight); rect(0, 0, innerWidth, innerHeight, '#171b12');
  for (let y = -32 - (camera.y % 32); y < innerHeight + 32; y += 32) for (let x = -64 - (camera.x % 64); x < innerWidth + 64; x += 64) {
    const worldRow = Math.floor((y + camera.y) / 32); const worldColumn = Math.floor((x + camera.x) / 64);
    const offset = worldRow % 2 ? 32 : 0; const variant = Math.abs(worldColumn * 3 + worldRow * 5) % 16;
    sheetSprite('ground', variant % 4, Math.floor(variant / 4), 64, 32, x + offset + 32, y + 16, 64, 32);
  }
  if (placement) for (let x = -(camera.x % GRID_SIZE); x < innerWidth; x += GRID_SIZE) for (let y = -(camera.y % GRID_SIZE); y < innerHeight; y += GRID_SIZE) { ctx.strokeStyle = 'rgba(205,185,139,.18)'; ctx.lineWidth = 1; ctx.strokeRect(Math.round(x)+.5, Math.round(y)+.5, GRID_SIZE, GRID_SIZE); }
  ctx.save(); ctx.translate(-camera.x, -camera.y); for (const p of particles) rect(p.x, p.y, p.s, p.s, '#385146');
  resources.forEach(r => r.state !== 'destroyed' && drawResource(r, now)); buildings.forEach(b => drawBuilding(b, now)); if (placement) drawBuilding(placement, now, true);
  if (player && !player.insideSettlement) { drawPlayer(now); drawPrompt(now); } ctx.restore();
  rect(0, 0, innerWidth, innerHeight, `rgba(4,6,14,${nightAlpha})`);
  if (player && player.role === 'human' && cycle.night) { const lights = [{ x: player.x-camera.x,y:player.y-camera.y,r:70 }, ...buildings.filter(b=>b.type==='campfire'||b.type==='watchtower').map(b=>({x:b.x-camera.x,y:b.y-camera.y,r:b.type==='campfire'?160:190}))]; ctx.save(); ctx.globalCompositeOperation='destination-out'; lights.forEach(l=>{const g=ctx.createRadialGradient(l.x,l.y,10,l.x,l.y,l.r);g.addColorStop(0,'rgba(0,0,0,.9)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(l.x,l.y,l.r,0,Math.PI*2);ctx.fill();});ctx.restore(); }
}
function loop(now) { const dt = Math.min(.05, (now - lastTime) / 1000); lastTime = now; update(dt, now); render(now); requestAnimationFrame(loop); }
document.querySelectorAll('[data-role]').forEach(button => button.addEventListener('click', () => start(button.dataset.role)));
document.querySelector('#sound').addEventListener('click', e => { e.currentTarget.classList.toggle('muted'); e.currentTarget.textContent = e.currentTarget.classList.contains('muted') ? '×' : '♪'; });
document.querySelectorAll('[data-build]').forEach(button => button.addEventListener('click', () => beginPlacement(button.dataset.build)));
canvas.addEventListener('mousemove', e => { if (!placement) return; placement.x = snapToGrid(e.clientX + camera.x); placement.y = snapToGrid(e.clientY + camera.y); });
canvas.addEventListener('mousedown', e => { if (e.button === 0 && placement) confirmPlacement(); if (e.button === 2) cancelPlacement(); }); canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => { const key=e.key.toLowerCase(); if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) e.preventDefault(); keys.add(key); if (key==='e'&&!e.repeat) placement?confirmPlacement():interact(); if (key==='enter'&&!e.repeat&&placement) confirmPlacement(); if (/^[1-4]$/.test(key)&&!e.repeat) beginPlacement(['campfire','settlement','watchtower','wall'][Number(key)-1]); if (key==='r'&&placement) placement.rotation=(placement.rotation+1)%2; if (key==='escape') placement?cancelPlacement():player&&location.reload(); });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase())); addEventListener('resize', resize); resize(); requestAnimationFrame(loop);
