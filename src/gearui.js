// Two Diablo-style panels sharing one layout:
//  - 装备 (opened from a summon's card at the top left): live 3D paperdoll of that summon with weapon / shield frames + the bag
//  - 背包 (🎒 button / I): the bag + the furnace (熔炉), with an auto-fill button
// Items are moved by picking them up and putting them down (click / tap); right-click or double-tap is a quick move.
// A fixed info box shows the hovered or held item, so nothing jumps around.
import * as THREE from 'three';
import { G, save, bagPut, bagFree, PACT } from './state.js';
import { TYPES, MODS, QUAL, affixName, WEAPONS, BAG_MAX, itemName, itemLines, itemScore, itemFits, itemBase, furnaceOdds, furnaceRoll, rollItem, techName, TECH_PITY, rareItems,
  HERO_GEAR, heroFurnaceOdds, heroFurnaceRoll, heroOddsQ, rollHeroItem } from './data.js';
import { heroEntry, heroName, SETS } from './pact.js';
import { furyBrief } from './pactui.js';
import { setGear, Unit, ANIM } from './units.js';
import { makeUnitMesh, play, heroWeaponPose, ZY_IDLE } from './assets.js';
import { initR, lit, itemIconURL as iconOf, portrait } from './icons.js';
import { S } from './audio.js';
import { message, closeCrypt, touchUI } from './ui.js';
import { tr } from './i18n.js';

const $ = s => document.querySelector(s), FURN_N = 12;
export let gearOpen = false;
let mode = 'bag', selEn = null, held = null, built = false, raf = 0, last = 0, infoIt = null;

// ---------- paperdoll ----------
let R = null, dollScene, dollCam, doll = null, dollKey = '';
function setDoll() {
  const en = selEn, key = en && mode === 'doll' ? en.id + ':' + (en.gear?.w?.id || 0) + ':' + (en.gear?.a?.id || 0) + ':' + (en.wset || '') : ''; if (key === dollKey) return; dollKey = key;
  if (doll) { dollScene.remove(doll.root); doll = null; } if (!key) return;
  doll = makeUnitMesh(en.type, { gear: en.gear, elems: en.champ ? en.mods : null, tint: en.mods.includes('stone') ? 0xb8b4ac : 0xffffff, hero: en.hero, wset: en.wset });
  dollScene.add(doll.root); play(doll, doll.gun || doll.muz ? '2H_Ranged_Aiming' : en.hero && en.wset === 'SPR' ? ZY_IDLE : ANIM[en.type].idle, {}); doll.mixer.update(0); // two-handed tech weapons: held up, not dragged on the floor
  // (赵云: his calm stand, the spear upright beside him — 'Stand' is his Unreal fighting guard now, crouched, head down, for the field)
  const box = new THREE.Box3().setFromObject(doll.root), h = box.max.y - box.min.y || 1.2;
  dollCam.position.set(0, h * 0.62, h * 2.55); dollCam.lookAt(0, h * 0.48, 0); doll.root.rotation.y = 0.5;
}
function loop(t) {
  if (!gearOpen) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
  const box = $('#gDoll'); if (mode !== 'doll' || !box || !doll) return; const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
  if (R.domElement.parentNode !== box) box.appendChild(R.domElement);
  const pr = Math.min(2, devicePixelRatio || 1); if (R.getPixelRatio() !== pr || R.domElement.width !== Math.round(w * pr) || R.domElement.height !== Math.round(h * pr)) { R.setPixelRatio(pr); R.setSize(w, h, false); dollCam.aspect = w / h; dollCam.updateProjectionMatrix(); }
  doll.mixer.update(dt); doll.root.rotation.y += dt * 0.35;
  if (selEn && selEn.hero) heroWeaponPose({ mesh: doll, fury: G.pact.stacks, dead: false, spawnT: 0, x: 0, z: 0 }, dt, null); // its crest and soul light as on the field
  if (selEn && selEn.hero && (briefT -= dt) <= 0) { briefT = 0.5; const el = $('#gsFw'); if (el) { const h = furyBrief(); if (h !== el.__h) { el.__h = h; el.innerHTML = h; } } } lit(() => R.render(dollScene, dollCam));
}

// ---------- containers ----------
const at = (c, p) => c === 'bag' ? G.bag.find(i => i.pos === p) : c === 'furn' ? G.furn.find(i => i.fpos === p) : selEn && selEn.gear ? selEn.gear[c] : null;
function take(c, p) {
  const it = at(c, p); if (!it) return null;
  if (c === 'bag') G.bag.splice(G.bag.indexOf(it), 1); else if (c === 'furn') G.furn.splice(G.furn.indexOf(it), 1); else setGear(selEn, c, null);
  return it;
}
const furnFree = () => { const u = new Set(G.furn.map(i => i.fpos)); for (let p = 0; p < FURN_N; p++) if (!u.has(p)) return p; return -1; };
const twoHanded = en => !!(en && en.hero && en.gear && en.gear.w && en.gear.w.hero && HERO_GEAR[en.gear.w.hero].two);
const fitsSlot = (it, c) => (c === 'w' ? it.slot === 'w' && itemFits(it, selEn.type, selEn.hero) : it.slot === 'a' && (selEn.hero ? !!it.hero && !twoHanded(selEn) : !it.hero));
// putting a greatsword in: the shield comes off into the bag first (refused if the bag has no room for it)
function freeOffHand(it) { if (!selEn || !selEn.hero || !it.hero || !HERO_GEAR[it.hero].two || !selEn.gear || !selEn.gear.a) return true;
  if (bagFree() < 0) { S.fail(); message(tr('背包满了，放不下换下来的盾牌', 'Bag is full — no room for the shield')); return false; }
  bagPut(setGear(selEn, 'a', null)); message(tr('双手大剑占着两只手：盾牌收回背包', 'The greatsword takes both hands: the shield goes back to the bag')); return true; }
function put(c, p, it) { // returns the displaced item (or null)
  if (c === 'bag') { const o = take('bag', p); it.pos = p; G.bag.push(it); return o; }
  if (c === 'furn') { const o = take('furn', p); it.fpos = p; G.furn.push(it); return o; }
  return setGear(selEn, c, it);
}
function returnHeld() {
  if (!held) return; const it = held.it, f = held.from;
  if ((f === 'w' || f === 'a') && selEn && !selEn.gear?.[f] && fitsSlot(it, f)) setGear(selEn, f, it);
  else if (!bagPut(it, f === 'bag' ? held.pos : null)) { const fp = furnFree(); if (fp >= 0) { it.fpos = fp; G.furn.push(it); } }
  held = null;
}
function cantUse(it, c) { S.fail();
  if (selEn && selEn.hero) { message(!it.hero ? tr('骸骨卫士用不了这件（这是墓穴模式召唤物的装备）', "The Bone Sentinel can't use this (it's gear for the Crypt's summons)")
    : c === 'a' && it.slot === 'a' ? tr('双手大剑占着两只手，盾牌格不能用', 'The greatsword takes both hands: no shield with it') : tr('这里放不下', "Doesn't go there")); return; }
  if (it.hero) { message(tr('这是骸骨卫士的装备', "That's gear for the Bone Sentinel")); return; }
  message(it.slot === 'w' ? tr(`${TYPES[selEn.type].name}用不了${itemBase(it).cat || WEAPONS[it.type].cat}，这是${TYPES[it.type].name}的武器`, `A ${TYPES[selEn.type].name} can't use this — it's a ${TYPES[it.type].name}'s ${WEAPONS[it.type].cat.toLowerCase()}`) : tr('这里放不下', "Doesn't fit here")); }
const noSmelt = () => { S.fail(); message(tr('史诗装备不能熔炼', "Epic items can't be smelted")); };
let lastPick = null;
// touch: a tap highlights an item (it stays where it is); a tap on an empty cell, a frame or the forge moves it there (swapping with what
// is there); a tap on another item in the same grid highlights that one instead; the info box offers the one-tap move. The mouse keeps
// picking items up and putting them down.
let tsel = null, lastPT = null, briefT = 0;
const tapMode = () => (lastPT ? lastPT !== 'mouse' : touchUI);
const stash = o => { if (!o) return; if (!bagPut(o)) { const fp = furnFree(); if (fp >= 0) { o.fpos = fp; G.furn.push(o); } } };
function tapCell(c, p) {
  if ((c === 'w' || c === 'a') && !selEn) return;
  const it = at(c, p), now = performance.now();
  if (tsel && tsel.c === c && tsel.p === p) { const dbl = now - tsel.t < 380; tsel = null; if (dbl && it) quick(c, p); else render(); return; } // tapped again: off (twice quickly: the quick move)
  if (!tsel || !at(tsel.c, tsel.p)) { tsel = null; if (it) { tsel = { c, p, t: now }; infoIt = it; S.gear(); } render(); return; }
  if (it && tsel.c === c && c !== 'w' && c !== 'a') { tsel = { c, p, t: now }; infoIt = it; S.gear(); render(); return; } // another item in the same grid
  const from = tsel; tsel = null; moveTo(from, c, p);
}
function moveTo(from, c, p) {
  const it = at(from.c, from.p); if (!it) { render(); return; }
  if ((c === 'w' || c === 'a') && !fitsSlot(it, c)) { cantUse(it, c); render(); return; }
  if (c === 'furn' && it.uniq) { noSmelt(); render(); return; }
  take(from.c, from.p);
  if (c === 'w' && !freeOffHand(it)) { stash(put(from.c, from.p, it)); render(); return; }
  const o = put(c, p, it);
  if (o) { if (from.c === 'w' || from.c === 'a') stash(fitsSlot(o, from.c) ? setGear(selEn, from.c, o) : o); else stash(put(from.c, from.p, o)); } // what was there goes where the moved one came from
  if (c === 'furn') S.furnIn(); else S.gear(); infoIt = it; save(); render();
}
function clickCell(c, p) {
  if (tapMode()) { tapCell(c, p); return; } tsel = null;
  if ((c === 'w' || c === 'a') && !selEn) return;
  const now = performance.now();
  if (!held) { const it = take(c, p); if (!it) return; held = { it, from: c, pos: p }; lastPick = { c, p, t: now }; S.gear(); }
  else { // a quick second tap on the same cell = double-click: quick move
    if (lastPick && lastPick.c === c && lastPick.p === p && now - lastPick.t < 380 && held.from === c) { lastPick = null; put(c, p, held.it); held = null; quick(c, p); return; }
    if ((c === 'w' || c === 'a') && !fitsSlot(held.it, c)) { cantUse(held.it, c); return; }
    if (c === 'w' && !freeOffHand(held.it)) return;
    if (c === 'furn' && held.it.uniq) { noSmelt(); return; }
    const o = put(c, p, held.it); held = o ? { it: o, from: c, pos: p } : null; lastPick = null; if (c === 'furn') S.furnIn(); else S.gear(); }
  infoIt = held ? held.it : at(c, p); save(); render();
}
// quick move: 装备 panel equips / takes off; 背包 panel moves between bag and furnace
function quick(c, p) {
  if (held) return; const it = at(c, p); if (!it) return;
  if (c === 'bag' && mode === 'doll') { const s = it.slot === 'w' ? 'w' : 'a'; if (!fitsSlot(it, s)) { cantUse(it, s); return; }
    take('bag', p); if (s === 'w' && !freeOffHand(it)) { it.pos = p; G.bag.push(it); return; } const o = setGear(selEn, s, it); if (o) { if (G.bag.some(i => i.pos === p)) bagPut(o); else { o.pos = p; G.bag.push(o); } } S.gear(); }
  else if (c === 'bag') { if (it.uniq) { noSmelt(); return; } const fp = furnFree(); if (fp < 0) { message(tr('熔炉放满了', 'The forge is full')); return; } take('bag', p); it.fpos = fp; G.furn.push(it); S.furnIn(); }
  else { if (bagFree() < 0) { message(tr('背包满了', 'Bag is full')); return; } bagPut(take(c, p)); S.gear(); }
  infoIt = null; save(); render();
}
// auto-fill: the qualities ticked under the forge (普通 and 精良 unless changed; kept in this browser), the lowest first — and among
// equals, those that would be an upgrade for a summon (or the Sentinel) go in last; tech weapons never (they can't be smelted)
const AUTO_KEY = 'graveTamerForgeQ';
let autoQ = (() => { try { const v = JSON.parse(localStorage.getItem(AUTO_KEY)); if (Array.isArray(v)) return new Set(v); } catch (e) {} return new Set([0, 1]); })();
const autoSave = () => { try { localStorage.setItem(AUTO_KEY, JSON.stringify([...autoQ])); } catch (e) {} };
function autoFill() {
  const upgrade = it => it.hero ? itemScore(it) > itemScore(G.pact.gear?.[it.slot]) + 0.5
    : G.crypt.some(en => (it.slot === 'a' || it.type === en.type) && itemScore(it) > itemScore(en.gear?.[it.slot === 'w' ? 'w' : 'a']) + 0.5);
  const cand = G.bag.filter(it => autoQ.has(it.q) && !it.uniq).sort((a, b) => a.q - b.q || (upgrade(a) - upgrade(b)) || itemScore(a) - itemScore(b));
  let n = 0; for (const it of cand) { const fp = furnFree(); if (fp < 0) break; G.bag.splice(G.bag.indexOf(it), 1); it.fpos = fp; G.furn.push(it); n++; }
  if (n) S.furnIn(); else message(fp0() < 0 ? tr('熔炉已经满了', 'The forge is full') : autoQ.size ? tr('背包里没有勾选品质的装备', 'Nothing of the ticked qualities in the bag') : tr('先在熔炉下面勾选要自动放入的品质', 'Tick the qualities to auto-fill under the forge first')); save(); render();
}
// the quality ticks under the forge buttons
const autoRow = () => `<div class="gfQ"><span>${tr('自动放入：', 'Auto-fill:')}</span>` + QUAL.slice(0, PACT ? 5 : 4).map((q, i) => `<button class="gfQb${autoQ.has(i) ? ' on' : ''}" data-aq="${i}" style="--qc:${q.col}"><i></i>${q.name}</button>`).join('') + `</div>`;
const fp0 = () => furnFree();
function emptyFurn() { for (const it of G.furn.slice()) { if (bagFree() < 0) break; G.furn.splice(G.furn.indexOf(it), 1); bagPut(it); } S.gear(); save(); render(); }

// ---------- DOM ----------
function build() {
  if (built) return; built = true; R = initR(); dollScene = new THREE.Scene(); dollCam = new THREE.PerspectiveCamera(28, 0.8, 0.1, 60);
  const d = document.createElement('div'); d.id = 'gearP';
  d.innerHTML = `<div id="gearBox" class="panel"><button class="btn" id="gearX">✖</button><div class="gTitle"><span id="gT"></span> <span class="sub" id="gSub"></span></div>
    <div class="gMain"><div class="gLeft" id="gLeft"></div><div class="gRight"><div class="gLab">${tr('背包', 'Bag')}</div><div class="gGrid gBag" id="gBag"></div></div><div class="gSide" id="gSide"></div></div>
    <div class="gInfo" id="gInfo"></div><div id="gHeld"></div></div>`;
  document.body.appendChild(d);
  d.addEventListener('pointerdown', e => { if (e.target.id === 'gearP' || e.target.id === 'gearX') closeGear(); });
  d.addEventListener('pointermove', e => { const hd = $('#gHeld'); if (held && e.pointerType === 'mouse') { hd.style.left = e.clientX + 'px'; hd.style.top = e.clientY + 'px'; } });
  d.addEventListener('contextmenu', e => { e.preventDefault(); const el = e.target.closest('.cell, .gSlot'); if (el) quick(el.dataset.c, +el.dataset.p || 0); });
  d.addEventListener('pointerdown', e => { lastPT = e.pointerType || null; }, true);
  d.addEventListener('click', e => { const qa = e.target.closest('[data-qa]');
    if (qa) { e.stopPropagation(); const s = tsel; tsel = null; if (qa.dataset.qa === 'go' && s) quick(s.c, s.p); else render(); return; }
    const el = e.target.closest('.cell, .gSlot'); if (!el) return; e.stopPropagation(); clickCell(el.dataset.c, +el.dataset.p || 0); });
  d.addEventListener('pointerover', e => { if (e.pointerType !== 'mouse' || held) return; const el = e.target.closest('.cell, .gSlot'), it = el ? at(el.dataset.c, +el.dataset.p || 0) : null; if (it !== infoIt) { infoIt = it; renderInfo(); } });
}
const cellHTML = (it, c, p, extra = '') => `<div class="cell${it ? ' q' + it.q : ''}${tsel && it && tsel.c === c && tsel.p === p ? ' sel' : ''}${it && c === 'bag' && freshIds.has(it.id) ? ' fresh' : ''}${extra}" data-c="${c}" data-p="${p}">${it ? `<img src="${iconOf(it)}" draggable="false">` : ''}</div>`;
export function render() {
  if (!gearOpen) return; const en = selEn, doll = mode === 'doll' && en;
  $('#gearBox').className = 'panel ' + (doll ? 'mDoll' : 'mBag');
  $('#gT').textContent = doll ? tr('装备', 'Equipment') : tr('背包', 'Bag'); $('#gSub').innerHTML = `${tr('背包', 'Bag')} ${G.bag.length} / ${BAG_MAX}`
    + (PACT ? ` <button class="btn gSw" id="gSw">${doll ? tr('🔥 熔炉', '🔥 Forge') : tr('⚔ 装备卫士', '⚔ Equip')}</button>` : '');
  if (PACT) $('#gSw').onclick = e => { e.stopPropagation(); returnHeld(); doll ? openBag() : openGear(heroEntry()); };
  if (doll) {
    const o = { kind: en.type, side: 'ally', level: en.level, mods: en.mods, champ: en.champ, entry: en, T: TYPES[en.type] }; Unit.prototype.stats.call(o);
    if (!$('#gDoll')) $('#gLeft').innerHTML = `<div class="gDollRow"><div class="gSlot" data-c="w" data-p="0"></div><div id="gDoll"></div><div class="gSlot" data-c="a" data-p="0"></div></div><div class="gStats" id="gStats"></div>`;
    for (const el of document.querySelectorAll('.gSlot')) { const c = el.dataset.c, it = en.gear ? en.gear[c] : null, ok = held && fitsSlot(held.it, c);
      const lock = c === 'a' && twoHanded(en), sl = tsel && tsel.c === c && it, tok = tsel && !sl && at(tsel.c, tsel.p) && fitsSlot(at(tsel.c, tsel.p), c);
      el.className = 'gSlot' + (it ? ' q' + it.q : '') + (lock ? ' lock' : '') + (sl ? ' sel' : '') + (held ? ok ? ' can' : ' no' : tsel && !sl ? tok ? ' can' : ' no' : '');
      el.innerHTML = it ? `<img src="${iconOf(it)}" draggable="false">` : `<span>${c === 'w' ? (en.hero ? tr('武器', 'Weapon') : WEAPONS[en.type].cat) : lock ? tr('双手武器', 'Two hands') : tr('盾', 'Shield')}</span>`; }
    $('#gStats').innerHTML = (en.hero ? `<div class="gsN">${SETS[en.wset].icon} ${heroName()} <small style="white-space:nowrap">Lv ${en.level} · ${SETS[en.wset].name}</small></div>`
      : `<div class="gsN">${portrait(en, 'sm')}${en.champ ? `<span style="color:#ffb347">${affixName(en.mods)}</span>` : ''}${techName(en)} <small style="white-space:nowrap">Lv ${en.level}${en.active ? tr(' · 出战中', ' · in party') : ''}</small></div>`)
      + `<div class="gsL"><span>${tr('生命', 'Life')} <b>${Math.round(o.maxHp)}</b></span><span>${tr('伤害', 'Damage')} <b>${o.dmg.toFixed(1)}</b></span><span>${tr('护甲', 'Armour')} <b>${Math.round(o.armor)}</b></span><span>${tr('攻击间隔', 'Interval')} <b>${o.cd.toFixed(2)}s</b></span>`
      + (en.hero ? `<span>${tr('闪避', 'Evasion')} <b>${Math.round(o.evade * 100)}%</b></span><span>${tr('暴击', 'Crit')} <b>${Math.round(o.crit * 100)}%</b></span>${o.leechB ? `<span>${tr('吸血', 'Life steal')} <b>${Math.round(o.leechB * 100)}%</b></span>` : ''}${o.blockB ? `<span>${tr('格挡 / 招架', 'Block / parry')} <b>+${Math.round(o.blockB * 100)}%</b></span>` : ''}` : '') + `</div>`
      + (en.hero ? `<div id="gsFw">${furyBrief()}</div>` : '');
    $('#gSide').innerHTML = '';
  } else {
    $('#gLeft').innerHTML = '';
    if (!$('#gF')) $('#gSide').innerHTML = `<div class="gFurn"><div class="gfT">🔥 ${tr('熔炉', 'Forge')}</div><div class="gfD">${tr('丢进 2 件以上，熔出 1 件随机装备。丢得越多、品质越好，出好东西的几率越大。', 'Put in 2 or more items to smelt them into one random item. More and better input, better odds.')}</div>
      <div class="gGrid gF" id="gF"></div><div class="gfOdds" id="gfOdds"></div><div class="gfB"><button class="btn gAuto" id="gAuto">${tr('自动放入', 'Auto-fill')}</button><button class="btn" id="gEmpty">${tr('全部取出', 'Take all')}</button></div><div id="gfQw">${autoRow()}</div><button class="btn gGo" id="gGo">${tr('熔炼', 'Smelt')}</button></div>`;
    $('#gAuto').onclick = e => { e.stopPropagation(); autoFill(); };
    $('#gfQw').onclick = e => { const b = e.target.closest('[data-aq]'); if (!b) return; e.stopPropagation(); const q = +b.dataset.aq; if (autoQ.has(q)) autoQ.delete(q); else autoQ.add(q); autoSave(); $('#gfQw').innerHTML = autoRow(); S.pick(); }; $('#gEmpty').onclick = e => { e.stopPropagation(); emptyFurn(); }; $('#gGo').onclick = e => { e.stopPropagation(); smelt(); };
    let h = ''; for (let p = 0; p < FURN_N; p++) h += cellHTML(at('furn', p), 'furn', p); $('#gF').innerHTML = h;
    const od = furnaceOdds(G.furn, G.techPity || 0), pc = v => Math.round(v * 100) + '%', pity = G.techPity || 0;
    if (PACT) { const ho = heroFurnaceOdds(G.furn), row = (q, v) => v > 0.004 ? `<span style="color:${QUAL[q].col}">${QUAL[q].name} ${pc(v)}</span>` : ''; // 魂契: the Sentinel's gear comes out, red possible; no tech pity
      $('#gfOdds').innerHTML = G.furn.length ? row(4, ho.red) + row(3, ho.pur) + row(2, ho.gold) + row(1, ho.blue) + row(0, ho.white) : `<span class="dim">${tr('放进装备后显示几率', 'Odds show once items are in')}</span>`; }
    else $('#gfOdds').innerHTML = (G.furn.length ? (od.epic ? `<span style="color:${QUAL[3].col}">${QUAL[3].name} ${pc(od.epic)}</span>` : '') + `<span style="color:${QUAL[2].col}">${QUAL[2].name} ${pc(od.gold)}</span><span style="color:${QUAL[1].col}">${QUAL[1].name} ${pc(od.blue)}</span><span style="color:${QUAL[0].col}">${QUAL[0].name} ${pc(od.white)}</span>` : `<span class="dim">${tr('放进装备后显示几率', 'Odds show once items are in')}</span>`)
      + (PACT ? '' : `<div class="gfPity" title="${tr('熔炼稀有装备（武器或盾牌）积累魂钢能量，满了必出史诗科技武器；出哪一把看放进去的武器', 'Smelting rare gear (weapons or shields) builds up soul steel; when it is full an epic tech weapon is guaranteed')}"><i style="width:${Math.min(100, pity / TECH_PITY * 100)}%"></i><span>${tr('魂钢能量', 'Soul steel')} ${pity}/${TECH_PITY}</span></div>`);
    $('#gGo').disabled = G.furn.length < 2; $('#gEmpty').disabled = !G.furn.length;
  }
  setDoll();
  let h = ''; for (let p = 0; p < BAG_MAX; p++) { const it = at('bag', p), fit = !it || !doll || fitsSlot(it, it.slot === 'w' ? 'w' : 'a'); h += cellHTML(it, 'bag', p, fit ? '' : ' nofit'); } $('#gBag').innerHTML = h;
  const hd = $('#gHeld'); hd.style.display = held && !touchUI ? 'block' : 'none'; if (held) hd.innerHTML = `<img src="${iconOf(held.it)}">`;
  renderInfo();
}
// the fixed info box: held item, else hovered item, else a hint
function renderInfo() {
  const it = held ? held.it : tsel ? at(tsel.c, tsel.p) : infoIt, box = $('#gInfo'); if (!box) return;
  const hint = mode === 'doll' ? (tapMode() ? tr('点装备选中（高亮），再点武器框 / 盾框或空格子移过去　·　双击：一键穿上', 'Tap an item to select it, then tap a frame or an empty cell to move it there · double-tap: equip') : tr('点装备拿起，再点武器框 / 盾框或格子放下　·　右键或双击：一键穿上 / 卸下', 'Click an item to pick it up, click a frame or cell to put it down · right-click or double-click: equip / take off'))
    : (tapMode() ? tr('点装备选中（高亮），再点空格子或熔炉移过去　·　双击：放进熔炉 / 拿回背包', 'Tap an item to select it, then tap an empty cell or the forge to move it there · double-tap: into / out of the forge') : tr('点装备拿起，再点格子或熔炉放下　·　右键或双击：放进熔炉 / 拿回背包', 'Click an item to pick it up, click a cell or the forge to put it down · right-click or double-click: into / out of the forge'));
  const ts = tsel && at(tsel.c, tsel.p), act = !ts ? '' : mode === 'doll' ? (tsel.c === 'bag' ? (fitsSlot(ts, ts.slot === 'w' ? 'w' : 'a') ? tr('穿上', 'Equip') : '') : tsel.c === 'furn' ? '' : tr('卸下', 'Take off'))
    : tsel.c === 'bag' ? (ts.uniq ? '' : tr('放进熔炉', 'Into the forge')) : tr('拿回背包', 'Back to the bag');
  box.innerHTML = it ? `<div class="gi"><div class="giIc q${it.q}"><img src="${iconOf(it)}"></div>${tipHTML(it)}${held ? `<div class="giH">${tr('拿在手上', 'Holding')}</div>` : ''}`
    + (ts ? `<div class="giA">${act ? `<button class="btn go" data-qa="go">${act}</button>` : ''}<button class="btn" data-qa="x">${tr('取消', 'Cancel')}</button></div>` : '') + `</div>` : `<div class="gi empty"><div class="hint">${hint}</div></div>`;
}
// Diablo-style item text
function tipHTML(it) {
  const B = itemBase(it), en = mode === 'doll' ? selEn : null, fit = !en || fitsSlot(it, it.slot === 'w' ? 'w' : 'a'), cur = en && en.gear ? en.gear[it.slot === 'w' ? 'w' : 'a'] : null;
  const isCur = cur === it, sc = itemScore(it), cs = itemScore(cur);
  const cmp = !en || isCur || !fit ? '' : !cur ? `<span class="tC up">${tr(`${en.hero ? heroName() : TYPES[en.type].name}现在没穿`, 'Slot is empty')}</span>` : sc > cs + 0.5 ? `<span class="tC up">${tr('▲ 比现在的强', '▲ Better than current')}</span>` : sc < cs - 0.5 ? `<span class="tC dn">${tr('▼ 不如现在的', '▼ Worse than current')}</span>` : `<span class="tC">${tr('与现在的差不多', 'About the same')}</span>`;
  return `<div class="tip"><div class="tN" style="color:${QUAL[it.q].col}">${itemName(it)} <span class="tI">${tr('物品等级', 'Item Level')} ${it.il}</span></div>
    <div class="tB">${it.hero ? `${B.cat} · ${B.name}` : it.slot === 'w' ? `${B.cat || WEAPONS[it.type].cat} · ${B.name}` : `${tr('护甲', 'Armour')} · ${B.name}`}　${it.hero ? `<span class="tR${fit ? '' : ' bad'}">${tr(`${heroName()}专用`, `${heroName()} only`)}</span>` : it.slot === 'w' ? `<span class="tR${fit ? '' : ' bad'}">${tr(`${TYPES[it.type].name}专用`, `${TYPES[it.type].name} only`)}</span>` : `<span class="tR">${tr('所有召唤物', 'Any summon')}</span>`}　${isCur ? `<span class="tC">${tr('正在穿着', 'Equipped')}</span>` : cmp}</div>
    <div class="tLs">${itemLines(it).map(l => `<span class="tL${l[0] === '✦' ? ' sp' : ''}">${l}</span>`).join('')}</div></div>`;
}

// ---------- furnace ----------
function smelt() {
  if (G.furn.length < 2 || held) return; const pity = G.techPity || 0, nr = rareItems(G.furn), odds = furnaceOdds(G.furn, pity), ho = PACT && heroFurnaceOdds(G.furn), res = PACT ? heroFurnaceRoll(G.furn, G.uid++) : furnaceRoll(G.furn, G.uid++, pity);
  if (!PACT) G.techPity = res.q === 3 ? 0 : Math.min(TECH_PITY, pity + nr); G.furn = [res]; res.fpos = 0; pending = res; save(); S.draw();
  const box = document.createElement('div'); box.className = 'gReel'; box.innerHTML = `<div class="lt">${tr('炉火翻滚……', 'The forge roars…')}</div><div class="reel"></div><button class="btn ok" style="visibility:hidden">${tr('收下', 'Take it')}</button>`;
  $('.gFurn').appendChild(box); const reel = box.querySelector('.reel'); let dly = 45;
  const show = it => { reel.innerHTML = `<div class="ri q${it.q}"><img src="${iconOf(it)}"><div class="tN" style="color:${QUAL[it.q].col}">${itemName(it)}</div></div>`; };
  const tick = () => { if (!gearOpen || !box.isConnected) return; if (dly > 300) { show(res); reel.classList.add('done', 'q' + res.q); box.querySelector('.lt').textContent = res.q === 4 ? tr('🔥 熔出了传说装备！', '🔥 A legendary item!') : res.q === 3 ? (res.hero ? tr('🌟 熔出了史诗装备！', '🌟 An epic item!') : tr('🌟 熔出了史诗科技武器！', '🌟 An epic tech weapon!')) : res.q === 2 ? tr('✨ 熔出了稀有装备！', '✨ A rare item!') : res.q === 1 ? tr('熔出了精良装备', 'A magic item') : tr('熔出了一件普通装备', 'A normal item');
      box.querySelector('.ok').style.visibility = 'visible'; collect(); infoIt = res; render(); if (res.q >= 2) S.level(); else if (res.q === 1) S.caught(); else S.pick(); return; }
    const r = Math.random(); show(PACT ? rollHeroItem(0, res.il, heroOddsQ(ho, r)) : rollItem(0, res.il, r < odds.epic + odds.gold ? 2 : r < odds.epic + odds.gold + odds.blue ? 1 : 0)); dly *= 1.13; setTimeout(tick, dly); };
  tick(); box.querySelector('.ok').addEventListener('click', e => { e.stopPropagation(); box.remove(); render(); });
  render();
}
// the smelted item goes straight into the bag once revealed (it stays in the forge only if the bag is full)
let pending = null; const freshIds = new Set(); // freshly smelted items glow in the bag until the panel closes
function collect() {
  const it = pending; pending = null; if (!it || !G.furn.includes(it)) return;
  if (bagFree() < 0) { message(tr('背包满了，熔出的装备留在熔炉里', 'Bag is full — the new item stays in the forge')); return; }
  G.furn.splice(G.furn.indexOf(it), 1); delete it.fpos; bagPut(it); freshIds.add(it.id); save();
}

// ---------- open / close ----------
function open(m, en) {
  closeCrypt(); build(); if (gearOpen) returnHeld(); tsel = null; briefT = 0; gearOpen = true; mode = m; selEn = en || null; infoIt = null; $('#gearP').classList.add('open');
  $('#gLeft').innerHTML = ''; $('#gSide').innerHTML = ''; dollKey = ''; render(); last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
export function openGear(en) { if (!en) return; open('doll', en); }
export function openBag() { open('bag', null); }
export function closeGear() { if (!gearOpen) return; returnHeld(); collect(); freshIds.clear(); save(); gearOpen = false; const p = $('#gearP'); if (p) p.classList.remove('open'); cancelAnimationFrame(raf); for (const r of document.querySelectorAll('.gReel')) r.remove(); }
export function toggleBag() { gearOpen && mode === 'bag' ? closeGear() : openBag(); }
export const toggleGear = toggleBag;
