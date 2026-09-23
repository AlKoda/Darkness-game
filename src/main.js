import './style.css';
import { WORLD_SIZE, clamp, createPlayer, cycleState, spendCampfire } from './systems.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const ui = {
  hero: document.querySelector('#hero'), hud: document.querySelector('#hud'), event: document.querySelector('#event'),
  role: document.querySelector('#role-label'), portrait: document.querySelector('#portrait'), health: document.querySelector('#health-bar'),
  wood: document.querySelector('#wood'), stone: document.querySelector('#stone'), essence: document.querySelector('#essence'), essenceWrap: document.querySelector('#essence-wrap'),
  cycle: document.querySelector('#cycle-label'), cycleBar: document.querySelector('#cycle-bar'), clock: document.querySelector('#clock'),
};

let player = null;
let startedAt = 0;
let lastTime = performance.now();
let camera = { x: 0, y: 0 };
let fires = [];
const keys = new Set();
const particles = Array.from({ length: 70 }, (_, i) => ({ x: (i * 349) % WORLD_SIZE, y: (i * 197) % WORLD_SIZE, s: i % 3 + 1 }));
const resources = Array.from({ length: 90 }, (_, i) => ({
  x: 100 + (i * 277) % (WORLD_SIZE - 200), y: 100 + (i * 431) % (WORLD_SIZE - 200),
  type: i % 3 ? 'tree' : 'rock', alive: true,
}));

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
  let nearest = null; let distance = 70;
  for (const resource of resources) {
    if (!resource.alive) continue;
    const d = Math.hypot(resource.x - player.x, resource.y - player.y);
    if (d < distance) { nearest = resource; distance = d; }
  }
  if (!nearest) return;
  nearest.alive = false;
  if (player.role === 'human') nearest.type === 'tree' ? player.wood += 2 : player.stone += 2;
  else player.essence += nearest.type === 'tree' ? 1 : 2;
  setTimeout(() => { nearest.alive = true; }, 9000);
}

function build() {
  if (!player) return;
  if (spendCampfire(player)) { fires.push({ x: player.x, y: player.y }); showEvent('LIGHT KINDLED', 'The darkness recoils.'); }
  else if (player.role === 'human') showEvent('NOT ENOUGH', 'Campfire requires 4 wood + 2 stone.');
}

function update(dt, now) {
  if (!player) return;
  let dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  let dy = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  if (dx && dy) { dx *= 0.707; dy *= 0.707; }
  player.x = clamp(player.x + dx * player.speed * dt, 30, WORLD_SIZE - 30);
  player.y = clamp(player.y + dy * player.speed * dt, 30, WORLD_SIZE - 30);
  camera.x += (player.x - innerWidth / 2 - camera.x) * Math.min(1, dt * 7);
  camera.y += (player.y - innerHeight / 2 - camera.y) * Math.min(1, dt * 7);

  const cycle = cycleState((now - startedAt) / 1000);
  if (cycle.night && player.role === 'human') {
    const safe = fires.some(f => Math.hypot(f.x - player.x, f.y - player.y) < 145);
    if (!safe) player.health = Math.max(0, player.health - dt * 2.5);
  }
  ui.health.style.width = `${player.health}%`; ui.wood.textContent = player.wood; ui.stone.textContent = player.stone; ui.essence.textContent = player.essence;
  ui.cycle.textContent = cycle.night ? 'NIGHT HAS FALLEN' : cycle.progress > .4 ? 'DUSK APPROACHES' : 'DAYLIGHT';
  ui.cycleBar.style.width = `${cycle.progress * 100}%`;
  ui.clock.textContent = `${String(Math.floor(cycle.secondsLeft / 60)).padStart(2, '0')}:${String(cycle.secondsLeft % 60).padStart(2, '0')}`;
}

function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

function drawTree(x, y) {
  rect(x - 4, y + 7, 8, 18, '#5f4030'); rect(x - 13, y - 11, 26, 21, '#183d35');
  rect(x - 8, y - 18, 18, 12, '#245446'); rect(x - 15, y - 4, 7, 9, '#2c6754'); rect(x - 5, y - 14, 5, 4, '#43806a');
}

function drawRock(x, y) { rect(x - 12, y - 6, 24, 14, '#49535d'); rect(x - 7, y - 11, 14, 7, '#68727a'); rect(x + 4, y - 5, 7, 5, '#353e48'); }

function drawPlayer(x, y) {
  if (player.role === 'human') {
    rect(x - 7, y - 12, 14, 18, '#d4a96a'); rect(x - 9, y - 5, 18, 13, '#344d62'); rect(x - 6, y + 8, 5, 8, '#17232c'); rect(x + 2, y + 8, 5, 8, '#17232c'); rect(x + 4, y - 10, 2, 2, '#151a22');
  } else {
    rect(x - 13, y - 5, 26, 15, '#893f64'); rect(x - 9, y - 10, 18, 7, '#af5778'); rect(x - 8, y + 10, 6, 4, '#562b4d'); rect(x + 4, y + 10, 6, 4, '#562b4d'); rect(x - 6, y - 5, 3, 3, '#f5d678'); rect(x + 4, y - 5, 3, 3, '#f5d678');
  }
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
  resources.forEach(r => r.alive && (r.type === 'tree' ? drawTree(r.x, r.y) : drawRock(r.x, r.y)));
  fires.forEach((f, i) => { ctx.fillStyle = 'rgba(239,166,70,.12)'; ctx.beginPath(); ctx.arc(f.x, f.y, 145, 0, Math.PI * 2); ctx.fill(); rect(f.x - 9, f.y + 4, 18, 5, '#5e392b'); rect(f.x - 5, f.y - 8 - (i + Math.floor(now / 250)) % 3, 10, 13, '#ef6c3d'); rect(f.x - 2, f.y - 5, 5, 8, '#ffd16b'); });
  if (player) drawPlayer(player.x, player.y);
  ctx.restore();

  rect(0, 0, innerWidth, innerHeight, `rgba(4, 6, 14, ${nightAlpha})`);
  if (player && player.role === 'human' && cycle.night) {
    const lights = [{ x: player.x - camera.x, y: player.y - camera.y, r: 70 }, ...fires.map(f => ({ x: f.x - camera.x, y: f.y - camera.y, r: 160 }))];
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; lights.forEach(l => { const g = ctx.createRadialGradient(l.x, l.y, 10, l.x, l.y, l.r); g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2); ctx.fill(); }); ctx.restore();
  }
}

function loop(now) { const dt = Math.min(.05, (now - lastTime) / 1000); lastTime = now; update(dt, now); render(now); requestAnimationFrame(loop); }

document.querySelectorAll('[data-role]').forEach(button => button.addEventListener('click', () => start(button.dataset.role)));
document.querySelector('#sound').addEventListener('click', e => { e.currentTarget.classList.toggle('muted'); e.currentTarget.textContent = e.currentTarget.classList.contains('muted') ? '×' : '♪'; });
addEventListener('keydown', e => { const key = e.key.toLowerCase(); keys.add(key); if (key === 'e' && !e.repeat) interact(); if (key === '1' && !e.repeat) build(); if (key === 'escape' && player) location.reload(); });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('resize', resize); resize(); requestAnimationFrame(loop);
