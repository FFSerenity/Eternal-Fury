// HUD, overlay text/bars, input (mouse + keyboard, touch joystick + buttons) and the crypt (墓典) panel
import * as THREE from 'three';
import { G, save } from './state.js';
import { TYPES, MODS, SKILLS, xpNeed, partySize, TREE, soulPoints, soulXP, QUAL, WEAPONS, BAG_MAX, itemName, itemLines, itemIcon, itemScore, itemFits, furnaceOdds, furnaceRoll, rollItem } from './data.js';
import { captureChance, activeCount, spawnAlly, dismissAlly, Unit, absorb, learn, canFeed, equip, unequip } from './units.js';
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
  // test helper: two taps → back to the camp, the crypt is generated again with fresh monsters
  let rArm = 0; const rb = $('#bReset');
  hold(rb, () => { if (performance.now() - rArm < 3000) { rArm = 0; rb.classList.remove('arm'); rb.textContent = '↺'; onReset && onReset(); return; }
    rArm = performance.now(); rb.classList.add('arm'); rb.textContent = '确认重置？'; setTimeout(() => { if (performance.now() - rArm >= 2900) { rb.classList.remove('arm'); rb.textContent = '↺'; } }, 3000); });
  $('#crypt').addEventListener('pointerdown', e => { if (e.target.id === 'crypt' || e.target.id === 'cryptX') closeCrypt(); });
}

// ---------- crypt panel (墓典): list of summons; tap one to see its stats, spend 魂能点 on its skills and feed it other summons ----------
export let cryptOpen = false;
let sel = null, armed = null, sig = '', tab = 'sum', pickSlot = null; const furn = new Set();
export function toggleCrypt() { cryptOpen ? closeCrypt() : openCrypt(); }
export function closeCrypt() { cryptOpen = false; sel = null; $('#crypt').classList.remove('open'); }
function inCombat() { const P = G.player; return G.enemies.some(e => !e.dead && e.aggro && Math.hypot(e.x - P.x, e.z - P.z) < 10); }
export function openCrypt() { cryptOpen = true; sel = null; pickSlot = null; $('#crypt').classList.add('open'); renderCrypt(true); }
const enName = en => (en.champ && en.mods[0] ? `<span class="mod">${MODS[en.mods[0]].name}</span>` : '') + TYPES[en.type].name;
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
  for (const id of [...furn]) if (!G.bag.some(it => it.id === id)) furn.delete(id);
  const s2 = JSON.stringify([tab, pickSlot, [...furn], G.bag.map(it => it.id), sel && sel.id, armed && isArmed(armed.k) && armed.k, G.level, G.crypt.map(e => [e.id, e.active, Math.ceil(e.reviveT), e.level, Math.floor(e.xp), e.sp, e.skills, e.gear && e.gear.w && e.gear.w.id, e.gear && e.gear.a && e.gear.a.id])]);
  if (!force && s2 === sig) return; sig = s2;
  const max = partySize(G.level), n = activeCount(), list = $('#cryptList'), top = list.scrollTop;
  $('#cryptHead').innerHTML = `墓典 <span class="sub">出战 ${n} / ${max}　·　共 ${G.crypt.length} 只</span><div class="tabs"><button class="btn${tab === 'sum' ? ' cur' : ''}" data-t="sum">召唤物</button><button class="btn${tab === 'gear' ? ' cur' : ''}" data-t="gear">装备 · 熔炉 <b>${G.bag.length}/${BAG_MAX}</b></button></div>`;
  $('#cryptHead').querySelectorAll('.tabs .btn').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); tab = b.dataset.t; sel = null; pickSlot = null; armed = null; renderCrypt(true); list.scrollTop = 0; }));
  list.innerHTML = ''; list.classList.toggle('detail', !!sel || tab === 'gear');
  if (tab === 'gear') { renderGear(list); list.scrollTop = top; return; }
  if (!G.crypt.length) { list.innerHTML = `<div class="cEmpty">还没有召唤物。<br>打倒怪物后对尸体施放「唤魂」（${touchUI ? '右下按钮' : 'Q 键 / 点尸体'}）来收服它。</div>`; return; }
  if (sel) { renderDetail(list, sel); return; }
  const feedN = G.crypt.filter(e => !e.champ && !e.active).length;
  if (feedN) { const tip = document.createElement('div'); tip.className = 'cTip'; tip.textContent = `点召唤物查看技能。休息中的普通召唤物（${feedN} 只）可以转化成魂能，喂给你想培养的召唤物。`; list.appendChild(tip); }
  for (const en of G.crypt.slice().sort((a, b) => (b.active - a.active) || (b.champ - a.champ) || (b.level - a.level))) {
    const T = TYPES[en.type], d = document.createElement('div'); d.className = 'card' + (en.active ? ' on' : '') + (en.champ ? ' champ' : '');
    d.innerHTML = `<div class="ic">${T.icon}</div><div class="info"><div class="nm">${enName(en)}${en.sp ? `<span class="spb">✦${en.sp}</span>` : ''}</div><div class="lv">Lv ${en.level} · ${T.role} · <b>${status(en)}</b></div>
      <div class="xp"><i style="width:${Math.min(100, en.xp / (xpNeed(en.level) * 0.8) * 100)}%"></i></div><div class="ds">${T.ally}</div></div><button class="btn tg">${en.active ? '休息' : '出战'}</button>`;
    d.addEventListener('click', e => { e.stopPropagation(); if (e.target.closest('.tg')) toggleActive(en); else { sel = en; armed = null; pickSlot = null; renderCrypt(true); $('#cryptList').scrollTop = 0; } });
    list.appendChild(d);
  }
  list.scrollTop = top;
}
function renderDetail(list, en) {
  const T = TYPES[en.type], st = statsOf(en), tree = TREE[en.type] || [], d = document.createElement('div'); d.className = 'det';
  const need = xpNeed(en.level) * 0.8, feed = G.crypt.filter(f => canFeed(f, en)).sort((a, b) => (b.type === en.type) - (a.type === en.type) || b.level - a.level);
  const statLine = [`生命 <b>${Math.round(st.maxHp)}</b>`, `伤害 <b>${st.dmg.toFixed(1)}</b>`, `护甲 <b>${Math.round(st.armor)}</b>`, `攻击间隔 <b>${st.cd.toFixed(2)}s</b>`, en.type === 'archer' ? `射程 <b>${st.range.toFixed(1)}</b>` : ''].filter(Boolean).join('　');
  d.innerHTML = `<div class="dHead"><button class="btn back">‹ 返回</button><div class="ic">${T.icon}</div><div class="info"><div class="nm">${enName(en)}</div>
      <div class="lv">Lv ${en.level} · ${T.role} · <b>${status(en)}</b></div><div class="xp"><i style="width:${Math.min(100, en.xp / need * 100)}%"></i></div><div class="xpT">经验 ${Math.floor(en.xp)} / ${Math.round(need)}</div></div>
      <button class="btn tg">${en.active ? '休息' : '出战'}</button></div>
    <div class="stats">${statLine}${en.champ && en.mods[0] ? `<div class="affix">${MODS[en.mods[0]].name}：${MODS[en.mods[0]].desc}</div>` : ''}</div>
    <div class="secT">装备 <small>武器只能用本类型的（${WEAPONS[en.type].cat}），护甲谁都能穿</small></div>
    <div class="gear">${['w', 'a'].map(sl => gearSlot(en, sl)).join('')}</div>
    <div class="secT">技能 <span class="pts">魂能点 <b>${en.sp || 0}</b></span></div>
    <div class="skl">${tree.map(sk => { const r = (en.skills || {})[sk.id] || 0, mx = r >= sk.max;
      return `<div class="sr${r ? ' got' : ''}"><span class="si">${sk.icon}</span><div class="sd"><div class="sn">${sk.name}<span class="pips">${'●'.repeat(r)}${'○'.repeat(sk.max - r)}</span></div>
        <div class="sx">${r ? sk.desc(r) : /解锁/.test(sk.desc(0)) ? sk.desc(0) : '1 级：' + sk.desc(1)}</div>${!mx && r ? `<div class="sx nx">下一级：${sk.desc(r + 1)}</div>` : ''}</div>
        <button class="btn plus" data-id="${sk.id}" ${mx || !(en.sp > 0) ? 'disabled' : ''}>${mx ? '满' : '＋'}</button></div>`; }).join('')}</div>
    <div class="secT">吸收魂能 <small>把休息中的普通召唤物转化成魂能：获得经验和魂能点（同类经验 +50%）</small></div>
    <div class="feed">${feed.length ? feed.map(f => { const k = 'eat' + f.id;
      return `<div class="fr"><span class="ic">${TYPES[f.type].icon}</span><div class="fn">${TYPES[f.type].name} <small>Lv ${f.level}</small></div><div class="gain">+${soulXP(f, en)} 经验 · +${soulPoints(f)} 点</div>
        <button class="btn eat${isArmed(k) ? ' arm' : ''}" data-id="${f.id}">${isArmed(k) ? '确认转化' : '转化'}</button></div>`; }).join('') +
      (feed.length > 1 ? `<button class="btn eatAll${isArmed('all') ? ' arm' : ''}">${isArmed('all') ? '确认全部转化' : `全部转化（${feed.length} 只）`}</button>` : '')
      : `<div class="fEmpty">墓典里没有可转化的召唤物。精英和出战中的不能转化；满员时收服的怪会存进墓典。</div>`}</div>`;
  d.querySelector('.back').addEventListener('click', e => { e.stopPropagation(); sel = null; armed = null; pickSlot = null; renderCrypt(true); });
  d.querySelectorAll('.gs .chg').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); pickSlot = pickSlot === b.dataset.s ? null : b.dataset.s; renderCrypt(true); }));
  d.querySelectorAll('.gs .off').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); unequip(en, b.dataset.s); pickSlot = null; renderCrypt(true); }));
  d.querySelectorAll('.pk').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const it = G.bag.find(x => x.id === +b.dataset.id); if (it && equip(en, it)) { message(`${TYPES[en.type].name} 装备了 ${itemName(it)}`); pickSlot = null; renderCrypt(true); } }));
  d.querySelector('.tg').addEventListener('click', e => { e.stopPropagation(); toggleActive(en); });
  d.querySelectorAll('.plus').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); if (learn(en, b.dataset.id)) renderCrypt(true); }));
  const eat = list2 => { let pts = 0, xp = 0, up = 0; for (const f of list2) { const r = absorb(en, f); if (r) { pts += r.pts; xp += r.xp; up += r.up; } }
    message(`${TYPES[en.type].name} 吸收了 ${list2.length} 只的魂能：+${xp} 经验，+${pts} 魂能点${up ? `，升到 Lv ${en.level}` : ''}`); renderCrypt(true); };
  d.querySelectorAll('.eat').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const f = G.crypt.find(x => x.id === +b.dataset.id); if (f && arm('eat' + f.id)) eat([f]); }));
  const all = d.querySelector('.eatAll'); if (all) all.addEventListener('click', e => { e.stopPropagation(); if (arm('all')) eat(G.crypt.filter(f => canFeed(f, en))); });
  list.appendChild(d);
}

// ---------- equipment ----------
const itemRow = (it, extra = '') => `<span class="ic">${itemIcon(it)}</span><div class="idt"><div class="in" style="color:${QUAL[it.q].col}">${itemName(it)} <small>物品等级 ${it.il}</small></div>
  <div class="il">${itemLines(it).join(' · ')}${extra}</div></div>`;
function gearSlot(en, sl) {
  const it = en.gear && en.gear[sl], label = sl === 'w' ? `武器（${WEAPONS[en.type].cat}）` : '护甲（盾）';
  const cand = G.bag.filter(x => x.slot === sl && itemFits(x, en.type)).sort((a, b) => itemScore(b) - itemScore(a)), cur = itemScore(it);
  let h = `<div class="gs">${it ? itemRow(it) : `<span class="ic dim">${sl === 'w' ? TYPES[en.type].icon : '🛡️'}</span><div class="idt"><div class="in dim">${label}：空</div><div class="il">${cand.length ? `背包里有 ${cand.length} 件可用` : '背包里没有可用的'}</div></div>`}
    <button class="btn chg" data-s="${sl}" ${cand.length ? '' : 'disabled'}>${pickSlot === sl ? '收起' : it ? '更换' : '装备'}</button>${it ? `<button class="btn off" data-s="${sl}">卸下</button>` : ''}</div>`;
  if (pickSlot === sl) h += `<div class="pick">${cand.map(x => { const sc = itemScore(x), up = sc > cur + 0.5, dn = sc < cur - 0.5;
    return `<div class="pr">${itemRow(x)}<span class="cmp ${up ? 'up' : dn ? 'dn' : ''}">${up ? '▲' : dn ? '▼' : '＝'}</span><button class="btn pk" data-id="${x.id}">装备</button></div>`; }).join('')}</div>`;
  return h;
}
function renderGear(list) {
  const d = document.createElement('div'); d.className = 'det gearTab'; const items = G.bag.slice().sort((a, b) => b.q - a.q || (a.slot > b.slot ? 1 : -1) || (a.type || '').localeCompare(b.type || '') || b.il - a.il);
  const chosen = G.bag.filter(it => furn.has(it.id)), o = furnaceOdds(chosen), pc = v => Math.round(v * 100) + '%';
  d.innerHTML = `<div class="furn"><div class="fh">🔥 熔炉 <small>把不要的装备丢进去，随机熔出一件新装备。丢得越多、品质越好，出好东西的几率越大（至少 2 件）。</small></div>
    <div class="odds">${chosen.length ? `<span style="color:${QUAL[2].col}">稀有 ${pc(o.gold)}</span><span style="color:${QUAL[1].col}">精良 ${pc(o.blue)}</span><span style="color:${QUAL[0].col}">普通 ${pc(o.white)}</span>` : '<span class="dim">点下面的装备选中，再点熔炼</span>'}</div>
    <div class="fb"><button class="btn sw">选中所有普通</button><button class="btn sc" ${chosen.length ? '' : 'disabled'}>清空</button><button class="btn go${isArmed('furn') ? ' arm' : ''}" ${chosen.length >= 2 ? '' : 'disabled'}>${isArmed('furn') ? '确认熔炼？' : `熔炼（${chosen.length} 件）`}</button></div></div>
    <div class="bag">${items.length ? items.map(it => `<div class="it${furn.has(it.id) ? ' on' : ''}" data-id="${it.id}">${itemRow(it, ` · ${it.slot === 'w' ? '适用：' + TYPES[it.type].name : '所有召唤物'}`)}<span class="chk">✓</span></div>`).join('')
      : '<div class="fEmpty">背包是空的。打怪会掉装备（精英必掉），走过去自动拾取；装备在墓典里点召唤物穿上。</div>'}</div>`;
  d.querySelectorAll('.it').forEach(r => r.addEventListener('click', e => { e.stopPropagation(); const id = +r.dataset.id; furn.has(id) ? furn.delete(id) : furn.add(id); armed = null; renderCrypt(true); }));
  d.querySelector('.sw').addEventListener('click', e => { e.stopPropagation(); for (const it of G.bag) if (it.q === 0) furn.add(it.id); renderCrypt(true); });
  d.querySelector('.sc').addEventListener('click', e => { e.stopPropagation(); furn.clear(); armed = null; renderCrypt(true); });
  d.querySelector('.go').addEventListener('click', e => { e.stopPropagation(); if (chosen.length < 2) return; if (!(chosen.some(it => it.q > 0)) || arm('furn')) smelt(chosen); });
  list.appendChild(d);
}
// smelting: the inputs are gone at once, the result is shown after a short slot-machine reel
function smelt(chosen) {
  const res = furnaceRoll(chosen, G.uid++), odds = furnaceOdds(chosen); G.bag = G.bag.filter(it => !chosen.includes(it)); G.bag.push(res); furn.clear(); armed = null; save(); S.fire();
  const box = document.createElement('div'); box.id = 'lotto'; box.innerHTML = '<div class="lt">熔炉里火光翻滚……</div><div class="reel"></div><button class="btn ok" style="visibility:hidden">收下</button>';
  $('#cryptBox').appendChild(box); const reel = box.querySelector('.reel'); let dly = 45;
  const show = it => { reel.innerHTML = `<div class="ri" style="color:${QUAL[it.q].col};border-color:${QUAL[it.q].col}">${itemRow(it)}</div>`; };
  const tick = () => { if (dly > 300) { show(res); reel.className = 'reel done q' + res.q; box.querySelector('.lt').textContent = res.q === 2 ? '✨ 熔出了稀有装备！' : res.q === 1 ? '熔出了精良装备' : '熔出了一件普通装备';
      box.querySelector('.ok').style.visibility = 'visible'; if (res.q === 2) S.level(); else if (res.q === 1) S.caught(); else S.pick(); return; }
    const r = Math.random(); show(rollItem(0, res.il, r < odds.gold ? 2 : r < odds.gold + odds.blue ? 1 : 0)); S.pick(); dly *= 1.13; setTimeout(tick, dly); };
  tick(); box.querySelector('.ok').addEventListener('click', e => { e.stopPropagation(); box.remove(); renderCrypt(true); });
  renderCrypt(true);
}

// ---------- HUD (DOM, refreshed a few times per second) + overlay (every frame) ----------
let hudT = 0;
export function updateHUD(dt, fps) {
  hudT -= dt; const P = G.player; if (!P) return;
  const bar = (id, v) => { $(id).style.width = Math.max(0, Math.min(100, v * 100)) + '%'; };
  bar('#hpB', P.hp / P.maxHp); bar('#mpB', P.mp / P.maxMp); bar('#xpB', G.xp / xpNeed(G.level));
  if (hudT > 0) return; hudT = 0.2;
  $('#lvl').textContent = `Lv ${G.level} 召唤师`; $('#hpT').textContent = `${Math.ceil(P.hp)} / ${Math.round(P.maxHp)}`; $('#mpT').textContent = `${Math.floor(P.mp)} / ${Math.round(P.maxMp)}`;
  $('#floorTag').textContent = G.depth === 0 ? '墓园营地' : `墓穴 · 第 ${G.depth} 层`; $('#cryptN').textContent = G.crypt.length; if (fps != null) $('#fps').textContent = fps;
  const party = $('#party'), act = G.crypt.filter(e => e.active); party.innerHTML = '';
  for (const en of act) { const u = en.unit, T = TYPES[en.type], d = document.createElement('div'); d.className = 'pc' + (en.reviveT > 0 ? ' dead' : '');
    d.innerHTML = `<span class="ic">${T.icon}</span><div class="pi"><div class="pn">${en.champ && en.mods[0] ? MODS[en.mods[0]].name : ''}${T.name} <small>Lv${en.level}</small>${en.sp ? `<span class="spb">✦${en.sp}</span>` : ''}</div><div class="ph"><i style="width:${u && !u.dead ? u.hp / u.maxHp * 100 : 0}%"></i></div></div>${en.reviveT > 0 ? `<b class="rv">${Math.ceil(en.reviveT)}</b>` : ''}`;
    party.appendChild(d); }
  for (let i = act.length; i < partySize(G.level); i++) { const d = document.createElement('div'); d.className = 'pc empty'; d.innerHTML = '<span class="ic">＋</span><div class="pi"><div class="pn">空位</div></div>'; party.appendChild(d); }
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
  // raise channel beam
  if (P.state === 'channel' && P.chanC) { const [ax, ay] = toScreen(P.x, 1.2, P.z), [bx, by] = toScreen(P.chanC.x, 0.3, P.chanC.z), k = P.st / (SKILLS.raise.channel / 0.8);
    g.strokeStyle = `rgba(120,255,235,${0.5 + 0.4 * Math.sin(G.t * 30)})`; g.lineWidth = 3 + 3 * k; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 6; g.beginPath(); g.arc(bx, by - 26, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.stroke(); g.strokeStyle = '#8ff7ea'; g.lineWidth = 3; g.stroke(); }
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
