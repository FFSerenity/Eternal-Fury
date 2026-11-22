// HUD, overlay text/bars, input (mouse + keyboard, touch joystick + buttons) and the crypt (墓典) panel
import * as THREE from 'three';
import { G, save } from './state.js';
import { isGunner, GUNNER, treeKey } from './data.js';
import { TYPES, MODS, SKILLS, xpNeed, partySize, TREE, soulPoints, soulXP, affixName, ROMAN, QUAL, WEAPONS, BAG_MAX, itemName, itemLines, itemIcon, itemScore, itemFits, furnaceOdds, furnaceRoll, rollItem } from './data.js';
import { captureChance, activeCount, spawnAlly, dismissAlly, Unit, absorb, learn, canFeed, canFuse, fusionOdds, fuse } from './units.js';
import { openGear, closeGear, gearOpen, toggleBag } from './gearui.js';
import { portrait } from './icons.js';
import { tr, ZH, LANG, setLang, SP } from './i18n.js';
import { cycleMap } from './minimap.js';
import { S } from './audio.js';
import { unlock, setSfx, sfxOn } from './audio.js';

const $ = s => document.querySelector(s);
export const IN = { joy: null, moveTo: null, hold: false, attack: null, castAt: null, castHold: false, autoAtk: false, raise: null, raiseKey: false, mend: false, stairs: false, cursor: null, shift: false };
export const touchUI = matchMedia('(pointer: coarse)').matches;
// fullscreen: Android / desktop browsers can do it from a tap; iPhone Safari can't (only "Add to Home Screen" removes the bars)
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
export const fsOK = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
export const isIPhone = /iPhone|iPod/.test(navigator.userAgent);
export const installed = !!navigator.standalone || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
export function goFull(on = true) {
  try { if (on && !fsEl()) { const el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen; const p = f && f.call(el, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); }
    else if (!on && fsEl()) { const f = document.exitFullscreen || document.webkitExitFullscreen; const p = f && f.call(document); if (p && p.catch) p.catch(() => {}); } } catch (e) {}
}
let cam = null, groundAt = null, W = 0, H = 0;
let onReset = null;
// static texts in index.html carry their English version in data-en / data-en-title / data-en-c
function applyLang() {
  document.documentElement.lang = ZH ? 'zh' : 'en'; document.body.classList.toggle('en', !ZH); document.title = tr('唤魂墓穴', 'Grave Tamer');
  if (ZH) return;
  for (const el of document.querySelectorAll('[data-en]')) el.textContent = el.dataset.en;
  for (const el of document.querySelectorAll('[data-en-title]')) el.title = el.dataset.enTitle;
  for (const el of document.querySelectorAll('[data-en-c]')) el.dataset.c = el.dataset.enC;
}
export function initUI(o) { applyLang(); cam = o.camera; groundAt = o.groundAt; onReset = o.reset; document.body.classList.toggle('touch', touchUI); bindInput(o.canvas); bindButtons(); }
export function resizeUI(w, h) { W = w; H = h; const c = $('#ov'), dpr = Math.min(devicePixelRatio || 1, 2); c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px'; ovScale = dpr; }
let ovScale = 1;
const V = new THREE.Vector3();
function toScreen(x, y, z) { V.set(x, y, z).project(cam); return [(V.x + 1) / 2 * W, (1 - V.y) / 2 * H, V.z < 1]; }

// ---------- messages ----------
let msgT = 0;
export function message(text, big = false, ms = 2200) {
  const box = $('#msg'), d = document.createElement('div'); d.className = 'm' + (big ? ' big' : ''); d.textContent = text; box.appendChild(d);
  while (box.children.length > 4) box.firstChild.remove(); setTimeout(() => d.classList.add('out'), ms); setTimeout(() => d.remove(), ms + 600);
}

// ---------- input ----------
function pickEnemy(p, r = 0.9) { let b = null, bd = r; for (const e of G.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.z - p.z) - e.r; if (d < bd) { bd = d; b = e; } } return b; }
export function pickCorpse(p, r = 1.0) { let b = null, bd = r; for (const c of G.corpses) { if (c.claim) continue; const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; b = c; } } return b; }
// clicks on walls, props or the dark outside keep the summoner walking toward them instead of stopping dead
const snapMove = (p, detour = true) => { const F = G.floor, P = G.player; if (!F || !P) return p;
  // in the camp, pointing at the crypt building means "walk into its door" (not to the nearest free spot beside it)
  // (the camera looks down along -x/-z, so a point h up on the building lands 0.69·h further back on the ground: sweep the box up its height)
  const c = F.crypt; if (c) for (let h = 0; h <= 5.2; h += 0.25) { const k = 0.69 * h; if (Math.abs(p.x + k - c.x) < 2.0 && Math.abs(p.z + k - c.z) < 2.65) return { ...F.stairs }; }
  return F.moveTarget(p.x, p.z, P.x, P.z, detour); }; // may be null: nowhere sensible to go, keep the current heading
// the camp coffin (until its secret is out): the click can land a little behind it, since it's raised off the ground
function pickCoffin(p) { const F = G.floor, c = F && F.coffin; if (!c || G.egg || G.depth !== 0) return false;
  for (let h = 0; h <= 0.7; h += 0.35) { const k = 0.69 * h; if (Math.abs(p.x + k - c.x) < 0.85 && Math.abs(p.z + k - c.z) < 0.85) return true; } return false; }
function bindInput(cv) {
  let joyId = null, joyO = null, clickAt = null;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    unlock(); e.preventDefault(); const p = groundAt(e.clientX, e.clientY); IN.cursor = p; IN.coffin = false;
    if (p && pickCoffin(p) && !(e.pointerType === 'touch' && e.clientX < W * 0.5)) { const c = G.floor.coffin, P = G.player; IN.coffin = true; IN.attack = null; IN.hold = false; IN.moveTo = G.floor.snapToward(c.x, c.z, P.x, P.z); return; }
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
    IN.attack = null; IN.hold = true; IN.moveTo = snapMove(p); clickAt = { t: performance.now(), p }; // a quick click (see up) may walk the long way round
  });
  cv.addEventListener('pointermove', e => {
    if (e.pointerId === joyId) { const dx = e.clientX - joyO.x, dy = e.clientY - joyO.y, l = Math.hypot(dx, dy), R = 56, k = Math.min(1, l / R);
      if (l < 6) IN.joy = null; else { const sx = dx / l * k, sy = dy / l * k; IN.joy = screenDir(sx, sy); } showJoy(joyO, { x: joyO.x + dx / Math.max(l, 1) * Math.min(l, R), y: joyO.y + dy / Math.max(l, 1) * Math.min(l, R) }); return; }
    if (e.pointerType === 'touch') return;
    const p = groundAt(e.clientX, e.clientY); IN.cursor = p; if (!p) return;
    if (IN.hold) { const m = snapMove(p); if (m) IN.moveTo = m; } if (IN.castHold) IN.castAt = p;
    cv.style.cursor = pickEnemy(p) ? 'crosshair' : pickCorpse(p, 0.9) ? 'cell' : pickCoffin(p) ? 'pointer' : 'default';
  });
  const up = e => { if (e.pointerId === joyId) { joyId = null; IN.joy = null; hideJoy(); return; } if (e.pointerType === 'touch') return;
    // a quick click (not a hold) on a spot only reachable the long way round: walk there
    if (IN.hold && clickAt && performance.now() - clickAt.t < 280 && G.floor && G.player) { const m = snapMove(clickAt.p, false); if (m) IN.moveTo = m; }
    clickAt = null; IN.hold = false; IN.castHold = false; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  addEventListener('keydown', e => { if (e.repeat && e.key !== 'Shift') return; const k = e.key.toLowerCase(); unlock();
    if (k === 'shift') IN.shift = true; else if (k === 'q') IN.raiseKey = true; else if (k === 'w') IN.mend = true; else if (k === 'tab' || k === 'c') { e.preventDefault(); toggleCrypt(); } else if (k === 'i' || k === 'b') { e.preventDefault(); toggleBag(); }
    else if (k === 'm') cycleMap(); else if (k === 'enter') IN.stairs = true; else if (k === 'escape') { closeCrypt(); closeGear(); } });
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
  hold($('#bGear'), () => toggleBag());
  // party cards (top left): tap a summon to open its equipment, an empty slot to open the 墓典
  $('#party').addEventListener('click', e => { const c = e.target.closest('.pc'); if (!c) return; e.stopPropagation(); unlock();
    if (c.dataset.id) { const en = G.crypt.find(x => x.id === +c.dataset.id); if (en) openGear(en); } else openCrypt(); });
  hold($('#bStairs'), () => { IN.stairs = true; });
  const sfxLabel = () => { $('#bSfx').textContent = sfxOn() ? '🔊 ' + tr('开', 'On') : '🔇 ' + tr('关', 'Off'); };
  hold($('#bSfx'), () => { setSfx(!sfxOn()); sfxLabel(); }); sfxLabel();
  const fsLabel = () => { $('#bFull').textContent = fsEl() ? '⛶ ' + tr('退出全屏', 'Exit fullscreen') : '⛶ ' + tr('全屏', 'Fullscreen'); };
  if (fsOK) { $('#bFull').addEventListener('click', e => { e.stopPropagation(); goFull(!fsEl()); }); document.addEventListener('fullscreenchange', fsLabel); document.addEventListener('webkitfullscreenchange', fsLabel); fsLabel(); }
  else { $('#bFull').style.display = 'none';
    if (isIPhone && !installed) $('#fsTip').textContent = tr('iPhone 的浏览器不能全屏：点 Safari 的分享按钮 →「添加到主屏幕」，以后从桌面图标打开就没有浏览器栏了。', 'iPhone browsers can’t go fullscreen: tap Share → “Add to Home Screen”, then open the game from that icon — no browser bars.');
    else $('#fsBox').style.display = 'none'; }
  if (isIPhone && !installed) $('#startTip').textContent = tr('📱 iPhone：分享 →「添加到主屏幕」，从桌面图标打开可全屏玩', '📱 iPhone: Share → “Add to Home Screen”, then open it from the icon to play fullscreen');
  // test helpers behind ↺: reset the dungeon (back to camp, fresh monsters) or wipe everything and start over; each needs a second tap
  const sm = $('#setMenu'), menu = $('#resetMenu'), shut = () => { sm.classList.remove('open'); for (const b of menu.querySelectorAll('.btn')) { b.classList.remove('arm'); b.textContent = b.dataset.l; } };
  for (const b of menu.querySelectorAll('.btn')) b.dataset.l = b.textContent;
  hold($('#bSet'), () => { sm.classList.contains('open') ? shut() : sm.classList.add('open'); });
  // language: saved, then the page reloads in the other language
  for (const b of sm.querySelectorAll('.lg')) { b.classList.toggle('cur', b.dataset.l === LANG);
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (b.dataset.l === LANG) return; save(); setLang(b.dataset.l); location.reload(); }); }
  menu.addEventListener('pointerdown', e => { e.stopPropagation(); const b = e.target.closest('.btn'); if (!b) return; e.preventDefault();
    if (!b.classList.contains('arm')) { for (const x of menu.querySelectorAll('.btn')) { x.classList.remove('arm'); x.textContent = x.dataset.l; } b.classList.add('arm'); b.textContent = b.dataset.c; return; }
    const what = b.dataset.r; shut(); onReset && onReset(what); });
  addEventListener('pointerdown', e => { if (sm.classList.contains('open') && !e.target.closest('#setMenu, #bSet')) shut(); });
  $('#crypt').addEventListener('pointerdown', e => { if (e.target.id === 'crypt' || e.target.id === 'cryptX') closeCrypt(); });
}

// ---------- crypt panel (墓典): list of summons; tap one to see its stats, spend 魂能点 on its skills and feed it other summons ----------
export let cryptOpen = false;
let sel = null, armed = null, sig = '', feedTab = 'eat';
export function toggleCrypt() { cryptOpen ? closeCrypt() : openCrypt(); }
export function closeCrypt() { cryptOpen = false; sel = null; $('#crypt').classList.remove('open'); }
function inCombat() { const P = G.player; return G.enemies.some(e => !e.dead && e.aggro && Math.hypot(e.x - P.x, e.z - P.z) < 10); }
export function openCrypt() { closeGear(); cryptOpen = true; sel = null; $('#crypt').classList.add('open'); renderCrypt(true); }
const tName = en => isGunner(en) ? GUNNER.name : TYPES[en.type].name;
const enName = en => (en.champ && en.mods.length ? `<span class="mod">${affixName(en.mods)}</span>` : '') + tName(en);
// coloured affix chips with their level
const chip = (m, lv = 1, short = false) => `<span class="achip" style="color:#${MODS[m].col.toString(16).padStart(6, '0')};border-color:#${MODS[m].col.toString(16).padStart(6, '0')}88">${short && !ZH ? MODS[m].short : MODS[m].name}${lv > 1 ? SP + ROMAN[lv - 1] : ''}</span>`;
const chips = (en, short = false) => en.champ ? en.mods.map(m => chip(m, (en.modLv && en.modLv[m]) || 1, short)).join('') : '';
// party cards: English names are long, so elites show their affixes as coloured dots instead of words
const dots = en => en.champ && en.mods && en.mods.length ? `<span class="mdots">${en.mods.map(m => `<i style="background:#${MODS[m].col.toString(16).padStart(6, '0')}"></i>`).join('')}</span>` : '';
const status = en => en.active ? (en.reviveT > 0 ? tr(`复原中 ${Math.ceil(en.reviveT)}s`, `reviving ${Math.ceil(en.reviveT)}s`) : tr('出战中', 'in party')) : tr('休息', 'resting');
function toggleActive(en) {
  if (inCombat()) { message(tr('战斗中不能更换出战', "Can't change the party during a fight")); return; } const max = partySize(G.level);
  if (en.active) { en.active = false; dismissAlly(en); }
  else { if (activeCount() >= max) { message(tr(`出战已满（${max} 只），先让一只休息`, `Party is full (${max}) — rest one first`)); return; } en.active = true; if (en.reviveT <= 0) spawnAlly(en); }
  save(); renderCrypt(true);
}
// two-tap confirm for destructive buttons
function arm(key) { if (armed && armed.k === key && performance.now() - armed.t < 3000) { armed = null; return true; } armed = { k: key, t: performance.now() }; renderCrypt(true); return false; }
const isArmed = key => armed && armed.k === key && performance.now() - armed.t < 3000;
function statsOf(en) { const o = { kind: en.type, side: 'ally', level: en.level, mods: en.mods, champ: en.champ, entry: en, T: TYPES[en.type] }; Unit.prototype.stats.call(o); return o; }
export function renderCrypt(force) {
  if (!cryptOpen) return; if (sel && !G.crypt.includes(sel)) sel = null;
  const s2 = JSON.stringify([sel && sel.id, armed && isArmed(armed.k) && armed.k, G.level, G.crypt.map(e => [e.id, e.active, Math.ceil(e.reviveT), e.level, Math.floor(e.xp), e.sp, e.skills, e.gear && e.gear.w && e.gear.w.id, e.gear && e.gear.a && e.gear.a.id])]);
  if (!force && s2 === sig) return; sig = s2;
  const max = partySize(G.level), n = activeCount(), list = $('#cryptList'), top = list.scrollTop;
  $('#cryptHead').innerHTML = tr(`墓典 <span class="sub">出战 ${n} / ${max}　·　共 ${G.crypt.length} 只</span>`, `Crypt <span class="sub">party ${n} / ${max} · ${G.crypt.length} total</span>`);
  list.innerHTML = ''; list.classList.toggle('detail', !!sel);
  if (!G.crypt.length) { list.innerHTML = tr(`<div class="cEmpty">还没有召唤物。<br>打倒怪物后对尸体施放「唤魂」（${touchUI ? '右下按钮' : 'Q 键 / 点尸体'}）来收服它。</div>`, `<div class="cEmpty">No summons yet.<br>Defeat monsters, then cast Raise (${touchUI ? 'the button at the bottom right' : 'Q, or click a corpse'}) to capture them.</div>`); return; }
  if (sel) { renderDetail(list, sel); return; }
  const feedN = G.crypt.filter(e => !e.champ && !e.active).length;
  if (feedN) { const tip = document.createElement('div'); tip.className = 'cTip'; tip.textContent = tr(`点召唤物查看技能。休息中的普通召唤物（${feedN} 只）可以转化成魂能，喂给你想培养的召唤物。`, `Tap a summon for its skills. Resting normal summons (${feedN}) can be absorbed as soul energy by the one you want to grow.`); list.appendChild(tip); }
  for (const en of G.crypt.slice().sort((a, b) => (b.active - a.active) || (b.champ - a.champ) || (b.level - a.level))) {
    const T = TYPES[en.type], d = document.createElement('div'); d.className = 'card' + (en.active ? ' on' : '') + (en.champ ? ' champ' : '');
    d.innerHTML = `<div class="ic">${portrait(en)}</div><div class="info"><div class="nm">${enName(en)}${en.sp ? `<span class="spb">✦${en.sp}</span>` : ''}</div><div class="lv">Lv ${en.level} · ${T.role} · <b>${status(en)}</b></div>
      <div class="xp"><i style="width:${Math.min(100, en.xp / (xpNeed(en.level) * 0.8) * 100)}%"></i></div><div class="ds">${T.ally}</div></div><button class="btn tg">${en.active ? tr('休息', 'Rest') : tr('出战', 'Join')}</button>`;
    d.addEventListener('click', e => { e.stopPropagation(); if (e.target.closest('.tg')) toggleActive(en); else { sel = en; armed = null; renderCrypt(true); $('#cryptList').scrollTop = 0; } });
    list.appendChild(d);
  }
  list.scrollTop = top;
}
function renderDetail(list, en) {
  const T = isGunner(en) ? { ...TYPES[en.type], ...GUNNER } : TYPES[en.type], st = statsOf(en), tree = TREE[treeKey(en)] || [], d = document.createElement('div'); d.className = 'det';
  const fuseList = G.crypt.filter(f => canFuse(f, en)).sort((a, b) => b.champ - a.champ || b.mods.length - a.mods.length || b.level - a.level);
  // one-click fusion: every plain (no-affix) partner, one by one, until something changes
  const plain = plainPartners(en), o0 = plain.length ? fusionOdds(en, plain[0]) : null, chance0 = o0 && (o0.elite || o0.add.length || o0.up.length);
  const allBar = plain.length > 1 && chance0 ? `<div class="fzAll"><div class="fzAllT">${tr(`把 ${plain.length} 只普通${TYPES[en.type].name}逐只融进来，一出现变化（${en.champ ? '属性强化' : '变成精英'}）就停下，剩下的留着`, `Fuses the ${plain.length} plain ${TYPES[en.type].name}s in one at a time and stops as soon as something changes (${en.champ ? 'an affix strengthens' : 'it turns elite'}); the rest are kept`)}</div>
    <button class="btn fzAllB${isArmed('fzall') ? ' arm' : ''}">${isArmed('fzall') ? tr('确认一键融合', 'Confirm') : tr(`一键融合（${plain.length} 只）`, `Fuse all (${plain.length})`)}</button></div>` : '';
  const need = xpNeed(en.level) * 0.8, feed = G.crypt.filter(f => canFeed(f, en)).sort((a, b) => (b.type === en.type) - (a.type === en.type) || b.level - a.level);
  const statLine = [`${tr('生命', 'Life')} <b>${Math.round(st.maxHp)}</b>`, `${tr('伤害', 'Damage')} <b>${st.dmg.toFixed(1)}</b>`, `${tr('护甲', 'Armour')} <b>${Math.round(st.armor)}</b>`, `${tr('攻击间隔', 'Interval')} <b>${st.cd.toFixed(2)}s</b>`, en.type === 'archer' || isGunner(en) ? `${tr('射程', 'Range')} <b>${st.range.toFixed(1)}</b>` : ''].filter(Boolean).join('　');
  d.innerHTML = `<div class="dHead"><button class="btn back">‹ ${tr('返回', 'Back')}</button><div class="ic">${portrait(en)}</div><div class="info"><div class="nm">${enName(en)}</div>
      <div class="lv">Lv ${en.level} · ${T.role} · <b>${status(en)}</b></div><div class="xp"><i style="width:${Math.min(100, en.xp / need * 100)}%"></i></div><div class="xpT">${tr('经验', 'XP')} ${Math.floor(en.xp)} / ${Math.round(need)}</div></div>
      <button class="btn tg">${en.active ? tr('休息', 'Rest') : tr('出战', 'Join')}</button></div>
    <div class="stats">${statLine}${en.champ ? en.mods.map(m => `<div class="affix">${chip(m, (en.modLv && en.modLv[m]) || 1)} ${MODS[m].desc}</div>`).join('') : ''}</div>
    <div class="secT">${tr('装备', 'Equipment')} <button class="btn toGear">${tr('打开装备界面', 'Open equipment')}</button></div>
    <div class="gsum">${['w', 'a'].map(sl => { const it = en.gear && en.gear[sl]; return `<span>${sl === 'w' ? tr('武器', 'Weapon') : tr('护甲', 'Armour')}: ${it ? `<b style="color:${QUAL[it.q].col}">${itemName(it)}</b>` : `<i>${tr('空', 'empty')}</i>`}</span>`; }).join('')}</div>
    <div class="secT">${tr('技能', 'Skills')} <span class="pts">${tr('魂能点', 'Soul points')} <b>${en.sp || 0}</b></span></div>
    <div class="skl">${tree.map(sk => { const r = (en.skills || {})[sk.id] || 0, mx = r >= sk.max;
      return `<div class="sr${r ? ' got' : ''}"><span class="si">${sk.icon}</span><div class="sd"><div class="sn">${sk.name}<span class="pips">${'●'.repeat(r)}${'○'.repeat(sk.max - r)}</span></div>
        <div class="sx">${r ? sk.desc(r) : sk.unlock ? sk.desc(0) : tr('1 级：', 'Rank 1: ') + sk.desc(1)}</div>${!mx && r ? `<div class="sx nx">${tr('下一级：', 'Next: ')}${sk.desc(r + 1)}</div>` : ''}</div>
        <button class="btn plus" data-id="${sk.id}" ${mx || !(en.sp > 0) ? 'disabled' : ''}>${mx ? tr('满', 'MAX') : '＋'}</button></div>`; }).join('')}</div>
    <div class="ftabs"><button class="btn ft${feedTab === 'eat' ? ' cur' : ''}" data-t="eat">${tr('吸收魂能', 'Absorb')} <b>${feed.length}</b></button><button class="btn ft${feedTab === 'fuse' ? ' cur' : ''}" data-t="fuse">${tr('融合', 'Fuse')} <b>${fuseList.length}</b></button></div>
    <div class="ftD">${feedTab === 'eat' ? tr('把休息中的普通召唤物转化成魂能：获得经验和魂能点（同类经验 +50%）', 'Turn a resting normal summon into soul energy: experience and soul points (+50% experience from the same kind)') : tr(`和休息中的同类召唤物融合：它会消失，${TYPES[en.type].name}可能变成精英、继承或强化特殊属性（一定会得到一些经验）`, `Fuse a resting ${TYPES[en.type].name} into this one: the partner is gone; this one may turn elite, inherit or strengthen affixes (always gains some experience)`)}</div>
    <div class="feed"${feedTab === 'eat' ? '' : ' style="display:none"'}>${feed.length ? feed.map(f => { const k = 'eat' + f.id;
      return `<div class="fr"><span class="ic">${portrait(f.type)}</span><div class="fn">${TYPES[f.type].name} <small>Lv ${f.level}</small></div><div class="gain">+${soulXP(f, en)} ${tr('经验', 'XP')} · +${soulPoints(f)} ${tr('点', 'pt')}</div>
        <button class="btn eat${isArmed(k) ? ' arm' : ''}" data-id="${f.id}">${isArmed(k) ? tr('确认转化', 'Confirm') : tr('转化', 'Absorb')}</button></div>`; }).join('') +
      (feed.length > 1 ? `<button class="btn eatAll${isArmed('all') ? ' arm' : ''}">${isArmed('all') ? tr('确认全部转化', 'Confirm all') : tr(`全部转化（${feed.length} 只）`, `Absorb all (${feed.length})`)}</button>` : '')
      : `<div class="fEmpty">${tr('墓典里没有可转化的召唤物。精英和出战中的不能转化；满员时收服的怪会存进墓典。', 'Nothing to absorb. Elites and party members cannot be absorbed; captures made with a full party are stored in the Crypt.')}</div>`}</div>
    <div class="feed fuse"${feedTab === 'fuse' ? '' : ' style="display:none"'}>${allBar}${fuseList.length ? fuseList.map(f => { const k = 'fuse' + f.id, o = fusionOdds(en, f), pc = v => Math.round(v * 100) + '%';
      const chance = [o.elite ? `${tr('成为精英', 'Turn elite')} ${pc(o.elite)}` : '', ...o.add.map(a => `${en.champ ? tr('新增', 'Add') : tr('继承', 'Inherit')} ${chip(a.m, 1, true)} ${pc(a.p)}`), ...o.up.map(u => `${tr('强化', 'Strengthen')} ${chip(u.m, Math.min(3, ((en.modLv && en.modLv[u.m]) || 1) + 1), true)} ${pc(u.p)}`)].filter(Boolean).map(t => `<span class="fo">${t}</span>`).join(' ') || `<span class="dim">${tr('只有经验', 'Experience only')}</span>`;
      return `<div class="fr"><span class="ic">${portrait(f.type)}</span><div class="fn">${ZH ? enName(f) : TYPES[f.type].name} <small>Lv ${f.level}</small>${chips(f) ? `<div class="fchips">${chips(f, !ZH)}</div>` : ''}</div>
        <div class="odds2">${chance}<br><span class="dim">+${o.xp} ${tr('经验', 'XP')}</span></div><button class="btn fz${isArmed(k) ? ' arm' : ''}" data-id="${f.id}">${isArmed(k) ? tr('确认融合', 'Confirm') : tr('融合', 'Fuse')}</button></div>`; }).join('')
      : `<div class="fEmpty">${tr(`墓典里没有休息中的${TYPES[en.type].name}可以融合。`, `No resting ${TYPES[en.type].name} in the Crypt to fuse with.`)}</div>`}</div>`;
  d.querySelector('.back').addEventListener('click', e => { e.stopPropagation(); sel = null; armed = null; renderCrypt(true); });
  d.querySelector('.toGear').addEventListener('click', e => { e.stopPropagation(); openGear(en); });
  d.querySelector('.tg').addEventListener('click', e => { e.stopPropagation(); toggleActive(en); });
  d.querySelectorAll('.plus').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); if (learn(en, b.dataset.id)) renderCrypt(true); }));
  const eat = list2 => { let pts = 0, xp = 0, up = 0; for (const f of list2) { const r = absorb(en, f); if (r) { pts += r.pts; xp += r.xp; up += r.up; } }
    message(tr(`${TYPES[en.type].name} 吸收了 ${list2.length} 只的魂能：+${xp} 经验，+${pts} 魂能点${up ? `，升到 Lv ${en.level}` : ''}`, `${TYPES[en.type].name} absorbed ${list2.length}: +${xp} XP, +${pts} soul points${up ? `, now Lv ${en.level}` : ''}`)); renderCrypt(true); };
  d.querySelectorAll('.eat').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const f = G.crypt.find(x => x.id === +b.dataset.id); if (f && arm('eat' + f.id)) eat([f]); }));
  const all = d.querySelector('.eatAll'); if (all) all.addEventListener('click', e => { e.stopPropagation(); if (arm('all')) eat(G.crypt.filter(f => canFeed(f, en))); });
  d.querySelectorAll('.ft').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); feedTab = b.dataset.t; armed = null; renderCrypt(true); }));
  d.querySelectorAll('.fz').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const f = G.crypt.find(x => x.id === +b.dataset.id); if (f && arm('fuse' + f.id)) fuseShow(en, f); }));
  const fa = d.querySelector('.fzAllB'); if (fa) fa.addEventListener('click', e => { e.stopPropagation(); if (arm('fzall')) fuseAll(en); });
  list.appendChild(d);
}

// fusion: two portraits drift together inside a spinning ring of soul light, a flash, then the outcome:
// a success bursts into rainbow light (rays, sparks in the affix colours, a rainbow frame), no change just glows softly
const hex = c => '#' + c.toString(16).padStart(6, '0');
const plainPartners = en => G.crypt.filter(f => canFuse(f, en) && !(f.champ && f.mods.length)).sort((a, b) => a.level - b.level || a.xp - b.xp);
function fuseShow(en, f) {
  const before = { champ: en.champ, mods: en.mods.slice() }, r = fuse(en, f); if (!r) { renderCrypt(true); return; }
  fuseAnim(en, f.type, r, before, 1);
}
function fuseAll(en) {
  const before = { champ: en.champ, mods: en.mods.slice() }, list = plainPartners(en), agg = { elite: false, added: [], upped: [], xp: 0, before: en.level }; let n = 0;
  for (const f of list) { const r = fuse(en, f); if (!r) break; n++; agg.xp += r.xp; agg.elite = agg.elite || r.elite; agg.added.push(...r.added); agg.upped.push(...r.upped); if (r.elite || r.added.length || r.upped.length) break; }
  if (!n) { renderCrypt(true); return; } fuseAnim(en, en.type, agg, before, n);
}
function fuseAnim(en, ftype, r, before, n) {
  const good = r.elite || r.added.length || r.upped.length, rnd = (a, b) => a + Math.random() * (b - a);
  const gained = [...r.added, ...r.upped], affCols = gained.map(m => hex(MODS[m].col)), rainbow = ['#ff5a5a', '#ffb347', '#ffe66d', '#6fe87a', '#5fd0ff', '#8f7dff', '#e67dff'];
  let motes = ''; for (let i = 0; i < 18; i++) { const a = rnd(0, 6.283), d = rnd(85, 130); motes += `<i class="fzM" style="--x:${(Math.cos(a) * d).toFixed(0)}px;--y:${(Math.sin(a) * d).toFixed(0)}px;--d:${rnd(0, 0.7).toFixed(2)}s;--c:${i % 3 ? '#6ff7e8' : '#b9a2ff'}"></i>`; }
  let sparks = ''; if (good) for (let i = 0; i < 42; i++) { const a = rnd(0, 6.283), d = rnd(90, 230), c = affCols.length && i % 2 ? affCols[i % affCols.length] : r.elite && i % 5 === 0 ? '#ffd36a' : rainbow[i % rainbow.length];
    sparks += `<i class="fzSp" style="--x:${(Math.cos(a) * d).toFixed(0)}px;--y:${(Math.sin(a) * d * 0.85).toFixed(0)}px;--d:${rnd(0, 0.15).toFixed(2)}s;--s:${rnd(4, 9).toFixed(1)}px;--c:${c}"></i>`; }
  S.raise(); const box = document.createElement('div'); box.id = 'fuseFx';
  box.innerHTML = `<div class="fzRow"><div class="fzRays"></div><div class="fzRingW"><div class="fzRing"></div></div>${motes}<div class="fzBurst"></div><div class="fzBurst b2"></div>${sparks}
    <div class="fzA">${portrait(en)}</div><div class="fzB">${portrait(ftype)}${n > 1 ? `<b class="fzN">×${n}</b>` : ''}</div></div><div class="fzT">${n > 1 ? tr(`融合中……（${n} 只）`, `Fusing… (${n})`) : tr('融合中……', 'Fusing…')}</div><div class="fzR"></div>
    <button class="btn ok" style="visibility:hidden">${tr('好', 'OK')}</button><div class="fzFlash"></div>`;
  if (good) box.style.setProperty('--gc', affCols[0] || '#ffd36a');
  $('#cryptBox').appendChild(box);
  setTimeout(() => { box.classList.add('merge'); }, 60);
  setTimeout(() => { box.classList.add('flash', good ? 'win' : 'meh'); if (good) S.level(); else S.caught();
    box.querySelector('.fzT').innerHTML = good ? `✨ ${enName(en)} ✨` : `${enName(en)}`;
    box.querySelector('.fzR').innerHTML = [r.elite ? `<div class="big">${tr('成为了精英！', 'Became an elite!')}</div>` : '', ...r.added.map(m => `<div>${r.elite && !before.champ ? tr('获得属性', 'Gained') : tr('新增属性', 'New affix')} ${chip(m)}</div>`),
      ...r.upped.map(m => `<div>${tr('属性强化', 'Strengthened')} ${chip(m, en.modLv[m])}</div>`), n > 1 ? `<div class="dim">${good ? tr(`第 ${n} 只成功`, `Succeeded on fusion #${n}`) : tr(`融合了 ${n} 只，都没有出现变化`, `Fused ${n}, nothing changed`)}</div>` : '', `<div class="dim">+${r.xp} ${tr('经验', 'XP')}${en.level > r.before ? tr(`，升到 Lv ${en.level}`, `, now Lv ${en.level}`) : ''}</div>`, !good && n === 1 ? `<div class="dim">${tr('这次没有出现变化', 'Nothing changed this time')}</div>` : ''].join('');
    box.querySelector('.ok').style.visibility = 'visible'; }, 1200);
  box.querySelector('.ok').addEventListener('click', e => { e.stopPropagation(); box.remove(); renderCrypt(true); });
}

// ---------- HUD (DOM, refreshed a few times per second) + overlay (every frame) ----------
let hudT = 0, partySig = '';
export function updateHUD(dt, fps) {
  hudT -= dt; const P = G.player; if (!P) return;
  const bar = (id, v) => { $(id).style.width = Math.max(0, Math.min(100, v * 100)) + '%'; };
  bar('#hpB', P.hp / P.maxHp); bar('#mpB', P.mp / P.maxMp); bar('#xpB', G.xp / xpNeed(G.level));
  if (hudT > 0) return; hudT = 0.2;
  $('#lvl').textContent = tr(`Lv ${G.level} 召唤师`, `Lv ${G.level} Summoner`); $('#hpT').textContent = `${Math.ceil(P.hp)} / ${Math.round(P.maxHp)}`; $('#mpT').textContent = `${Math.floor(P.mp)} / ${Math.round(P.maxMp)}`;
  $('#floorTag').textContent = G.depth === 0 ? (G.wild ? tr('墓园荒野', 'The Wilds') : tr('墓园营地', 'Graveyard Camp')) : tr(`墓穴 · 第 ${G.depth} 层`, `Crypt · Floor ${G.depth}`); $('#cryptN').textContent = G.crypt.length; $('#gearN').textContent = G.bag.length; if (fps != null) $('#fps').textContent = fps;
  // party cards: rebuilt only when something on them changes (so taps are not lost), hp bars updated in place
  const party = $('#party'), act = G.crypt.filter(e => e.active), psig = JSON.stringify([partySize(G.level), act.map(en => [en.id, en.level, en.sp, Math.ceil(en.reviveT), en.mods, isGunner(en)])]);
  if (psig !== partySig) { partySig = psig; party.innerHTML = '';
    for (const en of act) { const T = TYPES[en.type], d = document.createElement('div'); d.className = 'pc' + (en.reviveT > 0 ? ' dead' : '');
      d.dataset.id = en.id; d.title = tr('点开装备', 'Open equipment'); d.innerHTML = `<span class="ic">${portrait(en)}</span><div class="pi"><div class="pn">${ZH ? `<span class="pnn">${affixName(en.mods, en.champ)}${isGunner(en) ? GUNNER.name : T.name}</span>` : `<span class="pnn${en.champ && en.mods.length ? ' elite' : ''}">${isGunner(en) ? GUNNER.short : T.short}</span>${dots(en)}`}<small>Lv${en.level}</small>${en.sp ? `<span class="spb">✦${en.sp}</span>` : ''}</div><div class="ph"><i></i></div></div>${en.reviveT > 0 ? `<b class="rv">${Math.ceil(en.reviveT)}</b>` : ''}`;
      party.appendChild(d); }
    for (let i = act.length; i < partySize(G.level); i++) { const d = document.createElement('div'); d.className = 'pc empty'; d.title = tr('打开墓典', 'Open the Crypt'); d.innerHTML = `<span class="ic">＋</span><div class="pi"><div class="pn">${tr('空位', 'Empty slot')}</div></div>`; party.appendChild(d); } }
  for (const d of party.querySelectorAll('.pc[data-id]')) { const en = act.find(e => e.id === +d.dataset.id), u = en && en.unit, i = d.querySelector('.ph i'); if (i) i.style.width = (u && !u.dead ? u.hp / u.maxHp * 100 : 0) + '%'; }
  const near = G.corpses.filter(c => !c.claim && Math.hypot(c.x - P.x, c.z - P.z) < SKILLS.raise.range).length; const rb = $('#sRaise');
  rb.classList.toggle('ready', near > 0); $('#raiseN').textContent = near || ''; $('#raiseN').style.display = near ? 'flex' : 'none';
  const mc = Math.max(0, P.mendCD || 0); $('#sMend').style.setProperty('--cd', (mc / SKILLS.mend.cd * 100) + '%');
  const ns = G.floor && Math.hypot(P.x - G.floor.stairs.x, P.z - G.floor.stairs.z) < 1.3; $('#bStairs').classList.toggle('show', !!ns); if (ns) $('#bStairs').textContent = G.depth === 0 ? tr(`⬇ 进入墓穴${G.deep > 1 ? ' · 第 ' + G.deep + ' 层' : ''}`, `⬇ Enter the crypt${G.deep > 1 ? ' · floor ' + G.deep : ''}`) : tr('⬇ 下楼', '⬇ Descend');
  if (cryptOpen) renderCrypt();
}
export function drawOverlay() {
  const c = $('#ov'), g = c.getContext('2d'); g.setTransform(ovScale, 0, 0, ovScale, 0, 0); g.clearRect(0, 0, W, H); const P = G.player; if (!P) return;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // enemy health bars + champion names
  for (const e of G.enemies) { if (e.dead || (e.barT <= 0 && !e.champ)) continue; const [x, y, vis] = toScreen(e.x, 1.6 * (e.champ ? 1.25 : 1) + (e.kind === 'brute' ? 0.2 : 0), e.z); if (!vis || x < -40 || x > W + 40 || y < -20 || y > H + 20) continue;
    const w = e.champ ? 56 : 38; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - w / 2 - 1, y - 3, w + 2, 6); g.fillStyle = e.champ ? '#ffb347' : '#e0413a'; g.fillRect(x - w / 2, y - 2, w * Math.max(0, e.hp / e.maxHp), 4);
    if (e.champ) { g.font = '700 12px system-ui,sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(e.name, x, y - 11); g.fillStyle = '#ffd58a'; g.fillText(e.name, x, y - 11); }
    if (e.shred >= 1) { const t = '⬇' + Math.floor(e.shred); g.font = '800 11px system-ui,sans-serif'; g.textAlign = 'left'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(t, x + w / 2 + 4, y + 4); g.fillStyle = '#d9a8ff'; g.fillText(t, x + w / 2 + 4, y + 4); g.textAlign = 'center'; } }
  for (const a of G.friends) { if (a.side !== 'ally' || a.dead || a.hp >= a.maxHp) continue; const [x, y, vis] = toScreen(a.x, 1.55, a.z); if (!vis) continue;
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x - 17, y - 2, 34, 4); g.fillStyle = '#3fe0d0'; g.fillRect(x - 16, y - 1.5, 32 * a.hp / a.maxHp, 3); }
  // loot names
  g.font = '700 12px system-ui,sans-serif';
  for (const L of G.loot) { if (L.t < 0.45 || Math.abs(L.x - P.x) + Math.abs(L.z - P.z) > 18) continue; const [x, y, vis] = toScreen(L.x, 0.45, L.z); if (!vis) continue;
    const t = itemName(L.it); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(t, x, y - 8); g.fillStyle = QUAL[L.it.q].col; g.fillText(t, x, y - 8); }
  // capturable corpses near the summoner
  g.font = '700 12px system-ui,sans-serif';
  for (const cp of G.corpses) { if (cp.claim) continue; const d = Math.hypot(cp.x - P.x, cp.z - P.z); if (d > SKILLS.raise.range + 2) continue; const [x, y, vis] = toScreen(cp.x, 0.5, cp.z); if (!vis) continue;
    const inR = d <= SKILLS.raise.range, txt = `${tr('唤魂', 'Raise')} ${Math.round(captureChance(cp) * 100)}%`; g.globalAlpha = inR ? 1 : 0.45; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(txt, x, y - 4);
    g.fillStyle = inR ? '#8ff7ea' : '#cfc6d8'; g.fillText(txt, x, y - 4); g.globalAlpha = 1; }
  // lightning bolts: jagged, flickering polylines between units
  if (G.bolts.length) { g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const b of G.bolts) { const [ax, ay, va] = toScreen(b.ax, 0.9, b.az), [bx, by, vb] = toScreen(b.bx, 0.9, b.bz); if (!va && !vb) continue;
      const n = 7, pts = [[ax, ay]], len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / (len || 1), ny = (bx - ax) / (len || 1);
      for (let i = 1; i < n; i++) { const k = i / n, j = (Math.random() - 0.5) * Math.min(26, len * 0.25); pts.push([ax + (bx - ax) * k + nx * j, ay + (by - ay) * k + ny * j]); } pts.push([bx, by]);
      for (const [w, c] of [[7, 'rgba(255,230,90,.35)'], [3, 'rgba(255,248,190,.95)'], [1.2, '#ffffff']]) { g.lineWidth = w; g.strokeStyle = c; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); } }
    g.restore(); }
  // floating numbers / words
  let j = 0; for (const m of G.msgs) { m.t += 1 / 60; if (m.t > m.max) continue; G.msgs[j++] = m; const [x, y, vis] = toScreen(m.x, m.y + m.t * 1.2, m.z); if (!vis) continue;
    g.globalAlpha = Math.min(1, (m.max - m.t) * 3); g.font = `800 ${m.size}px system-ui,sans-serif`; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(m.text, x, y); g.fillStyle = m.col; g.fillText(m.text, x, y); }
  G.msgs.length = j; g.globalAlpha = 1;
}
