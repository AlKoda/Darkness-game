import './style.css';
import { BUILDINGS, WORLD_SIZE, canAfford, clamp, createPlayer, createResource, cycleState, spendBuilding, spendCampfire, spendSettlement, strikeResource, updateResourceState } from './systems.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const ui = {
  hero: document.querySelector('#hero'), hud: document.querySelector('#hud'), event: document.querySelector('#event'),
  role: document.querySelector('#role-label'), portrait: document.querySelector('#portrait'), health: document.querySelector('#health-bar'),
  wood: document.querySelector('#wood'), stone: document.querySelector('#stone'), essence: document.querySelector('#essence'), essenceWrap: document.querySelector('#essence-wrap'),
  cycle: document.querySelector('#cycle-label'), cycleBar: document.querySelector('#cycle-bar'), clock: document.querySelector('#clock'),
  objective: document.querySelector('#objective'), buildbar: document.querySelector('#buildbar'),
};

let player = null;
let startedAt = 0;
let lastTime = performance.now();
let camera = { x: 0, y: 0 };
let fires = [];
let settlements = [];
let watchtowers = [];
let walls = [];
let facing = { x: 0, y: 1 };
let action = { type: 'idle', until: 0 };
const keys = new Set();
const particles = Array.from({ length: 70 }, (_, i) => ({ x: (i * 349) % WORLD_SIZE, y: (i * 197) % WORLD_SIZE, s: i % 3 + 1 }));
const resources = Array.from({ length: 90 }, (_, i) => createResource(
  i % 3 ? 'tree' : 'rock',
  100 + (i * 277) % (WORLD_SIZE - 200),
  100 + (i * 431) % (WORLD_SIZE - 200),
));

function resize() {
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

function start(role) {
  player = createPlayer(role); startedAt = performance.now();
  ui.hero.classList.add('leaving');
  setTimeout(() => { ui.hero.classList.add('hidden'); ui.hud.classList.remove('hidden'); }, 450);
  ui.role.textContent = role === 'human' ? 'HUMAN · LEVEL 1' : 'MONSTER · WHELP';
  ui.portrait.textContent = role === 'human' ? 'H' : 'M';
  ui.portrait.className = `portrait ${role}`;
  ui.essenceWrap.style.display = role === 'monster' ? '' : 'none';
  ui.buildbar.classList.toggle('hidden', role !== 'human');
  showEvent(role === 'human' ? 'A FIRE AWAITS' : 'THE HUNT BEGINS', role === 'human' ? 'Gather 4 wood and 2 stone.' : 'Absorb essence. Evolve.');
}

function showEvent(title, copy) {
  document.querySelector('#event-title').textContent = title;
  document.querySelector('#event-copy').textContent = copy;
  ui.event.classList.remove('hidden');
  clearTimeout(showEvent.timer); showEvent.timer = setTimeout(() => ui.event.classList.add('hidden'), 3200);
}

function interact() {
  if (!player) return;
  const home = settlements.find(s => Math.hypot(s.x - player.x, s.y - player.y) < 78);
  if (home && player.role === 'human') {
    player.insideSettlement = !player.insideSettlement;
    showEvent(player.insideSettlement ? 'WELCOME HOME' : 'BACK TO THE WILD', player.insideSettlement ? 'Sheltered, safe, and slowly healing.' : 'Your settlement will be waiting.');
    return;
  }
  let nearest = null; let distance = 70;
  for (const resource of resources) {
    if (resource.state === 'destroyed' || resource.state === 'falling') continue;
    const d = Math.hypot(resource.x - player.x, resource.y - player.y);
    if (d < distance) { nearest = resource; distance = d; }
  }
  if (!nearest) return;
  action = { type: nearest.type === 'tree' ? 'chop' : 'mine', until: performance.now() + 260 };
  const result = strikeResource(nearest, performance.now());
  if (result.felled) showEvent('TIMBER!', 'The trunk is down. Chop it twice to collect wood.');
  if (result.collected && player.role === 'human') {
    player.wood += result.collected.wood || 0;
    player.stone += result.collected.stone || 0;
    showEvent(result.collected.wood ? 'WOOD COLLECTED' : 'STONE COLLECTED', result.collected.wood ? '+4 wood — the fallen trunk is cleared.' : '+3 stone — the boulder is broken.');
  } else if (result.collected) {
    player.essence += nearest.type === 'tree' ? 1 : 2;
  }
}

function build() {
  if (!player) return;
  if (spendCampfire(player)) { fires.push({ x: player.x, y: player.y }); showEvent('LIGHT KINDLED', 'The darkness recoils.'); }
  else if (player.role === 'human') showEvent('NOT ENOUGH', 'Campfire requires 4 wood + 2 stone.');
}

function buildSettlement() {
  if (!player || player.role !== 'human') return;
  if (!spendSettlement(player)) {
    showEvent('MORE MATERIALS NEEDED', 'A settlement requires 8 wood + 6 stone.');
    return;
  }
  settlements.push({ x: player.x, y: player.y, foundedAt: performance.now() });
  player.insideSettlement = true;
  showEvent('SETTLEMENT FOUNDED', 'You are home. Press E by the door to enter or leave.');
}

function buildDefense(type) {
  if (!player || player.role !== 'human') return;
  const cost = BUILDINGS[type];
  if (!spendBuilding(player, type)) {
    showEvent('MORE MATERIALS NEEDED', `${type === 'watchtower' ? 'Watchtower' : 'Stone wall'} requires ${cost.wood} wood + ${cost.stone} stone.`);
    return;
  }
  const x = clamp(player.x + facing.x * 62, 50, WORLD_SIZE - 50);
  const y = clamp(player.y + facing.y * 62, 50, WORLD_SIZE - 50);
  if (type === 'watchtower') {
    watchtowers.push({ x, y, phase: performance.now() % 6000 });
    showEvent('WATCHTOWER RAISED', 'Its lantern sweeps the darkness and keeps you safe.');
  } else {
    walls.push({ x, y, vertical: Math.abs(facing.x) > Math.abs(facing.y) });
    showEvent('WALL FORTIFIED', 'A sturdy barrier now guards this approach.');
  }
}

function update(dt, now) {
  if (!player) return;
  resources.forEach(resource => updateResourceState(resource, now));
  let dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  let dy = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  if (dx && dy) { dx *= 0.707; dy *= 0.707; }
  if (dx || dy) facing = { x: dx, y: dy };
  if (!player.insideSettlement) {
    player.x = clamp(player.x + dx * player.speed * dt, 30, WORLD_SIZE - 30);
    player.y = clamp(player.y + dy * player.speed * dt, 30, WORLD_SIZE - 30);
  } else {
    player.health = Math.min(100, player.health + dt * 5);
  }
  camera.x += (player.x - innerWidth / 2 - camera.x) * Math.min(1, dt * 7);
  camera.y += (player.y - innerHeight / 2 - camera.y) * Math.min(1, dt * 7);

  const cycle = cycleState((now - startedAt) / 1000);
  if (cycle.night && player.role === 'human') {
    const safe = player.insideSettlement || fires.some(f => Math.hypot(f.x - player.x, f.y - player.y) < 145) || watchtowers.some(t => Math.hypot(t.x - player.x, t.y - player.y) < 190);
    if (!safe) player.health = Math.max(0, player.health - dt * 2.5);
  }
  ui.health.style.width = `${player.health}%`; ui.wood.textContent = player.wood; ui.stone.textContent = player.stone; ui.essence.textContent = player.essence;
  document.querySelectorAll('[data-build]').forEach(button => button.classList.toggle('unaffordable', !canAfford(player, button.dataset.build)));
  ui.cycle.textContent = cycle.night ? 'NIGHT HAS FALLEN' : cycle.progress > .4 ? 'DUSK APPROACHES' : 'DAYLIGHT';
  ui.cycleBar.style.width = `${cycle.progress * 100}%`;
  ui.clock.textContent = `${String(Math.floor(cycle.secondsLeft / 60)).padStart(2, '0')}:${String(cycle.secondsLeft % 60).padStart(2, '0')}`;
  if (player.role === 'human') {
    ui.objective.innerHTML = settlements.length
      ? `<small>HOME STATUS</small><b>${player.insideSettlement ? 'SAFE INSIDE' : 'SETTLEMENT BUILT'}</b><span>${player.insideSettlement ? 'Resting · health regenerating' : 'Return to the door and press E'}</span>`
      : `<small>NEXT GOAL</small><b>FOUND A SETTLEMENT</b><span>${player.wood}/8 wood · ${player.stone}/6 stone</span>`;
  } else ui.objective.classList.add('hidden');
}

function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

function drawStandingTree(x, y) {
  rect(x - 4, y + 7, 8, 18, '#5f4030'); rect(x - 13, y - 11, 26, 21, '#183d35');
  rect(x - 8, y - 18, 18, 12, '#245446'); rect(x - 15, y - 4, 7, 9, '#2c6754'); rect(x - 5, y - 14, 5, 4, '#43806a');
}

function drawTree(resource, now) {
  const shake = now < resource.shakeUntil ? Math.sin(now * .12) * 3 : 0;
  if (resource.state === 'fallen') {
    rect(resource.x - 25, resource.y + 8, 50, 9, '#66432f'); rect(resource.x - 19, resource.y + 5, 4, 4, '#8a6041');
    rect(resource.x + 25, resource.y + 9, 4, 7, '#bd9462');
    return;
  }
  const fall = resource.state === 'falling' ? Math.min(1, (now - resource.stateChangedAt) / 650) : 0;
  ctx.save(); ctx.translate(resource.x + shake, resource.y + 25); ctx.rotate(fall * Math.PI / 2); drawStandingTree(0, -25); ctx.restore();
}

function drawRock(resource, now) {
  const x = resource.x + (now < resource.shakeUntil ? Math.sin(now * .15) * 2 : 0); const y = resource.y;
  rect(x - 12, y - 6, 24, 14, '#49535d'); rect(x - 7, y - 11, 14, 7, '#68727a'); rect(x + 4, y - 5, 7, 5, '#353e48');
  if (resource.hits) rect(x - 1, y - 8, 2, 8, '#252c32');
}

function drawSettlement(home) {
  ctx.fillStyle = 'rgba(229,174,91,.08)'; ctx.fillRect(home.x - 58, home.y - 54, 116, 108);
  rect(home.x - 54, home.y - 51, 108, 6, '#74705d'); rect(home.x - 54, home.y + 45, 108, 6, '#74705d');
  rect(home.x - 54, home.y - 45, 6, 90, '#74705d'); rect(home.x + 48, home.y - 45, 6, 90, '#74705d');
  rect(home.x - 33, home.y - 27, 66, 51, '#6d4935'); rect(home.x - 39, home.y - 32, 78, 9, '#a06b47');
  rect(home.x - 9, home.y + 3, 18, 21, '#241d1a'); rect(home.x - 4, home.y + 7, 4, 4, '#e8ad51');
  rect(home.x - 27, home.y - 16, 12, 10, '#d3a85f'); rect(home.x + 15, home.y - 16, 12, 10, '#d3a85f');
  rect(home.x - 48, home.y + 42, 16, 9, '#373f35'); rect(home.x + 32, home.y + 42, 16, 9, '#373f35');
}

function drawWall(wall) {
  ctx.save(); ctx.translate(wall.x, wall.y); if (wall.vertical) ctx.rotate(Math.PI / 2);
  rect(-31, -8, 62, 15, '#4b4c43'); rect(-27, -13, 17, 7, '#898477'); rect(-7, -13, 17, 7, '#77756a'); rect(13, -13, 14, 7, '#979083');
  rect(-29, -4, 19, 8, '#69685e'); rect(-7, -4, 18, 8, '#858176'); rect(14, -4, 40, 8, '#5a5b52'); rect(-31, 7, 62, 4, '#2a302d');
  ctx.restore();
}

function drawWatchtower(tower, now) {
  const angle = now / 1900 + tower.phase / 1000;
  ctx.save(); ctx.translate(tower.x, tower.y);
  ctx.fillStyle = 'rgba(255,202,72,.13)'; ctx.beginPath(); ctx.moveTo(0, -35); ctx.arc(0, -35, 125, angle - .22, angle + .22); ctx.closePath(); ctx.fill();
  rect(-17, -31, 34, 9, '#332519'); rect(-21, -25, 42, 8, '#75502d'); rect(-14, -18, 5, 53, '#4d3827'); rect(9, -18, 5, 53, '#4d3827');
  rect(-19, 3, 38, 4, '#7e5733'); rect(-17, 20, 34, 4, '#6a492f'); rect(-24, 34, 48, 7, '#303a31');
  rect(-13, -43, 26, 17, '#4e321e'); rect(-18, -47, 36, 6, '#2b211a'); rect(-8, -39, 16, 9, '#edb84d'); rect(-3, -38, 6, 7, '#ffe891');
  ctx.restore();
}

function drawPlayer(x, y, now) {
  const moving = keys.has('w') || keys.has('a') || keys.has('s') || keys.has('d') || keys.has('arrowup') || keys.has('arrowleft') || keys.has('arrowdown') || keys.has('arrowright');
  const bob = moving ? Math.round(Math.sin(now / 85) * 2) : 0;
  const swing = now < action.until ? Math.round(Math.sin((action.until - now) / 260 * Math.PI) * 7) : 0;
  y += bob;
  if (player.role === 'human') {
    rect(x - 7, y - 12, 14, 18, '#d4a96a'); rect(x - 9, y - 5, 18, 13, '#344d62'); rect(x - 6, y + 8, 5, 8, '#17232c'); rect(x + 2, y + 8, 5, 8, '#17232c'); rect(x + 4, y - 10, 2, 2, '#151a22');
    if (now < action.until) { rect(x + 9 + swing, y - 8, 3, 18, '#8d6039'); rect(x + 6 + swing, y - 10, 9, 5, '#a9afb0'); }
  } else {
    rect(x - 13, y - 5, 26, 15, '#893f64'); rect(x - 9, y - 10, 18, 7, '#af5778'); rect(x - 8, y + 10, 6, 4, '#562b4d'); rect(x + 4, y + 10, 6, 4, '#562b4d'); rect(x - 6, y - 5, 3, 3, '#f5d678'); rect(x + 4, y - 5, 3, 3, '#f5d678');
  }
}

function drawPrompt(now) {
  if (!player || player.insideSettlement) return;
  const home = settlements.find(s => Math.hypot(s.x - player.x, s.y - player.y) < 78);
  const resource = resources.find(r => r.state !== 'destroyed' && r.state !== 'falling' && Math.hypot(r.x - player.x, r.y - player.y) < 70);
  if (!home && !resource) return;
  const x = player.x; const y = player.y - 37 + Math.sin(now / 220) * 2;
  rect(x - 44, y - 9, 88, 18, '#090d12dd');
  ctx.fillStyle = '#e8dfc8'; ctx.font = '8px "Press Start 2P"'; ctx.textAlign = 'center';
  ctx.fillText(home ? '[E] ENTER' : resource.type === 'tree' && resource.state === 'fallen' ? '[E] CHOP LOG' : resource.type === 'tree' ? '[E] CHOP' : '[E] MINE', x, y + 3);
  ctx.textAlign = 'start';
}

function render(now) {
  const elapsed = player ? (now - startedAt) / 1000 : 48;
  const cycle = cycleState(elapsed);
  const nightAlpha = player && cycle.night ? Math.min(.72, .38 + (cycle.progress - .55)) : .08;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  rect(0, 0, innerWidth, innerHeight, '#101b1b');
  const grid = 48;
  for (let x = -(camera.x % grid); x < innerWidth; x += grid) for (let y = -(camera.y % grid); y < innerHeight; y += grid) {
    const odd = (Math.floor((x + camera.x) / grid) + Math.floor((y + camera.y) / grid)) % 2;
    rect(x, y, grid, grid, odd ? '#152322' : '#172725');
    if ((x * 3 + y * 7) % 5 === 0) rect(x + 12, y + 25, 3, 5, '#274038');
  }
  ctx.save(); ctx.translate(-camera.x, -camera.y);
  for (const p of particles) rect(p.x, p.y, p.s, p.s, '#385146');
  resources.forEach(r => r.state !== 'destroyed' && (r.type === 'tree' ? drawTree(r, now) : drawRock(r, now)));
  walls.forEach(drawWall);
  settlements.forEach(drawSettlement);
  watchtowers.forEach(t => drawWatchtower(t, now));
  fires.forEach((f, i) => { ctx.fillStyle = 'rgba(239,166,70,.12)'; ctx.beginPath(); ctx.arc(f.x, f.y, 145, 0, Math.PI * 2); ctx.fill(); rect(f.x - 9, f.y + 4, 18, 5, '#5e392b'); rect(f.x - 5, f.y - 8 - (i + Math.floor(now / 250)) % 3, 10, 13, '#ef6c3d'); rect(f.x - 2, f.y - 5, 5, 8, '#ffd16b'); });
  if (player && !player.insideSettlement) { drawPlayer(player.x, player.y, now); drawPrompt(now); }
  ctx.restore();

  rect(0, 0, innerWidth, innerHeight, `rgba(4, 6, 14, ${nightAlpha})`);
  if (player && player.role === 'human' && cycle.night) {
    const lights = [{ x: player.x - camera.x, y: player.y - camera.y, r: 70 }, ...fires.map(f => ({ x: f.x - camera.x, y: f.y - camera.y, r: 160 })), ...watchtowers.map(t => ({ x: t.x - camera.x, y: t.y - camera.y - 35, r: 190 }))];
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; lights.forEach(l => { const g = ctx.createRadialGradient(l.x, l.y, 10, l.x, l.y, l.r); g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2); ctx.fill(); }); ctx.restore();
  }
}

function loop(now) { const dt = Math.min(.05, (now - lastTime) / 1000); lastTime = now; update(dt, now); render(now); requestAnimationFrame(loop); }

document.querySelectorAll('[data-role]').forEach(button => button.addEventListener('click', () => start(button.dataset.role)));
document.querySelector('#sound').addEventListener('click', e => { e.currentTarget.classList.toggle('muted'); e.currentTarget.textContent = e.currentTarget.classList.contains('muted') ? '×' : '♪'; });
document.querySelectorAll('[data-build]').forEach(button => button.addEventListener('click', () => ({ campfire: build, settlement: buildSettlement, watchtower: () => buildDefense('watchtower'), wall: () => buildDefense('wall') })[button.dataset.build]()));
addEventListener('keydown', e => { const key = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault(); keys.add(key); if (key === 'e' && !e.repeat) interact(); if (key === '1' && !e.repeat) build(); if (key === '2' && !e.repeat) buildSettlement(); if (key === '3' && !e.repeat) buildDefense('watchtower'); if (key === '4' && !e.repeat) buildDefense('wall'); if (key === 'escape' && player) location.reload(); });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('resize', resize); resize(); requestAnimationFrame(loop);
