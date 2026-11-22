// HUD, overlay text/bars, input (mouse + keyboard, touch joystick + buttons) and the crypt (墓典) panel
import * as THREE from 'three';
import { G, save } from './state.js';
import { TYPES, MODS, SKILLS, xpNeed, partySize } from './data.js';
import { captureChance, activeCount, spawnAlly, dismissAlly } from './units.js';
import { unlock, setSfx, sfxOn } from './audio.js';

const $ = s => document.querySelector(s);
export const IN = { joy: null, moveTo: null, hold: false, attack: null, castAt: null, castHold: false, autoAtk: false, raise: null, raiseKey: false, mend: false, stairs: false, cursor: null, shift: false };
export const touchUI = matchMedia('(pointer: coarse)').matches;
let cam = null, groundAt = null, W = 0, H = 0;
export function initUI(o) { cam = o.camera; groundAt = o.groundAt; document.body.classList.toggle('touch', touchUI); bindInput(o.canvas); bindButtons(); }
export function resizeUI(w, h) { W = w; H = h; const c = $('#ov'), dpr = Math.min(devicePixelRatio || 1, 2); c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px'; ovScale = dpr; }
let ovScale = 1;
const V = new THREE.Vector3();
function toScreen(x, y, z) { V.set(x, y, z).project(cam); return [(V.x + 1) / 2 * W, (1 - V.y) / 2 * H, V.z < 1]; }

// ---------- messages ----------
let msgT = 0;
export function message(text, big = false) {
  const box = $('#msg'), d = document.createElement('div'); d.className = 'm' + (big ? ' big' : ''); d.textContent = text; box.appendChild(d);
  while (box.children.length > 4) box.firstChild.remove(); setTimeout(() => d.classList.add('out'), 2200); setTimeout(() => d.remove(), 2800);
}

// ---------- input ----------
function pickEnemy(p, r = 0.9) { let b = null, bd = r; for (const e of G.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.z - p.z) - e.r; if (d < bd) { bd = d; b = e; } } return b; }
export function pickCorpse(p, r = 1.0) { let b = null, bd = r; for (const c of G.corpses) { if (c.claim) continue; const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; b = c; } } return b; }
function bindInput(cv) {
  let joyId = null, joyO = null;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    unlock(); e.preventDefault(); const p = groundAt(e.clientX, e.clientY); IN.cursor = p;
    if (e.pointerType === 'touch') {
      if (e.clientX < W * 0.5 && joyId === null) { joyId = e.pointerId; joyO = { x: e.clientX, y: e.clientY }; showJoy(joyO, joyO); cv.setPointerCapture(e.pointerId); return; }
      if (!p) return; const en = pickEnemy(p, 1.2); if (en) { IN.attack = en; G.focus = en; return; } const c = pickCorpse(p, 1.4); if (c) { IN.raise = c; return; } return;
    }
    cv.setPointerCapture(e.pointerId); if (!p) return;
    if (e.button === 2) { IN.castAt = p; IN.castHold = true; return; }
    if (e.button !== 0) return;
    if (IN.shift) { IN.castAt = p; IN.castHold = true; return; }
    const en = pickEnemy(p); if (en) { IN.attack = en; G.focus = en; IN.hold = false; return; }
    const c = pickCorpse(p, 0.9); if (c) { IN.raise = c; return; }
    if (G.floor && Math.hypot(p.x - G.floor.stairs.x, p.z - G.floor.stairs.z) < 0.9) { IN.moveTo = { ...G.floor.stairs }; IN.stairs = true; return; }
    IN.attack = null; IN.moveTo = p; IN.hold = true;
  });
  cv.addEventListener('pointermove', e => {
    if (e.pointerId === joyId) { const dx = e.clientX - joyO.x, dy = e.clientY - joyO.y, l = Math.hypot(dx, dy), R = 56, k = Math.min(1, l / R);
      if (l < 6) IN.joy = null; else { const sx = dx / l * k, sy = dy / l * k; IN.joy = screenDir(sx, sy); } showJoy(joyO, { x: joyO.x + dx / Math.max(l, 1) * Math.min(l, R), y: joyO.y + dy / Math.max(l, 1) * Math.min(l, R) }); return; }
    if (e.pointerType === 'touch') return;
    const p = groundAt(e.clientX, e.clientY); IN.cursor = p; if (!p) return;
    if (IN.hold) IN.moveTo = p; if (IN.castHold) IN.castAt = p;
    cv.style.cursor = pickEnemy(p) ? 'crosshair' : pickCorpse(p, 0.9) ? 'cell' : 'default';
  });
  const up = e => { if (e.pointerId === joyId) { joyId = null; IN.joy = null; hideJoy(); return; } if (e.pointerType === 'touch') return; IN.hold = false; IN.castHold = false; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  addEventListener('keydown', e => { if (e.repeat && e.key !== 'Shift') return; const k = e.key.toLowerCase(); unlock();
    if (k === 'shift') IN.shift = true; else if (k === 'q') IN.raiseKey = true; else if (k === 'w') IN.mend = true; else if (k === 'tab' || k === 'c') { e.preventDefault(); toggleCrypt(); }
    else if (k === 'enter') IN.stairs = true; else if (k === 'escape') closeCrypt(); });
  addEventListener('keyup', e => { if (e.key === 'Shift') IN.shift = false; });
}
// screen-space stick direction -> world direction (camera looks diagonally: screen up = world (-1,0,-1))
function screenDir(sx, sy) { const r = Math.SQRT1_2; return { x: (sx + sy) * r * 1, z: (sy - sx) * r * 1, k: Math.hypot(sx, sy) }; }
function showJoy(o, k) { const j = $('#joy'); j.style.display = 'block'; j.style.left = o.x + 'px'; j.style.top = o.y + 'px'; const n = $('#joyK'); n.style.transform = `translate(${k.x - o.x}px,${k.y - o.y}px)`; }
function hideJoy() { $('#joy').style.display = 'none'; }

function hold(el, on, off) { el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); unlock(); el.classList.add('down'); on(); el.setPointerCapture(e.pointerId); });
  const f = e => { el.classList.remove('down'); off && off(); }; el.addEventListener('pointerup', f); el.addEventListener('pointercancel', f); }
function bindButtons() {
  hold($('#sAtk'), () => { IN.autoAtk = true; }, () => { IN.autoAtk = false; });
  hold($('#sRaise'), () => { IN.raiseKey = true; });
  hold($('#sMend'), () => { IN.mend = true; });
  hold($('#bCrypt'), () => toggleCrypt());
  hold($('#bStairs'), () => { IN.stairs = true; });
  hold($('#bSfx'), () => { setSfx(!sfxOn()); $('#bSfx').textContent = sfxOn() ? '🔊' : '🔇'; });
  $('#bSfx').textContent = sfxOn() ? '🔊' : '🔇';
  $('#crypt').addEventListener('pointerdown', e => { if (e.target.id === 'crypt' || e.target.id === 'cryptX') closeCrypt(); });
}

// ---------- crypt panel ----------
export let cryptOpen = false;
export function toggleCrypt() { cryptOpen ? closeCrypt() : openCrypt(); }
export function closeCrypt() { cryptOpen = false; $('#crypt').classList.remove('open'); }
function inCombat() { const P = G.player; return G.enemies.some(e => !e.dead && e.aggro && Math.hypot(e.x - P.x, e.z - P.z) < 10); }
export function openCrypt() { cryptOpen = true; $('#crypt').classList.add('open'); renderCrypt(); }
export function renderCrypt() {
  if (!cryptOpen) return; const max = partySize(G.level), n = activeCount();
  $('#cryptHead').innerHTML = `墓典 <span class="sub">出战 ${n} / ${max}　·　共 ${G.crypt.length} 只</span>`;
  const list = $('#cryptList'); list.innerHTML = '';
  if (!G.crypt.length) { list.innerHTML = `<div class="cEmpty">还没有召唤物。<br>打倒怪物后对尸体施放「唤魂」（${touchUI ? '右下按钮' : 'Q 键 / 点尸体'}）来收服它。</div>`; return; }
  for (const en of G.crypt.slice().sort((a, b) => (b.active - a.active) || (b.level - a.level))) {
    const T = TYPES[en.type], d = document.createElement('div'); d.className = 'card' + (en.active ? ' on' : '') + (en.champ ? ' champ' : '');
    const st = en.active ? (en.reviveT > 0 ? `复原中 ${Math.ceil(en.reviveT)}s` : '出战中') : '休息';
    const mod = en.champ && en.mods[0] ? `<span class="mod">${MODS[en.mods[0]].name}</span>` : '';
    d.innerHTML = `<div class="ic">${T.icon}</div><div class="info"><div class="nm">${mod}${T.name}</div><div class="lv">Lv ${en.level} · ${T.role} · <b>${st}</b></div>
      <div class="xp"><i style="width:${Math.min(100, en.xp / (xpNeed(en.level) * 0.8) * 100)}%"></i></div><div class="ds">${T.ally}</div></div>`;
    d.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation();
      if (inCombat()) { message('战斗中不能更换出战'); return; }
      if (en.active) { en.active = false; dismissAlly(en); }
      else { if (activeCount() >= max) { message(`出战已满（${max} 只），先让一只休息`); return; } en.active = true; if (en.reviveT <= 0) spawnAlly(en); }
      save(); renderCrypt(); });
    list.appendChild(d);
  }
}

// ---------- HUD (DOM, refreshed a few times per second) + overlay (every frame) ----------
let hudT = 0;
export function updateHUD(dt, fps) {
  hudT -= dt; const P = G.player; if (!P) return;
  const bar = (id, v) => { $(id).style.width = Math.max(0, Math.min(100, v * 100)) + '%'; };
  bar('#hpB', P.hp / P.maxHp); bar('#mpB', P.mp / P.maxMp); bar('#xpB', G.xp / xpNeed(G.level));
  if (hudT > 0) return; hudT = 0.2;
  $('#lvl').textContent = `Lv ${G.level} 召唤师`; $('#hpT').textContent = `${Math.ceil(P.hp)} / ${Math.round(P.maxHp)}`; $('#mpT').textContent = `${Math.floor(P.mp)} / ${Math.round(P.maxMp)}`;
  $('#floorTag').textContent = `墓穴 · 第 ${G.depth} 层`; $('#cryptN').textContent = G.crypt.length; if (fps != null) $('#fps').textContent = fps;
  const party = $('#party'), act = G.crypt.filter(e => e.active); party.innerHTML = '';
  for (const en of act) { const u = en.unit, T = TYPES[en.type], d = document.createElement('div'); d.className = 'pc' + (en.reviveT > 0 ? ' dead' : '');
    d.innerHTML = `<span class="ic">${T.icon}</span><div class="pi"><div class="pn">${en.champ && en.mods[0] ? MODS[en.mods[0]].name : ''}${T.name} <small>Lv${en.level}</small></div><div class="ph"><i style="width:${u && !u.dead ? u.hp / u.maxHp * 100 : 0}%"></i></div></div>${en.reviveT > 0 ? `<b class="rv">${Math.ceil(en.reviveT)}</b>` : ''}`;
    party.appendChild(d); }
  for (let i = act.length; i < partySize(G.level); i++) { const d = document.createElement('div'); d.className = 'pc empty'; d.innerHTML = '<span class="ic">＋</span><div class="pi"><div class="pn">空位</div></div>'; party.appendChild(d); }
  const near = G.corpses.filter(c => !c.claim && Math.hypot(c.x - P.x, c.z - P.z) < SKILLS.raise.range).length; const rb = $('#sRaise');
  rb.classList.toggle('ready', near > 0); $('#raiseN').textContent = near || ''; $('#raiseN').style.display = near ? 'flex' : 'none';
  const mc = Math.max(0, P.mendCD || 0); $('#sMend').style.setProperty('--cd', (mc / SKILLS.mend.cd * 100) + '%');
  const ns = G.floor && Math.hypot(P.x - G.floor.stairs.x, P.z - G.floor.stairs.z) < 1.3; $('#bStairs').classList.toggle('show', !!ns);
  if (cryptOpen) renderCrypt();
}
export function drawOverlay() {
  const c = $('#ov'), g = c.getContext('2d'); g.setTransform(ovScale, 0, 0, ovScale, 0, 0); g.clearRect(0, 0, W, H); const P = G.player; if (!P) return;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // enemy health bars + champion names
  for (const e of G.enemies) { if (e.dead || (e.barT <= 0 && !e.champ)) continue; const [x, y, vis] = toScreen(e.x, 1.6 * (e.champ ? 1.25 : 1) + (e.kind === 'brute' ? 0.2 : 0), e.z); if (!vis || x < -40 || x > W + 40 || y < -20 || y > H + 20) continue;
    const w = e.champ ? 56 : 38; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - w / 2 - 1, y - 3, w + 2, 6); g.fillStyle = e.champ ? '#ffb347' : '#e0413a'; g.fillRect(x - w / 2, y - 2, w * Math.max(0, e.hp / e.maxHp), 4);
    if (e.champ) { g.font = '700 12px system-ui,sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(e.name, x, y - 11); g.fillStyle = '#ffd58a'; g.fillText(e.name, x, y - 11); } }
  for (const a of G.friends) { if (a.side !== 'ally' || a.dead || a.hp >= a.maxHp) continue; const [x, y, vis] = toScreen(a.x, 1.55, a.z); if (!vis) continue;
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x - 17, y - 2, 34, 4); g.fillStyle = '#3fe0d0'; g.fillRect(x - 16, y - 1.5, 32 * a.hp / a.maxHp, 3); }
  // capturable corpses near the summoner
  g.font = '700 12px system-ui,sans-serif';
  for (const cp of G.corpses) { if (cp.claim) continue; const d = Math.hypot(cp.x - P.x, cp.z - P.z); if (d > SKILLS.raise.range + 2) continue; const [x, y, vis] = toScreen(cp.x, 0.5, cp.z); if (!vis) continue;
    const inR = d <= SKILLS.raise.range, txt = `唤魂 ${Math.round(captureChance(cp) * 100)}%`; g.globalAlpha = inR ? 1 : 0.45; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(txt, x, y - 4);
    g.fillStyle = inR ? '#8ff7ea' : '#cfc6d8'; g.fillText(txt, x, y - 4); g.globalAlpha = 1; }
  // raise channel beam
  if (P.state === 'channel' && P.chanC) { const [ax, ay] = toScreen(P.x, 1.2, P.z), [bx, by] = toScreen(P.chanC.x, 0.3, P.chanC.z), k = P.st / SKILLS.raise.channel;
    g.strokeStyle = `rgba(120,255,235,${0.5 + 0.4 * Math.sin(G.t * 30)})`; g.lineWidth = 3 + 3 * k; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 6; g.beginPath(); g.arc(bx, by - 26, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.stroke(); g.strokeStyle = '#8ff7ea'; g.lineWidth = 3; g.stroke(); }
  // floating numbers / words
  let j = 0; for (const m of G.msgs) { m.t += 1 / 60; if (m.t > m.max) continue; G.msgs[j++] = m; const [x, y, vis] = toScreen(m.x, m.y + m.t * 1.2, m.z); if (!vis) continue;
    g.globalAlpha = Math.min(1, (m.max - m.t) * 3); g.font = `800 ${m.size}px system-ui,sans-serif`; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(m.text, x, y); g.fillStyle = m.col; g.fillText(m.text, x, y); }
  G.msgs.length = j; g.globalAlpha = 1;
}
