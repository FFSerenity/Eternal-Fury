// ---------- minimap: explored cells drawn at the camera's 45° angle (so "up" on the map is "up" on screen) ----------
// modes cycle small (corner) → big (see-through overlay in the middle, clicks pass through) → off.
import { G } from './state.js';
import { tr } from './i18n.js';

const MODES = ['small', 'big', 'off'], KEY = 'graveTamerMap';
let cv = null, ctx = null, img = null, ictx = null, mode = 'small', lastF = null, dirty = true, acc = 0, cssW = 0;
try { const m = localStorage.getItem(KEY); if (MODES.includes(m)) mode = m; } catch (e) {}

export function initMap() {
  cv = document.createElement('canvas'); cv.id = 'mmap'; document.getElementById('hud').appendChild(cv); ctx = cv.getContext('2d');
  img = document.createElement('canvas'); ictx = img.getContext('2d');
  cv.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (mode === 'small') setMode('big'); });
  // while the big map is up, a chip where the small one sits shrinks it back (the big one lets clicks through)
  const chip = document.createElement('button'); chip.id = 'mapChip'; chip.className = 'btn'; chip.textContent = '🗺'; chip.title = tr('缩小地图', 'Shrink the map'); document.getElementById('hud').appendChild(chip);
  chip.addEventListener('click', e => { e.stopPropagation(); setMode('small'); });
  const b = document.getElementById('bMap'); if (b) b.addEventListener('click', e => { e.stopPropagation(); cycleMap(); });
  const t = document.getElementById('bMapSet'); if (t) t.addEventListener('click', e => { e.stopPropagation(); setMode(mode === 'off' ? 'small' : 'off'); });
  apply();
}
export function cycleMap() { setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]); }
function setMode(m) { mode = m; try { localStorage.setItem(KEY, m); } catch (e) {} apply(); }
function apply() {
  if (!cv) return; cv.className = mode; cssW = 0; acc = 1;
  const t = document.getElementById('bMapSet'); if (t) t.textContent = '🗺 ' + (mode === 'off' ? tr('关', 'Off') : tr('开', 'On'));
  const b = document.getElementById('bMap'); if (b) { b.classList.toggle('on', mode !== 'off'); b.title = { small: tr('地图：小（点一下放大）', 'Map: small (tap to enlarge)'), big: tr('地图：大', 'Map: large'), off: tr('地图：关', 'Map: off') }[mode] + ' · M'; }
}

// reveal what's around the player; the camp is small and fully known
function reveal(F, x, z, r) {
  const W = F.W, H = F.H, s = F.seen, x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(W - 1, Math.floor(x + r)), z0 = Math.max(0, Math.floor(z - r)), z1 = Math.min(H - 1, Math.floor(z + r));
  for (let Z = z0; Z <= z1; Z++) for (let X = x0; X <= x1; X++) { const i = Z * W + X; if (s[i]) continue; const dx = X + 0.5 - x, dz = Z + 0.5 - z; if (dx * dx + dz * dz <= r * r && F.g[i]) { s[i] = 1; dirty = true; } }
}
// one pixel per cell: floor dim violet, walls / blocked bright
function rebuild(F) {
  const W = F.W, H = F.H, d = ictx.createImageData(W, H), p = d.data;
  for (let i = 0; i < W * H; i++) { if (!F.seen[i]) continue; const v = F.g[i], o = i * 4;
    if (v === 1) { p[o] = 92; p[o + 1] = 78; p[o + 2] = 132; p[o + 3] = 150; } else if (v === 2) { p[o] = 196; p[o + 1] = 178; p[o + 2] = 236; p[o + 3] = 255; } }
  ictx.putImageData(d, 0, 0); dirty = false;
}

const QC = ['#d8d2c8', '#6f9bff', '#ffd36a'];
export function updateMap(dt) {
  const F = G.floor, P = G.player; if (!cv || !F || !P) return;
  if (F !== lastF) { lastF = F; if (!F.seen) F.seen = new Uint8Array(F.W * F.H); if (G.depth === 0) F.seen.fill(1); img.width = F.W; img.height = F.H; dirty = true; }
  if (mode === 'off') return; acc += dt; if (acc < 0.1) return; acc = 0;
  reveal(F, P.x, P.z, 9);
  for (const r of F.rooms || []) if (P.x >= r.x && P.x <= r.x + r.w && P.z >= r.y && P.z <= r.y + r.h && !r.seen) { r.seen = 1; // walking into a room maps all of it
    for (let Z = Math.max(0, r.y - 1); Z <= Math.min(F.H - 1, r.y + r.h); Z++) for (let X = Math.max(0, r.x - 1); X <= Math.min(F.W - 1, r.x + r.w); X++) if (F.g[Z * F.W + X]) F.seen[Z * F.W + X] = 1; dirty = true; }
  if (dirty) rebuild(F);
  const w = cv.clientWidth; if (!w) return; const dpr = Math.min(devicePixelRatio || 1, 2);
  if (w !== cssW) { cssW = w; cv.width = cv.height = Math.round(w * dpr); }
  const N = cv.width, big = mode === 'big', s = dpr * (big ? w / 62 : Math.min(5.5, Math.max(4, w / 28))); // px per cell
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, N, N);
  ctx.save(); ctx.translate(N / 2, N / 2); ctx.rotate(Math.PI / 4); ctx.scale(s, s); ctx.translate(-P.x, -P.z);
  ctx.imageSmoothingEnabled = false; ctx.globalAlpha = big ? 0.7 : 1; ctx.drawImage(img, 0, 0); ctx.globalAlpha = 1;
  const dot = (x, z, r, col, glow) => { ctx.beginPath(); ctx.arc(x, z, r / s * dpr, 0, 6.2832); ctx.fillStyle = col; if (glow) { ctx.shadowColor = col; ctx.shadowBlur = glow * dpr; } ctx.fill(); ctx.shadowBlur = 0; };
  const seen = (x, z) => { const X = Math.floor(x), Z = Math.floor(z); return X >= 0 && Z >= 0 && X < F.W && Z < F.H && F.seen[Z * F.W + X]; };
  // the way down (or the crypt portal in the camp): a glowing blue diamond (a square, turned by the map)
  const st = F.stairs; if (st && seen(st.x, st.z)) { const r = 2.6 / s * dpr * (big ? 1.4 : 1.15); ctx.shadowColor = '#6fb6ff'; ctx.shadowBlur = 10 * dpr; ctx.fillStyle = '#8fd0ff'; ctx.fillRect(st.x - r, st.z - r, r * 2, r * 2); ctx.shadowBlur = 0; }
  for (const L of G.loot) if (seen(L.x, L.z)) dot(L.x, L.z, L.it.q === 2 ? 2.2 : 1.6, QC[L.it.q] || QC[0], L.it.q ? 6 : 0);
  for (const u of G.units) { if (u.dead || u === P) continue;
    if (u.side === 'enemy') { if (seen(u.x, u.z) && Math.hypot(u.x - P.x, u.z - P.z) < 16) dot(u.x, u.z, u.champ ? 2.6 : 1.8, u.champ ? '#ffb347' : '#ff5a5a', u.champ ? 6 : 0); }
    else dot(u.x, u.z, 2, '#6ff7a0', 4); }
  // the summoner: an arrow pointing where they face
  const f = P.face || 0, fx = Math.sin(f), fz = Math.cos(f), k = 1 / s * dpr * (big ? 1.25 : 1);
  ctx.beginPath(); ctx.moveTo(P.x + fx * 5 * k, P.z + fz * 5 * k); ctx.lineTo(P.x - fx * 3 * k + fz * 3.4 * k, P.z - fz * 3 * k - fx * 3.4 * k); ctx.lineTo(P.x - fx * 1.4 * k, P.z - fz * 1.4 * k); ctx.lineTo(P.x - fx * 3 * k - fz * 3.4 * k, P.z - fz * 3 * k + fx * 3.4 * k); ctx.closePath();
  ctx.fillStyle = '#6ff7e8'; ctx.shadowColor = '#3fe0d0'; ctx.shadowBlur = 8 * dpr; ctx.fill(); ctx.shadowBlur = 0;
  ctx.restore();
}
