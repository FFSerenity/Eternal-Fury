// HUD, overlay text/bars, input (mouse + keyboard, touch joystick + buttons) and the crypt (墓典) panel
import * as THREE from 'three';
import { G, save } from './state.js';
import { TYPES, MODS, SKILLS, xpNeed, partySize, TREE, soulPoints, soulXP, affixName, ROMAN, QUAL, WEAPONS, BAG_MAX, itemName, itemLines, itemIcon, itemScore, itemFits, furnaceOdds, furnaceRoll, rollItem } from './data.js';
import { captureChance, activeCount, spawnAlly, dismissAlly, Unit, absorb, learn, canFeed, canFuse, fusionOdds, fuse } from './units.js';
import { openGear, closeGear, gearOpen, toggleBag } from './gearui.js';
import { portrait } from './icons.js';
import { S } from './audio.js';
import { unlock, setSfx, sfxOn } from './audio.js';

const $ = s => document.querySelector(s);
export const IN = { joy: null, moveTo: null, hold: false, attack: null, castAt: null, castHold: false, autoAtk: false, raise: null, raiseKey: false, mend: false, stairs: false, cursor: null, shift: false };
export const touchUI = matchMedia('(pointer: coarse)').matches;
let cam = null, groundAt = null, W = 0, H = 0;
let onReset = null;
export function initUI(o) { cam = o.camera; groundAt = o.groundAt; onReset = o.reset; document.body.classList.toggle('touch', touchUI); bindInput(o.canvas); bindButtons(); }
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
// clicks on walls, props or the dark outside keep the summoner walking toward them instead of stopping dead
const snapMove = p => { const F = G.floor, P = G.player; if (!F || !P) return p; const s = F.snapToward(p.x, p.z, P.x, P.z);
  return Math.hypot(s.x - P.x, s.z - P.z) < 0.6 ? F.nearestWalk(p.x, p.z) : s; };
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
    IN.attack = null; IN.moveTo = snapMove(p); IN.hold = true;
  });
  cv.addEventListener('pointermove', e => {
    if (e.pointerId === joyId) { const dx = e.clientX - joyO.x, dy = e.clientY - joyO.y, l = Math.hypot(dx, dy), R = 56, k = Math.min(1, l / R);
      if (l < 6) IN.joy = null; else { const sx = dx / l * k, sy = dy / l * k; IN.joy = screenDir(sx, sy); } showJoy(joyO, { x: joyO.x + dx / Math.max(l, 1) * Math.min(l, R), y: joyO.y + dy / Math.max(l, 1) * Math.min(l, R) }); return; }
    if (e.pointerType === 'touch') return;
    const p = groundAt(e.clientX, e.clientY); IN.cursor = p; if (!p) return;
    if (IN.hold) IN.moveTo = snapMove(p); if (IN.castHold) IN.castAt = p;
    cv.style.cursor = pickEnemy(p) ? 'crosshair' : pickCorpse(p, 0.9) ? 'cell' : 'default';
  });
  const up = e => { if (e.pointerId === joyId) { joyId = null; IN.joy = null; hideJoy(); return; } if (e.pointerType === 'touch') return; IN.hold = false; IN.castHold = false; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  addEventListener('keydown', e => { if (e.repeat && e.key !== 'Shift') return; const k = e.key.toLowerCase(); unlock();
    if (k === 'shift') IN.shift = true; else if (k === 'q') IN.raiseKey = true; else if (k === 'w') IN.mend = true; else if (k === 'tab' || k === 'c') { e.preventDefault(); toggleCrypt(); } else if (k === 'i' || k === 'b') { e.preventDefault(); toggleBag(); }
    else if (k === 'enter') IN.stairs = true; else if (k === 'escape') { closeCrypt(); closeGear(); } });
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
  hold($('#bSfx'), () => { setSfx(!sfxOn()); $('#bSfx').textContent = sfxOn() ? '🔊' : '🔇'; });
  $('#bSfx').textContent = sfxOn() ? '🔊' : '🔇';
  // test helpers behind ↺: reset the dungeon (back to camp, fresh monsters) or wipe everything and start over; each needs a second tap
  const menu = $('#resetMenu'), shut = () => { menu.classList.remove('open'); for (const b of menu.querySelectorAll('.btn')) { b.classList.remove('arm'); b.textContent = b.dataset.l; } };
  for (const b of menu.querySelectorAll('.btn')) b.dataset.l = b.textContent;
  hold($('#bReset'), () => { menu.classList.contains('open') ? shut() : menu.classList.add('open'); });
  menu.addEventListener('pointerdown', e => { e.stopPropagation(); const b = e.target.closest('.btn'); if (!b) return; e.preventDefault();
    if (!b.classList.contains('arm')) { for (const x of menu.querySelectorAll('.btn')) { x.classList.remove('arm'); x.textContent = x.dataset.l; } b.classList.add('arm'); b.textContent = b.dataset.c; return; }
    const what = b.dataset.r; shut(); onReset && onReset(what); });
  addEventListener('pointerdown', e => { if (menu.classList.contains('open') && !e.target.closest('#resetMenu, #bReset')) shut(); });
  $('#crypt').addEventListener('pointerdown', e => { if (e.target.id === 'crypt' || e.target.id === 'cryptX') closeCrypt(); });
}

// ---------- crypt panel (墓典): list of summons; tap one to see its stats, spend 魂能点 on its skills and feed it other summons ----------
export let cryptOpen = false;
let sel = null, armed = null, sig = '', feedTab = 'eat';
export function toggleCrypt() { cryptOpen ? closeCrypt() : openCrypt(); }
export function closeCrypt() { cryptOpen = false; sel = null; $('#crypt').classList.remove('open'); }
function inCombat() { const P = G.player; return G.enemies.some(e => !e.dead && e.aggro && Math.hypot(e.x - P.x, e.z - P.z) < 10); }
export function openCrypt() { closeGear(); cryptOpen = true; sel = null; $('#crypt').classList.add('open'); renderCrypt(true); }
const enName = en => (en.champ && en.mods.length ? `<span class="mod">${affixName(en.mods)}</span>` : '') + TYPES[en.type].name;
// coloured affix chips with their level
const chip = (m, lv = 1) => `<span class="achip" style="color:#${MODS[m].col.toString(16).padStart(6, '0')};border-color:#${MODS[m].col.toString(16).padStart(6, '0')}88">${MODS[m].name}${ROMAN[lv - 1] || ''}</span>`;
const chips = en => en.champ ? en.mods.map(m => chip(m, (en.modLv && en.modLv[m]) || 1)).join('') : '';
const status = en => en.active ? (en.reviveT > 0 ? `复原中 ${Math.ceil(en.reviveT)}s` : '出战中') : '休息';
function toggleActive(en) {
  if (inCombat()) { message('战斗中不能更换出战'); return; } const max = partySize(G.level);
  if (en.active) { en.active = false; dismissAlly(en); }
  else { if (activeCount() >= max) { message(`出战已满（${max} 只），先让一只休息`); return; } en.active = true; if (en.reviveT <= 0) spawnAlly(en); }
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
  $('#cryptHead').innerHTML = `墓典 <span class="sub">出战 ${n} / ${max}　·　共 ${G.crypt.length} 只</span>`;
  list.innerHTML = ''; list.classList.toggle('detail', !!sel);
  if (!G.crypt.length) { list.innerHTML = `<div class="cEmpty">还没有召唤物。<br>打倒怪物后对尸体施放「唤魂」（${touchUI ? '右下按钮' : 'Q 键 / 点尸体'}）来收服它。</div>`; return; }
  if (sel) { renderDetail(list, sel); return; }
  const feedN = G.crypt.filter(e => !e.champ && !e.active).length;
  if (feedN) { const tip = document.createElement('div'); tip.className = 'cTip'; tip.textContent = `点召唤物查看技能。休息中的普通召唤物（${feedN} 只）可以转化成魂能，喂给你想培养的召唤物。`; list.appendChild(tip); }
  for (const en of G.crypt.slice().sort((a, b) => (b.active - a.active) || (b.champ - a.champ) || (b.level - a.level))) {
    const T = TYPES[en.type], d = document.createElement('div'); d.className = 'card' + (en.active ? ' on' : '') + (en.champ ? ' champ' : '');
    d.innerHTML = `<div class="ic">${portrait(en.type)}</div><div class="info"><div class="nm">${enName(en)}${en.sp ? `<span class="spb">✦${en.sp}</span>` : ''}</div><div class="lv">Lv ${en.level} · ${T.role} · <b>${status(en)}</b></div>
      <div class="xp"><i style="width:${Math.min(100, en.xp / (xpNeed(en.level) * 0.8) * 100)}%"></i></div><div class="ds">${T.ally}</div></div><button class="btn tg">${en.active ? '休息' : '出战'}</button>`;
    d.addEventListener('click', e => { e.stopPropagation(); if (e.target.closest('.tg')) toggleActive(en); else { sel = en; armed = null; renderCrypt(true); $('#cryptList').scrollTop = 0; } });
    list.appendChild(d);
  }
  list.scrollTop = top;
}
function renderDetail(list, en) {
  const T = TYPES[en.type], st = statsOf(en), tree = TREE[en.type] || [], d = document.createElement('div'); d.className = 'det';
  const fuseList = G.crypt.filter(f => canFuse(f, en)).sort((a, b) => b.champ - a.champ || b.mods.length - a.mods.length || b.level - a.level);
  const need = xpNeed(en.level) * 0.8, feed = G.crypt.filter(f => canFeed(f, en)).sort((a, b) => (b.type === en.type) - (a.type === en.type) || b.level - a.level);
  const statLine = [`生命 <b>${Math.round(st.maxHp)}</b>`, `伤害 <b>${st.dmg.toFixed(1)}</b>`, `护甲 <b>${Math.round(st.armor)}</b>`, `攻击间隔 <b>${st.cd.toFixed(2)}s</b>`, en.type === 'archer' ? `射程 <b>${st.range.toFixed(1)}</b>` : ''].filter(Boolean).join('　');
  d.innerHTML = `<div class="dHead"><button class="btn back">‹ 返回</button><div class="ic">${portrait(en.type)}</div><div class="info"><div class="nm">${enName(en)}</div>
      <div class="lv">Lv ${en.level} · ${T.role} · <b>${status(en)}</b></div><div class="xp"><i style="width:${Math.min(100, en.xp / need * 100)}%"></i></div><div class="xpT">经验 ${Math.floor(en.xp)} / ${Math.round(need)}</div></div>
      <button class="btn tg">${en.active ? '休息' : '出战'}</button></div>
    <div class="stats">${statLine}${en.champ ? en.mods.map(m => `<div class="affix">${chip(m, (en.modLv && en.modLv[m]) || 1)} ${MODS[m].desc}</div>`).join('') : ''}</div>
    <div class="secT">装备 <button class="btn toGear">打开装备界面</button></div>
    <div class="gsum">${['w', 'a'].map(sl => { const it = en.gear && en.gear[sl]; return `<span>${sl === 'w' ? '武器' : '护甲'}：${it ? `<b style="color:${QUAL[it.q].col}">${itemName(it)}</b>` : '<i>空</i>'}</span>`; }).join('')}</div>
    <div class="secT">技能 <span class="pts">魂能点 <b>${en.sp || 0}</b></span></div>
    <div class="skl">${tree.map(sk => { const r = (en.skills || {})[sk.id] || 0, mx = r >= sk.max;
      return `<div class="sr${r ? ' got' : ''}"><span class="si">${sk.icon}</span><div class="sd"><div class="sn">${sk.name}<span class="pips">${'●'.repeat(r)}${'○'.repeat(sk.max - r)}</span></div>
        <div class="sx">${r ? sk.desc(r) : /解锁/.test(sk.desc(0)) ? sk.desc(0) : '1 级：' + sk.desc(1)}</div>${!mx && r ? `<div class="sx nx">下一级：${sk.desc(r + 1)}</div>` : ''}</div>
        <button class="btn plus" data-id="${sk.id}" ${mx || !(en.sp > 0) ? 'disabled' : ''}>${mx ? '满' : '＋'}</button></div>`; }).join('')}</div>
    <div class="ftabs"><button class="btn ft${feedTab === 'eat' ? ' cur' : ''}" data-t="eat">吸收魂能 <b>${feed.length}</b></button><button class="btn ft${feedTab === 'fuse' ? ' cur' : ''}" data-t="fuse">融合 <b>${fuseList.length}</b></button></div>
    <div class="ftD">${feedTab === 'eat' ? '把休息中的普通召唤物转化成魂能：获得经验和魂能点（同类经验 +50%）' : `和休息中的同类召唤物融合：它会消失，${TYPES[en.type].name}可能变成精英、继承或强化特殊属性（一定会得到一些经验）`}</div>
    <div class="feed"${feedTab === 'eat' ? '' : ' style="display:none"'}>${feed.length ? feed.map(f => { const k = 'eat' + f.id;
      return `<div class="fr"><span class="ic">${portrait(f.type)}</span><div class="fn">${TYPES[f.type].name} <small>Lv ${f.level}</small></div><div class="gain">+${soulXP(f, en)} 经验 · +${soulPoints(f)} 点</div>
        <button class="btn eat${isArmed(k) ? ' arm' : ''}" data-id="${f.id}">${isArmed(k) ? '确认转化' : '转化'}</button></div>`; }).join('') +
      (feed.length > 1 ? `<button class="btn eatAll${isArmed('all') ? ' arm' : ''}">${isArmed('all') ? '确认全部转化' : `全部转化（${feed.length} 只）`}</button>` : '')
      : `<div class="fEmpty">墓典里没有可转化的召唤物。精英和出战中的不能转化；满员时收服的怪会存进墓典。</div>`}</div>
    <div class="feed fuse"${feedTab === 'fuse' ? '' : ' style="display:none"'}>${fuseList.length ? fuseList.map(f => { const k = 'fuse' + f.id, o = fusionOdds(en, f), pc = v => Math.round(v * 100) + '%';
      const chance = [o.elite ? `成为精英 ${pc(o.elite)}` : '', ...o.add.map(a => `${en.champ ? '新增' : '继承'} ${chip(a.m)} ${pc(a.p)}`), ...o.up.map(u => `强化 ${chip(u.m, Math.min(3, ((en.modLv && en.modLv[u.m]) || 1) + 1))} ${pc(u.p)}`)].filter(Boolean).join('　') || '<span class="dim">只有经验</span>';
      return `<div class="fr"><span class="ic">${portrait(f.type)}</span><div class="fn">${enName(f)} <small>Lv ${f.level}</small>${chips(f) ? `<div class="fchips">${chips(f)}</div>` : ''}</div>
        <div class="odds2">${chance}<br><span class="dim">+${o.xp} 经验</span></div><button class="btn fz${isArmed(k) ? ' arm' : ''}" data-id="${f.id}">${isArmed(k) ? '确认融合' : '融合'}</button></div>`; }).join('')
      : `<div class="fEmpty">墓典里没有休息中的${TYPES[en.type].name}可以融合。</div>`}</div>`;
  d.querySelector('.back').addEventListener('click', e => { e.stopPropagation(); sel = null; armed = null; renderCrypt(true); });
  d.querySelector('.toGear').addEventListener('click', e => { e.stopPropagation(); openGear(en); });
  d.querySelector('.tg').addEventListener('click', e => { e.stopPropagation(); toggleActive(en); });
  d.querySelectorAll('.plus').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); if (learn(en, b.dataset.id)) renderCrypt(true); }));
  const eat = list2 => { let pts = 0, xp = 0, up = 0; for (const f of list2) { const r = absorb(en, f); if (r) { pts += r.pts; xp += r.xp; up += r.up; } }
    message(`${TYPES[en.type].name} 吸收了 ${list2.length} 只的魂能：+${xp} 经验，+${pts} 魂能点${up ? `，升到 Lv ${en.level}` : ''}`); renderCrypt(true); };
  d.querySelectorAll('.eat').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const f = G.crypt.find(x => x.id === +b.dataset.id); if (f && arm('eat' + f.id)) eat([f]); }));
  const all = d.querySelector('.eatAll'); if (all) all.addEventListener('click', e => { e.stopPropagation(); if (arm('all')) eat(G.crypt.filter(f => canFeed(f, en))); });
  d.querySelectorAll('.ft').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); feedTab = b.dataset.t; armed = null; renderCrypt(true); }));
  d.querySelectorAll('.fz').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const f = G.crypt.find(x => x.id === +b.dataset.id); if (f && arm('fuse' + f.id)) fuseShow(en, f); }));
  list.appendChild(d);
}

// fusion: two portraits drift together, flash, and the outcome is revealed
function fuseShow(en, f) {
  const before = { champ: en.champ, mods: en.mods.slice() }, r = fuse(en, f); if (!r) { renderCrypt(true); return; }
  S.raise(); const box = document.createElement('div'); box.id = 'fuseFx';
  box.innerHTML = `<div class="fzRow"><div class="fzA">${portrait(en.type)}</div><div class="fzB">${portrait(f.type)}</div></div><div class="fzT">融合中……</div><div class="fzR"></div><button class="btn ok" style="visibility:hidden">好</button>`;
  $('#cryptBox').appendChild(box);
  setTimeout(() => { box.classList.add('merge'); }, 60);
  setTimeout(() => { box.classList.add('flash'); const good = r.elite || r.added.length || r.upped.length; if (good) S.level(); else S.caught();
    box.querySelector('.fzT').innerHTML = good ? `✨ ${enName(en)}` : `${enName(en)}`;
    box.querySelector('.fzR').innerHTML = [r.elite ? '<div>成为了精英！</div>' : '', ...r.added.map(m => `<div>${r.elite && !before.champ ? '获得属性' : '新增属性'} ${chip(m)}</div>`),
      ...r.upped.map(m => `<div>属性强化 ${chip(m, en.modLv[m])}</div>`), `<div class="dim">+${r.xp} 经验${en.level > r.before ? `，升到 Lv ${en.level}` : ''}</div>`, !good ? '<div class="dim">这次没有出现变化</div>' : ''].join('');
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
  $('#lvl').textContent = `Lv ${G.level} 召唤师`; $('#hpT').textContent = `${Math.ceil(P.hp)} / ${Math.round(P.maxHp)}`; $('#mpT').textContent = `${Math.floor(P.mp)} / ${Math.round(P.maxMp)}`;
  $('#floorTag').textContent = G.depth === 0 ? '墓园营地' : `墓穴 · 第 ${G.depth} 层`; $('#cryptN').textContent = G.crypt.length; $('#gearN').textContent = G.bag.length; if (fps != null) $('#fps').textContent = fps;
  // party cards: rebuilt only when something on them changes (so taps are not lost), hp bars updated in place
  const party = $('#party'), act = G.crypt.filter(e => e.active), psig = JSON.stringify([partySize(G.level), act.map(en => [en.id, en.level, en.sp, Math.ceil(en.reviveT), en.mods])]);
  if (psig !== partySig) { partySig = psig; party.innerHTML = '';
    for (const en of act) { const T = TYPES[en.type], d = document.createElement('div'); d.className = 'pc' + (en.reviveT > 0 ? ' dead' : '');
      d.dataset.id = en.id; d.title = '点开装备'; d.innerHTML = `<span class="ic">${portrait(en.type)}</span><div class="pi"><div class="pn">${affixName(en.mods, en.champ)}${T.name} <small>Lv${en.level}</small>${en.sp ? `<span class="spb">✦${en.sp}</span>` : ''}</div><div class="ph"><i></i></div></div>${en.reviveT > 0 ? `<b class="rv">${Math.ceil(en.reviveT)}</b>` : ''}`;
      party.appendChild(d); }
    for (let i = act.length; i < partySize(G.level); i++) { const d = document.createElement('div'); d.className = 'pc empty'; d.title = '打开墓典'; d.innerHTML = '<span class="ic">＋</span><div class="pi"><div class="pn">空位</div></div>'; party.appendChild(d); } }
  for (const d of party.querySelectorAll('.pc[data-id]')) { const en = act.find(e => e.id === +d.dataset.id), u = en && en.unit, i = d.querySelector('.ph i'); if (i) i.style.width = (u && !u.dead ? u.hp / u.maxHp * 100 : 0) + '%'; }
  const near = G.corpses.filter(c => !c.claim && Math.hypot(c.x - P.x, c.z - P.z) < SKILLS.raise.range).length; const rb = $('#sRaise');
  rb.classList.toggle('ready', near > 0); $('#raiseN').textContent = near || ''; $('#raiseN').style.display = near ? 'flex' : 'none';
  const mc = Math.max(0, P.mendCD || 0); $('#sMend').style.setProperty('--cd', (mc / SKILLS.mend.cd * 100) + '%');
  const ns = G.floor && Math.hypot(P.x - G.floor.stairs.x, P.z - G.floor.stairs.z) < 1.3; $('#bStairs').classList.toggle('show', !!ns); if (ns) $('#bStairs').textContent = G.depth === 0 ? `⬇ 进入墓穴${G.deep > 1 ? ' · 第 ' + G.deep + ' 层' : ''}` : '⬇ 下楼';
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
  // loot names
  g.font = '700 12px system-ui,sans-serif';
  for (const L of G.loot) { if (L.t < 0.45 || Math.abs(L.x - P.x) + Math.abs(L.z - P.z) > 18) continue; const [x, y, vis] = toScreen(L.x, 0.45, L.z); if (!vis) continue;
    const t = itemName(L.it); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(t, x, y - 8); g.fillStyle = QUAL[L.it.q].col; g.fillText(t, x, y - 8); }
  // capturable corpses near the summoner
  g.font = '700 12px system-ui,sans-serif';
  for (const cp of G.corpses) { if (cp.claim) continue; const d = Math.hypot(cp.x - P.x, cp.z - P.z); if (d > SKILLS.raise.range + 2) continue; const [x, y, vis] = toScreen(cp.x, 0.5, cp.z); if (!vis) continue;
    const inR = d <= SKILLS.raise.range, txt = `唤魂 ${Math.round(captureChance(cp) * 100)}%`; g.globalAlpha = inR ? 1 : 0.45; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(txt, x, y - 4);
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
